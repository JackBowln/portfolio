// F01-T2: pnpm check:contrast reads the shipped tokens and fails under WCAG 2.2 AA (ADR-0010 §2)
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkContrast, CONTRAST_PAIRS, contrastPasses } from '../../shared/design/contrast'
import { customProperties, parseOklch, themeColors } from '../../shared/design/css-tokens'

const MAIN_CSS = readFileSync('app/assets/css/main.css', 'utf8')

const css = (tokens: string) => `@theme {
  --color-ink: oklch(0.2 0.02 250);
  --color-paper: oklch(0.96 0.01 75);
  ${tokens}
}`

function runScript(file: string) {
  return spawnSync(process.execPath, ['scripts/check-contrast.ts', '--css', file], { encoding: 'utf8' })
}

describe('css tokens', () => {
  it('parses oklch() and nothing looser', () => {
    expect(parseOklch('oklch(0.5 0.1 250)')).toEqual({ l: 0.5, c: 0.1, h: 250 })
    expect(parseOklch('oklch(0.5 0.1 250 / 0.5)')).toBeUndefined()
    expect(parseOklch('#fff')).toBeUndefined()
  })

  it('keeps the first declaration and ignores comments', () => {
    const properties = customProperties('/* --a: x; */ :root { --a: 1; } @media (x) { :root { --a: 2; } }')
    expect(properties.get('--a')).toBe('1')
  })

  it('resolves light-dark() through var() to both themes', () => {
    const colors = themeColors(css('--color-text: light-dark(var(--color-ink), var(--color-paper));'))
    expect(colors.light.text).toEqual({ l: 0.2, c: 0.02, h: 250 })
    expect(colors.dark.text).toEqual({ l: 0.96, c: 0.01, h: 75 })
  })

  it('rejects a semantic token it cannot resolve', () => {
    expect(() => themeColors(css('--color-text: light-dark(var(--color-missing), var(--color-paper));'))).toThrow(/color-missing/)
    expect(() => themeColors(css('--color-text: light-dark(#000, var(--color-paper));'))).toThrow(/#000/)
    expect(() => themeColors(css('--color-text: light-dark(var(--color-ink));'))).toThrow(/two colors/)
  })
})

describe('check:contrast', () => {
  it('main.css defines every token the pairs use, and all pairs pass AA in both themes', () => {
    const report = checkContrast(themeColors(MAIN_CSS))
    expect(report.problems).toEqual([])
    expect(report.results).toHaveLength(CONTRAST_PAIRS.length * 2)
    expect(report.results.filter(result => !result.pass)).toEqual([])
  })

  it('fails on a pair under the minimum, on a missing token and outside sRGB', () => {
    const bad = { text: { l: 0.7, c: 0, h: 0 }, bg: { l: 0.96, c: 0, h: 0 } }
    const report = checkContrast({ light: bad }, [{ foreground: 'text', background: 'bg', use: 'text' }, { foreground: 'focus', background: 'bg', use: 'ui' }])
    expect(report.results[0]?.pass).toBe(false)
    expect(report.problems).toEqual(['light: focus × bg names a missing token'])
    expect(contrastPasses(report)).toBe(false)
    expect(checkContrast({ light: { x: { l: 0.7, c: 0.4, h: 150 } } }, []).problems).toEqual(['light: x is outside sRGB'])
  })

  it('the script exits 0 on main.css and 1 with a bad pair', () => {
    expect(runScript('app/assets/css/main.css').status).toBe(0)

    // main.css with a muted text too light to read on the light background
    const dir = mkdtempSync(join(tmpdir(), 'contrast-'))
    const file = join(dir, 'bad.css')
    writeFileSync(file, MAIN_CSS.replace(/--color-text-muted: light-dark\([^;]+;/, '--color-text-muted: light-dark(oklch(0.75 0.01 245), var(--color-night-300));'))
    const result = runScript(file)
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/FAIL light text-muted × bg/)
  })
})
