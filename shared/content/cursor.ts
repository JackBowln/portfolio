// Keyset cursor of the public lists, ordered by (published_at DESC, id DESC): base64url of "{published_at}:{id}".
// published_at repeats (a batch publish), so the id breaks ties
import { isUuidv7 } from '../utils/id.ts'

export interface PublishedCursor {
  publishedAt: number
  id: string
}

export function encodePublishedCursor({ publishedAt, id }: PublishedCursor): string {
  return btoa(`${publishedAt}:${id}`).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** null for anything that is not a cursor this module wrote */
export function decodePublishedCursor(cursor: string): PublishedCursor | null {
  if (!/^[\w-]{1,128}$/.test(cursor)) {
    return null
  }
  let text: string
  try {
    text = atob(cursor.replaceAll('-', '+').replaceAll('_', '/'))
  }
  catch {
    return null
  }
  const match = /^(\d{1,15}):(.+)$/.exec(text)
  if (!match || !isUuidv7(match[2]!)) {
    return null
  }
  return { publishedAt: Number(match[1]), id: match[2]! }
}
