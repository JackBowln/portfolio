// AI translation jobs (F09-T3, ADR-0009 §6, RF-11.1/11.3). Estimating segments the pt-BR copy, prices it and records
// an `estimated` job; running needs that estimate (fresh, from the same source) and an explicit confirmation. Each
// request translates up to 20 batches of ~3,000 tokens; the cost guard checks every batch against the ledger
// BEFORE the provider is called. Batches done are kept on the job, so a failure (or the 20-call limit) resumes where
// it stopped. When every segment is done, the target copy is written as `machine`: nothing is published, a person
// reviews it (F09-T4). Only content fields are sent (source.ts)
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { withoutTerms } from '../../../shared/content/inline-tags.ts'
import type { ProtectedTerm, TaggedText } from '../../../shared/content/inline-tags.ts'
import type { Segment } from '../../../shared/content/segmenter.ts'
import type { AiModel } from '../../../shared/translation/models.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { translationJobs } from '../../db/schema/translation.ts'
import { createAppError } from '../../utils/errors.ts'
import { aiTranslationSettings } from '../settings/settings.service.ts'
import { checkCost, batches, utcWindows } from './cost-guard.ts'
import type { GuardRefusal } from './cost-guard.ts'
import { glossaryFor } from './glossary.service.ts'
import type { TranslationProvider, TranslationRequest } from './providers/types.ts'
import { ProviderError, tokensOf } from './providers/types.ts'
import { segmentSource } from './source.ts'
import { loadSource, reviewTexts, topOf, writeTranslation } from './target.ts'
import { textsSubject } from './texts.service.ts'
import type { LoadedSource, TranslatableType } from './target.ts'

export type { TranslatableType } from './target.ts'

/** How long an estimate stays good for running (RF-11.3: the person confirms what they just saw) */
export const ESTIMATE_TTL_MS = 15 * 60 * 1000
const MAX_CALLS_PER_REQUEST = 20
const BATCH_TOKENS = 3000

export interface RunDeps {
  /** The provider for the configured model; the route picks Workers AI, or the fake in the test build */
  provider: (model: AiModel) => TranslationProvider
  now?: () => Date
}

type JobRow = typeof translationJobs.$inferSelect

export interface JobView {
  id: string
  entityType: JobEntityType
  entityId: string
  locale: Locale
  status: JobRow['status']
  model: string
  segmentsTotal: number
  segmentsDone: number
  estimate: { inputTokens: number, outputTokens: number, neurons: number, costMicroUsd: number }
  usage: { inputTokens: number, outputTokens: number, neurons: number, costMicroUsd: number, estimated: boolean }
  failedSegments: string[]
  error: string | null
  createdAt: string
}

const viewOf = (row: JobRow): JobView => ({
  id: row.id,
  entityType: row.entityType,
  entityId: row.entityId,
  locale: row.targetLocale,
  status: row.status,
  model: row.model,
  segmentsTotal: row.segmentsTotal,
  segmentsDone: row.segmentsDone,
  estimate: { inputTokens: row.estimatedInputTokens, outputTokens: row.estimatedOutputTokens, neurons: row.estimatedNeurons, costMicroUsd: row.estimatedCostMicroUsd },
  usage: { inputTokens: row.inputTokens, outputTokens: row.outputTokens, neurons: row.neurons, costMicroUsd: row.costMicroUsd, estimated: row.usageEstimated },
  failedSegments: row.results.failed,
  error: row.error,
  createdAt: row.createdAt.toISOString(),
})

const refused = (path: string, message: string) => createAppError('conflict', 'Cannot translate', [{ path, message }])

/**
 * A whole translation is written only where nothing human would be lost: no translation yet, or a machine one. Any
 * existing translation can have chosen segments retranslated (F09-T4): the rest of it is kept, and it goes to review
 */
function assertTargetFree(source: LoadedSource, partial: boolean): void {
  const state = source.target?.translationState
  if (partial) {
    if (!source.target) {
      throw refused('locale', 'translation_missing')
    }
    return
  }
  if (state !== undefined && state !== 'missing' && state !== 'machine') {
    throw refused('locale', `translation_${state}`)
  }
}

async function ledger(db: Db, now: Date): Promise<{ todayNeurons: number, monthCostMicroUsd: number, monthNeurons: number }> {
  const { day, month } = utcWindows(now)
  const at = sql`coalesce(${translationJobs.startedAt}, ${translationJobs.createdAt})`
  const sums = (from: number, to: number) => db.select({
    neurons: sql<number>`coalesce(sum(${translationJobs.neurons}), 0)`.mapWith(Number),
    cost: sql<number>`coalesce(sum(${translationJobs.costMicroUsd}), 0)`.mapWith(Number),
  }).from(translationJobs).where(and(gte(at, from), lt(at, to)))
  const [today, thisMonth] = await db.batch([sums(day[0], day[1]), sums(month[0], month[1])])
  return { todayNeurons: today[0]?.neurons ?? 0, monthCostMicroUsd: thisMonth[0]?.cost ?? 0, monthNeurons: thisMonth[0]?.neurons ?? 0 }
}

/** What the dashboard shows: today's neurons against the cap, and this month's (UTC) */
export async function translationUsage(db: Db, now = new Date()) {
  const [settings, used] = await Promise.all([aiTranslationSettings(db), ledger(db, now)])
  return {
    enabled: settings.enabled && settings.model !== '',
    model: settings.model,
    today: { neurons: used.todayNeurons, cap: settings.dailyNeuronCap },
    month: { neurons: used.monthNeurons, costMicroUsd: used.monthCostMicroUsd, budgetMicroUsd: settings.monthlyBudgetMicroUsd },
  }
}

function requestFor(locale: Locale, settings: Awaited<ReturnType<typeof aiTranslationSettings>>, glossary: { term: string, translation: string }[]) {
  const style = settings.style[locale as 'en']
  return (segments: TranslationRequest['segments']): TranslationRequest => ({ targetLocale: locale, segments, glossary, formality: style.formality, notes: style.notes })
}

/**
 * What a job translates (F09-T5): a content item in a locale, or a batch of short texts. Both segment with the
 * glossary's protected terms, are fingerprinted (a change after the estimate stops the job), and write their own result
 */
export interface JobSubject {
  sourceHash: string
  segments: Segment[]
  accepts: (id: string, text: string) => boolean
  taggedOf: (id: string) => TaggedText | undefined
  /** Writes the review texts of the segments done (a failed one has none) */
  finish: (texts: Record<string, string>, scope: string[] | undefined, userId: string | null) => Promise<void>
}

export type JobEntityType = TranslatableType | 'texts'

async function contentSubject(db: Db, type: TranslatableType, entityId: string, locale: Locale, terms: ProtectedTerm[], partial: boolean): Promise<JobSubject> {
  const source = await loadSource(db, type, entityId, locale)
  assertTargetFree(source, partial)
  const segmented = segmentSource(type, source.copy, terms)
  return {
    sourceHash: source.copy.workingHash,
    segments: segmented.segments,
    accepts: segmented.accepts,
    taggedOf: segmented.taggedOf,
    finish: async (translated, scope, userId) => {
      const all = segmented.segments
      const inScope = scope ? all.filter(segment => scope.includes(segment.id)) : all
      await writeTranslation(db, source, locale, {
        // Over what the translation already had, for a partial job
        texts: { ...(scope ? reviewTexts(source) : {}), ...translated },
        // A whole job makes a machine copy; retranslating part of a reviewed one sends it back to review
        state: scope ? 'in_review' : 'machine',
        touched: new Set(inScope.map(segment => topOf(segment.id))),
        touchedState: 'machine',
        userId,
        kind: 'ai',
      })
    },
  }
}

/** `scope`: the segments asked for, when not all of them */
function loadSubject(db: Db, type: JobEntityType, entityId: string, locale: Locale, terms: ProtectedTerm[], scope: string[] | undefined): Promise<JobSubject> {
  return type === 'texts' ? textsSubject(db, locale, terms, scope) : contentSubject(db, type, entityId, locale, terms, scope !== undefined)
}

/** Segments and prices a translation, and records the estimate; the person then confirms it to run */
export async function estimateTranslation(db: Db, deps: RunDeps, userId: string, input: { entityType: JobEntityType, entityId: string, locale: Locale, segmentIds?: string[] | undefined }): Promise<JobView & { blocked: GuardRefusal | null }> {
  const now = deps.now?.() ?? new Date()
  const settings = await aiTranslationSettings(db)
  const partial = input.segmentIds !== undefined
  const glossary = await glossaryFor(db, input.locale)
  const subject = await loadSubject(db, input.entityType, input.entityId, input.locale, glossary.protected, input.segmentIds)
  // A partial job (F09-T4) retranslates only the segments asked for, and every one must exist in the source
  const segments = partial ? subject.segments.filter(segment => input.segmentIds!.includes(segment.id)) : subject.segments
  if (partial && segments.length !== new Set(input.segmentIds).size) {
    throw createAppError('bad_request', 'Invalid input', [{ path: 'segmentIds', message: 'unknown_segment' }])
  }
  if (segments.length === 0) {
    throw refused('source', 'empty')
  }
  const model = (settings.model || 'fake') as AiModel
  const provider = deps.provider(model)
  const request = requestFor(input.locale, settings, glossary.translations)
  const estimate = batches(segments, segment => tokensOf(segment.text), BATCH_TOKENS)
    .map(batch => provider.estimate(request(batch)))
    .reduce((sum, item) => ({ inputTokens: sum.inputTokens + item.inputTokens, outputTokens: sum.outputTokens + item.outputTokens, neurons: sum.neurons + item.neurons, costMicroUsd: sum.costMicroUsd + item.costMicroUsd }), { inputTokens: 0, outputTokens: 0, neurons: 0, costMicroUsd: 0 })
  const used = await ledger(db, now)
  const verdict = checkCost({ settings, usedToday: { neurons: used.todayNeurons }, usedThisMonth: { costMicroUsd: used.monthCostMicroUsd }, job: { neurons: 0, costMicroUsd: 0 }, batch: estimate })
  const [row] = await db.insert(translationJobs).values({
    id: uuidv7(),
    entityType: input.entityType,
    entityId: input.entityId,
    targetLocale: input.locale,
    sourceHash: subject.sourceHash,
    provider: provider.id,
    model: provider.model,
    segmentsTotal: segments.length,
    estimatedInputTokens: estimate.inputTokens,
    estimatedOutputTokens: estimate.outputTokens,
    estimatedNeurons: estimate.neurons,
    estimatedCostMicroUsd: estimate.costMicroUsd,
    results: { done: {}, failed: [], ...(partial ? { scope: segments.map(segment => segment.id) } : {}) },
    requestedBy: userId,
    createdAt: now,
  }).returning()
  return { ...viewOf(row!), blocked: verdict.ok ? null : verdict.reason }
}

export async function getTranslationJob(db: Db, id: string): Promise<JobView> {
  const [row] = await db.select().from(translationJobs).where(eq(translationJobs.id, id))
  if (!row) {
    throw createAppError('not_found')
  }
  return viewOf(row)
}

const sanitized = (error: unknown) => (error instanceof ProviderError ? `${error.code}: ${error.message}` : 'internal: the translation stopped unexpectedly')

/**
 * Runs (or resumes) a job. Throws 409 when the estimate is stale, the source changed, the job is over, or the cost
 * guard refuses the next batch (the job is then `failed` with the reason, and nothing was sent)
 */
export async function runTranslation(db: Db, deps: RunDeps, jobId: string): Promise<JobView> {
  const now = () => deps.now?.() ?? new Date()
  const [job] = await db.select().from(translationJobs).where(eq(translationJobs.id, jobId))
  if (!job) {
    throw createAppError('not_found')
  }
  if (job.status === 'succeeded' || job.status === 'cancelled') {
    throw refused('status', job.status)
  }
  if (job.status === 'estimated' && now().getTime() - job.createdAt.getTime() > ESTIMATE_TTL_MS) {
    throw refused('estimate', 'stale')
  }
  const scope = job.results.scope
  const settings = await aiTranslationSettings(db)
  const glossary = await glossaryFor(db, job.targetLocale)
  const segmented = await loadSubject(db, job.entityType, job.entityId, job.targetLocale, glossary.protected, scope)
  if (segmented.sourceHash !== job.sourceHash) {
    await db.update(translationJobs).set({ status: 'cancelled', error: 'source_changed: the original changed after the estimate', finishedAt: now() }).where(eq(translationJobs.id, job.id))
    throw refused('source', 'changed')
  }
  const provider = deps.provider((settings.model || 'fake') as AiModel)
  const request = requestFor(job.targetLocale, settings, glossary.translations)
  const results = structuredClone(job.results)
  const inScope = scope ? segmented.segments.filter(segment => scope.includes(segment.id)) : segmented.segments
  const pending = inScope.filter(segment => !(segment.id in results.done) && !results.failed.includes(segment.id))
  let state: JobRow = { ...job, results, status: 'running', error: null, startedAt: job.startedAt ?? now() }

  const save = async (changes: Partial<JobRow>) => {
    const next = { ...state, ...changes }
    // Guarded by the progress read: a second run of the same job in parallel stops instead of writing over this one
    const written = await db.update(translationJobs).set({
      status: next.status,
      segmentsDone: next.segmentsDone,
      inputTokens: next.inputTokens,
      outputTokens: next.outputTokens,
      neurons: next.neurons,
      costMicroUsd: next.costMicroUsd,
      usageEstimated: next.usageEstimated,
      results: next.results,
      error: next.error,
      startedAt: next.startedAt,
      finishedAt: next.finishedAt,
    }).where(and(eq(translationJobs.id, job.id), eq(translationJobs.segmentsDone, state.segmentsDone))).returning({ id: translationJobs.id })
    if (written.length === 0) {
      throw refused('status', 'running_elsewhere')
    }
    state = next
  }

  let calls = 0
  for (const batch of batches(pending, segment => tokensOf(segment.text), BATCH_TOKENS)) {
    if (calls >= MAX_CALLS_PER_REQUEST) {
      break
    }
    const planned = provider.estimate(request(batch))
    const used = await ledger(db, now())
    const verdict = checkCost({ settings, usedToday: { neurons: used.todayNeurons }, usedThisMonth: { costMicroUsd: used.monthCostMicroUsd }, job: { neurons: state.neurons, costMicroUsd: state.costMicroUsd }, batch: planned })
    if (!verdict.ok) {
      await save({ status: 'failed', error: `cost_guard: ${verdict.reason}` })
      throw refused('cost', verdict.reason)
    }
    calls++
    let answer
    try {
      answer = await provider.translate(request(batch))
    }
    catch (error) {
      await save({ status: 'failed', error: sanitized(error) })
      return viewOf(state)
    }
    const returned = new Map(answer.segments.map(segment => [segment.id, segment.text]))
    for (const segment of batch) {
      const text = returned.get(segment.id)
      if (text !== undefined && segmented.accepts(segment.id, text)) {
        results.done[segment.id] = text
      }
      else {
        // A missing or broken segment keeps its source in the copy, flagged for the review
        results.failed.push(segment.id)
      }
    }
    await save({
      results,
      segmentsDone: state.segmentsDone + batch.length,
      inputTokens: state.inputTokens + answer.usage.inputTokens,
      outputTokens: state.outputTokens + answer.usage.outputTokens,
      neurons: state.neurons + answer.usage.neurons,
      costMicroUsd: state.costMicroUsd + answer.usage.costMicroUsd,
      usageEstimated: state.usageEstimated || answer.usage.estimated,
    })
  }

  if (state.segmentsDone < inScope.length) {
    return viewOf(state)
  }
  // The model's texts as review text, over what the translation already had for a partial job
  const translated = Object.fromEntries(Object.entries(results.done).map(([id, text]) => [id, withoutTerms(text, segmented.taggedOf(id)!)]))
  // A failed segment has no text: it keeps the source and stays `missing` until someone translates it
  await segmented.finish(Object.fromEntries(Object.entries(translated).filter(([id]) => !results.failed.includes(id))), scope, job.requestedBy)
  await save({ status: 'succeeded', finishedAt: now() })
  return viewOf(state)
}
