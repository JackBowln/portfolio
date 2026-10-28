// Auth rules of ADR-0005 §2–§4 as pure functions (unit-tested): who GitHub may create, the bootstrap grant and when a
// passkey may be removed. WebCrypto only, so the same code runs in Node (tests) and in the Worker
export const BOOTSTRAP_COOKIE = 'portfolio.bootstrap'
export const BOOTSTRAP_GRANT_SECONDS = 10 * 60
// There is no rate limit on the bootstrap until F03-T4, so a short token could be guessed: it never opens the flow
export const MIN_BOOTSTRAP_TOKEN_LENGTH = 32

export function bootstrapTokenUsable(token: string | undefined): token is string {
  return (token?.length ?? 0) >= MIN_BOOTSTRAP_TOKEN_LENGTH
}

const encoder = new TextEncoder()

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let difference = 0
  for (let index = 0; index < a.length; index++) {
    difference |= a[index]! ^ b[index]!
  }
  return difference === 0
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** Constant time, whatever the lengths: both sides are compared as HMACs of equal size */
export async function tokensMatch(given: string, expected: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac(secret, `token:${given}`), hmac(secret, `token:${expected}`)])
  return equalBytes(a, b) && expected.length > 0
}

/** `<expiresAtMs>.<signature>`: proves the BOOTSTRAP_TOKEN was presented, for a short while */
export async function createBootstrapGrant(secret: string, nowMs: number): Promise<string> {
  const expiresAt = nowMs + BOOTSTRAP_GRANT_SECONDS * 1000
  return `${expiresAt}.${base64url(await hmac(secret, `bootstrap:${expiresAt}`))}`
}

export async function verifyBootstrapGrant(value: string | undefined, secret: string, nowMs: number): Promise<boolean> {
  const [expiresAt = '', signature = '', ...rest] = (value ?? '').split('.')
  if (rest.length > 0 || !/^\d{13}$/.test(expiresAt) || Number(expiresAt) <= nowMs) {
    return false
  }
  const expected = base64url(await hmac(secret, `bootstrap:${expiresAt}`))
  return equalBytes(encoder.encode(signature), encoder.encode(expected))
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) {
      return decodeURIComponent(value.join('='))
    }
  }
  return undefined
}

export type GithubAccessDecision
  = | { allowed: true }
    | { allowed: false, reason: 'not_configured' | 'not_allowlisted' | 'owner_exists' | 'bootstrap_required' | 'unknown_action' }

/**
 * Better Auth asks on every GitHub sign-up, sign-in and account link (`action`). Signing in or linking needs only the
 * allowlisted id; creating a user happens once: the owner, before any owner exists, with a bootstrap grant
 */
export function githubAccessDecision(input: {
  action: string
  ownerGithubId: string | undefined
  githubId: string | undefined
  ownerExists: boolean
  bootstrapGranted: boolean
}): GithubAccessDecision {
  if (!input.ownerGithubId) {
    return { allowed: false, reason: 'not_configured' }
  }
  if (!input.githubId || input.githubId !== input.ownerGithubId) {
    return { allowed: false, reason: 'not_allowlisted' }
  }
  if (input.action === 'sign-in' || input.action === 'link-account') {
    return { allowed: true }
  }
  if (input.action !== 'create-user') {
    return { allowed: false, reason: 'unknown_action' }
  }
  if (input.ownerExists) {
    return { allowed: false, reason: 'owner_exists' }
  }
  if (!input.bootstrapGranted) {
    return { allowed: false, reason: 'bootstrap_required' }
  }
  return { allowed: true }
}

export type PasskeyRemoval = 'ok' | 'session_not_fresh' | 'last_passkey'

/** Removing a passkey needs a fresh session and must not leave the account without a way in */
export function passkeyRemoval(input: {
  sessionCreatedAt: Date
  nowMs: number
  freshAgeSeconds: number
  passkeyCount: number
  hasGithub: boolean
}): PasskeyRemoval {
  if (input.nowMs - input.sessionCreatedAt.getTime() > input.freshAgeSeconds * 1000) {
    return 'session_not_fresh'
  }
  if (input.passkeyCount <= 1 && !input.hasGithub) {
    return 'last_passkey'
  }
  return 'ok'
}
