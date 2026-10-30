// The actor of a publishing action in a request: the signed-in user and the IP the audit hashes (F06-T4)
import type { H3Event } from 'h3'
import type { Actor } from '../services/content/publishing.service.ts'

export function publishActor(event: H3Event, userId: string): Actor {
  return { userId, ip: clientIp(event.headers), ipHashSalt: useEnv(event).IP_HASH_SALT }
}

/** Purges after a committed write; a failed purge is logged by the purge itself and never undoes the write */
export async function purgeAfterWrite(event: H3Event, tags: readonly string[]): Promise<void> {
  await purgeCacheTags(event, tags).catch(() => {})
}
