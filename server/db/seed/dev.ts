// pnpm db:seed — local development data only (ADR-0004 §9). Every value is [PLACEHOLDER] and never reaches production.
// Opens the same local D1 state as `nuxt dev` and `pnpm preview` (.wrangler/state) through wrangler's platform proxy.
import { getPlatformProxy } from 'wrangler'
import { createDb } from '../client.ts'
import { siteSettings } from '../schema/index.ts'

const { env, dispose } = await getPlatformProxy<Env>({
  configPath: 'wrangler.jsonc',
  persist: { path: '.wrangler/state/v3' },
  remoteBindings: false,
})

try {
  if (env.ENVIRONMENT !== 'local') {
    throw new Error(`Refusing to seed: ENVIRONMENT is "${env.ENVIRONMENT}", expected "local"`)
  }

  const db = createDb(env.DB)
  const rows = [
    { key: 'identity' as const, value: { name: '[PLACEHOLDER]', role: '[PLACEHOLDER]' } },
    { key: 'social' as const, value: { links: [] } },
    { key: 'seo_defaults' as const, value: { titleTemplate: '%s · [PLACEHOLDER]' } },
  ]
  await db.batch([
    db.insert(siteSettings).values(rows[0]!).onConflictDoNothing(),
    ...rows.slice(1).map(row => db.insert(siteSettings).values(row).onConflictDoNothing()),
  ])
  const seeded = await db.select({ key: siteSettings.key }).from(siteSettings)
  console.log(`Seeded local site_settings: ${seeded.map(row => row.key).join(', ')}`)
}
finally {
  await dispose()
}
