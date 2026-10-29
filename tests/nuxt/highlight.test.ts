// F05-T3: the real Shiki output, with the admin's configuration, in every offered language, passes the HAST
// allowlist the server applies (closes the F05-T2 risk) and shows exactly the code
import { describe, expect, it } from 'vitest'
import { highlightCode } from '~/utils/admin/highlight'
import { CODE_LANGUAGES } from '~/utils/admin/code-languages'
import type { CodeLanguage } from '~/utils/admin/code-languages'
import { hastIssues, hastText } from '#shared/content/hast'
import { validateDocument } from '#shared/content/document-schema'

const SAMPLES: Record<CodeLanguage, string> = {
  text: 'texto simples\n  com recuo',
  ts: 'export const sum = (a: number, b: number): number => a + b // soma\n/** doc */\ninterface X { y?: string }',
  tsx: 'export const A = () => <div className="a">{1 + 1}</div>',
  js: 'const re = /a+b/g\nconsole.log(`x ${re}`)',
  jsx: '<Button onClick={() => alert(1)}>ok</Button>',
  vue: '<template>\n  <p v-if="ok">{{ msg }}</p>\n</template>\n<script setup lang="ts">\nconst ok = true\n</script>\n<style scoped>\np { color: red }\n</style>',
  html: '<!doctype html>\n<a href="javascript:alert(1)" onclick="x()">link</a><script>alert(1)</script>',
  css: '.a:hover { background: url("x.png"); --v: 1px }\n@media (min-width: 1px) { b { color: #fff } }',
  json: '{ "a": [1, true, null], "b": "c" }',
  bash: '#!/usr/bin/env bash\nfor f in *.ts; do echo "$f"; done | grep -v test',
  sql: 'SELECT id FROM article_localizations WHERE locale = \'pt-BR\' -- comentário',
  yaml: 'name: ci\non: [push]\njobs:\n  test: { runs-on: ubuntu-latest }',
  md: '# Título\n\n**negrito** e `código`\n\n```ts\nconst a = 1\n```',
  diff: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new',
  python: 'def f(x: int) -> str:\n    """doc"""\n    return f"{x}"',
  go: 'package main\n\nfunc main() { println("oi") }',
  rust: 'fn main() { let v: Vec<u8> = vec![1]; println!("{:?}", v); }',
  dockerfile: 'FROM node:24-alpine\nRUN corepack enable && pnpm i\nCMD ["node", "x.js"]',
}

describe('highlightCode', () => {
  it.each(Object.keys(CODE_LANGUAGES) as CodeLanguage[])('%s passes the allowlist and keeps the text', async (language) => {
    const code = SAMPLES[language]
    const pre = await highlightCode(code, language)
    expect(hastIssues(pre)).toEqual([])
    expect(hastText(pre)).toBe(code)
    expect(pre.properties.class).toBe('shiki shiki-themes github-light github-dark')
    expect(validateDocument({ type: 'doc', content: [{ type: 'codeBlock', attrs: { id: 'c', language, code, hast: pre } }] }).ok).toBe(true)
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
