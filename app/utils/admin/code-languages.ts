// Languages the admin highlighter offers: the list is shared with the public renderer. Each grammar is a chunk
// loaded only when a block uses it (highlight.ts)
import { isCodeLanguage } from '#shared/content/code-languages'
import type { CodeLanguage } from '#shared/content/code-languages'

export { CODE_LANGUAGES, isCodeLanguage } from '#shared/content/code-languages'
export type { CodeLanguage } from '#shared/content/code-languages'

/** `language-ts` / `lang-ts` classes from pasted HTML, or text */
export function languageFromClass(className: string | null): CodeLanguage {
  const match = /(?:^|\s)lang(?:uage)?-([\w+#-]+)/.exec(className ?? '')
  const id = match?.[1]?.toLowerCase() ?? 'text'
  const aliases: Record<string, CodeLanguage> = { typescript: 'ts', javascript: 'js', shell: 'bash', sh: 'bash', yml: 'yaml', markdown: 'md', py: 'python' }
  const language = aliases[id] ?? id
  return isCodeLanguage(language) ? language : 'text'
}
