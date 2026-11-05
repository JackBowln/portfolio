// pnpm db:seed:prodlike — the content of the production-like instance (`pnpm preview:prod`, .wrangler/state-prod)
// that Lighthouse measures (F11-T5): the blog fixture (`x` in five locales, home and about), the contact page and the
// reference article and project with real images (reference.ts). Local state only, through wrangler's platform
// proxy like `pnpm db:seed`; every value is [PLACEHOLDER] and never reaches a deployed environment. Idempotent
import { eq } from 'drizzle-orm'
import { getPlatformProxy } from 'wrangler'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import { ensureBlogFixture } from '../../_test/blog-fixture.ts'
import { getPage, publishPage, updatePage } from '../../services/content/pages.service.ts'
import { createDb } from '../client.ts'
import { users } from '../schema/auth.ts'
import { ensureReferenceContent } from './reference.ts'

const EMAIL = 'reference-seed@example.test'

// PRODLIKE_STATE points the seed at another local state, to check it on an empty one
const { env, dispose } = await getPlatformProxy<Env>({
  configPath: 'wrangler.jsonc',
  persist: { path: `${process.env.PRODLIKE_STATE ?? '.wrangler/state-prod'}/v3` },
  remoteBindings: false,
})

try {
  if (env.ENVIRONMENT !== 'local') {
    throw new Error(`Refusing to seed: ENVIRONMENT is "${env.ENVIRONMENT}", expected "local"`)
  }
  const db = createDb(env.DB)
  const [found] = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL))
  const userId = found?.id ?? (await db.insert(users).values({ name: 'Reference seed', email: EMAIL }).returning({ id: users.id }))[0]!.id

  await ensureBlogFixture(db)
  const contact = await getPage(db, 'contact')
  const copy = contact.localizations.find(item => item.locale === SOURCE_LOCALE)!
  if (!copy.publishedRevisionId) {
    const saved = await updatePage(db, userId, contact, { version: copy.version, blocks: { intro: '[PLACEHOLDER] Escreva para conversar sobre um projeto.', success: '[PLACEHOLDER] Mensagem enviada.' } })
    await publishPage(db, { userId, ip: null, ipHashSalt: undefined }, saved, SOURCE_LOCALE, saved.localizations.find(item => item.locale === SOURCE_LOCALE)!.version)
  }
  await ensureReferenceContent(db, env.MEDIA, userId)
  console.log('Seeded the production-like instance: blog fixture, contact page, reference article and project')
}
finally {
  await dispose()
}
