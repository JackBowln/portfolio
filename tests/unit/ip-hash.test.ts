// F03-T4: client IPs are read from Cloudflare's header only and stored only as an HMAC (ADR-0012 §10)
import { describe, expect, it } from 'vitest'
import { clientIp, hashIp } from '../../server/utils/ip-hash'

describe('clientIp', () => {
  it('trusts only CF-Connecting-IP', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': ' 203.0.113.7 ' }))).toBe('203.0.113.7')
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1' }))).toBeNull()
    expect(clientIp(new Headers({ 'cf-connecting-ip': '' }))).toBeNull()
    expect(clientIp(undefined)).toBeNull()
  })
})

describe('hashIp', () => {
  it('is HMAC-SHA256 in hex, keyed by the salt', async () => {
    // printf '%s' '203.0.113.7' | openssl dgst -sha256 -hmac 'salt-a'
    expect(await hashIp('203.0.113.7', 'salt-a')).toBe('2e6db182328df4144fd08b1e8af56ca460d7833aaf3aa454540a90360e3482cf')
    expect(await hashIp('203.0.113.7', 'salt-b')).not.toBe(await hashIp('203.0.113.7', 'salt-a'))
    expect(await hashIp('203.0.113.8', 'salt-a')).not.toBe(await hashIp('203.0.113.7', 'salt-a'))
  })

  it('stores nothing without a salt or an IP, rather than an unsalted hash', async () => {
    expect(await hashIp('203.0.113.7', undefined)).toBeNull()
    expect(await hashIp('203.0.113.7', '')).toBeNull()
    expect(await hashIp(null, 'salt-a')).toBeNull()
  })
})
