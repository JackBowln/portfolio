// The document's blocks and inline content as Vue elements (ADR-0006 §5): text is always a child string, so Vue
// escapes it, and nothing becomes markup unless it is a known node. An unknown node, mark or level renders
// nothing (or its text alone), and a link whose href fails contentHref is plain text: the schema rejects all of
// these on save, and the renderer does not rely on it. Media, code and embed blocks have their own components
import { defineComponent, h } from 'vue'
import type { PropType, VNode, VNodeChild } from 'vue'
import { CALLOUT_TONES, HEADING_LEVELS } from '#shared/content/document-schema'
import { inlineText } from '#shared/content/derive'
import { contentHref, linkRel } from '#shared/content/url'
import { useContentContext } from './context'
import type { ContentContext } from './context'
import ContentCode from './nodes/ContentCode.vue'
import ContentEmbed from './nodes/ContentEmbed.vue'
import ContentFigure from './nodes/ContentFigure.vue'
import ContentGallery from './nodes/ContentGallery.vue'
import ContentVideo from './nodes/ContentVideo.vue'

type Translate = (key: string, values?: Record<string, unknown>) => string
interface Node {
  type?: unknown
  attrs?: Record<string, unknown>
  content?: unknown
  text?: unknown
  marks?: unknown
}

const nodesOf = (value: unknown): Node[] => (Array.isArray(value) ? value.filter((item): item is Node => typeof item === 'object' && item !== null) : [])

function withMark(child: VNodeChild, mark: Node, context: ContentContext): VNodeChild {
  switch (mark.type) {
    case 'bold':
      return h('strong', [child])
    case 'italic':
      return h('em', [child])
    case 'strike':
      return h('s', [child])
    case 'code':
      return h('code', [child])
    case 'link': {
      const href = typeof mark.attrs?.href === 'string' ? contentHref(mark.attrs.href) : undefined
      return href ? h('a', { href, rel: linkRel(href, context.siteUrl) }, [child]) : child
    }
    default:
      return child
  }
}

function inline(value: unknown, context: ContentContext): VNodeChild[] {
  return nodesOf(value).map((node) => {
    if (node.type === 'hardBreak') {
      return h('br')
    }
    if (node.type !== 'text' || typeof node.text !== 'string') {
      return null
    }
    // Each mark wraps what the previous ones made
    return nodesOf(node.marks).reduce<VNodeChild>((child, mark) => withMark(child, mark, context), node.text)
  })
}

function cells(row: Node, header: boolean, context: ContentContext, t: Translate): VNode[] {
  return nodesOf(row.content).flatMap((cell) => {
    if (cell.type !== 'tableHeader' && cell.type !== 'tableCell') {
      return []
    }
    const tag = cell.type === 'tableHeader' ? 'th' : 'td'
    const scope = tag === 'th' ? (header ? 'col' : 'row') : undefined
    return [h(tag, { scope }, blocks(cell.content, context, t))]
  })
}

function table(node: Node, context: ContentContext, t: Translate): VNode {
  const rows = nodesOf(node.content).filter(row => row.type === 'tableRow')
  const [first, ...rest] = rows
  // A first row of header cells only is the column header
  const headed = first !== undefined && nodesOf(first.content).every(cell => cell.type === 'tableHeader')
  const body = (headed ? rest : rows).map(row => h('tr', cells(row, false, context, t)))
  return h('div', { 'class': 'content-table', 'role': 'group', 'tabindex': 0, 'aria-label': t('content.table') }, [
    h('table', [
      headed ? h('thead', [h('tr', cells(first, true, context, t))]) : null,
      h('tbody', body),
    ]),
  ])
}

function block(node: Node, context: ContentContext, t: Translate): VNodeChild {
  const attrs = node.attrs ?? {}
  switch (node.type) {
    case 'paragraph':
      return h('p', inline(node.content, context))
    case 'heading': {
      const level = attrs.level
      if (!HEADING_LEVELS.includes(level as 2)) {
        return h('p', inline(node.content, context))
      }
      const anchor = context.anchors.get(String(attrs.id))
      const title = inlineText(nodesOf(node.content) as never).trim()
      return h(`h${level}`, { id: anchor, class: 'content-heading' }, [
        ...inline(node.content, context),
        anchor ? h('a', { 'href': `#${anchor}`, 'class': 'content-anchor', 'aria-label': t('content.anchor', { title }) }, '#') : null,
      ])
    }
    case 'bulletList':
      return h('ul', items(node, context, t))
    case 'orderedList': {
      const start = Number.isInteger(attrs.start) && (attrs.start as number) > 1 ? attrs.start as number : undefined
      return h('ol', { start }, items(node, context, t))
    }
    case 'blockquote':
      return h('blockquote', blocks(node.content, context, t))
    case 'callout': {
      const tone = CALLOUT_TONES.includes(attrs.tone as 'info') ? attrs.tone as string : 'info'
      // The tone is a word as well as a color (WCAG 1.4.1)
      return h('div', { 'class': 'content-callout', 'data-tone': tone, 'role': 'note' }, [
        h('p', { class: 'content-callout-label' }, t(`content.callout.${tone}`)),
        ...blocks(node.content, context, t),
      ])
    }
    case 'horizontalRule':
      return h('hr')
    case 'table':
      return table(node, context, t)
    case 'codeBlock':
      return h(ContentCode, { node: attrs })
    case 'image':
      return h(ContentFigure, { node: attrs })
    case 'gallery':
      return h(ContentGallery, { node: attrs })
    case 'video':
      return h(ContentVideo, { node: attrs })
    case 'embed':
      return h(ContentEmbed, { node: attrs })
    default:
      return null
  }
}

function items(list: Node, context: ContentContext, t: Translate): VNode[] {
  return nodesOf(list.content).filter(item => item.type === 'listItem').map(item => h('li', blocks(item.content, context, t)))
}

function blocks(value: unknown, context: ContentContext, t: Translate): VNodeChild[] {
  return nodesOf(value).map(node => block(node, context, t))
}

export default defineComponent({
  name: 'ContentBlocks',
  props: { nodes: { type: Array as PropType<unknown[]>, required: true } },
  setup(props) {
    const context = useContentContext()
    const { t } = useI18n()
    return () => blocks(props.nodes, context, t)
  },
})
