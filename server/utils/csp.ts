// CSP by hash (ADR-0012 §1). Pages are cached at the edge, so a per-request nonce would be frozen in the cache;
// hashes of the final HTML's inline scripts travel with that same HTML instead. Pure, so it is unit-tested directly
const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi
const SRC_ATTR = /(?:^|\s)src\s*=/i
const TYPE_ATTR = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i
// Types the browser runs (or parses as script policy): everything else, like JSON data blocks, never executes
const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript', 'importmap', 'speculationrules'])

/** Contents of the inline scripts that CSP governs, in document order */
export function inlineScripts(html: string): string[] {
  const scripts: string[] = []
  for (const [, attrs = '', content = ''] of html.matchAll(SCRIPT_TAG)) {
    if (SRC_ATTR.test(attrs)) {
      continue
    }
    const type = TYPE_ATTR.exec(attrs)
    const value = (type?.[1] ?? type?.[2] ?? type?.[3] ?? '').trim().toLowerCase()
    if (EXECUTABLE_TYPES.has(value)) {
      scripts.push(content)
    }
  }
  return scripts
}

// The same few scripts repeat on every page; the config one changes only per environment
const MAX_MEMO = 64
const memo = new Map<string, string>()

/** CSP hash source of one script: `'sha256-<base64 of the UTF-8 bytes>'` */
export async function scriptHash(content: string): Promise<string> {
  const cached = memo.get(content)
  if (cached) {
    return cached
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content)))
  const source = `'sha256-${btoa(String.fromCharCode(...digest))}'`
  if (memo.size >= MAX_MEMO) {
    memo.clear()
  }
  memo.set(content, source)
  return source
}

export interface PageCspOptions {
  scriptHashes: readonly string[]
  /** Origin serving media when it differs from the site's own (MEDIA_BASE_URL) */
  mediaOrigin?: string | undefined
  /** Only on https sites: upgrading localhost requests would break local previews */
  upgradeInsecureRequests: boolean
}

export function pageCsp({ scriptHashes, mediaOrigin, upgradeInsecureRequests }: PageCspOptions): string {
  const media = mediaOrigin ? ` ${mediaOrigin}` : ''
  const hashes = [...new Set(scriptHashes)].map(hash => ` ${hash}`).join('')
  const directives = [
    `default-src 'self'`,
    `script-src 'self'${hashes}`,
    // Accepted trade-off: Nuxt and Vue emit inline styles (ADR-0012 §1)
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:${media}`,
    `media-src 'self'${media}`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ]
  if (upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests')
  }
  return directives.join('; ')
}

/** Anything that is not a page (JSON, errors, files) loads nothing and is never framed */
export const NON_PAGE_CSP = `default-src 'none'; frame-ancestors 'none'`

/** MEDIA_BASE_URL's origin, or undefined when media is served by the site itself */
export function mediaOriginFor(siteUrl: string, mediaBaseUrl: string | undefined): string | undefined {
  if (!mediaBaseUrl) {
    return undefined
  }
  const origin = new URL(mediaBaseUrl).origin
  return origin === new URL(siteUrl).origin ? undefined : origin
}
