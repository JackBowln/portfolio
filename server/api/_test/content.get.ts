// Test-only (PORTFOLIO_TEST_BUILD=1): the document with every node type (tests/support/documents.ts), pointed at
// media the test created, validated by the document schema and resolved like a public read (F05-T4). `repeat`
// appends copies of the body with fresh block ids, to measure a document near the schema's limits
import { z } from 'zod'
import { documentSchema } from '#shared/content/document-schema'
import { LOCALES } from '#shared/types/enums'
import { MEDIA, fullDocument } from '../../../tests/support/documents.ts'
import { resolveDocumentMedia } from '../../services/content/document-media.ts'

const mediaId = z.string().regex(/^[0-9a-f-]{36}$/).optional()
const querySchema = z.object({
  locale: z.enum(LOCALES).default('pt-BR'),
  photo: mediaId,
  second: mediaId,
  third: mediaId,
  clip: mediaId,
  poster: mediaId,
  repeat: z.coerce.number().int().min(0).max(60).default(0),
})

export default defineEventHandler(async (event) => {
  const { locale, repeat, ...ids } = getValidatedQueryStrict(event, querySchema)
  let json = JSON.stringify(fullDocument())
  for (const [name, id] of Object.entries(ids)) {
    if (id) {
      json = json.replaceAll(MEDIA[name as keyof typeof MEDIA], id)
    }
  }
  const base = JSON.parse(json) as ReturnType<typeof fullDocument>
  const copies = Array.from({ length: repeat }, (_, copy) => JSON.parse(JSON.stringify(base.content).replace(/"id":"([\w-]+)"/g, `"id":"$1-r${copy}"`)) as typeof base.content)
  const document = documentSchema.parse({ ...base, content: [...base.content, ...copies.flat()] })
  return { document, media: await resolveDocumentMedia(useDb(event), document, locale) }
})
