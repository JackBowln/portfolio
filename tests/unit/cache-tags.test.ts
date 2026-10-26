import { describe, expect, it } from 'vitest'
import { assertValidCacheTags, cacheTags, isValidCacheTag } from '../../shared/cache/tags'

describe('cacheTags', () => {
  it('builds the ADR-0003 vocabulary', () => {
    const id = '0192f3c4-7d1e-7a00-8000-000000000001'

    expect(cacheTags.site()).toBe('site')
    expect(cacheTags.locale('pt-BR')).toBe('locale:pt-BR')
    expect(cacheTags.page('about', 'en')).toBe('page:about:en')
    expect(cacheTags.article(id)).toBe(`article:${id}`)
    expect(cacheTags.articleLocale(id, 'de')).toBe(`article:${id}:de`)
    expect(cacheTags.blogList('fr')).toBe('list:blog:fr')
    expect(cacheTags.projectList('es')).toBe('list:projects:es')
    expect(cacheTags.rss('en')).toBe('rss:en')
    expect(cacheTags.settings()).toBe('settings')
    expect(cacheTags.sitemap()).toBe('sitemap')
    expect(cacheTags.redirects()).toBe('redirects')
  })

  it('produces only valid tags', () => {
    const tags = [cacheTags.site(), cacheTags.page('home', 'pt-BR'), cacheTags.tag('x'), cacheTags.media('y')]

    expect(tags.every(isValidCacheTag)).toBe(true)
  })
})

describe('isValidCacheTag', () => {
  it.each([
    ['', 'empty'],
    ['a b', 'space'],
    ['a,b', 'comma, the header separator'],
    ['café', 'non-ASCII'],
    ['a\nb', 'control character'],
    ['x'.repeat(1025), 'over 1024 characters'],
  ])('rejects %j (%s)', (tag) => {
    expect(isValidCacheTag(tag)).toBe(false)
  })

  it('accepts printable ASCII up to 1024 characters', () => {
    expect(isValidCacheTag('x'.repeat(1024))).toBe(true)
    expect(isValidCacheTag('article:abc:pt-BR')).toBe(true)
  })
})

describe('assertValidCacheTags', () => {
  it('throws naming the invalid tags', () => {
    expect(() => assertValidCacheTags(['site', 'a,b'])).toThrow('"a,b"')
  })

  it('accepts a valid list', () => {
    expect(() => assertValidCacheTags(['site', 'settings'])).not.toThrow()
  })
})
