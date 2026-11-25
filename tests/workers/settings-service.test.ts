// F08-T1: the settings service on a real D1. With nothing saved the site reads the defaults; a save moves the version
// (a stale one is a 409 and changes nothing); a locale without its own text falls back to pt-BR; a translation can be
// removed; a stored value that no longer fits its schema reads as the default; ai_translation never reaches the site
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { siteSettings, users } from '../../server/db/schema'
import { insertMedia, listUsages, markReady } from '../../server/services/media/media.repo'
import { adminSettings, publicSettings, siteFeatures, updateSetting } from '../../server/services/settings/settings.service'
import { PUBLIC_SETTINGS_DEFAULTS } from '../../shared/settings/public'
import { uuidv7 } from '../../shared/utils/id'

const db = createDb(env.DB)
const [user] = await db.insert(users).values({ name: 'Config', email: `settings-${uuidv7()}@example.test` }).returning()
const userId = user!.id
const errorOf = async (promise: Promise<unknown>) => promise.then(() => undefined, (error: { statusCode?: number, data?: unknown }) => ({ statusCode: error.statusCode, data: error.data }))
const versionOf = async (key: Parameters<typeof updateSetting>[2]) => (await adminSettings(db)).find(item => item.key === key)!.version

describe('settings service', () => {
  it('reads the defaults while nothing is saved, and never exposes ai_translation', async () => {
    await db.delete(siteSettings).where(eq(siteSettings.key, 'navigation'))
    const settings = await publicSettings(db, 'en', 'https://media.example.test')
    expect(settings.navigation).toEqual(PUBLIC_SETTINGS_DEFAULTS.navigation)
    expect(settings.cacheTags).toContain('settings')
    expect(JSON.stringify(settings)).not.toContain('dailyNeuronCap')
    expect((await adminSettings(db)).find(item => item.key === 'ai_translation')?.value).toMatchObject({ provider: 'workers-ai', dailyNeuronCap: 8000 })
  })

  it('saves with the version read; a stale save is a 409 and changes nothing', async () => {
    const version = await versionOf('identity')
    const saved = await updateSetting(db, userId, 'identity', { version, value: { name: 'Nome salvo' }, localizations: { 'pt-BR': { role: 'Papel', bio: 'Bio' } } })
    expect(saved.version).toBe(version + 1)
    expect((await publicSettings(db, 'pt-BR', 'https://media.example.test')).identity).toEqual({ name: 'Nome salvo', role: 'Papel', bio: 'Bio', cv: null })
    expect(await errorOf(updateSetting(db, userId, 'identity', { version, value: { name: 'Perdeu' } }))).toMatchObject({ statusCode: 409, data: { issues: [{ path: 'version', message: 'stale' }] } })
    expect((await publicSettings(db, 'pt-BR', 'https://media.example.test')).identity.name).toBe('Nome salvo')
  })

  it('falls back to pt-BR for a locale without its own text, and back again once removed', async () => {
    let version = await versionOf('footer')
    await updateSetting(db, userId, 'footer', { version, value: { showSocial: false }, localizations: { 'pt-BR': { text: 'Rodapé' }, 'de': { text: 'Fußzeile' } } })
    expect((await publicSettings(db, 'de', 'https://media.example.test')).footer).toEqual({ showSocial: false, text: 'Fußzeile' })
    expect((await publicSettings(db, 'fr', 'https://media.example.test')).footer.text).toBe('Rodapé')
    version = await versionOf('footer')
    await updateSetting(db, userId, 'footer', { version, value: { showSocial: false }, localizations: { de: null } })
    expect((await publicSettings(db, 'de', 'https://media.example.test')).footer.text).toBe('Rodapé')
    expect((await adminSettings(db)).find(item => item.key === 'footer')?.localizations.de).toBeUndefined()
  })

  it('shows the contact e-mail only when chosen, and reads a broken stored value as the default', async () => {
    await updateSetting(db, userId, 'contact', { version: await versionOf('contact'), value: { email: 'oi@example.com', showEmail: false } })
    expect((await publicSettings(db, 'pt-BR', 'https://media.example.test')).contactEmail).toBeNull()
    await updateSetting(db, userId, 'contact', { version: await versionOf('contact'), value: { email: 'oi@example.com', showEmail: true } })
    expect((await publicSettings(db, 'pt-BR', 'https://media.example.test')).contactEmail).toBe('oi@example.com')

    await db.update(siteSettings).set({ value: { contactForm: 'yes' } }).where(eq(siteSettings.key, 'features'))
    await db.insert(siteSettings).values({ key: 'features', value: { contactForm: 'yes' } }).onConflictDoNothing()
    expect(await siteFeatures(db)).toEqual(PUBLIC_SETTINGS_DEFAULTS.features)
  })

  it('refuses a share image that is not a ready image', async () => {
    expect(await errorOf(updateSetting(db, userId, 'seo_defaults', { version: await versionOf('seo_defaults'), value: { ogImageMediaId: uuidv7() } })))
      .toMatchObject({ statusCode: 400, data: { issues: [{ path: 'value.ogImageMediaId' }] } })
  })

  // F13-T5 (ADR-0017): the CV is a ready PDF; its link is public, its use is recorded and blocks deletion, and clearing
  // it removes both
  it('links a ready CV, refuses anything else, and records its use', async () => {
    const hash = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const cv = { id: uuidv7(), kind: 'file' as const, mimeType: 'application/pdf' as const, originalFilename: 'cv.pdf', sizeBytes: 1000, width: null, height: null, sha256: hash, originalKey: `media/${hash.slice(0, 2)}/${hash}/file.pdf`, variants: [] }
    await insertMedia(db, cv, [])
    expect(await markReady(db, cv.id)).toBe(true)
    const base = 'https://media.example.test'

    let version = await versionOf('identity')
    await updateSetting(db, userId, 'identity', { version, value: { name: 'Com CV', cvMediaId: cv.id } })
    expect((await publicSettings(db, 'pt-BR', base)).identity.cv).toEqual({ url: `${base}/${cv.originalKey}` })
    expect(await listUsages(db, cv.id)).toEqual([expect.objectContaining({ entityType: 'setting', entityId: 'identity', context: 'settings' })])

    version = await versionOf('identity')
    const imageHash = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const image = { id: uuidv7(), kind: 'image' as const, mimeType: 'image/jpeg' as const, originalFilename: 'foto.jpg', sizeBytes: 100, width: 10, height: 10, sha256: imageHash, originalKey: `originals/${imageHash}.jpg`, variants: [] }
    await insertMedia(db, image, [])
    await markReady(db, image.id)
    expect(await errorOf(updateSetting(db, userId, 'identity', { version, value: { name: 'Com CV', cvMediaId: image.id } }))).toMatchObject({ statusCode: 400 })

    version = await versionOf('identity')
    await updateSetting(db, userId, 'identity', { version, value: { name: 'Sem CV', cvMediaId: null } })
    expect((await publicSettings(db, 'pt-BR', base)).identity.cv).toBeNull()
    expect(await listUsages(db, cv.id)).toEqual([])
  })
})
