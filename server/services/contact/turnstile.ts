// Turnstile, checked on the server (ADR-0012 §6, F08-T3): the widget's token goes to siteverify with the secret.
// Any failure (network, timeout, bad answer) counts as not verified: the form fails closed. Outside local runs the
// token must also come from this site (hostname), so a token solved elsewhere with the same key is refused
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

export async function verifyTurnstile(secret: string, token: string, ip: string | null, fetcher: typeof fetch = fetch, hostname?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token })
  if (ip) {
    body.set('remoteip', ip)
  }
  try {
    const response = await fetcher(SITEVERIFY, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!response.ok) {
      return false
    }
    const result = await response.json() as { success?: unknown, hostname?: unknown }
    return result.success === true && (hostname === undefined || result.hostname === hostname)
  }
  catch {
    return false
  }
}
