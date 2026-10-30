// The text of inline content, a hard break counting as a space. Its own module with no imports: public pages (the
// table of contents, heading anchors) use it, and derive.ts would bring the canonical JSON and, through chunk
// ordering, zod schemas into their JS (F06-T5)
interface InlineLike {
  type: string
  text?: string
}

export function inlineText(content: readonly InlineLike[] | undefined): string {
  return (content ?? []).map(node => (node.type === 'text' ? node.text ?? '' : ' ')).join('')
}
