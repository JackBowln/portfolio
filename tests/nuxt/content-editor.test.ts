// F06-T1: the ContentEditor component with the body of a new article (no block yet). It opens on an empty paragraph,
// and what it emits always has a `content` array that passes the document schema, even after everything is
// deleted (ProseMirror leaves `content` out of an empty node's JSON)
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { validateDocument } from '#shared/content/document-schema'
import type { DocumentJson } from '#shared/content/document-schema'
import ContentEditor from '~/components/admin/editor/ContentEditor.vue'

const settle = () => new Promise(resolve => setTimeout(resolve, 50))

describe('ContentEditor with an empty body', () => {
  it('opens on a paragraph and always emits a valid document', async () => {
    const updates: DocumentJson[] = []
    const edits: unknown[] = []
    const wrapper = await mountSuspended(ContentEditor, {
      props: {
        'label': 'Corpo',
        'modelValue': { type: 'doc', attrs: { schemaVersion: 1 }, content: [] },
        'onUpdate:modelValue': (value: DocumentJson | undefined) => value && updates.push(value),
        'onEdit': () => edits.push(true),
      },
    })
    await settle()
    const opened = updates.at(-1)!
    expect(opened.content.map(block => block.type)).toEqual(['paragraph'])
    expect(validateDocument(opened).ok).toBe(true)
    // Opening is not an edit: the block id came from UniqueID, outside the history
    expect(edits).toEqual([])

    const { editor } = wrapper.vm as unknown as { editor: { commands: { clearContent: (emitUpdate: boolean) => void, insertContent: (text: string) => void } } }
    editor.commands.insertContent('Olá')
    await settle()
    expect(edits.length).toBeGreaterThan(0)
    editor.commands.clearContent(true)
    await settle()
    const cleared = updates.at(-1)!
    expect(Array.isArray(cleared.content)).toBe(true)
    expect(validateDocument(cleared).ok).toBe(true)
  })
})
