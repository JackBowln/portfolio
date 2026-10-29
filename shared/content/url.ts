// Link targets inside documents (ADR-0006 §2): https:, http:, mailto: or relative to the site. Stricter than the
// UI's safeHref (no tel:), and the rel is derived here instead of stored in the document
import { isExternalHref, safeHref } from '../utils/url.ts'

export const MAX_HREF_LENGTH = 2048
const CONTENT_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/** The href exactly as stored, or undefined when it must be refused */
export function contentHref(input: string): string | undefined {
  if (input.length === 0 || input.length > MAX_HREF_LENGTH || input !== input.trim()) {
    return undefined
  }
  const href = safeHref(input)
  if (href === undefined) {
    return undefined
  }
  if (!/^[a-z][a-z\d+.-]*:/i.test(input)) {
    return input
  }
  return CONTENT_PROTOCOLS.has(new URL(href).protocol) ? input : undefined
}

/** rel for a rendered link: external targets never get the opener nor a referrer */
export function linkRel(href: string, siteOrigin?: string): string | undefined {
  return isExternalHref(href, siteOrigin) ? 'noopener noreferrer' : undefined
}
