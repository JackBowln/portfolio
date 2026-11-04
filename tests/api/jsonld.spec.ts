// F11-T1: each public template carries its JSON-LD, parseable and with only the types of i18n-seo §5; contact and
// privacy carry none; an article whose title holds </script> keeps the HTML intact
import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from '../support/auth'
import { ensureBlogFixture } from '../support/blog'

async function jsonLd(request: APIRequestContext, path: string) {
  const html = await (await request.get(path)).text()
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]!) as { '@graph': { '@type': string }[] })
  return { html, types: blocks.flatMap(block => block['@graph'].map(node => node['@type'])) }
}

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
})

test('every template carries only its types', async ({ request }) => {
  const project = ((await (await request.get('/projetos')).text()).match(/view-transition-name:\s*project-([a-z0-9-]+)/) ?? [])[1] ?? 'x'
  const expected: [string, string[]][] = [
    ['/', ['WebSite', 'Person']],
    ['/sobre', ['ProfilePage', 'Person']],
    ['/blog', ['CollectionPage', 'BreadcrumbList']],
    ['/blog/x', ['BlogPosting', 'BreadcrumbList']],
    ['/blog/temas/x', ['CollectionPage', 'BreadcrumbList']],
    ['/projetos', ['CollectionPage', 'BreadcrumbList']],
    ['/en/blog/x', ['BlogPosting', 'BreadcrumbList']],
  ]
  for (const [path, types] of expected) {
    expect((await jsonLd(request, path)).types, path).toEqual(types)
  }
  const work = (await jsonLd(request, `/projetos/${project}`)).types
  expect([['CreativeWork', 'BreadcrumbList'], ['SoftwareSourceCode', 'BreadcrumbList']]).toContainEqual(work)
  for (const path of ['/contato', '/privacidade']) {
    expect((await jsonLd(request, path)).types, path).toEqual([])
  }
})

test('a title with </script> does not break the HTML', async ({ playwright, baseURL, page }) => {
  const editor = await playwright.request.newContext({ baseURL })
  expect((await editor.post('/api/_test/session?role=editor', { headers: { origin: SITE_ORIGIN } })).status()).toBe(200)
  const title = `Fim </script><script>alert(1)</script> ${crypto.randomUUID().slice(0, 6)}`
  const created = await editor.post('/api/admin/articles', { headers: { origin: SITE_ORIGIN }, data: { title } })
  const { id, localizations } = await created.json() as { id: string, localizations: { slug: string }[] }
  expect((await editor.post(`/api/admin/articles/${id}/publish`, { headers: { origin: SITE_ORIGIN }, data: { locale: 'pt-BR', version: 1 } })).status()).toBe(200)
  const path = `/blog/${localizations[0]!.slug}`
  const { html, types } = await jsonLd(editor, path)
  expect(types).toEqual(['BlogPosting', 'BreadcrumbList'])
  // In a browser: no alert runs and no executable script holds the title (it may appear, escaped, in data blocks
  // and in quoted attributes such as og:title, where it is inert)
  let alerted = false
  page.on('dialog', async (dialog) => {
    alerted = true
    await dialog.dismiss()
  })
  await page.goto(path)
  const executable = await page.locator('script').evaluateAll(scripts => scripts
    .filter(script => ['', 'module', 'text/javascript'].includes(script.getAttribute('type') ?? ''))
    .filter(script => script.textContent?.includes('alert(1)')).length)
  expect(executable).toBe(0)
  expect(alerted).toBe(false)
  const posting = JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)![1]!) as { '@graph': { headline?: string }[] }
  expect(posting['@graph'][0]!.headline).toBe(title)
})
