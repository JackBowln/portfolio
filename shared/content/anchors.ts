// Heading anchors (F05-T4, decision 2): a readable slug of the heading's text, unique in the page. The renderer
// sets it as the heading's id and the table of contents (F06) links to it, so both call this one function.
// Headings are top-level blocks only (the schema allows them nowhere else)
import type { DocumentJson } from './document-schema.ts'
import { inlineText } from './derive.ts'

const MAX_ANCHOR = 64
/** Ids the page frame already uses (skip link target, mobile menu) */
const RESERVED = new Set(['main', 'site-menu'])
const FALLBACK = 'section'

/** "Como funciona? (v2)" → "como-funciona-v2": ASCII letters and digits, accents dropped */
export function anchorSlug(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_ANCHOR)
    .replace(/^-+|-+$/g, '')
  return slug === '' ? FALLBACK : slug
}

/** Block id → anchor, for every heading in document order; repeats get -2, -3… */
export function headingAnchors(doc: DocumentJson): Map<string, string> {
  const taken = new Set(RESERVED)
  const anchors = new Map<string, string>()
  // The renderer calls this on documents the schema may not have seen: anything but a heading object is skipped
  for (const block of doc.content as unknown[]) {
    if (typeof block !== 'object' || block === null || (block as { type?: unknown }).type !== 'heading') {
      continue
    }
    const { attrs, content } = block as { attrs?: { id?: unknown }, content?: unknown }
    const base = anchorSlug(Array.isArray(content) ? inlineText(content.filter(node => typeof node?.text === 'string' || node?.type === 'hardBreak')) : '')
    let anchor = base
    for (let n = 2; taken.has(anchor); n++) {
      anchor = `${base}-${n}`
    }
    taken.add(anchor)
    anchors.set(String(attrs?.id), anchor)
  }
  return anchors
}
