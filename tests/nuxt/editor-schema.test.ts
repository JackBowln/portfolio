// F05-T3: the editor's JSON is the document schema (ADR-0006 §3). Headless Tiptap with the editor's own extension
// list: every node of the full document survives a round trip unchanged, every insert command makes a valid node,
// generated edit sequences never leave the schema, and hostile pasted HTML ends up as allowed nodes only
import { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { schemaExtensions } from '~/components/admin/editor/extensions/schema-extensions'
import { validateDocument } from '#shared/content/document-schema'
import type { DocumentJson } from '#shared/content/document-schema'
import { CODE, MEDIA, fullDocument, shikiPre } from '../support/documents'

const editors: Editor[] = []
afterEach(() => editors.splice(0).forEach(editor => editor.destroy()))

/** Resolves after Tiptap's asynchronous `create` event, when UniqueID has given every block its id */
async function editorWith(content: DocumentJson | string = { type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'start' } }] }) {
  const editor = new Editor({ extensions: schemaExtensions(), content: content as JSONContent })
  editors.push(editor)
  await new Promise(resolve => editor.on('create', resolve))
  return editor
}

function expectValid(editor: Editor) {
  const result = validateDocument(editor.getJSON())
  expect(result.ok ? [] : result.issues, JSON.stringify(editor.getJSON())).toEqual([])
}

describe('round trip', () => {
  it('keeps the full document exactly', async () => {
    const editor = await editorWith(fullDocument())
    expect(editor.getJSON()).toEqual(fullDocument())
    expectValid(editor)
  })

  it('adds ids and the schema version to a new document', async () => {
    const editor = await editorWith('<p>Olá</p><h2>Título</h2><ul><li><p>Item</p></li></ul>')
    const json = editor.getJSON() as DocumentJson
    expect(json.attrs).toEqual({ schemaVersion: 1 })
    expect(json.content.map(node => node.type)).toEqual(['paragraph', 'heading', 'bulletList'])
    expectValid(editor)
  })
})

describe('insert commands', () => {
  it.each<[string, (editor: Editor) => boolean]>([
    ['bold, italic, strike and code', editor => editor.chain().insertContent('texto').selectAll().toggleBold().toggleItalic().toggleStrike().toggleCode().run()],
    ['a link', editor => editor.chain().insertContent('link').selectAll().setLink({ href: 'https://example.com' }).run()],
    ['headings', editor => editor.chain().setHeading({ level: 2 }).insertContent('a').setHeading({ level: 4 }).run()],
    ['lists', editor => editor.chain().insertContent('a').toggleBulletList().toggleOrderedList().run()],
    ['a quote', editor => editor.chain().insertContent('a').toggleBlockquote().run()],
    ['a callout', editor => editor.chain().insertContent('a').toggleCallout('tip').setCalloutTone('danger').run()],
    ['a rule and a hard break', editor => editor.chain().insertContent('a').setHardBreak().setHorizontalRule().run()],
    ['a code block, then highlighted', (editor) => {
      editor.commands.insertCodeBlock({ language: 'ts', code: CODE })
      let pos = -1
      editor.state.doc.descendants((node, at) => {
        if (node.type.name === 'codeBlock') {
          pos = at
        }
      })
      return editor.commands.setCodeBlockSource(pos, { language: 'ts', code: CODE, hast: shikiPre(CODE) })
    }],
    ['media blocks', editor => editor.chain()
      .insertContent({ type: 'image', attrs: { mediaId: MEDIA.photo, caption: 'Legenda', altOverride: null } })
      .insertContent({ type: 'gallery', attrs: { items: [MEDIA.photo, MEDIA.second], layout: 'stack' } })
      .insertContent({ type: 'video', attrs: { mediaId: MEDIA.clip, caption: null } })
      .insertContent({ type: 'embed', attrs: { provider: 'vimeo', externalId: '76979871', title: 'Vídeo', posterMediaId: MEDIA.poster } })
      .run()],
    ['a table with a header row', editor => editor.commands.insertTable({ rows: 3, cols: 2, withHeaderRow: true }) && editor.commands.addColumnAfter() && editor.commands.addRowAfter()],
  ])('makes %s that pass the schema', async (_name, command) => {
    const editor = await editorWith()
    expect(command(editor)).toBe(true)
    expectValid(editor)
  })

  it('refuses a link the schema would refuse', async () => {
    const editor = await editorWith()
    editor.chain().insertContent('x').selectAll().setLink({ href: 'javascript:alert(1)' }).run()
    expect(JSON.stringify(editor.getJSON())).not.toContain('javascript')
    expectValid(editor)
  })
})

describe('moving blocks', () => {
  const ids = (editor: Editor) => (editor.getJSON() as DocumentJson).content.map(node => (node.attrs as { id: string }).id)

  it('swaps the current block with its neighbors and keeps the cursor in it', async () => {
    const editor = await editorWith({ type: 'doc', content: ['a', 'b', 'c'].map(id => ({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text: id.toUpperCase() }] })) })
    editor.commands.setTextSelection(5) // inside "B"
    expect(editor.commands.moveBlock('up')).toBe(true)
    expect(ids(editor)).toEqual(['b', 'a', 'c'])
    expect(editor.state.selection.$from.parent.textContent).toBe('B')
    expect(editor.commands.moveBlock('up')).toBe(false)
    editor.commands.moveBlock('down')
    editor.commands.moveBlock('down')
    expect(ids(editor)).toEqual(['a', 'c', 'b'])
    expect(editor.commands.moveBlock('down')).toBe(false)
    expectValid(editor)
  })

  it('moves a selected atom', async () => {
    const editor = await editorWith(fullDocument())
    let pos = -1
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'image') {
        pos = offset
      }
    })
    editor.commands.setNodeSelection(pos)
    editor.commands.moveBlock('up')
    const order = ids(editor)
    expect(order.indexOf('img-1')).toBe(order.indexOf('code-1') - 1)
    expectValid(editor)
  })
})

describe('generated edit sequences', () => {
  // Small seeded PRNG (mulberry32), so a failure can be replayed
  function random(seed: number) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
  }

  const actions: ((editor: Editor, next: () => number) => unknown)[] = [
    editor => editor.chain().insertContent('palavra ').run(),
    editor => editor.chain().toggleBold().insertContent('forte').run(),
    editor => editor.chain().toggleItalic().toggleStrike().insertContent('x').run(),
    (editor, next) => editor.chain().setHeading({ level: [2, 3, 4][Math.floor(next() * 3)] as 2 | 3 | 4 }).run(),
    editor => editor.chain().setParagraph().run(),
    editor => editor.chain().toggleBulletList().run(),
    editor => editor.chain().toggleOrderedList().run(),
    editor => editor.chain().sinkListItem('listItem').run(),
    editor => editor.chain().liftListItem('listItem').run(),
    editor => editor.chain().toggleBlockquote().run(),
    editor => editor.chain().toggleCallout('warning').run(),
    editor => editor.chain().splitBlock().run(),
    editor => editor.chain().setHardBreak().run(),
    editor => editor.chain().setHorizontalRule().run(),
    editor => editor.chain().insertCodeBlock({ language: 'ts', code: 'let a = 1' }).run(),
    editor => editor.chain().insertContent({ type: 'image', attrs: { mediaId: MEDIA.photo, caption: null, altOverride: null } }).run(),
    editor => editor.chain().insertContent({ type: 'gallery', attrs: { items: [MEDIA.photo, MEDIA.second], layout: 'grid' } }).run(),
    editor => editor.chain().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(),
    editor => editor.chain().insertContent('link').setLink({ href: 'https://example.com/x' }).run(),
    (editor, next) => editor.commands.moveBlock(next() < 0.5 ? 'up' : 'down'),
    editor => editor.chain().deleteSelection().run(),
    editor => editor.chain().joinBackward().run(),
    editor => editor.chain().undo().run(),
    (editor, next) => editor.commands.setTextSelection(Math.floor(next() * editor.state.doc.content.size)),
    editor => editor.chain().selectAll().run(),
  ]

  it('stays inside the schema after every step of 200 random sequences', async () => {
    for (let seed = 1; seed <= 200; seed++) {
      const next = random(seed)
      const editor = await editorWith()
      const steps: number[] = []
      for (let step = 0; step < 25; step++) {
        const action = Math.floor(next() * actions.length)
        steps.push(action)
        actions[action]!(editor, next)
        const result = validateDocument(editor.getJSON())
        if (!result.ok) {
          throw new Error(`seed ${seed}, actions ${steps.join(',')}: ${JSON.stringify(result.issues)}\n${JSON.stringify(editor.getJSON())}`)
        }
      }
      editor.destroy()
    }
  })
})

describe('paste', () => {
  const hostile = [
    '<h1>Título 1</h1><h5>Título 5</h5>',
    '<p>a<script>alert(1)</script>b</p><iframe src="https://evil.example"></iframe>',
    '<img src="x" onerror="alert(1)"><p><img src="https://example.com/a.png" alt="foto"></p>',
    '<p><a href="javascript:alert(1)">clique</a> <a href="data:text/html,x">dados</a> <a href="https://example.com" target="_blank" rel="opener" class="x">ok</a></p>',
    '<p><u>sublinhado</u> <span style="color:red;background:url(x)">estilo</span> <font color="red">fonte</font></p>',
    '<table><tr><td colspan="2" style="width:9px"><h2>célula</h2></td></tr></table>',
    '<pre class="language-ts"><code>const a = 1\n</code></pre><pre><code class="language-evil">x</code></pre>',
    '<blockquote><h3>citação</h3><img src="x"></blockquote>',
    '<ul><li><h2>item</h2><pre>code</pre></li></ul>',
    '<figure data-node="image" data-media-id="../originals/x"></figure><figure data-node="embed" data-provider="evil" data-external-id="x"></figure>',
    '<div onclick="alert(1)"><svg><script>alert(1)</script></svg>texto</div>',
  ]

  it.each(hostile)('normalizes %s', async (html) => {
    const editor = await editorWith()
    editor.view.pasteHTML(html)
    expectValid(editor)
    const json = JSON.stringify(editor.getJSON())
    for (const forbidden of ['script', 'javascript', 'onerror', 'onclick', 'iframe', 'evil', 'style', 'target', 'data:', 'originals', 'colspan":2']) {
      expect(json).not.toContain(forbidden)
    }
  })

  it('keeps allowed formatting and links when pasting', async () => {
    const editor = await editorWith()
    editor.view.pasteHTML('<h2>Seção</h2><p><strong>forte</strong> <em>leve</em> <a href="https://example.com/a">link</a></p><pre class="language-ts"><code>let x = 1</code></pre>')
    const json = editor.getJSON() as DocumentJson
    expect(json.content.map(node => node.type)).toEqual(['heading', 'paragraph', 'codeBlock'])
    expect(JSON.stringify(json)).toContain('"href":"https://example.com/a"')
    expect(json.content[2]).toMatchObject({ attrs: { language: 'ts', code: 'let x = 1' } })
    expectValid(editor)
  })

  it('gives pasted copies new ids', async () => {
    const editor = await editorWith(fullDocument())
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.view.pasteHTML('<p data-id="p-1">cópia</p>')
    expectValid(editor)
  })
})
