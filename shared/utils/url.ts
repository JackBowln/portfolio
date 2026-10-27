// Link targets are checked by protocol before they reach an href (CLAUDE.md "Sem XSS"): javascript:, data: and any
// other scheme never render as a link. Pure, so the admin, the renderer and the UI components share it.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
// Browsers drop tabs and newlines inside URLs ("java\tscript:"), so any control character rejects the link
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/
const ABSOLUTE = /^[a-z][a-z\d+.-]*:/i

/** The href to render, or undefined when the target must not become a link */
export function safeHref(input: string): string | undefined {
  const href = input.trim()
  if (href === '' || CONTROL_CHARACTERS.test(href) || href.startsWith('//') || href.includes('\\')) {
    return undefined
  }
  if (!ABSOLUTE.test(href)) {
    // Path, query or fragment on this site
    return href
  }
  try {
    const url = new URL(href)
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : undefined
  }
  catch {
    return undefined
  }
}

/** http(s) on another origin than the site's own (relative links are internal) */
export function isExternalHref(href: string, siteOrigin?: string): boolean {
  if (!/^https?:\/\//i.test(href)) {
    return false
  }
  try {
    return siteOrigin === undefined || new URL(href).origin !== new URL(siteOrigin).origin
  }
  catch {
    return true
  }
}
