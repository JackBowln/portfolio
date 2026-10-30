// F02-T2: every route of docs/architecture/i18n-seo.md §2 in the 5 locales, cacheable and cookie-free
import { readdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({ baseURL })
  await ensureBlogFixture(request)
  await request.dispose()
})

const LANGUAGES = { 'pt-BR': '', 'en': '/en', 'es': '/es', 'de': '/de', 'fr': '/fr' } as const
type Locale = keyof typeof LANGUAGES

const ROUTES: Record<string, Record<Locale, string>> = {
  home: { 'pt-BR': '/', 'en': '/', 'es': '/', 'de': '/', 'fr': '/' },
  about: { 'pt-BR': '/sobre', 'en': '/about', 'es': '/sobre-mi', 'de': '/ueber-mich', 'fr': '/a-propos' },
  projects: { 'pt-BR': '/projetos', 'en': '/projects', 'es': '/proyectos', 'de': '/projekte', 'fr': '/projets' },
  project: { 'pt-BR': '/projetos/x', 'en': '/projects/x', 'es': '/proyectos/x', 'de': '/projekte/x', 'fr': '/projets/x' },
  blog: { 'pt-BR': '/blog', 'en': '/blog', 'es': '/blog', 'de': '/blog', 'fr': '/blog' },
  article: { 'pt-BR': '/blog/x', 'en': '/blog/x', 'es': '/blog/x', 'de': '/blog/x', 'fr': '/blog/x' },
  topic: { 'pt-BR': '/blog/temas/x', 'en': '/blog/topics/x', 'es': '/blog/temas/x', 'de': '/blog/themen/x', 'fr': '/blog/sujets/x' },
  contact: { 'pt-BR': '/contato', 'en': '/contact', 'es': '/contacto', 'de': '/kontakt', 'fr': '/contact' },
  privacy: { 'pt-BR': '/privacidade', 'en': '/privacy', 'es': '/privacidad', 'de': '/datenschutz', 'fr': '/confidentialite' },
}

function localizedUrl(locale: Locale, path: string): string {
  const prefixed = `${LANGUAGES[locale]}${path}`
  return prefixed.length > 1 && prefixed.endsWith('/') ? prefixed.slice(0, -1) : prefixed
}

for (const [name, paths] of Object.entries(ROUTES)) {
  test(`${name} answers 200 in every locale, without cookies`, async ({ request }) => {
    for (const locale of Object.keys(LANGUAGES) as Locale[]) {
      const url = localizedUrl(locale, paths[locale])
      const response = await request.get(url, { maxRedirects: 0 })

      expect(response.status(), url).toBe(200)
      expect(response.headers()['set-cookie'], url).toBeUndefined()
      expect(response.headers()['cache-control'], url).toBe('public, max-age=0, s-maxage=604800')
      expect(await response.text(), url).toMatch(new RegExp(`<html[^>]* lang="${locale}"`))
    }
  })
}

test('skeleton pages are noindex; the home and about are indexable (F02-T3)', async ({ request }) => {
  expect(await (await request.get('/en/projects')).text()).toContain('<meta name="robots" content="noindex">')
  for (const path of ['/en', '/en/about']) {
    expect(await (await request.get(path)).text(), path).not.toContain('<meta name="robots"')
  }
})

test('no redirect or cookie from Accept-Language', async ({ request }) => {
  const response = await request.get('/', { headers: { 'accept-language': 'de-DE,de;q=0.9' }, maxRedirects: 0 })

  expect(response.status()).toBe(200)
  expect(response.headers()['set-cookie']).toBeUndefined()
  expect(await response.text()).toMatch(/<html[^>]* lang="pt-BR"/)
})

test('pt-BR paths do not exist under another locale prefix', async ({ request }) => {
  for (const url of ['/en/sobre', '/de/projetos', '/fr/blog/temas/x']) {
    expect((await request.get(url, { maxRedirects: 0 })).status(), url).toBe(404)
  }
})

test('admin and preview are not localized', async ({ request }) => {
  for (const url of ['/en/admin', '/de/admin/settings', '/en/preview/token', '/fr/preview/token']) {
    expect((await request.get(url, { maxRedirects: 0 })).status(), url).toBe(404)
  }
})

test('UI messages are prerendered static assets with an immutable cache', async ({ request }) => {
  // Same machine as the build: the content hash is the directory name under .output/public/_i18n
  const [hash] = readdirSync('.output/public/_i18n')

  for (const locale of Object.keys(LANGUAGES)) {
    const response = await request.get(`/_i18n/${hash}/${locale}/messages.json`)

    expect(response.status(), locale).toBe(200)
    expect(response.headers()['cache-control'], locale).toBe('public, max-age=31536000, immutable')
    expect(response.headers()['set-cookie'], locale).toBeUndefined()
  }
})
