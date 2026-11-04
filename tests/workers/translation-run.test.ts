// F09-T3: AI translation jobs on a real D1, with the fake provider. The estimate records a job; running needs it fresh
// and from the same source; the cost guard stops a job over the balance before any call; the ledger keeps estimated
// and used numbers; a provider failure fails the job with a sanitized error and keeps the batches done, and the next
// run resumes; at most 20 calls per request; the result is a `machine` copy with a valid document, broken segments
// keeping their source; nothing but content reaches the provider
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { siteSettings, translationJobs, users } from '../../server/db/schema'
import { createArticle, getArticle, updateArticle } from '../../server/services/content/articles.service'
import { createLocalization } from '../../server/services/content/localized.repo'
import { publishArticle } from '../../server/services/content/publishing.service'
import { createFakeProvider } from '../../server/services/translation/providers/fake'
import type { FakeOptions } from '../../server/services/translation/providers/fake'
import { ESTIMATE_TTL_MS, estimateTranslation, runTranslation, translationUsage } from '../../server/services/translation/run.service'
import type { DocumentJson } from '../../shared/content/document-schema'
import { documentSchema } from '../../shared/content/document-schema'
import { settingSchemas } from '../../shared/settings/schemas'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const email = `run-${uuidv7()}@example.test`
const [user] = await db.insert(users).values({ name: 'Tradução IA', email }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))

async function aiSettings(changes: Record<string, unknown> = {}) {
  const value = { ...settingSchemas.ai_translation.defaults.global, enabled: true, model: '@cf/qwen/qwen3-30b-a3b-fp8', dailyNeuronCap: 10_000, perJobNeuronCap: 10_000, ...changes }
  await db.insert(siteSettings).values({ key: 'ai_translation', value }).onConflictDoUpdate({ target: siteSettings.key, set: { value } })
}

const body = (paragraphs: number, words = 'Um parágrafo de texto'): DocumentJson => ({
  type: 'doc',
  attrs: { schemaVersion: 1 },
  content: Array.from({ length: paragraphs }, (_, index) => ({ type: 'paragraph' as const, attrs: { id: `p${index}` }, content: [{ type: 'text' as const, text: `${words} ${index}` }, { type: 'text' as const, text: ' em negrito', marks: [{ type: 'bold' as const }] }] })),
})

async function article(paragraphs = 3, words?: string) {
  const draft = await createArticle(db, userId, `Artigo ${unique()}`)
  const saved = await updateArticle(db, userId, draft, { version: 1, excerpt: 'Resumo do artigo', body: body(paragraphs, words) })
  return (await publishArticle(db, actor, saved, 'pt-BR', 2)).article
}

function deps(options: FakeOptions = {}, now?: () => Date) {
  const provider = createFakeProvider(options)
  return { provider, value: { provider: () => provider, now } }
}

const jobRow = async (id: string) => (await db.select().from(translationJobs).where(eq(translationJobs.id, id)))[0]!

beforeEach(async () => {
  await aiSettings()
})

describe('estimate and run', () => {
  it('estimates, runs on confirmation and writes a machine copy with a valid document', async () => {
    const item = await article()
    const { value, provider } = deps()
    const job = await estimateTranslation(db, value, userId, { entityType: 'article', entityId: item.id, locale: 'de' })
    expect(job).toMatchObject({ status: 'estimated', segmentsTotal: 5, blocked: null })
    expect(job.estimate.neurons).toBeGreaterThan(0)
    expect(provider.calls).toHaveLength(0)

    const done = await runTranslation(db, value, job.id)
    expect(done).toMatchObject({ status: 'succeeded', segmentsDone: 5, failedSegments: [] })
    expect(done.usage.neurons).toBeGreaterThan(0)
    const german = (await getArticle(db, item.id)).localizations.find(copy => copy.locale === 'de')!
    expect(german).toMatchObject({ translationState: 'machine', status: 'draft', title: expect.stringMatching(/^\[de\] Artigo/) })
    expect(german.slug).toMatch(/^de-artigo/)
    expect(documentSchema.safeParse(german.body).success).toBe(true)
    expect(german.body.content[0]).toMatchObject({ content: [{ text: '[de] Um parágrafo de texto 0' }, { text: '[de]  em negrito', marks: [{ type: 'bold' }] }] })
    expect(german.segmentsMeta['block:p0']?.state).toBe('machine')
    expect(await errorOf(runTranslation(db, value, job.id))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'status', message: 'succeeded' }] } })
  })

  it('records estimated and used numbers in the ledger, summed for the UTC day', async () => {
    const before = await translationUsage(db)
    const item = await article()
    const { value } = deps({ reportUsage: false })
    const job = await estimateTranslation(db, value, userId, { entityType: 'article', entityId: item.id, locale: 'fr' })
    await runTranslation(db, value, job.id)
    const row = await jobRow(job.id)
    expect(row).toMatchObject({ estimatedNeurons: job.estimate.neurons, usageEstimated: true })
    expect(row.neurons).toBeGreaterThan(0)
    expect((await translationUsage(db)).today.neurons).toBe(before.today.neurons + row.neurons)
  })

  it('needs a fresh estimate from the same source', async () => {
    const item = await article()
    const stale = deps({}, () => new Date(Date.now() + ESTIMATE_TTL_MS + 1000))
    const job = await estimateTranslation(db, deps().value, userId, { entityType: 'article', entityId: item.id, locale: 'es' })
    expect(await errorOf(runTranslation(db, stale.value, job.id))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'estimate', message: 'stale' }] } })
    expect(stale.provider.calls).toHaveLength(0)

    const again = await estimateTranslation(db, deps().value, userId, { entityType: 'article', entityId: item.id, locale: 'es' })
    const source = (await getArticle(db, item.id)).localizations.find(copy => copy.locale === 'pt-BR')!
    await updateArticle(db, userId, await getArticle(db, item.id), { version: source.version, excerpt: 'Outro resumo' })
    const { value, provider } = deps()
    expect(await errorOf(runTranslation(db, value, again.id))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'source', message: 'changed' }] } })
    expect((await jobRow(again.id)).status).toBe('cancelled')
    expect(provider.calls).toHaveLength(0)
  })

  it('blocks a job over the balance before any call', async () => {
    const item = await article()
    await aiSettings({ dailyNeuronCap: 1 })
    const { value, provider } = deps()
    const job = await estimateTranslation(db, value, userId, { entityType: 'article', entityId: item.id, locale: 'en' })
    expect(job.blocked).toBe('daily_neurons')
    expect(await errorOf(runTranslation(db, value, job.id))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'cost', message: 'daily_neurons' }] } })
    expect(provider.calls).toHaveLength(0)
    expect(await jobRow(job.id)).toMatchObject({ status: 'failed', error: 'cost_guard: daily_neurons', neurons: 0 })

    await aiSettings({ enabled: false })
    const off = await estimateTranslation(db, value, userId, { entityType: 'article', entityId: item.id, locale: 'en' })
    expect(off.blocked).toBe('disabled')
    expect(await errorOf(runTranslation(db, value, off.id))).toMatchObject({ data: { issues: [{ message: 'disabled' }] } })
    expect(provider.calls).toHaveLength(0)
  })
})

describe('failures and resuming', () => {
  it('fails with a sanitized error, keeps the batches done, and resumes from there', async () => {
    // ~45 paragraphs of ~80 tokens: more than one batch of 3,000 tokens
    const item = await article(45, 'Um parágrafo bem mais longo, '.repeat(10))
    const failing = deps({ failOnCalls: [2] })
    const job = await estimateTranslation(db, failing.value, userId, { entityType: 'article', entityId: item.id, locale: 'de' })
    const failed = await runTranslation(db, failing.value, job.id)
    expect(failed.status).toBe('failed')
    expect(failed.error).toBe('unavailable: Fake provider failure')
    const kept = failed.segmentsDone
    expect(kept).toBeGreaterThan(0)
    expect(kept).toBeLessThan(failed.segmentsTotal)
    expect((await getArticle(db, item.id)).localizations.some(copy => copy.locale === 'de')).toBe(false)

    const healthy = deps()
    const resumed = await runTranslation(db, healthy.value, job.id)
    expect(resumed.status).toBe('succeeded')
    expect(healthy.provider.calls.flatMap(call => call.segments)).toHaveLength(failed.segmentsTotal - kept)
  })

  it('does at most 20 calls per request and continues on the next one', async () => {
    // Each paragraph is over the 3,000-token batch budget, so each one is a call: 22 of them, plus the fields
    const item = await article(22, 'Texto longo para encher o lote. '.repeat(400))
    await aiSettings({ perJobNeuronCap: 10_000 })
    const { value, provider } = deps()
    const job = await estimateTranslation(db, value, userId, { entityType: 'article', entityId: item.id, locale: 'fr' })
    const first = await runTranslation(db, value, job.id)
    expect(provider.calls).toHaveLength(20)
    expect(first.status).toBe('running')
    const second = await runTranslation(db, value, job.id)
    expect(second.status).toBe('succeeded')
    expect(second.segmentsDone).toBe(second.segmentsTotal)
  })

  it('keeps the source text of a segment whose tags came back broken, and flags it', async () => {
    const item = await article(2)
    const { value } = deps({ breakTags: ['block:p1'] })
    const job = await estimateTranslation(db, value, userId, { entityType: 'article', entityId: item.id, locale: 'es' })
    const done = await runTranslation(db, value, job.id)
    expect(done).toMatchObject({ status: 'succeeded', failedSegments: ['block:p1'] })
    const spanish = (await getArticle(db, item.id)).localizations.find(copy => copy.locale === 'es')!
    expect(spanish.body.content[1]).toEqual(body(2).content[1])
  })
})

describe('what is sent and where it may write', () => {
  it('sends only content segments: no user, contact or settings data', async () => {
    const item = await article()
    const { value, provider } = deps()
    const job = await estimateTranslation(db, value, userId, { entityType: 'article', entityId: item.id, locale: 'en' })
    await runTranslation(db, value, job.id)
    const payload = JSON.stringify(provider.calls)
    expect(provider.calls.flatMap(call => call.segments.map(segment => segment.id)).sort()).toEqual(['block:p0', 'block:p1', 'block:p2', 'excerpt', 'title'])
    expect(payload).not.toContain(email)
    expect(payload).not.toContain(userId)
    expect(payload).not.toMatch(/@example\.test|ip_?hash/i)
  })

  it('never writes over a translation a person has worked on', async () => {
    const item = await article()
    await createLocalization(db, 'article', { articleId: item.id, locale: 'de', title: 'Geprüft', slug: `geprueft-${unique()}`, excerpt: '', body: body(1), translationState: 'approved' }, { coverMediaId: null, tagIds: [] })
    expect(await errorOf(estimateTranslation(db, deps().value, userId, { entityType: 'article', entityId: item.id, locale: 'de' }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'locale', message: 'translation_approved' }] } })
  })
})
