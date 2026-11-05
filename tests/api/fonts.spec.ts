// F01-T3: fonts come from the site itself, with metric-matched fallbacks and no preload (ADR-0010 §4)
import { expect, test } from '@playwright/test'
import { DISPLAY_FALLBACK_CSS, DISPLAY_FALLBACK_METRICS, fallbackFamilies, FONT_FAMILIES, FONT_LOADING_SCRIPT, FONT_PENDING_CSS, fontFaces } from '../../shared/design/fonts'

test('the home inlines same-origin @font-face rules, their fallbacks and the first-visit loader, with no preload', async ({ request }) => {
  const html = await (await request.get('/')).text()
  const head = html.slice(0, html.indexOf('</head>'))

  // Fonts wait for `load` on a first visit, so nothing competes with the LCP
  expect(html).not.toMatch(/<link[^>]*as="font"/)
  expect(head).toContain(`<script>${FONT_LOADING_SCRIPT}</script>`)
  expect(head).toContain(FONT_PENDING_CSS)

  const rules = [...head.matchAll(/@font-face\{[^}]*\}/g)].map(match => match[0])
  for (const family of FONT_FAMILIES) {
    // The minifier may drop the quotes around the family name
    expect(rules.some(rule => rule.includes(`font-family:${family.name};`) || rule.includes(`font-family:"${family.name}";`)), family.name).toBe(true)
  }
  // Nothing from another origin, and no local() copies of our families (only the fallbacks use local system fonts)
  expect(rules.join('')).not.toMatch(/url\((?!\/fonts\/)/)
  expect(rules.filter(rule => !rule.includes('Fallback')).join('')).not.toContain('local(')

  // Every fallback the pending CSS names exists, with metric overrides, so the later swap does not move the layout
  const fallbackRules = rules.filter(rule => rule.includes('Fallback'))
  for (const name of FONT_FAMILIES.flatMap(fallbackFamilies)) {
    const unquoted = name.replaceAll('"', '').replace(': ', '\\: ')
    const rule = fallbackRules.find(candidate => candidate.includes(`font-family:${unquoted};`) || candidate.includes(`font-family:${name};`))
    expect(rule, name).toBeDefined()
    expect(rule).toMatch(/size-adjust:[\d.]+%/)
    expect(rule).toMatch(/ascent-override:[\d.]+%/)
  }
})

test('font files are served as immutable WOFF2', async ({ request }) => {
  for (const face of FONT_FAMILIES.flatMap(fontFaces).filter(face => face.subset === 'latin' && face.style === 'normal')) {
    const response = await request.get(face.src)
    expect(response.status(), face.src).toBe(200)
    expect(response.headers()['content-type']).toBe('font/woff2')
    expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
  }
})

test('display titles get the narrower fallbacks in the HTML only, built from the faces @nuxt/fonts generates', async ({ request }) => {
  // F11-T5: in the server-rendered head, never in the JS (app.head would serialize it into the bundle)
  const html = await (await request.get('/')).text()
  const head = html.slice(0, html.indexOf('</head>'))
  expect(head).toContain(`<style>${DISPLAY_FALLBACK_CSS}</style>`)
  const entry = html.match(/<script type="module" src="([^"]+)"/)?.[1]
  expect(entry).toBeTruthy()
  expect(await (await request.get(entry!)).text()).not.toContain('Fraunces Fallback 83')

  // The copied metrics are still the ones @nuxt/fonts generates for the Fraunces fallbacks
  for (const [local, metrics] of Object.entries(DISPLAY_FALLBACK_METRICS)) {
    const rule = [...head.matchAll(/@font-face\{[^}]*\}/g)].map(match => match[0]).find(text => text.includes(`Fraunces Fallback\\: ${local};`))
    expect(rule, local).toBeTruthy()
    expect(rule, local).toContain(`size-adjust:${metrics.sizeAdjust}%`)
    expect(rule, local).toContain(`ascent-override:${metrics.ascent}%`)
    expect(rule, local).toContain(`descent-override:${metrics.descent}%`)
  }
})
