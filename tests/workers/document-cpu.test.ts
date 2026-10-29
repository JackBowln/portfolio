// F05-T2: what a save costs in workerd (Free plan = 10 ms of CPU): validating a ~50 KB document with every node
// type and deriving its data. A measure, not a benchmark: the median of 20 runs is logged and has a loose ceiling
import { describe, expect, it } from 'vitest'
import { deriveDocument, segmentHashes } from '../../shared/content/derive'
import { validateDocument } from '../../shared/content/document-schema'
import type { DocumentJson } from '../../shared/content/document-schema'
import { fullDocument } from '../support/documents'

function largeDocument(): DocumentJson {
  const base = fullDocument()
  const content: DocumentJson['content'] = []
  for (let copy = 0; content.length < 300; copy++) {
    const prefixed = JSON.parse(JSON.stringify(base.content).replaceAll(/"id":"([\w-]+)"/g, `"id":"$1-${copy}"`)) as DocumentJson['content']
    content.push(...prefixed, ...Array.from({ length: 10 }, (_, index) => ({
      type: 'paragraph' as const,
      attrs: { id: `extra-${copy}-${index}` },
      content: [{ type: 'text' as const, text: 'Um parágrafo de texto corrido, com algumas palavras a mais para pesar. ' }],
    })))
  }
  return { ...base, content }
}

const median = (values: number[]) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!

describe('document save cost', () => {
  it('validates and derives a ~50 KB document in a few milliseconds', async () => {
    const doc = largeDocument()
    const size = JSON.stringify(doc).length
    expect(size).toBeGreaterThan(40_000)
    expect(validateDocument(doc).ok).toBe(true)

    const validate: number[] = []
    const derive: number[] = []
    for (let run = 0; run < 20; run++) {
      let started = performance.now()
      validateDocument(doc)
      validate.push(performance.now() - started)
      started = performance.now()
      deriveDocument(doc, 'pt-BR')
      await segmentHashes(doc, { title: 'Título' })
      derive.push(performance.now() - started)
    }
    // workerd only advances performance.now() on I/O, so in-test timings can read 0; the ceiling stays loose
    console.log(`[F05-T2] ${size} chars, ${doc.content.length} blocks: validate median ${median(validate).toFixed(2)} ms, derive + segment hashes median ${median(derive).toFixed(2)} ms (workerd, miniflare)`)
    expect(median(validate)).toBeLessThan(5)
  })
})
