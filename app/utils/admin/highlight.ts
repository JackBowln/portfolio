// Shiki in the admin browser (ADR-0006 §3): the JavaScript regex engine (no WASM, which the admin page CSP does not
// allow), two themes as CSS variables only (defaultColor: false) and one grammar chunk per language, loaded when a
// block first uses it. The server never highlights; it checks this output against shared/content/hast.ts
import type { HighlighterCore, LanguageInput } from 'shiki/core'
import { hastIssues } from '#shared/content/hast'
import type { HastElement } from '#shared/content/hast'
import type { CodeLanguage } from './code-languages'

const THEMES = { light: 'github-light', dark: 'github-dark' } as const

const GRAMMARS: Record<Exclude<CodeLanguage, 'text'>, { id: string, load: () => Promise<{ default: LanguageInput }> }> = {
  ts: { id: 'typescript', load: () => import('shiki/langs/typescript.mjs') },
  tsx: { id: 'tsx', load: () => import('shiki/langs/tsx.mjs') },
  js: { id: 'javascript', load: () => import('shiki/langs/javascript.mjs') },
  jsx: { id: 'jsx', load: () => import('shiki/langs/jsx.mjs') },
  vue: { id: 'vue', load: () => import('shiki/langs/vue.mjs') },
  html: { id: 'html', load: () => import('shiki/langs/html.mjs') },
  css: { id: 'css', load: () => import('shiki/langs/css.mjs') },
  json: { id: 'json', load: () => import('shiki/langs/json.mjs') },
  bash: { id: 'bash', load: () => import('shiki/langs/bash.mjs') },
  sql: { id: 'sql', load: () => import('shiki/langs/sql.mjs') },
  yaml: { id: 'yaml', load: () => import('shiki/langs/yaml.mjs') },
  md: { id: 'markdown', load: () => import('shiki/langs/markdown.mjs') },
  diff: { id: 'diff', load: () => import('shiki/langs/diff.mjs') },
  python: { id: 'python', load: () => import('shiki/langs/python.mjs') },
  go: { id: 'go', load: () => import('shiki/langs/go.mjs') },
  rust: { id: 'rust', load: () => import('shiki/langs/rust.mjs') },
  dockerfile: { id: 'docker', load: () => import('shiki/langs/docker.mjs') },
}

let highlighter: Promise<HighlighterCore> | undefined

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ])
    return createHighlighterCore({ themes: [light.default, dark.default], langs: [], engine: createJavaScriptRegexEngine() })
  })()
  return highlighter
}

export class HighlightError extends Error {}

/** The `pre` element for a code block, already checked against the server's allowlist */
export async function highlightCode(code: string, language: CodeLanguage): Promise<HastElement> {
  const shiki = await getHighlighter()
  let lang = 'text'
  if (language !== 'text') {
    const grammar = GRAMMARS[language]
    if (!shiki.getLoadedLanguages().includes(grammar.id)) {
      await shiki.loadLanguage((await grammar.load()).default)
    }
    lang = grammar.id
  }
  const root = shiki.codeToHast(code, { lang, themes: THEMES, defaultColor: false })
  // The JSON form, which is what the document stores: Shiki's elements carry `data: undefined`
  const pre = JSON.parse(JSON.stringify(root.children[0])) as HastElement
  const issues = hastIssues(pre)
  if (issues.length > 0) {
    throw new HighlightError(`Shiki output outside the allowlist: ${issues[0]!.path.join('.')}: ${issues[0]!.message}`)
  }
  return pre
}
