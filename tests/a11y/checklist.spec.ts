// F12-T2 (accessibility.md §2): the manual checklist, measured where a browser can measure it, on R1–R8 and the
// contact form. Structure (landmarks, skip link first, one h1, no skipped levels, lang on the language names), focus
// (visible, an indicator of 3:1 against what is behind it, never under the sticky header: 2.4.7, 2.4.11, 1.4.11),
// reflow at 320 px and at 200% zoom (1.4.10, 1.4.4), the text-spacing override (1.4.12) and target size (2.5.8). Each
// route collects its findings, so one run lists them all. What needs a person (VoiceOver) is in the audit report
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { ensureBlogFixture } from '../support/blog'
import { ensureReferenceContent, REFERENCE } from '../support/reference-content'

const ROUTES = ['/', '/blog', `/blog/${REFERENCE.article}`, '/projetos', `/projetos/${REFERENCE.project}`, '/sobre', '/contato', '/de/blog/x']

test.beforeAll(async ({ request }) => {
  await ensureBlogFixture(request)
  await ensureReferenceContent(request)
})

async function open(page: Page, path: string, width: number, height = 900) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean((document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__))).toBe(true)
}

/** Landmarks, the skip link as the first stop, one h1 and headings without skipped levels */
async function structure(page: Page): Promise<string[]> {
  const findings = await page.evaluate(() => {
    const issues: string[] = []
    const count = (selector: string) => document.querySelectorAll(selector).length
    if (count('main') !== 1) issues.push(`${count('main')} main landmarks`)
    if (count('body > div header, header[role="banner"], #__nuxt header') < 1) issues.push('no header')
    if (count('footer') < 1) issues.push('no footer')
    for (const nav of document.querySelectorAll('nav')) {
      if (!nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby')) issues.push(`a nav without a label: ${nav.outerHTML.slice(0, 80)}`)
    }
    const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(heading => (heading as HTMLElement).offsetParent !== null || getComputedStyle(heading).position === 'fixed').map(heading => Number(heading.tagName[1]))
    if (levels.filter(level => level === 1).length !== 1) issues.push(`${levels.filter(level => level === 1).length} h1`)
    levels.forEach((level, index) => {
      if (index > 0 && level > levels[index - 1]! + 1) issues.push(`heading level skips from h${levels[index - 1]} to h${level}`)
    })
    for (const link of document.querySelectorAll('footer a[hreflang]')) {
      if (!link.getAttribute('lang')) issues.push(`language name without lang: ${link.textContent}`)
    }
    return issues
  })
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), href: document.activeElement?.getAttribute('href'), target: Boolean(document.querySelector('main#main, #main')) }))
  if (first.href !== '#main' || !first.target) {
    findings.push(`the first Tab stop is not the skip link to #main (${first.text} → ${first.href})`)
  }
  const shown = await page.evaluate(() => document.activeElement!.getBoundingClientRect())
  if (shown.width < 24 || shown.height < 24) {
    findings.push(`the focused skip link is ${Math.round(shown.width)}×${Math.round(shown.height)} px`)
  }
  return findings
}

/** Tab through the page: each stop shows an indicator of 3:1 or more, and the sticky header never covers it */
async function focus(page: Page): Promise<string[]> {
  const findings: string[] = []
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let stop = 0; stop < 40; stop++) {
    await page.keyboard.press('Tab')
    const result = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) {
        return { done: true }
      }
      // Any CSS color to sRGB, through a canvas (tokens are OKLCH)
      const canvas = document.createElement('canvas').getContext('2d')!
      const rgb = (color: string) => {
        canvas.clearRect(0, 0, 1, 1)
        canvas.fillStyle = '#000'
        canvas.fillStyle = color
        canvas.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data
        return { r: r!, g: g!, b: b!, a: a! }
      }
      const luminance = ({ r, g, b }: { r: number, g: number, b: number }) => {
        const [R, G, B] = [r, g, b].map((value) => {
          const channel = value / 255
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * R! + 0.7152 * G! + 0.0722 * B!
      }
      const background = (node: Element | null): string => {
        for (let current = node; current; current = current.parentElement) {
          const color = getComputedStyle(current).backgroundColor
          if (rgb(color).a > 250) return color
        }
        return getComputedStyle(document.body).backgroundColor
      }
      const style = getComputedStyle(element)
      const width = Number.parseFloat(style.outlineWidth)
      const name = `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}"`
      if (style.outlineStyle === 'none' || width < 2) {
        return { name, issue: `no visible focus outline (${style.outlineStyle} ${style.outlineWidth})` }
      }
      // The outline sits outside the element (outline-offset ≥ 0): measure it against the parent's background
      const ratioOf = (a: string, b: string) => {
        const [l1, l2] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x)
        return (l1! + 0.05) / (l2! + 0.05)
      }
      const ratio = ratioOf(style.outlineColor, background(element.parentElement))
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1), Math.min(Math.max(rect.top + Math.min(rect.height, 8) / 2, 0), innerHeight - 1))
      const header = document.querySelector('header')
      const covered = header && hit && header.contains(hit) && !header.contains(element)
      return { name, issue: ratio < 3 ? `focus indicator contrast ${ratio.toFixed(2)}:1` : covered ? 'covered by the sticky header' : null }
    })
    if ('done' in result) {
      break
    }
    if (result.issue) {
      findings.push(`${result.name}: ${result.issue}`)
    }
  }
  return findings
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
/** What sticks out to the right, for the finding */
const wide = (page: Page) => page.evaluate(() => {
  const width = document.documentElement.clientWidth
  const main = document.querySelector('main')!.getBoundingClientRect().width
  return `inner ${innerWidth} client ${width} main ${Math.round(main)} zoom ${getComputedStyle(document.documentElement).zoom} ` + [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > width + 1).slice(0, 3)
    .map(element => `${element.tagName.toLowerCase()}.${String(element.className).split(' ').slice(0, 3).join('.')}`).join(', ')
})

/** 1.4.12: line height 1.5, paragraph spacing 2em, letter 0.12em, word 0.16em; nothing overflows or gets clipped */
async function textSpacing(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important } p { margin-bottom: 2em !important }' })
  const findings = (await overflow(page)) > 0 ? [`horizontal overflow of ${await overflow(page)} px with spaced text (${await wide(page)})`] : []
  const clipped = await page.evaluate(() => [...document.querySelectorAll('a, button, label, h1, h2, h3, p, li, summary')]
    .filter((element) => {
      const style = getComputedStyle(element)
      const hides = style.overflow === 'hidden' || style.overflowY === 'hidden' || style.textOverflow === 'ellipsis'
      return hides && (element as HTMLElement).offsetParent !== null && element.scrollHeight > element.clientHeight + 1 && !element.classList.contains('sr-only')
    })
    .map(element => `${element.tagName.toLowerCase()} "${element.textContent?.trim().slice(0, 40)}"`))
  return [...findings, ...clipped.map(name => `${name} clipped with spaced text`)]
}

/** 2.5.8: targets of 24×24 px or more, except links inside a sentence */
async function targets(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [tabindex="0"]')]
    .filter((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || element.closest('[inert], [aria-hidden="true"]')) return false
      // Hidden until focused (the skip link): measured once it has focus, in structure()
      if (rect.width <= 1 && rect.height <= 1) return false
      const inline = element.tagName === 'A' && style.display === 'inline' && element.parentElement?.closest('p, li, figcaption, td, dd')
      return !inline && (rect.width < 24 || rect.height < 24)
    })
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}" is ${Math.round(rect.width)}×${Math.round(rect.height)} px`
    }))
}

for (const path of ROUTES) {
  test(`${path}: structure, focus, reflow, text spacing and targets`, async ({ page }) => {
    test.setTimeout(90_000)
    const findings: string[] = []
    for (const width of [1280, 390]) {
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme })
        await open(page, path, width)
        findings.push(...(await structure(page)).map(finding => `${width}px ${scheme}: ${finding}`))
        findings.push(...(await focus(page)).map(finding => `${width}px ${scheme}: ${finding}`))
      }
      findings.push(...(await targets(page)).map(finding => `${width}px: ${finding}`))
    }
    // Reflow at 320 px, and 200% zoom (a 1280 px window at 200% lays out at 640 CSS px)
    for (const width of [320, 640]) {
      await open(page, path, width)
      const extra = await overflow(page)
      if (extra > 0) findings.push(`${width}px: horizontal overflow of ${extra} px (${await wide(page)})`)
    }
    await open(page, path, 1280)
    findings.push(...(await textSpacing(page)).map(finding => `1280px: ${finding}`))
    await open(page, path, 390)
    findings.push(...(await textSpacing(page)).map(finding => `390px: ${finding}`))
    expect([...new Set(findings)]).toEqual([])
  })
}

test('the contact form: visible labels, autocomplete, errors tied to their fields and announced', async ({ page }) => {
  await open(page, '/contato', 1280)
  await expect(page.locator('form[data-ready]')).toBeVisible()
  await expect(page.getByLabel('Nome')).toHaveAttribute('autocomplete', 'name')
  await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'email')
  for (const label of ['Nome', 'E-mail', 'Mensagem']) {
    await expect(page.locator('label', { hasText: label }).first()).toBeVisible()
  }
  await page.getByLabel('Nome').fill('Visitante')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(/.+/)
  // Nothing typed is lost
  await expect(page.getByLabel('Nome')).toHaveValue('Visitante')
})

// Screen reader, approximated through the accessibility tree (accessibility.md §2); VoiceOver itself is in the report
test('links read on their own: no vague names, and one name never leads to two places', async ({ page }) => {
  const VAGUE = ['leia mais', 'saiba mais', 'clique aqui', 'aqui', 'mais', 'ver mais', 'link']
  const findings: string[] = []
  for (const path of ROUTES) {
    await open(page, path, 1280)
    const links = await page.locator('a[href]').evaluateAll(nodes => nodes.filter(node => (node as HTMLElement).offsetParent !== null || node.getBoundingClientRect().width > 0)
      .map(node => ({ name: (node.getAttribute('aria-label') ?? node.textContent ?? '').replace(/\s+/g, ' ').trim(), href: new URL((node as HTMLAnchorElement).href).pathname + new URL((node as HTMLAnchorElement).href).hash })))
    const places = new Map<string, Set<string>>()
    for (const link of links) {
      if (!link.name) findings.push(`${path}: a link without a name → ${link.href}`)
      if (VAGUE.includes(link.name.toLowerCase())) findings.push(`${path}: a vague link "${link.name}"`)
      places.set(link.name, (places.get(link.name) ?? new Set()).add(link.href))
    }
    for (const [name, hrefs] of places) {
      if (hrefs.size > 1) findings.push(`${path}: "${name}" leads to ${[...hrefs].join(', ')}`)
    }
  }
  expect(findings).toEqual([])
})

test('a navigation in the site announces the new page', async ({ page }) => {
  await open(page, '/', 1280)
  await page.getByRole('banner').getByRole('link', { name: 'Blog', exact: true }).click()
  await expect(page).toHaveURL(/\/blog$/)
  await expect(page.locator('#__nuxt-route-announcer, [id^="nuxt-route-announcer"], span[aria-live]').filter({ hasText: /Blog/ }).first()).toBeAttached()
})

test('a code block names its language and announces the copy', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page, `/blog/${REFERENCE.article}`, 1280)
  await expect(page.getByRole('group', { name: 'Código em TypeScript' })).toBeVisible()
  await page.getByRole('button', { name: 'Copiar', exact: true }).click()
  await expect(page.locator('[data-content-copy-status]')).toHaveText('Copiado')
})

test('the split hero title is read as one sentence while it animates', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const title = page.getByRole('heading', { level: 1 })
  const text = (await title.textContent())!.replace(/\s+/g, ' ').trim()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'started', { timeout: 15_000 })
  await expect(title).toHaveAccessibleName(text)
})
