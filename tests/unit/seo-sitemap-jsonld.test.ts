import { describe, expect, it } from 'vitest'
import { localizedPath, xDefaultLocale } from '../../shared/i18n/locales'
import { person, serializeJsonLd, website } from '../../shared/seo/jsonld'
import { buildSitemap } from '../../shared/seo/sitemap'

describe('buildSitemap', () => {
  it('writes one <url> per locale, each with all alternates and x-default', () => {
    const xml = buildSitemap([{ urls: { 'pt-BR': 'https://x.dev/sobre', 'en': 'https://x.dev/en/about' } }])

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /)
    expect(xml.match(/<url>/g)).toHaveLength(2)
    expect(xml.match(/hreflang="x-default" href="https:\/\/x.dev\/en\/about"/g)).toHaveLength(2)
    expect(xml).toContain('<loc>https://x.dev/sobre</loc>')
  })

  it('points x-default to pt-BR without English and escapes XML', () => {
    const xml = buildSitemap([{ urls: { 'pt-BR': 'https://x.dev/a?b=1&c=<2>' }, lastmod: '2026-10-26' }])

    expect(xml).toContain('<loc>https://x.dev/a?b=1&amp;c=&lt;2&gt;</loc>')
    expect(xml).toContain('hreflang="x-default" href="https://x.dev/a?b=1&amp;c=&lt;2&gt;"')
    expect(xml).toContain('<lastmod>2026-10-26</lastmod>')
  })
})

describe('locale helpers', () => {
  it('prefixes every locale but pt-BR, with the home at the prefix itself', () => {
    expect(localizedPath('pt-BR', '/')).toBe('/')
    expect(localizedPath('en', '/')).toBe('/en')
    expect(localizedPath('de', '/ueber-mich')).toBe('/de/ueber-mich')
  })

  it('picks English for x-default only when published', () => {
    expect(xDefaultLocale(['pt-BR', 'en', 'de'])).toBe('en')
    expect(xDefaultLocale(['pt-BR', 'de'])).toBe('pt-BR')
  })
})

describe('JSON-LD', () => {
  it('uses stable @id values and inLanguage', () => {
    expect(website({ siteUrl: 'https://x.dev/', name: 'N', locale: 'fr' })).toMatchObject({
      '@type': 'WebSite', '@id': 'https://x.dev/#website', 'inLanguage': 'fr', 'publisher': { '@id': 'https://x.dev/#person' },
    })
    expect(person({ siteUrl: 'https://x.dev', name: 'N' })).toEqual({
      '@type': 'Person', '@id': 'https://x.dev/#person', 'url': 'https://x.dev/', 'name': 'N',
    })
  })

  it('can never close the script tag', () => {
    const json = serializeJsonLd([person({ siteUrl: 'https://x.dev', name: '</script><script>alert(1)</script>' })])

    expect(json).not.toContain('<')
    expect(JSON.parse(json)['@graph'][0].name).toBe('</script><script>alert(1)</script>')
  })
})
