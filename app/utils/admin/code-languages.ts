// Languages the admin highlighter offers (F05-T3, decision 2), as Shiki ids. Names are the languages' own; `text`
// is labeled through i18n. Each grammar is a chunk loaded only when a block uses it (useShiki)
export const CODE_LANGUAGES = {
  text: null,
  ts: 'TypeScript',
  tsx: 'TSX',
  js: 'JavaScript',
  jsx: 'JSX',
  vue: 'Vue',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  bash: 'Bash',
  sql: 'SQL',
  yaml: 'YAML',
  md: 'Markdown',
  diff: 'Diff',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  dockerfile: 'Dockerfile',
} as const

export type CodeLanguage = keyof typeof CODE_LANGUAGES

export function isCodeLanguage(value: string): value is CodeLanguage {
  return Object.hasOwn(CODE_LANGUAGES, value)
}

/** `language-ts` / `lang-ts` classes from pasted HTML, or text */
export function languageFromClass(className: string | null): CodeLanguage {
  const match = /(?:^|\s)lang(?:uage)?-([\w+#-]+)/.exec(className ?? '')
  const id = match?.[1]?.toLowerCase() ?? 'text'
  const aliases: Record<string, CodeLanguage> = { typescript: 'ts', javascript: 'js', shell: 'bash', sh: 'bash', yml: 'yaml', markdown: 'md', py: 'python' }
  const language = aliases[id] ?? id
  return isCodeLanguage(language) ? language : 'text'
}
