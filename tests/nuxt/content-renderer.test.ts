// F05-T4: the public renderer. One snapshot per node type from the document with every node, the accessible
// structure (anchors, code language, table headers, gallery dialogs) and hostile input given straight to the
// renderer, without the schema in front: it must come out as escaped text or not at all
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { DocumentJson } from '#shared/content/document-schema'
import type { PublicImage, PublicMediaMap } from '#shared/media/public'
import ContentRenderer from '~/components/content/ContentRenderer.vue'
import HastNode from '~/components/content/HastNode'
import { CODE, MEDIA, fullDocument } from '../support/documents'

const SHA = 'cd'.repeat(32)
const image = (alt: string, caption: string | null = null): PublicImage => ({
  width: 800,
  height: 600,
  variants: ['avif', 'webp', 'jpeg'].map(format => ({ format: format as 'avif', width: 320, height: 240, key: `media/cd/${SHA}/${format}-320.${format === 'jpeg' ? 'jpg' : format}` })),
  placeholderDataUrl: null,
  dominantColor: null,
  focalX: 0.5,
  focalY: 0.5,
  alt,
  decorative: false,
  caption,
  credit: null,
})

const media: PublicMediaMap = {
  [MEDIA.photo]: { kind: 'image', image: image('Uma foto', 'Legenda da biblioteca') },
  [MEDIA.second]: { kind: 'image', image: image('Segunda') },
  [MEDIA.third]: { kind: 'image', image: image('Terceira') },
  [MEDIA.poster]: { kind: 'image', image: image('Poster') },
  [MEDIA.clip]: { kind: 'video', video: { width: 1280, height: 720, key: `media/cd/${SHA}/video.mp4`, mimeType: 'video/mp4', durationMs: 1000, poster: image('Poster'), tracks: [] } },
}

const render = (document: DocumentJson | Record<string, unknown>, map: PublicMediaMap = media) =>
  mountSuspended(ContentRenderer, { props: { document: document as DocumentJson, media: map } })
const doc = (...content: unknown[]) => ({ type: 'doc', content }) as unknown as DocumentJson
const para = (...content: unknown[]) => ({ type: 'paragraph', attrs: { id: 'p' }, content })

describe('ContentRenderer: every node type', () => {
  const full = fullDocument()

  it.each(full.content.map(block => [block.type + ':' + block.attrs.id, block] as const))('renders %s', async (_name, block) => {
    const wrapper = await render(doc(block))
    expect(wrapper.html()).toMatchSnapshot()
  })

  it('gives headings a readable anchor and a named link to it', async () => {
    const wrapper = await render(full)
    const headings = wrapper.findAll('h2, h3, h4')
    expect(headings.map(heading => [heading.element.tagName, heading.attributes('id')])).toEqual([['H2', 'introducao'], ['H3', 'listas'], ['H4', 'midia']])
    const anchor = headings[0]!.get('a')
    expect(anchor.attributes('href')).toBe('#introducao')
    expect(anchor.attributes('aria-label')).toBe('Link para a seção “Introdução”')
  })

  it('names the code block by its language, with the copy button and a status region', async () => {
    const wrapper = await render(full)
    const code = wrapper.get('.content-code')
    expect(code.get('figcaption').text()).toContain('TypeScript')
    expect(code.get('[role="group"]').attributes()).toMatchObject({ 'tabindex': '0', 'aria-label': 'Código em TypeScript' })
    expect(code.get('code').text()).toBe(CODE)
    expect(code.get('button[data-content-copy]').attributes('data-copied')).toBe('Copiado')
    expect(code.find('[role="status"]').exists()).toBe(true)
    // The HAST's own tab stop is dropped: the group is the one focusable element
    expect(code.get('pre').attributes('tabindex')).toBeUndefined()
  })

  it('marks the first header row as column headers and keeps list starts, links and rel', async () => {
    const wrapper = await render(full)
    expect(wrapper.findAll('thead th').map(th => th.attributes('scope'))).toEqual(['col'])
    expect(wrapper.get('ol').attributes('start')).toBe('3')
    const links = wrapper.findAll('.content > p a').map(a => [a.attributes('href'), a.attributes('rel')])
    expect(links).toEqual([['https://example.com/a?b=1#c', 'noopener noreferrer'], ['/blog/outro', undefined], ['mailto:ola@example.com', undefined]])
  })

  it('opens each gallery image in its own dialog through invoker commands', async () => {
    const wrapper = await render(full)
    const buttons = wrapper.findAll('.content-gallery-open')
    expect(buttons).toHaveLength(3)
    for (const [index, button] of buttons.entries()) {
      const target = button.attributes('commandfor')!
      expect(button.attributes('command')).toBe('show-modal')
      expect(button.text()).toContain(`Ampliar imagem ${index + 1} de 3`)
      const dialog = wrapper.get(`dialog[id="${target}"]`)
      expect(dialog.attributes('aria-label')).toBe(`Imagem ${index + 1} de 3`)
      expect(dialog.get('button').attributes()).toMatchObject({ commandfor: target, command: 'close' })
    }
  })

  it('uses the block caption first and the override alt, and links the embed to its provider', async () => {
    const wrapper = await render(doc(
      { type: 'image', attrs: { id: 'a', mediaId: MEDIA.photo, caption: null, altOverride: 'Alt do bloco' } },
      { type: 'image', attrs: { id: 'b', mediaId: MEDIA.photo, caption: 'Do bloco', altOverride: null } },
      full.content.find(block => block.type === 'embed'),
    ))
    const figures = wrapper.findAll('.content-figure')
    expect(figures[0]!.get('img').attributes('alt')).toBe('Alt do bloco')
    expect(figures[0]!.get('figcaption').text()).toBe('Legenda da biblioteca')
    expect(figures[1]!.get('img').attributes('alt')).toBe('Uma foto')
    expect(figures[1]!.get('figcaption').text()).toBe('Do bloco')
    const embed = figures[2]!.get('a')
    expect(embed.attributes()).toMatchObject({ href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', rel: 'noopener noreferrer' })
    expect(embed.text()).toBe('Assistir no YouTube: Palestra sobre acessibilidade')
    expect(wrapper.find('iframe').exists()).toBe(false)
  })

  it('skips blocks whose media is missing or of the wrong kind', async () => {
    const wrapper = await render(full, { [MEDIA.photo]: media[MEDIA.clip]! })
    expect(wrapper.find('.content-figure img').exists()).toBe(false)
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.find('.content-gallery').exists()).toBe(false)
  })
})

describe('ContentRenderer: hostile input without the schema', () => {
  it('escapes markup in text', async () => {
    const wrapper = await render(doc(para({ type: 'text', text: '<script>alert(1)</script><img src=x onerror=alert(2)>{{ 7 * 7 }}' })))
    const html = wrapper.html()
    expect(html).not.toMatch(/<script|<img/)
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(wrapper.text()).toContain('{{ 7 * 7 }}')
  })

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
    '//evil.example',
    '\\\\evil.example',
    'tel:+5511999999999',
  ])('renders a link to %s as plain text', async (href) => {
    const wrapper = await render(doc(para({ type: 'text', text: 'clique', marks: [{ type: 'link', attrs: { href } }] })))
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('clique')
  })

  it('keeps only href from link attributes and ignores unknown marks', async () => {
    const wrapper = await render(doc(para(
      { type: 'text', text: 'a', marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_blank', onclick: 'alert(1)', class: 'x' } }] },
      { type: 'text', text: 'b', marks: [{ type: 'underline' }, { type: 'textStyle', attrs: { style: 'color:red' } }] },
    )))
    expect(wrapper.get('a').attributes()).toEqual({ href: 'https://example.com', rel: 'noopener noreferrer' })
    expect(wrapper.html()).not.toMatch(/onclick|target|style|<u>/)
  })

  it('drops unknown nodes and attributes, and falls back on invalid levels, tones and starts', async () => {
    const wrapper = await render(doc(
      { type: 'iframe', attrs: { src: 'https://evil.example' } },
      { type: 'html', content: '<b>x</b>' },
      { type: 'heading', attrs: { id: 'h', level: 1, onclick: 'x' }, content: [{ type: 'text', text: 'Título' }] },
      { type: 'callout', attrs: { id: 'c', tone: 'x" onmouseover="alert(1)' }, content: [para({ type: 'text', text: 'Nota' })] },
      { type: 'orderedList', attrs: { id: 'o', start: '2" onload="x' }, content: [{ type: 'listItem', content: [para({ type: 'text', text: 'Item' })] }] },
      { type: 'paragraph', attrs: { id: 'p', style: 'background:url(x)' }, content: [{ type: 'image', attrs: { src: 'x' } }, { type: 'text', text: 42 }] },
      'not a node',
      null,
    ))
    const html = wrapper.html()
    expect(html).not.toMatch(/iframe|<b>|onclick|onmouseover|onload|url\(|<h1/)
    expect(wrapper.get('p').text()).toBe('Título')
    expect(wrapper.get('.content-callout').attributes('data-tone')).toBe('info')
    expect(wrapper.get('ol').attributes('start')).toBeUndefined()
  })

  it('renders an embed with an id outside the provider pattern as nothing', async () => {
    const wrapper = await render(doc({ type: 'embed', attrs: { id: 'e', provider: 'youtube', externalId: 'x" onload="alert(1)', title: 't', posterMediaId: MEDIA.poster } }, { type: 'embed', attrs: { id: 'f', provider: 'evil', externalId: 'dQw4w9WgXcQ', title: 't', posterMediaId: MEDIA.poster } }))
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('falls back to the plain code when the HAST breaks the allowlist', async () => {
    const hast = {
      type: 'element',
      tagName: 'pre',
      properties: { onclick: 'alert(1)' },
      children: [{ type: 'element', tagName: 'code', properties: {}, children: [
        { type: 'element', tagName: 'script', properties: {}, children: [{ type: 'text', value: 'alert(1)' }] },
        { type: 'element', tagName: 'span', properties: { style: 'background:url(https://evil.example/x)', class: 'evil' }, children: [{ type: 'text', value: 'x' }] },
      ] }],
    }
    const wrapper = await render(doc({ type: 'codeBlock', attrs: { id: 'c', language: 'ts', code: 'const x = 1', hast } }))
    expect(wrapper.html()).not.toMatch(/onclick|<script|url\(|evil/)
    expect(wrapper.get('code').text()).toBe('const x = 1')
  })

  it('applies the allowlist node by node in HastNode itself', async () => {
    const wrapper = await mountSuspended(HastNode, { props: { hast: {
      type: 'element',
      tagName: 'pre',
      properties: { class: 'shiki evil', style: '--shiki-light:#fff', tabindex: '0', onclick: 'x' },
      children: [
        { type: 'text', value: 'outside code' },
        { type: 'element', tagName: 'code', properties: { style: '--shiki-light:#000' }, children: [
          { type: 'element', tagName: 'span', properties: { style: '--shiki-light:#D73A49', class: 'line' }, children: [{ type: 'text', value: 'ok' }] },
          { type: 'element', tagName: 'span', properties: { style: 'color:red;background:url(x)' }, children: [{ type: 'text', value: '<b>escaped</b>' }] },
          { type: 'element', tagName: 'a', properties: { href: 'javascript:alert(1)' }, children: [{ type: 'text', value: 'dropped' }] },
          { type: 'comment', value: '<script>' },
        ] },
      ],
    } as never } })
    const html = wrapper.html()
    expect(html).toBe('<pre class="shiki" style="--shiki-light: #fff;"><code><span class="line" style="--shiki-light: #D73A49;">ok</span><span>&lt;b&gt;escaped&lt;/b&gt;</span></code></pre>')
  })
})
