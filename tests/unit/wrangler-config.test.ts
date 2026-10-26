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
})
