// Languages a code block can carry (F05-T3, decision 2), as Shiki ids. Names are the languages' own; `text` is
// labeled through i18n. The admin highlighter loads one grammar per id; the public renderer only shows the name
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

/** The language's display name; null for plain text and for ids outside the list */
export function codeLanguageName(value: string): string | null {
  return isCodeLanguage(value) ? CODE_LANGUAGES[value] : null
}
