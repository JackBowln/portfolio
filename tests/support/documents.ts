// Documents for the schema, derive, editor and renderer tests: one with every node type, and a HAST shaped like
// Shiki's codeToHast with two themes and defaultColor: false
import type { DocumentJson } from '../../shared/content/document-schema'
import type { HastElement } from '../../shared/content/hast'

export const MEDIA = {
  photo: '01a18000-0000-7000-8000-000000000001',
  second: '01a18000-0000-7000-8000-000000000002',
  third: '01a18000-0000-7000-8000-000000000003',
  clip: '01a18000-0000-7000-8000-000000000004',
  poster: '01a18000-0000-7000-8000-000000000005',
} as const

/** One span per token, one span.line per line, "\n" text between lines, like Shiki */
export function shikiPre(code: string): HastElement {
  const lines = code.split('\n')
  const children: HastElement['children'] = []
  lines.forEach((line, index) => {
    if (index > 0) {
      children.push({ type: 'text', value: '\n' })
    }
    const tokens = line.split(/(?<=\s)|(?=\s)/).filter(token => token !== '')
    children.push({
      type: 'element',
      tagName: 'span',
      properties: { class: 'line' },
      children: tokens.map((token, position) => ({
        type: 'element',
        tagName: 'span',
        properties: { style: position % 2 === 0 ? '--shiki-light:#CF222E;--shiki-dark:#FF7B72' : '--shiki-light:#1F2328;--shiki-dark:#E6EDF3;--shiki-light-font-style:italic;--shiki-dark-font-style:italic' },
        children: [{ type: 'text', value: token }],
      })),
    })
  })
  return {
    type: 'element',
    tagName: 'pre',
    properties: { class: 'shiki shiki-themes github-light-default github-dark-default', style: '--shiki-light:#1f2328;--shiki-dark:#e6edf3;--shiki-light-bg:#ffffff;--shiki-dark-bg:#0d1117', tabindex: '0' },
    children: [{ type: 'element', tagName: 'code', properties: {}, children }],
  }
}

export const CODE = 'const answer = 42\nconsole.log(answer)'

/** Every node, mark and attribute the schema allows, once */
export function fullDocument(): DocumentJson {
  return {
    type: 'doc',
    attrs: { schemaVersion: 1 },
    content: [
      { type: 'heading', attrs: { id: 'h-intro', level: 2 }, content: [{ type: 'text', text: 'Introdução' }] },
      {
        type: 'paragraph',
        attrs: { id: 'p-1' },
        content: [
          { type: 'text', text: 'Texto com ' },
          { type: 'text', text: 'negrito', marks: [{ type: 'bold' }] },
          { type: 'text', text: ', ' },
          { type: 'text', text: 'itálico', marks: [{ type: 'italic' }, { type: 'strike' }] },
          { type: 'text', text: ', ' },
          { type: 'text', text: 'código', marks: [{ type: 'code' }] },
          { type: 'hardBreak' },
          { type: 'text', text: 'e um link', marks: [{ type: 'link', attrs: { href: 'https://example.com/a?b=1#c' } }] },
          { type: 'text', text: ' interno', marks: [{ type: 'link', attrs: { href: '/blog/outro' } }] },
          { type: 'text', text: ' e e-mail.', marks: [{ type: 'link', attrs: { href: 'mailto:ola@example.com' } }] },
        ],
      },
      { type: 'paragraph', attrs: { id: 'p-empty' } },
      { type: 'heading', attrs: { id: 'h-lists', level: 3 }, content: [{ type: 'text', text: 'Listas' }] },
      {
        type: 'bulletList',
        attrs: { id: 'ul-1' },
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', attrs: { id: 'li-1' }, content: [{ type: 'text', text: 'Um' }] }] },
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', attrs: { id: 'li-2' }, content: [{ type: 'text', text: 'Dois' }] },
              { type: 'orderedList', attrs: { id: 'ol-1', start: 3 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { id: 'li-3' }, content: [{ type: 'text', text: 'Três' }] }] }] },
            ],
          },
        ],
      },
      { type: 'blockquote', attrs: { id: 'q-1' }, content: [{ type: 'paragraph', attrs: { id: 'q-p' }, content: [{ type: 'text', text: 'Uma citação.' }] }] },
      { type: 'callout', attrs: { id: 'c-1', tone: 'warning' }, content: [{ type: 'paragraph', attrs: { id: 'c-p' }, content: [{ type: 'text', text: 'Atenção aqui.' }] }] },
      { type: 'horizontalRule', attrs: { id: 'hr-1' } },
      { type: 'heading', attrs: { id: 'h-media', level: 4 }, content: [{ type: 'text', text: 'Mídia' }] },
      { type: 'codeBlock', attrs: { id: 'code-1', language: 'ts', code: CODE, hast: shikiPre(CODE) } },
      { type: 'image', attrs: { id: 'img-1', mediaId: MEDIA.photo, caption: 'Legenda da foto', altOverride: null } },
      { type: 'gallery', attrs: { id: 'gal-1', items: [MEDIA.second, MEDIA.third, MEDIA.photo], layout: 'grid' } },
      { type: 'video', attrs: { id: 'vid-1', mediaId: MEDIA.clip, caption: null } },
      { type: 'embed', attrs: { id: 'emb-1', provider: 'youtube', externalId: 'dQw4w9WgXcQ', title: 'Palestra sobre acessibilidade', posterMediaId: MEDIA.poster } },
      {
        type: 'table',
        attrs: { id: 'tbl-1' },
        content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', attrs: { id: 'th-1' }, content: [{ type: 'text', text: 'Coluna' }] }] }] },
          { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', attrs: { id: 'td-1' }, content: [{ type: 'text', text: 'Valor' }] }] }] },
        ],
      },
    ],
  }
}
