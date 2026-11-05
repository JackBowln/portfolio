// F11-T4: which query parameters each public page keeps; anything else makes the middleware redirect
import { describe, expect, it } from 'vitest'
import { allowedParams, canonicalQueryTarget } from '../../shared/seo/canonical-query'

describe('canonicalQueryTarget', () => {
  it('keeps page on blog and topic lists, tech on project lists, nothing elsewhere', () => {
    expect(allowedParams('/blog')).toEqual(['page'])
    expect(allowedParams('/fr/blog/sujets/vue')).toEqual(['page'])
    expect(allowedParams('/de/projekte')).toEqual(['tech'])
    expect(allowedParams('/blog/um-artigo')).toEqual([])
    expect(allowedParams('/')).toEqual([])
  })

  it('redirects to the URL without what the page does not read', () => {
    expect(canonicalQueryTarget('/', '?utm_source=x')).toBe('/')
    expect(canonicalQueryTarget('/blog', '?utm_source=x&page=2')).toBe('/blog?page=2')
    expect(canonicalQueryTarget('/blog', '?page=2&page=3')).toBe('/blog?page=2')
    expect(canonicalQueryTarget('/en/projects', '?page=2&tech=vue')).toBe('/en/projects?tech=vue')
    expect(canonicalQueryTarget('/blog/temas/x', '?page=2')).toBeNull()
    expect(canonicalQueryTarget('/projetos', '?tech=a%20b')).toBeNull()
    expect(canonicalQueryTarget('/sobre', '')).toBeNull()
    expect(canonicalQueryTarget('/sobre', '?')).toBeNull()
  })

  it('leaves alone what reads its own query', () => {
    for (const path of ['/api/public/blog', '/admin/midia', '/_test/media', '/preview/abc', '/media/ab/x.jpg', '/_i18n/h/en/messages.json', '/__nuxt_error']) {
      expect(canonicalQueryTarget(path, '?x=1'), path).toBeNull()
    }
  })
})
