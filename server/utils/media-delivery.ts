// The headers a media object is delivered with (ADR-0007 §5, ADR-0017 §3). A PDF is a download and never a page on the
// site's origin: attachment, and a sandbox policy so that a browser opening it anyway runs and loads nothing. A CV is
// cached for a day, not for a year: the owner may replace it, and the browser should pick up the new file soon
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
export const CV_CACHE = 'public, max-age=86400'

export function deliveryCacheControl(contentType: string): string {
  return contentType === 'application/pdf' ? CV_CACHE : IMMUTABLE_CACHE
}

export function deliveryDispositionHeaders(contentType: string): Record<string, string> {
  if (contentType === 'application/pdf') {
    return { 'content-disposition': 'attachment; filename="cv.pdf"', 'content-security-policy': 'default-src \'none\'; sandbox' }
  }
  return { 'content-disposition': 'inline' }
}
