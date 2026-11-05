// F12-T1 (i18n-seo §8): a crawl of every static page and of the fixture's article, project and topic in the five
// locales. Each answers 200 with its own `lang`, shows the locale's navigation labels, leaks no i18n key (every key
// of the message files is checked against the page text) and links its language switcher to pages that answer 200.
// Pages are fetched and parsed in one browser page, so the crawl stays fast
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { articlePath, projectPath, topicPath } from '../../shared/content/paths'
import { localizedPath } from '../../shared/i18n/locales'
import { STATIC_PAGE_PATHS } from '../../shared/i18n/routes'
import { LOCALES } from '../../shared/types/enums'
import type { Locale } from '../../shared/types/enums'
import { ensureBlogFixture } from '../support/blog'

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'It reads HTML; one browser is enough')

type Messages = { [key: string]: string | Messages }
const messages = (locale: Locale) => JSON.parse(readFileSync(`i18n/locales/${locale}.json`, 'utf8')) as Messages & { layout: { nav: Record<string, string> } }

/** Every key path of the public messages (admin.* is pt-BR only and never on a public page) */
function keyPaths(tree: Messages, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : key === 'admin' && !prefix ? [] : keyPaths(value, path)
  })
}

test('every page in every locale: 200, its lang, its labels, no raw key, a working switcher', async ({ page, request }) => {
  test.setTimeout(120_000)
  await ensureBlogFixture(request)
  await page.goto('/')
  const keys = keyPaths(messages('pt-BR')).filter(key => key.includes('.'))
  const checked = new Map<string, number>()

  for (const locale of LOCALES) {
    const nav = messages(locale).layout.nav
    const paths = [
      ...Object.values(STATIC_PAGE_PATHS).map(paths => localizedPath(locale, paths[locale])),
      articlePath(locale, 'x'),
      projectPath(locale, 'x'),
      topicPath(locale, 'x'),
    ]
    for (const path of paths) {
      const response = await request.get(path, { headers: { accept: 'text/html' } })
      expect(response.status(), path).toBe(200)
      const read = await page.evaluate((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html')
        doc.querySelectorAll('script, style, template').forEach(node => node.remove())
        return {
          lang: doc.documentElement.getAttribute('lang'),
          text: doc.body.textContent?.replace(/\s+/g, ' ') ?? '',
          switcher: [...doc.querySelectorAll('footer a[hreflang]')].map(link => link.getAttribute('href') ?? ''),
        }
      }, await response.text())

      expect(read.lang, path).toBe(locale)
      for (const label of ['projects', 'blog', 'about', 'contact']) {
        expect(read.text, `${path}: the ${label} label in ${locale}`).toContain(nav[label])
      }
      expect(keys.filter(key => read.text.includes(key)), `${path}: raw i18n keys`).toEqual([])
      expect(read.switcher, path).toHaveLength(LOCALES.length)
      for (const href of read.switcher) {
        expect(href, path).toMatch(/^\//)
        if (!checked.has(href)) {
          checked.set(href, (await request.get(href, { headers: { accept: 'text/html' } })).status())
        }
        expect(checked.get(href), `${path} → ${href}`).toBe(200)
      }
    }
  }
})
