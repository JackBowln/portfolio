import { describe, expect, it } from 'vitest'
import { absoluteUrl, buildSeoHead } from '../../shared/seo/head'
import type { SeoInput } from '../../shared/seo/head'

const SITE = 'https://example.dev'
const ABOUT = { 'pt-BR': '/sobre', 'en': '/en/about', 'es': '/es/sobre-mi', 'de': '/de/ueber-mich', 'fr': '/fr/a-propos' }

const input = (overrides: Partial<SeoInput> = {}): SeoInput => ({
  siteUrl: SITE,
  locale: 'de',
  path: '/de/ueber-mich',
  title: 'Über mich',
  titleTemplate: '%s — Name',
  description: 'Beschreibung',
  alternates: ABOUT,
  ...overrides,
})

const hreflang = (head: ReturnType<typeof buildSeoHead>) =>
  Object.fromEntries(head.link.filter(link => link.rel === 'alternate').map(link => [link.hreflang, link.href]))

describe('buildSeoHead', () => {
  it('applies the title template and an absolute canonical for the page itself', () => {
    const head = buildSeoHead(input())

    expect(head.title).toBe('Über mich — Name')
    expect(head.link[0]).toEqual({ rel: 'canonical', href: `${SITE}/de/ueber-mich` })
    expect(head.meta).toContainEqual({ name: 'description', content: 'Beschreibung' })
    expect(head.meta).toContainEqual({ property: 'og:url', content: `${SITE}/de/ueber-mich` })
    expect(head.meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
  })

  it('lists hreflang for every published locale, itself included, and x-default to English', () => {
    expect(hreflang(buildSeoHead(input()))).toEqual({
      'pt-BR': `${SITE}/sobre`,
      'en': `${SITE}/en/about`,
      'es': `${SITE}/es/sobre-mi`,
      'de': `${SITE}/de/ueber-mich`,
      'fr': `${SITE}/fr/a-propos`,
      'x-default': `${SITE}/en/about`,
    })
  })

  it('lists only the alternates it is given, with x-default to pt-BR when English is not published', () => {
    const head = buildSeoHead(input({ alternates: { 'pt-BR': '/sobre', 'de': '/de/ueber-mich' } }))

    expect(hreflang(head)).toEqual({
      'pt-BR': `${SITE}/sobre`,
      'de': `${SITE}/de/ueber-mich`,
      'x-default': `${SITE}/sobre`,
    })
    expect(head.meta.filter(meta => 'property' in meta && meta.property === 'og:locale:alternate'))
      .toEqual([{ property: 'og:locale:alternate', content: 'pt_BR' }])
  })

  it('sets og:locale from the active locale', () => {
    expect(buildSeoHead(input({ locale: 'pt-BR', path: '/sobre' })).meta)
      .toContainEqual({ property: 'og:locale', content: 'pt_BR' })
  })

  it('marks noindex pages and gives them no hreflang', () => {
    const head = buildSeoHead(input({ noindex: true }))

    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex' })
    expect(hreflang(head)).toEqual({})
    expect(head.link).toEqual([{ rel: 'canonical', href: `${SITE}/de/ueber-mich` }])
  })
})

describe('absoluteUrl', () => {
  it('drops query and hash and tolerates a trailing slash on the site URL', () => {
    expect(absoluteUrl(`${SITE}/`, '/en/about?utm_source=x#top')).toBe(`${SITE}/en/about`)
    expect(absoluteUrl(SITE, '/')).toBe(`${SITE}/`)
  })
})
