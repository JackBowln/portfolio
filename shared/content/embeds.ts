// Embeds (ADR-0006 §2, ADR-0012 §1, F05-T5): the URL the owner pastes in the editor becomes `{ provider,
// externalId }`, the only thing a document stores; the player and "watch" URLs are built here from that pair, for
// the editor and the public facade alike. Hosts are matched exactly, so look-alike domains never pass
import { EMBED_ID_PATTERNS } from './document-schema.ts'
import type { EmbedProvider } from './document-schema.ts'

export { EMBED_FRAME_ORIGINS, isEmbedFrameUrl } from './embed-origins.ts'

export type EmbedParse
  = | { ok: true, provider: EmbedProvider, externalId: string }
    | { ok: false, reason: 'invalid' | 'provider' | 'video' | 'unlisted' }

export const EMBED_PROVIDER_NAMES: Record<EmbedProvider, string> = { youtube: 'YouTube', vimeo: 'Vimeo' }

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])

/** The provider's own pattern accepts the id; false for a provider outside the list (a hostile document) */
export function isEmbedId(provider: string, externalId: string): provider is EmbedProvider {
  return Object.hasOwn(EMBED_ID_PATTERNS, provider) && EMBED_ID_PATTERNS[provider as EmbedProvider].test(externalId)
}

const found = (provider: EmbedProvider, id: string | undefined): EmbedParse =>
  id !== undefined && EMBED_ID_PATTERNS[provider].test(id) ? { ok: true, provider, externalId: id } : { ok: false, reason: 'video' }

function youtube(url: URL, host: string): EmbedParse {
  if (host === 'youtu.be') {
    return found('youtube', url.pathname.split('/')[1])
  }
  const [first, second] = url.pathname.split('/').slice(1)
  if (first === 'watch') {
    return found('youtube', url.searchParams.get('v') ?? undefined)
  }
  if (first === 'embed' || first === 'shorts' || first === 'live') {
    return found('youtube', second)
  }
  return { ok: false, reason: 'video' }
}

function vimeo(url: URL, host: string): EmbedParse {
  const parts = url.pathname.split('/').filter(part => part !== '')
  if (host === 'player.vimeo.com') {
    // An unlisted video's player URL carries its hash as ?h=
    return parts[0] === 'video' ? (url.searchParams.has('h') ? { ok: false, reason: 'unlisted' } : found('vimeo', parts[1])) : { ok: false, reason: 'video' }
  }
  const index = parts.findIndex(part => /^\d+$/.test(part))
  if (index === -1) {
    return { ok: false, reason: 'video' }
  }
  // vimeo.com/{id}/{hash} is an unlisted video: playing it needs the hash, which the schema does not store
  const next = parts[index + 1]
  if ((next !== undefined && /^[\da-f]{6,}$/i.test(next)) || url.searchParams.has('h')) {
    return { ok: false, reason: 'unlisted' }
  }
  // Only vimeo.com/{id} and vimeo.com/channels/{name}/{id}
  const valid = (index === 0 && parts.length === 1) || (parts[0] === 'channels' && index === 2 && parts.length === 3)
  return valid ? found('vimeo', parts[index]) : { ok: false, reason: 'video' }
}

/** A pasted video URL as the pair a document stores, or why it cannot be one */
export function parseEmbedUrl(input: string): EmbedParse {
  let url: URL
  try {
    url = new URL(input.trim())
  }
  catch {
    return { ok: false, reason: 'invalid' }
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username !== '' || url.password !== '' || url.port !== '') {
    return { ok: false, reason: 'invalid' }
  }
  const host = url.hostname.toLowerCase()
  if (host === 'youtu.be' || YOUTUBE_HOSTS.has(host)) {
    return youtube(url, host)
  }
  if (VIMEO_HOSTS.has(host)) {
    return vimeo(url, host)
  }
  return { ok: false, reason: 'provider' }
}

/** The privacy-preserving player, autoplaying because it loads on the reader's click; undefined for a bad id */
export function embedPlayerUrl(provider: EmbedProvider, externalId: string): string | undefined {
  if (!isEmbedId(provider, externalId)) {
    return undefined
  }
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${externalId}?autoplay=1`
    : `https://player.vimeo.com/video/${externalId}?dnt=1&autoplay=1`
}

/** The video on the provider's own site, the link when JS does not run */
export function embedWatchUrl(provider: EmbedProvider, externalId: string): string | undefined {
  if (!isEmbedId(provider, externalId)) {
    return undefined
  }
  return provider === 'youtube' ? `https://www.youtube.com/watch?v=${externalId}` : `https://vimeo.com/${externalId}`
}
