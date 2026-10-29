// A code block's HAST as Vue elements, never v-html (ADR-0006 §5). The schema already checked it on save; this
// renderer applies the same allowlist again on every node, so a document that skipped the schema still renders
// only pre > code > span with Shiki's classes and variables, and every text value is escaped by Vue
import { defineComponent, h } from 'vue'
import type { PropType, VNode } from 'vue'
import { SHIKI_THEMES, styleIssue } from '#shared/content/hast'
import type { HastElement, HastText } from '#shared/content/hast'

const CHILDREN: Record<string, readonly string[]> = { root: ['pre'], pre: ['code'], code: ['span'], span: ['span'] }
const CLASSES = new Set<string>(['shiki', 'shiki-themes', 'line', ...SHIKI_THEMES])
const MAX_DEPTH = 8

function classOf(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const tokens = value.split(/\s+/).filter(token => CLASSES.has(token))
  return tokens.length > 0 ? tokens.join(' ') : undefined
}

const styleOf = (value: unknown) => (typeof value === 'string' && styleIssue(value) === null ? value : undefined)

function render(node: unknown, parent: string, depth: number): VNode | string | null {
  if (typeof node !== 'object' || node === null) {
    return null
  }
  const item = node as Partial<HastElement> & Partial<HastText>
  if (item.type === 'text') {
    return parent !== 'root' && parent !== 'pre' && typeof item.value === 'string' ? item.value : null
  }
  const tag = item.tagName
  if (item.type !== 'element' || typeof tag !== 'string' || !CHILDREN[parent]!.includes(tag) || depth > MAX_DEPTH) {
    return null
  }
  const properties = (typeof item.properties === 'object' && item.properties !== null ? item.properties : {}) as Record<string, unknown>
  const children = Array.isArray(item.children) ? item.children.map(child => render(child, tag, depth + 1)).filter(child => child !== null) : []
  // pre's tabindex is the code figure's to set (ContentCode), so the HAST never adds a tab stop
  return h(tag, { class: classOf(properties.class), style: tag === 'code' ? undefined : styleOf(properties.style) }, children)
}

export default defineComponent({
  name: 'HastNode',
  props: { hast: { type: Object as PropType<HastElement>, required: true } },
  setup: props => () => render(props.hast, 'root', 1),
})
