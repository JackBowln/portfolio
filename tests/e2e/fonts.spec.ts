// F01-T3: no font request leaves the site, in any locale; diacritics of pt, es, de and fr render with our faces
import { expect, test } from '@playwright/test'

const PANGRAMS = [
  'À noite, vovô Kowalsky vê o ímã cair no pé do pinguim queixoso e vovó põe açúcar no chá de tâmaras do jabuti feliz.',
  'El veloz murciélago hindú comía feliz cardillo y kiwi. La cigüeña tocaba el saxofón detrás del palenque de paja.',
  'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich.',
  'Voix ambiguë d’un cœur qui, au zéphyr, préfère les jattes de kiwis.',
  'The quick brown fox jumps over the lazy dog.',
]
// Outside latin: makes the browser fetch the latin-ext faces
const LATIN_EXT_SAMPLE = 'Łódź, Ğ, ő'

for (const path of ['/', '/en', '/es', '/de', '/fr']) {
  test(`${path}: every request stays on the site and the text renders with our fonts`, async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const external: string[] = []
    const fontRequests: string[] = []
    page.on('request', (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) {
        external.push(request.url())
      }
      if (request.resourceType() === 'font') {
        fontRequests.push(new URL(request.url()).pathname)
      }
    })

    await page.goto(path)
    await page.evaluate(({ pangrams, extra }) => {
      const section = document.createElement('section')
      for (const [index, text] of [...pangrams, extra].entries()) {
        for (const font of ['var(--font-display)', 'var(--font-sans)', 'var(--font-mono)']) {
          const paragraph = document.createElement('p')
          paragraph.textContent = text
          paragraph.style.fontFamily = font
          paragraph.style.fontStyle = index === 0 ? 'italic' : 'normal'
          section.append(paragraph)
        }
      }
      document.body.append(section)
    }, { pangrams: PANGRAMS, extra: LATIN_EXT_SAMPLE })
    await page.evaluate(() => document.fonts.ready)

    // Each character falls in the unicode-range of one of our faces that finished loading, so no system font fills in.
    // (document.fonts.check() alone would pass vacuously when no face matches the family)
    const uncovered = await page.evaluate(() => {
      const inRange = (char: string, range: string) => range.split(',').some((part) => {
        const [start = '', end] = part.trim().replace(/^U\+/i, '').split('-')
        const code = char.codePointAt(0) ?? -1
        return code >= Number.parseInt(start, 16) && code <= Number.parseInt(end ?? start, 16)
      })
      const faces = [...document.fonts].filter(face => face.status === 'loaded')
      return ['Fraunces', 'Inter', 'JetBrains Mono'].flatMap((family) => {
        const own = faces.filter(face => face.family.replaceAll('"', '') === family)
        return ['œ', 'ß', 'ñ', 'ç', 'ã', 'ü', 'Ł'].filter(char => !own.some(face => inRange(char, face.unicodeRange)))
          .map(char => `${family} ${char}`)
      })
    })
    expect(uncovered).toEqual([])

    expect(external).toEqual([])
    expect(fontRequests.every(font => font.startsWith('/fonts/v5.3.0/'))).toBe(true)
    expect(fontRequests.some(font => font.includes('latin-ext'))).toBe(true)
  })
}

test.describe('first-visit loading', () => {
  async function fontTimeline(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      const fonts = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(entry => entry.name.endsWith('.woff2'))
      return { loadStart: navigation?.loadEventStart ?? 0, fontStarts: fonts.map(entry => entry.startTime) }
    })
  }

  test('no font is requested before load; then they arrive, and the next visit uses them from the start', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fonts'))).toBe('1')
    const first = await fontTimeline(page)
    expect(first.fontStarts.length).toBeGreaterThan(0)
    expect(first.fontStarts.every(start => start >= first.loadStart)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.classList.contains('fonts-pending'))).toBe(false)

    await page.reload()
    const second = await fontTimeline(page)
    expect(second.fontStarts.some(start => start < second.loadStart)).toBe(true)
  })

  test('the swap from the fallback to the web fonts does not move the layout', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { shifts: number }).shifts = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number }[]) {
          (window as unknown as { shifts: number }).shifts += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('fonts'))).toBe('1')
    await page.evaluate(() => document.fonts.ready)
    const shifts = await page.evaluate(() => (window as unknown as { shifts: number }).shifts)
    // Metric-matched fallbacks: any residual shift stays far below the 0.02 lab target (performance-budgets §4)
    expect(shifts).toBeLessThan(0.02)
  })
})
