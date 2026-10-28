// F03-T2: bootstrap grant, token comparison and passkey removal rules (ADR-0005 §2–§4)
import { describe, expect, it } from 'vitest'
import {
  BOOTSTRAP_GRANT_SECONDS,
  bootstrapTokenUsable,
  createBootstrapGrant,
  githubAccessDecision,
  passkeyRemoval,
  readCookie,
  tokensMatch,
  verifyBootstrapGrant,
} from '../../server/services/auth/policies'

// Throwaway value generated per run; never a real secret
const SECRET = crypto.randomUUID() + crypto.randomUUID()
const NOW = Date.UTC(2026, 9, 28, 12)

describe('tokensMatch', () => {
  it('matches only the exact token, whatever the lengths', async () => {
    expect(await tokensMatch('abc-123', 'abc-123', SECRET)).toBe(true)
    expect(await tokensMatch('abc-124', 'abc-123', SECRET)).toBe(false)
    expect(await tokensMatch('abc', 'abc-123', SECRET)).toBe(false)
    expect(await tokensMatch('', '', SECRET)).toBe(false)
  })
})

describe('bootstrapTokenUsable', () => {
  it('needs a configured token of at least 32 characters', () => {
    expect(bootstrapTokenUsable(undefined)).toBe(false)
    expect(bootstrapTokenUsable('')).toBe(false)
    expect(bootstrapTokenUsable('x'.repeat(31))).toBe(false)
    expect(bootstrapTokenUsable('x'.repeat(32))).toBe(true)
  })
})

describe('bootstrap grant', () => {
  it('is valid for 10 minutes', async () => {
    const grant = await createBootstrapGrant(SECRET, NOW)
    expect(await verifyBootstrapGrant(grant, SECRET, NOW + 1000)).toBe(true)
    expect(await verifyBootstrapGrant(grant, SECRET, NOW + BOOTSTRAP_GRANT_SECONDS * 1000 + 1)).toBe(false)
  })

  it('rejects a grant signed with another secret, tampered or malformed', async () => {
    const grant = await createBootstrapGrant(SECRET, NOW)
    const [expiresAt, signature] = grant.split('.')
    expect(await verifyBootstrapGrant(grant, `${SECRET}x`, NOW)).toBe(false)
    expect(await verifyBootstrapGrant(`${Number(expiresAt) + 60_000}.${signature}`, SECRET, NOW)).toBe(false)
    for (const value of [undefined, '', 'x', `${expiresAt}`, `${grant}.extra`, `abc.${signature}`]) {
      expect(await verifyBootstrapGrant(value, SECRET, NOW), String(value)).toBe(false)
    }
  })
})

describe('readCookie', () => {
  it('finds one cookie among others and decodes it', () => {
    expect(readCookie('a=1; portfolio.bootstrap=x%2Ey; b=2', 'portfolio.bootstrap')).toBe('x.y')
    expect(readCookie('a=1', 'portfolio.bootstrap')).toBeUndefined()
    expect(readCookie(null, 'portfolio.bootstrap')).toBeUndefined()
  })
})

describe('githubAccessDecision', () => {
  const base = { action: 'create-user', ownerGithubId: '7', githubId: '7', ownerExists: false, bootstrapGranted: true }

  it('creates a user only for the allowlisted id, before any owner, with a grant', () => {
    expect(githubAccessDecision(base)).toEqual({ allowed: true })
    expect(githubAccessDecision({ ...base, ownerGithubId: undefined })).toEqual({ allowed: false, reason: 'not_configured' })
    expect(githubAccessDecision({ ...base, githubId: '8' })).toEqual({ allowed: false, reason: 'not_allowlisted' })
    expect(githubAccessDecision({ ...base, githubId: undefined })).toEqual({ allowed: false, reason: 'not_allowlisted' })
    expect(githubAccessDecision({ ...base, ownerExists: true })).toEqual({ allowed: false, reason: 'owner_exists' })
    expect(githubAccessDecision({ ...base, bootstrapGranted: false })).toEqual({ allowed: false, reason: 'bootstrap_required' })
  })

  it('signs in and links only the allowlisted id, with no bootstrap needed', () => {
    for (const action of ['sign-in', 'link-account']) {
      expect(githubAccessDecision({ ...base, action, ownerExists: true, bootstrapGranted: false }), action).toEqual({ allowed: true })
      expect(githubAccessDecision({ ...base, action, githubId: '8' }), action).toEqual({ allowed: false, reason: 'not_allowlisted' })
    }
  })

  it('rejects actions it does not know', () => {
    expect(githubAccessDecision({ ...base, action: 'something-new' })).toEqual({ allowed: false, reason: 'unknown_action' })
  })
})

describe('passkeyRemoval', () => {
  const fresh = { sessionCreatedAt: new Date(NOW - 60_000), nowMs: NOW, freshAgeSeconds: 900 }

  it('needs a fresh session', () => {
    expect(passkeyRemoval({ ...fresh, sessionCreatedAt: new Date(NOW - 901_000), passkeyCount: 3, hasGithub: true })).toBe('session_not_fresh')
  })

  it('keeps the last passkey unless GitHub is linked', () => {
    expect(passkeyRemoval({ ...fresh, passkeyCount: 1, hasGithub: false })).toBe('last_passkey')
    expect(passkeyRemoval({ ...fresh, passkeyCount: 1, hasGithub: true })).toBe('ok')
    expect(passkeyRemoval({ ...fresh, passkeyCount: 2, hasGithub: false })).toBe('ok')
  })
})
