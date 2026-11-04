// F09-T5: short texts in batch on a real D1, with the fake provider. Only what the site shows is listed; a batch job
// needs an estimate, the cost guard runs before any call, and the result is `machine`; nothing reaches the site
// before approval; a title template keeps its %s; settings texts need settings:update to edit and approve; a field
// without a translation blocks the approval; a topic's slug is unique per locale
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { mediaLocalizations, mediaUsages, siteSettingLocalizations, siteSettings, users } from '../../server/db/schema'
import type { media } from '../../server/db/schema'
import { createArticle, updateArticle } from '../../server/services/content/articles.service'
import { topicsIn } from '../../server/services/content/blog.repo'
import { publishArticle } from '../../server/services/content/publishing.service'
import { createTopic } from '../../server/services/content/tags.service'
import { findReadyMediaWithText, insertMedia, markReady } from '../../server/services/media/media.repo'
import { publicSettings } from '../../server/services/settings/settings.service'
import { createFakeProvider } from '../../server/services/translation/providers/fake'
import type { FakeOptions } from '../../server/services/translation/providers/fake'
import { estimateTranslation, runTranslation } from '../../server/services/translation/run.service'
import { approveTextItems, listTextItems, saveTextItems } from '../../server/services/translation/texts.service'
import { settingSchemas } from '../../shared/settings/schemas'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Textos', email: `texts-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const actor = { userId, ip: null, ipHashSalt: undefined }
const unique = () => uuidv7().slice(-8)
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))

async function aiOn(changes: Record<string, unknown> = {}) {
  const value = { ...settingSchemas.ai_translation.defaults.global, enabled: true, model: '@cf/qwen/qwen3-30b-a3b-fp8', dailyNeuronCap: 10_000, perJobNeuronCap: 10_000, ...changes }
  await db.insert(siteSettings).values({ key: 'ai_translation', value }).onConflictDoUpdate({ target: siteSettings.key, set: { value } })
}

async function usedTopic() {
  const topic = await createTopic(db, userId, { name: `Tema ${unique()}` })
  const draft = await createArticle(db, userId, `Artigo ${unique()}`)
  const saved = await updateArticle(db, userId, draft, { version: 1, excerpt: 'x', tagIds: [topic.id] })
  await publishArticle(db, actor, saved, 'pt-BR', 2)
  return topic
}

async function usedImage(alt: string) {
  const hash = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const row: typeof media.$inferInsert = { id: uuidv7(), kind: 'image', mimeType: 'image/jpeg', originalFilename: `foto-${unique()}.jpg`, sizeBytes: 1, width: 10, height: 10, sha256: hash, originalKey: `originals/${hash}.jpg`, variants: [] }
  await insertMedia(db, row, [])
  await markReady(db, row.id!)
  await db.insert(mediaLocalizations).values({ mediaId: row.id!, locale: 'pt-BR', alt, translationState: 'source' })
  await db.insert(mediaUsages).values({ mediaId: row.id!, entityType: 'article', entityId: uuidv7(), context: 'body' })
  return row.id!
}

async function settingsSource() {
  await db.insert(siteSettings).values({ key: 'seo_defaults', value: { ogImageMediaId: null } }).onConflictDoNothing()
  await db.insert(siteSettingLocalizations).values({ key: 'seo_defaults', locale: 'pt-BR', value: { titleTemplate: '%s — Portfólio', description: 'Descrição' }, translationState: 'source' })
    .onConflictDoUpdate({ target: [siteSettingLocalizations.key, siteSettingLocalizations.locale], set: { value: { titleTemplate: '%s — Portfólio', description: 'Descrição' } } })
}

async function batch(locale: 'en' | 'de' | 'fr' | 'es', segmentIds: string[], options: FakeOptions = {}) {
  const provider = createFakeProvider(options)
  const deps = { provider: () => provider }
  const job = await estimateTranslation(db, deps, userId, { entityType: 'texts', entityId: 'batch', locale, segmentIds })
  return { provider, job, done: await runTranslation(db, deps, job.id).catch((error: { data?: unknown }) => error) }
}

const item = async (locale: 'en' | 'de' | 'fr' | 'es', key: string) => (await listTextItems(db, locale)).find(entry => entry.key === key)

beforeEach(async () => {
  await aiOn()
  await settingsSource()
})

describe('batch translation of short texts', () => {
  it('lists only what the site shows', async () => {
    const used = await usedTopic()
    const unused = await createTopic(db, userId, { name: `Solto ${unique()}` })
    const image = await usedImage('Um gato')
    const keys = (await listTextItems(db, 'de')).map(entry => entry.key)
    expect(keys).toContain(`tag:${used.id}`)
    expect(keys).not.toContain(`tag:${unused.id}`)
    expect(keys).toContain(`media:${image}`)
    expect(keys).toContain('setting:seo_defaults')
    expect(await item('de', `tag:${used.id}`)).toMatchObject({ state: 'missing', fields: [{ name: 'name', status: 'missing', translation: null }] })
  })

  it('translates the chosen fields as machine, keeps them off the site, and approves them', async () => {
    const topic = await usedTopic()
    const image = await usedImage('Um gato')
    const { done, provider } = await batch('de', [`tag:${topic.id}:name`, `media:${image}:alt`, 'setting:seo_defaults:titleTemplate', 'setting:seo_defaults:description'])
    expect(done).toMatchObject({ status: 'succeeded', failedSegments: [] })
    expect(provider.calls.flatMap(call => call.segments.map(segment => segment.id))).toHaveLength(4)
    const tag = await item('de', `tag:${topic.id}`)
    expect(tag).toMatchObject({ state: 'machine', fields: [{ translation: `[de] ${topic.name}`, status: 'ok' }] })
    expect(tag!.slug).toMatch(/^de-tema-/)
    const seo = await item('de', 'setting:seo_defaults')
    expect(seo!.fields.find(field => field.name === 'titleTemplate')!.translation).toBe('%s[de]  — Portfólio')

    // Not on the site yet
    expect(await topicsIn(db, 'de', [topic.id])).toEqual([])
    expect((await findReadyMediaWithText(db, [image])).localizations.map(row => row.locale)).toEqual(['pt-BR'])
    expect((await publicSettings(db, 'de', 'http://x')).seo.titleTemplate).toBe('%s — Portfólio')

    // Settings texts need settings:update; the others do not
    expect(await errorOf(approveTextItems(db, 'de', ['setting:seo_defaults'], false))).toMatchObject({ statusCode: 403 })
    const { purge } = await approveTextItems(db, 'de', [`tag:${topic.id}`, `media:${image}`, 'setting:seo_defaults'], true)
    expect(purge.sort()).toEqual([`media:${image}`, 'settings', `tag:${topic.id}`].sort())
    expect(await topicsIn(db, 'de', [topic.id])).toMatchObject([{ name: `[de] ${topic.name}` }])
    expect((await findReadyMediaWithText(db, [image])).localizations.map(row => row.locale).sort()).toEqual(['de', 'pt-BR'])
    expect((await publicSettings(db, 'de', 'http://x')).seo.titleTemplate).toBe('%s[de]  — Portfólio')
  })

  it('blocks a job over the balance before any call, and needs the chosen fields', async () => {
    const topic = await usedTopic()
    await aiOn({ dailyNeuronCap: 1 })
    const { provider, job, done } = await batch('fr', [`tag:${topic.id}:name`])
    expect(job.blocked).toBe('daily_neurons')
    expect(done).toMatchObject({ data: { issues: [{ path: 'cost', message: 'daily_neurons' }] } })
    expect(provider.calls).toHaveLength(0)
    expect(await errorOf(estimateTranslation(db, { provider: () => createFakeProvider() }, userId, { entityType: 'texts', entityId: 'batch', locale: 'fr' }))).toMatchObject({ statusCode: 400 })
  })

  it('a template that loses its %s fails and blocks the approval until someone writes it', async () => {
    const { done } = await batch('es', ['setting:seo_defaults:titleTemplate', 'setting:seo_defaults:description'], { breakTags: ['setting:seo_defaults:titleTemplate'] })
    expect(done).toMatchObject({ status: 'succeeded', failedSegments: ['setting:seo_defaults:titleTemplate'] })
    const seo = await item('es', 'setting:seo_defaults')
    expect(seo!.fields.find(field => field.name === 'titleTemplate')!.status).toBe('missing')
    expect(await errorOf(approveTextItems(db, 'es', ['setting:seo_defaults'], true))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'items.setting:seo_defaults.titleTemplate', message: 'missing' }] } })
    expect(await errorOf(saveTextItems(db, 'es', [{ key: 'setting:seo_defaults', fields: { titleTemplate: 'Sin marcador' } }], true))).toMatchObject({ statusCode: 400, data: { issues: [{ message: 'template' }] } })
    expect(await errorOf(saveTextItems(db, 'es', [{ key: 'setting:seo_defaults', fields: { titleTemplate: '%s — Portafolio' } }], false))).toMatchObject({ statusCode: 403 })
    await saveTextItems(db, 'es', [{ key: 'setting:seo_defaults', fields: { titleTemplate: '%s — Portafolio' } }], true)
    await approveTextItems(db, 'es', ['setting:seo_defaults'], true)
    expect((await publicSettings(db, 'es', 'http://x')).seo.titleTemplate).toBe('%s — Portafolio')
  })

  it('keeps a topic slug unique per locale', async () => {
    const first = await usedTopic()
    const second = await usedTopic()
    await saveTextItems(db, 'en', [{ key: `tag:${first.id}`, fields: { name: 'Shared' }, slug: `shared-${first.id.slice(-6)}` }], false)
    expect(await errorOf(saveTextItems(db, 'en', [{ key: `tag:${second.id}`, fields: { name: 'Shared' }, slug: `shared-${first.id.slice(-6)}` }], false))).toMatchObject({ statusCode: 409, data: { issues: [{ message: 'slug_taken' }] } })
    expect((await item('en', `tag:${first.id}`))!.state).toBe('in_review')
  })
})
