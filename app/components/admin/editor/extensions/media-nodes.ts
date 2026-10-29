// Media blocks of the document schema (ADR-0006 §2): atoms that only point at the library. They are inserted
// complete from the dialogs, never empty. The HTML here is the editor's own clipboard format; the data-* rules let
// copy and paste inside the editor keep the nodes, and anything that fails the checks is dropped
import { Node, mergeAttributes } from '@tiptap/core'
import { EMBED_ID_PATTERNS, EMBED_PROVIDERS, GALLERY_LAYOUTS } from '#shared/content/document-schema'
import type { EmbedProvider } from '#shared/content/document-schema'
import { isUuidv7 } from '#shared/utils/id'

const text = (value: string | null | undefined) => (value && value.trim() !== '' ? value : null)

/** Attributes read back from the editor's HTML, null when they would not pass the schema */
const mediaAttribute = (element: HTMLElement, name: string) => {
  const value = element.getAttribute(name)
  return value && isUuidv7(value) ? value : null
}

const atom = { group: 'block', atom: true, draggable: true, selectable: true } as const

export const ImageNode = Node.create({
  name: 'image',
  ...atom,
  addAttributes() {
    return {
      mediaId: { default: null, rendered: false },
      caption: { default: null, rendered: false },
      altOverride: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{
      tag: 'figure[data-node="image"]',
      getAttrs: (element) => {
        const mediaId = mediaAttribute(element, 'data-media-id')
        return mediaId ? { mediaId, caption: text(element.getAttribute('data-caption')), altOverride: text(element.getAttribute('data-alt')) } : false
      },
    }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-node': 'image', 'data-media-id': node.attrs.mediaId, 'data-caption': node.attrs.caption, 'data-alt': node.attrs.altOverride })]
  },
})

export const GalleryNode = Node.create({
  name: 'gallery',
  ...atom,
  addAttributes() {
    return {
      items: { default: [], rendered: false },
      layout: { default: 'grid', rendered: false },
    }
  },
  parseHTML() {
    return [{
      tag: 'div[data-node="gallery"]',
      getAttrs: (element) => {
        const items = (element.getAttribute('data-items') ?? '').split(' ').filter(isUuidv7)
        const layout = element.getAttribute('data-layout') ?? 'grid'
        return items.length >= 2 && (GALLERY_LAYOUTS as readonly string[]).includes(layout) ? { items: items.slice(0, 24), layout } : false
      },
    }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-node': 'gallery', 'data-items': (node.attrs.items as string[]).join(' '), 'data-layout': node.attrs.layout })]
  },
})

export const VideoNode = Node.create({
  name: 'video',
  ...atom,
  addAttributes() {
    return {
      mediaId: { default: null, rendered: false },
      caption: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{
      tag: 'figure[data-node="video"]',
      getAttrs: (element) => {
        const mediaId = mediaAttribute(element, 'data-media-id')
        return mediaId ? { mediaId, caption: text(element.getAttribute('data-caption')) } : false
      },
    }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-node': 'video', 'data-media-id': node.attrs.mediaId, 'data-caption': node.attrs.caption })]
  },
})

export const EmbedNode = Node.create({
  name: 'embed',
  ...atom,
  addAttributes() {
    return {
      provider: { default: 'youtube', rendered: false },
      externalId: { default: '', rendered: false },
      title: { default: '', rendered: false },
      posterMediaId: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{
      tag: 'figure[data-node="embed"]',
      getAttrs: (element) => {
        const provider = element.getAttribute('data-provider') as EmbedProvider
        const externalId = element.getAttribute('data-external-id') ?? ''
        const title = text(element.getAttribute('data-title'))
        const posterMediaId = mediaAttribute(element, 'data-poster')
        const valid = EMBED_PROVIDERS.includes(provider) && EMBED_ID_PATTERNS[provider].test(externalId) && title && posterMediaId
        return valid ? { provider, externalId, title, posterMediaId } : false
      },
    }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, {
      'data-node': 'embed',
      'data-provider': node.attrs.provider,
      'data-external-id': node.attrs.externalId,
      'data-title': node.attrs.title,
      'data-poster': node.attrs.posterMediaId,
    })]
  },
})
