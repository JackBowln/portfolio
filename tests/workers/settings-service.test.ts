// F08-T1: the settings service on a real D1. With nothing saved the site reads the defaults; a save moves the version
// (a stale one is a 409 and changes nothing); a locale without its own text falls back to pt-BR; a translation can be
// removed; a stored value that no longer fits its schema reads as the default; ai_translation never reaches the site
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { siteSettings, users } from '../../server/db/schema'
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
    expect((await publicSettings(db, 'pt-BR', 'https://media.example.test')).identity).toEqual({ name: 'Nome salvo', role: 'Papel', bio: 'Bio' })
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
})
