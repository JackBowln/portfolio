import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('wrangler.jsonc', () => {
  it('sets NUXT_PUBLIC_SITE_URL equal to SITE_URL in every environment', () => {
    const config = readFileSync('wrangler.jsonc', 'utf8')
    const siteUrls = [...config.matchAll(/"SITE_URL": "([^"]*)"/g)].map(match => match[1])
    const publicUrls = [...config.matchAll(/"NUXT_PUBLIC_SITE_URL": "([^"]*)"/g)].map(match => match[1])

    // local, preview and production
    expect(siteUrls).toHaveLength(3)
    expect(publicUrls).toEqual(siteUrls)
  })

  // F04-T3: components build media URLs on the client from the public copy
  it('sets NUXT_PUBLIC_MEDIA_BASE_URL equal to MEDIA_BASE_URL in every environment, without a trailing slash', () => {
    const config = readFileSync('wrangler.jsonc', 'utf8')
    const mediaUrls = [...config.matchAll(/"MEDIA_BASE_URL": "([^"]*)"/g)].map(match => match[1])
    const publicUrls = [...config.matchAll(/"NUXT_PUBLIC_MEDIA_BASE_URL": "([^"]*)"/g)].map(match => match[1])

    expect(mediaUrls).toHaveLength(3)
    expect(publicUrls).toEqual(mediaUrls)
    expect(mediaUrls.every(url => !url!.endsWith('/'))).toBe(true)
  })
})
