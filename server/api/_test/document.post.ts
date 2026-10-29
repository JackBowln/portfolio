// Test-only (PORTFOLIO_TEST_BUILD=1): the editor's "save" stub (F05-T3). Validates the body with the document
// schema, as the save API of F06-T2 will, and returns what the server derives from it
import { deriveDocument, segmentHashes } from '#shared/content/derive'
import { validateDocument } from '#shared/content/document-schema'

export default defineEventHandler(async (event) => {
  const result = validateDocument(await readBody(event))
  if (!result.ok) {
    setResponseStatus(event, 400)
    return { ok: false, issues: result.issues }
  }
  const types = new Set<string>()
  const walk = (node: { type: string, content?: unknown[] }) => {
    types.add(node.type)
    node.content?.forEach(child => walk(child as typeof node))
  }
  walk(result.doc)
  return { ok: true, types: [...types].sort(), derived: deriveDocument(result.doc, 'pt-BR'), segments: Object.keys(await segmentHashes(result.doc)).length }
})
