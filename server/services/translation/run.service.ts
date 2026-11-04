// AI translation jobs (F09-T3, ADR-0009 §6, RF-11.1/11.3). Estimating segments the pt-BR copy, prices it and records
// an `estimated` job; running needs that estimate (fresh, from the same source) and an explicit confirmation. Each
// request translates up to 20 batches of ~3,000 tokens; the cost guard checks every batch against the ledger
// BEFORE the provider is called. Batches done are kept on the job, so a failure (or the 20-call limit) resumes where
// it stopped. When every segment is done, the target copy is written as `machine`: nothing is published, a person
// reviews it (F09-T4). Only content fields are sent (source.ts)
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import type { DocumentJson } from '../../../shared/content/document-schema.ts'
import { deriveDocument } from '../../../shared/content/derive.ts'
import { hashSegments } from '../../../shared/content/segment-hash.ts'
import type { SegmentsMeta } from '../../../shared/content/segment-hash.ts'
import { snapshotOf } from '../../../shared/content/snapshot.ts'
import type { ContentType } from '../../../shared/content/snapshot.ts'
import type { AiModel } from '../../../shared/translation/models.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { pages } from '../../db/schema/content.ts'
import { translationJobs } from '../../db/schema/translation.ts'
import { createAppError } from '../../utils/errors.ts'
import { articleEntity, getArticle } from '../content/articles.service.ts'
import { createLocalization } from '../content/localized.repo.ts'
import { insertPageLocalization } from '../content/pages.repo.ts'
import { getPage } from '../content/pages.service.ts'
import { getProject, projectEntity } from '../content/projects.service.ts'
import { contentTables } from '../content/content-tables.ts'
import type { ContentTables } from '../content/content-tables.ts'
import { freeSlug } from '../content/working-copy.ts'
import { aiTranslationSettings } from '../settings/settings.service.ts'
import { checkCost, batches, utcWindows } from './cost-guard.ts'
import type { GuardRefusal } from './cost-guard.ts'
import { glossaryFor } from './glossary.service.ts'
import type { TranslationProvider, TranslationRequest } from './providers/types.ts'
import { ProviderError, tokensOf } from './providers/types.ts'
import { segmentSource } from './source.ts'
import { contentSegments } from './state.repo.ts'

export type TranslatableType = 'article' | 'project' | 'page'

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
  entityType: TranslatableType
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

interface LoadedSource {
  copy: Record<string, unknown> & { id: string, workingHash: string }
  /** The target copy, when there is one */
  target: (Record<string, unknown> & { id: string, version: number, translationState: string, slug?: string }) | undefined
  entity: object
}

async function loadSource(db: Db, type: TranslatableType, entityId: string, locale: Locale): Promise<LoadedSource> {
  let localizations: { locale: Locale }[]
  let entity: object
  if (type === 'article') {
    const item = await getArticle(db, entityId)
    localizations = item.localizations
    entity = articleEntity(item)
  }
  else if (type === 'project') {
    const item = await getProject(db, entityId)
    localizations = item.localizations
    entity = projectEntity(item)
  }
  else {
    const [row] = await db.select({ key: pages.key }).from(pages).where(eq(pages.id, entityId))
    if (!row) {
      throw createAppError('not_found')
    }
    localizations = (await getPage(db, row.key)).localizations
    entity = {}
  }
  const copy = localizations.find(item => item.locale === SOURCE_LOCALE) as LoadedSource['copy'] | undefined
  if (!copy) {
    throw createAppError('not_found')
  }
  return { copy, target: localizations.find(item => item.locale === locale) as LoadedSource['target'], entity }
}

/**
 * A job may write only where nothing human would be lost: no translation yet, or a machine one. An approved,
 * in-review or outdated copy is retranslated by segment from the review screen (F09-T4, decision 1)
 */
function assertTargetFree(source: LoadedSource): void {
  const state = source.target?.translationState
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

/** Segments and prices a translation, and records the estimate; the person then confirms it to run */
export async function estimateTranslation(db: Db, deps: RunDeps, userId: string, input: { entityType: TranslatableType, entityId: string, locale: Locale }): Promise<JobView & { blocked: GuardRefusal | null }> {
  const now = deps.now?.() ?? new Date()
  const settings = await aiTranslationSettings(db)
  const source = await loadSource(db, input.entityType, input.entityId, input.locale)
  assertTargetFree(source)
  const glossary = await glossaryFor(db, input.locale)
  const { segments } = segmentSource(input.entityType, source.copy, glossary.protected)
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
    sourceHash: source.copy.workingHash,
    provider: provider.id,
    model: provider.model,
    segmentsTotal: segments.length,
    estimatedInputTokens: estimate.inputTokens,
    estimatedOutputTokens: estimate.outputTokens,
    estimatedNeurons: estimate.neurons,
    estimatedCostMicroUsd: estimate.costMicroUsd,
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
  const type = job.entityType
  const source = await loadSource(db, type, job.entityId, job.targetLocale)
  if (source.copy.workingHash !== job.sourceHash) {
    await db.update(translationJobs).set({ status: 'cancelled', error: 'source_changed: the original changed after the estimate', finishedAt: now() }).where(eq(translationJobs.id, job.id))
    throw refused('source', 'changed')
  }
  assertTargetFree(source)

  const settings = await aiTranslationSettings(db)
  const glossary = await glossaryFor(db, job.targetLocale)
  const segmented = segmentSource(type, source.copy, glossary.protected)
  const provider = deps.provider((settings.model || 'fake') as AiModel)
  const request = requestFor(job.targetLocale, settings, glossary.translations)
  const results = structuredClone(job.results)
  const pending = segmented.segments.filter(segment => !(segment.id in results.done) && !results.failed.includes(segment.id))
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

  if (state.segmentsDone < segmented.segments.length) {
    return viewOf(state)
  }
  await writeTarget(db, type, job.targetLocale, source, segmented.rebuild(results.done).values, source.copy)
  await save({ status: 'succeeded', finishedAt: now() })
  return viewOf(state)
}

const tablesOf = (type: ContentType) => contentTables[type] as unknown as ContentTables['article']

/** The translated copy, as `machine`; its segments meta records the source each segment was translated from */
async function writeTarget(db: Db, type: TranslatableType, locale: Locale, source: LoadedSource, values: Record<string, unknown>, copy: Record<string, unknown>): Promise<void> {
  const hashes = await hashSegments(contentSegments(type, copy))
  const segmentsMeta: SegmentsMeta = Object.fromEntries(Object.entries(hashes).map(([id, sourceHash]) => [id, { sourceHash, state: 'machine' as const }]))
  const body = type === 'page' ? undefined : deriveDocument(values.body as DocumentJson, locale)
  const derived = body ? { wordCount: body.wordCount, readingTimeMin: body.readingTimeMin, toc: body.toc } : {}
  const fields = { ...values, ...derived, translationState: 'machine' as const, segmentsMeta, seoTitle: values.seoTitle ?? null, seoDescription: values.seoDescription ?? null }

  if (source.target) {
    const { localizations } = tablesOf(type)
    const next = { ...source.target, ...fields }
    const workingHash = await contentHash(snapshotOf(type, source.entity as never, next))
    const updated = await db.update(localizations).set({ ...fields, workingHash, version: source.target.version + 1 } as never)
      .where(and(eq(localizations.id, source.target.id), eq(localizations.version, source.target.version))).returning({ id: localizations.id })
    if (updated.length === 0) {
      throw refused('version', 'stale')
    }
    return
  }
  if (type === 'page') {
    const row = { id: uuidv7(), pageId: (copy as { pageId: string }).pageId, locale, ...fields }
    await insertPageLocalization(db, { ...row, workingHash: await contentHash(snapshotOf('page', {}, row)) } as never)
    return
  }
  const entityKey = contentTables[type].entityKey
  const slug = await freeSlug(db, type, String(values.title ?? ''), String(copy.slug ?? 'item'), locale)
  await createLocalization(db, type, { [entityKey]: (copy as Record<string, unknown>)[entityKey], locale, slug, ...fields } as never, source.entity as never)
}
