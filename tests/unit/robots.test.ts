// F11-T3: robots.txt per environment; only production lets crawlers in, and it points to the sitemap
import { describe, expect, it } from 'vitest'
import { robotsTxt } from '../../shared/seo/robots'

describe('robotsTxt', () => {
  it('allows production except the private areas, with the sitemap', () => {
    expect(robotsTxt('production', 'https://example.dev/')).toBe('User-agent: *\nDisallow: /admin\nDisallow: /api\nDisallow: /preview\n\nSitemap: https://example.dev/sitemap.xml\n')
  })

  it('blocks every other environment', () => {
    for (const environment of ['preview', 'local', 'test', '']) {
      expect(robotsTxt(environment, 'https://example.dev'), environment).toBe('User-agent: *\nDisallow: /\n')
    }
  })
})
