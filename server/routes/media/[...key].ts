// Media delivery for local and preview (ADR-0007 §5); production serves the bucket on its own domain. Only
// delivered keys pass (never originals/), streamed from R2 with Range support for video. The Content-Type is the
// one the server wrote at upload, from the record, so no D1 read is needed here
import { cacheTags } from '#shared/cache/tags'
import { isPublicMediaKey } from '#shared/media/public'

const IMMUTABLE = 'public, max-age=31536000, immutable'

export default defineEventHandler(async (event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    setResponseHeader(event, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }
  // Raw (still encoded) path: %2F, %2E and friends fail the pattern instead of being decoded into a path
  const key = `media/${getRouterParam(event, 'key', { decode: false }) ?? ''}`
  if (!isPublicMediaKey(key)) {
    throw createAppError('not_found')
  }

  const bucket = useEnv(event).MEDIA
  const headers = new Headers(getRequestHeaders(event) as Record<string, string>)
  const rangeHeader = event.method === 'GET' ? headers.get('range') : null
  let range: { offset: number, length: number } | undefined
  if (rangeHeader) {
    // Parsed here: the size comes from a head() first, so a range past the end is a proper 416
    const size = (await bucket.head(key))?.size
    if (size === undefined) {
      throw createAppError('not_found')
    }
    range = parseRange(rangeHeader, size)
    if (!range) {
      setResponseHeader(event, 'content-range', `bytes */${size}`)
      throw createError({ statusCode: 416, statusMessage: 'Range not satisfiable' })
    }
  }

  const object = event.method === 'HEAD'
    ? await bucket.head(key)
    : await bucket.get(key, { ...(range ? { range } : {}), onlyIf: headers })
  if (!object) {
    throw createAppError('not_found')
  }

  setResponseHeaders(event, {
    'cache-control': IMMUTABLE,
    'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    'content-disposition': 'inline',
    'x-content-type-options': 'nosniff',
    'accept-ranges': 'bytes',
    'etag': object.httpEtag,
  })
  setCacheTags(event, [cacheTags.mediaFile(key.split('/')[2]!)])

  // onlyIf failed (If-None-Match matched): R2 returns the metadata without a body
  if (event.method === 'GET' && !('body' in object)) {
    setResponseStatus(event, 304)
    return null
  }
  if (range) {
    setResponseStatus(event, 206)
    setResponseHeader(event, 'content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`)
    setResponseHeader(event, 'content-length', range.length)
    return (object as R2ObjectBody).body
  }
  setResponseHeader(event, 'content-length', object.size)
  // h3 turns a null result into 204; an empty body keeps HEAD at 200
  return event.method === 'HEAD' ? '' : (object as R2ObjectBody).body
})
