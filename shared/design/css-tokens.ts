// Reads the color tokens of app/assets/css/main.css, so the contrast check and the styleguide use the shipped values.
// Supported forms: `--color-x: oklch(l c h);` (raw) and `--color-x: light-dark(<light>, <dark>);` (semantic), where each
// side is oklch() or var(--color-raw). Anything else in a semantic token is an error, never silently skipped.
import type { Oklch } from './contrast.ts'

export type ThemeName = 'light' | 'dark'
export type ThemeColors = Record<ThemeName, Record<string, Oklch>>

/** First declaration of every custom property (later ones live in media queries or theme overrides) */
export function customProperties(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const properties = new Map<string, string>()
  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    const [, name = '', value = ''] = match
    if (!properties.has(name)) {
      properties.set(name, value.trim())
    }
  }
  return properties
}

export function parseOklch(value: string): Oklch | undefined {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim())
  if (!match) {
    return undefined
  }
  const [, l, c, h] = match.map(Number)
  return { l: l ?? 0, c: c ?? 0, h: h ?? 0 }
}

/** Splits function arguments on top-level commas */
function splitArguments(inner: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of inner) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    }
    else {
      current += char
    }
  }
  parts.push(current.trim())
  return parts
}

function resolveColor(value: string, properties: Map<string, string>, token: string): Oklch {
  const reference = /^var\(\s*(--color-[\w-]+)\s*\)$/.exec(value)
  const resolved = reference ? properties.get(reference[1] ?? '') : value
  const color = resolved === undefined ? undefined : parseOklch(resolved)
  if (!color) {
    throw new Error(`${token}: cannot resolve "${value}" to oklch(l c h)`)
  }
  return color
}

/** Semantic colors (the light-dark() tokens) per theme, keyed without the --color- prefix */
export function themeColors(css: string): ThemeColors {
  const properties = customProperties(css)
  const colors: ThemeColors = { light: {}, dark: {} }
  for (const [name, value] of properties) {
    if (!name.startsWith('--color-') || !value.startsWith('light-dark(')) {
      continue
    }
    const args = splitArguments(value.slice('light-dark('.length, -1))
    if (args.length !== 2 || !value.endsWith(')')) {
      throw new Error(`${name}: light-dark() needs exactly two colors`)
    }
    const token = name.slice('--color-'.length)
    colors.light[token] = resolveColor(args[0] ?? '', properties, name)
    colors.dark[token] = resolveColor(args[1] ?? '', properties, name)
  }
  return colors
}
