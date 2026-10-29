// F05-T3: the real Shiki output, with the admin's configuration, in every offered language, passes the HAST
// allowlist the server applies (closes the F05-T2 risk) and shows exactly the code. Since the F05 contrast fix,
// every token color also meets WCAG AA (4.5:1) on its theme's background, light and dark
import { describe, expect, it } from 'vitest'
import { highlightCode } from '~/utils/admin/highlight'
import { CODE_LANGUAGES } from '~/utils/admin/code-languages'
import type { CodeLanguage } from '~/utils/admin/code-languages'
import { hastIssues, hastText } from '#shared/content/hast'
import type { HastElement, HastText } from '#shared/content/hast'
import { validateDocument } from '#shared/content/document-schema'

const SAMPLES: Record<CodeLanguage, string> = {
  text: 'texto simples\n  com recuo',
  ts: 'export const sum = (a: number, b: number): number => a + b // soma\n/** doc */\ninterface X { y?: string }',
  tsx: 'export const A = () => <div className="a">{1 + 1}</div>',
  js: 'const re = /a+b/g // regex\nconsole.log(`x ${re}`, 42, null)',
  jsx: '<Button onClick={() => alert(1)}>ok</Button>',
  vue: '<template>\n  <p v-if="ok">{{ msg }}</p>\n</template>\n<script setup lang="ts">\nconst ok = true\n</script>\n<style scoped>\np { color: red }\n</style>',
  html: '<!doctype html>\n<!-- comentário -->\n<a href="javascript:alert(1)" onclick="x()">link</a><script>alert(1)</script>',
  css: '/* comentário */\n.a:hover { background: url("x.png"); --v: 1px }\n@media (min-width: 1px) { b { color: #fff !important } }',
  json: '{ "a": [1, true, null], "b": "c" }',
  bash: '#!/usr/bin/env bash\nfor f in *.ts; do echo "$f"; done | grep -v test',
  sql: 'SELECT id FROM article_localizations WHERE locale = \'pt-BR\' -- comentário',
  yaml: '# comentário\nname: ci\non: [push]\njobs:\n  test: { runs-on: ubuntu-latest, timeout: 10, cache: true }',
  md: '# Título\n\n**negrito** e `código`\n\n```ts\nconst a = 1\n```',
  diff: 'diff --git a/x b/x\n--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new\n context',
  python: 'def f(x: int) -> str:\n    """doc"""\n    return f"{x}"',
  go: 'package main\n\n// main prints\nfunc main() { x := 1; println("oi", x) }',
  rust: '// comentário\n#[derive(Debug)]\nfn main() { let v: Vec<u8> = vec![1]; println!("{:?}", v); }',
  dockerfile: '# comentário\nFROM node:24-alpine AS base\nENV PORT=8080\nRUN corepack enable && pnpm i\nCMD ["node", "x.js"]',
}

/** WCAG relative-luminance contrast of two #rgb / #rrggbb colors */
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const digits = hex.replace('#', '')
    const full = digits.length === 3 ? [...digits].map(digit => digit + digit).join('') : digits.slice(0, 6)
    const [r, g, b] = [0, 2, 4].map(index => Number.parseInt(full.slice(index, index + 2), 16) / 255)
      .map(channel => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter! + 0.05) / (darker! + 0.05)
}

describe('highlightCode', () => {
  it.each(Object.keys(CODE_LANGUAGES) as CodeLanguage[])('%s passes the allowlist and keeps the text', async (language) => {
    const code = SAMPLES[language]
    const pre = await highlightCode(code, language)
    expect(hastIssues(pre)).toEqual([])
    expect(hastText(pre)).toBe(code)
    expect(pre.properties.class).toBe('shiki shiki-themes github-light-default github-dark-default')
    expect(validateDocument({ type: 'doc', content: [{ type: 'codeBlock', attrs: { id: 'c', language, code, hast: pre } }] }).ok).toBe(true)
  }, 20_000)

  // WCAG 2.2 AA (1.4.3): every color a token shows, against the background of the same theme
  it.each(Object.keys(CODE_LANGUAGES) as CodeLanguage[])('%s tokens have at least 4.5:1 contrast in both themes', async (language) => {
    const pre = await highlightCode(SAMPLES[language], language)
    const vars = (style: unknown) => Object.fromEntries(String(style ?? '').split(';').filter(Boolean).map(part => part.split(':').map(item => item.trim()) as [string, string]))
    const root = vars(pre.properties.style)
    const low: string[] = []
    const visit = (node: HastElement | HastText, inherited: Record<string, string>) => {
      if (node.type === 'text') {
        if (node.value.trim() === '') {
          return
        }
        for (const theme of ['light', 'dark'] as const) {
          const ratio = contrast(inherited[`--shiki-${theme}`]!, root[`--shiki-${theme}-bg`]!)
          if (ratio < 4.5) {
            low.push(`${theme} ${inherited[`--shiki-${theme}`]} on ${root[`--shiki-${theme}-bg`]} = ${ratio.toFixed(2)} for ${JSON.stringify(node.value)}`)
          }
        }
        return
      }
      const own = { ...inherited, ...vars(node.properties.style) }
      node.children.forEach(child => visit(child, own))
    }
    visit(pre, root)
    expect(low).toEqual([])
  }, 20_000)

  it('highlights tokens with the theme variables only', async () => {
    const pre = await highlightCode('const a = 1', 'ts')
    const styles = JSON.stringify(pre).match(/"style":"[^"]*"/g) ?? []
    expect(styles.length).toBeGreaterThan(2)
    for (const style of styles) {
      expect(style).not.toMatch(/(?:^|[;"])color:/)
    }
  })

  it('handles empty code and trailing newlines', async () => {
    for (const code of ['', '\n', 'a\n\n']) {
      expect(hastText(await highlightCode(code, 'ts'))).toBe(code)
    }
  })
})
