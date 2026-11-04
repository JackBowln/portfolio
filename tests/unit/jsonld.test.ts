// F11-T1: JSON-LD helpers and their serialization. Stable @id, inLanguage, no empty field; a title with </script>
// can never close the tag; the section names the server uses match the UI messages
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { articleJsonLd, blogListJsonLd, homeJsonLd, projectJsonLd } from '../../server/services/seo/jsonld.service'
import type { BlogArticle } from '../../shared/content/blog'
import type { PublicProject } from '../../shared/content/projects-public'
import { blogPosting, breadcrumbList, creativeWork, person, personId, serializeJsonLd, websiteId } from '../../shared/seo/jsonld'
import { SECTION_NAMES } from '../../shared/seo/sections'
import type { PublicSettings } from '../../shared/settings/public'
import { LOCALES } from '../../shared/types/enums'

const siteUrl = 'https://example.dev/'
const context = { siteUrl: 'https://example.dev', mediaBaseUrl: 'https://media.example.dev' }
const graph = (json: string) => (JSON.parse(json) as { '@graph': Record<string, unknown>[] })['@graph']

describe('JSON-LD helpers', () => {
  it('uses stable ids and leaves out empty fields', () => {
    expect(personId(siteUrl)).toBe('https://example.dev/#person')
    expect(websiteId(siteUrl)).toBe('https://example.dev/#website')
    expect(person({ siteUrl, name: 'Nome', jobTitle: '', sameAs: [] })).toEqual({ '@type': 'Person', '@id': 'https://example.dev/#person', 'url': 'https://example.dev/', 'name': 'Nome' })
    expect(blogPosting({ url: 'https://example.dev/blog/a', headline: 'A', locale: 'pt-BR', siteUrl, datePublished: '2026-01-01T00:00:00.000Z', dateModified: '2026-01-02T00:00:00.000Z' })).toMatchObject({ author: { '@id': 'https://example.dev/#person' }, inLanguage: 'pt-BR', mainEntityOfPage: 'https://example.dev/blog/a' })
  })

  it('makes a project a SoftwareSourceCode only with a repository', () => {
    const base = { url: 'https://example.dev/projetos/p', name: 'P', locale: 'pt-BR' as const, siteUrl }
    expect(creativeWork(base)['@type']).toBe('CreativeWork')
    expect(creativeWork({ ...base, codeRepository: 'https://github.com/x/y' })).toMatchObject({ '@type': 'SoftwareSourceCode', 'codeRepository': 'https://github.com/x/y' })
  })

  it('numbers breadcrumbs from 1', () => {
    expect(breadcrumbList({ url: 'u', items: [{ name: 'A', url: 'a' }, { name: 'B', url: 'b' }] }).itemListElement).toEqual([{ '@type': 'ListItem', 'position': 1, 'name': 'A', 'item': 'a' }, { '@type': 'ListItem', 'position': 2, 'name': 'B', 'item': 'b' }])
  })

  it('never lets content close the script tag', () => {
    const separators = String.fromCharCode(0x2028, 0x2029)
    const hostile = `Título </script><script>alert(1)</script> & <!-- ${separators}`
    const json = serializeJsonLd([person({ siteUrl, name: hostile })])
    expect(json).not.toMatch(/[<>&]/)
    expect([...separators].some(char => json.includes(char))).toBe(false)
    expect(graph(json)[0]!.name).toBe(hostile)
  })
})

describe('JSON-LD per template', () => {
  const settings = { identity: { name: 'Nome', role: 'Engenheiro', bio: '' }, social: [{ network: 'github', url: 'https://github.com/x' }], footer: { showSocial: false, text: '' } } as unknown as PublicSettings

  it('home: WebSite and Person, social links only when the footer shows them', () => {
    expect(graph(homeJsonLd(context, 'en', settings)).map(node => node['@type'])).toEqual(['WebSite', 'Person'])
    expect(graph(homeJsonLd(context, 'en', settings))[1]).not.toHaveProperty('sameAs')
    expect(graph(homeJsonLd(context, 'en', { ...settings, footer: { showSocial: true, text: '' } }))[1]).toMatchObject({ sameAs: ['https://github.com/x'], jobTitle: 'Engenheiro' })
  })

  it('article, project and lists: their types, localized URLs and breadcrumbs', () => {
    const article = { locale: 'de', title: 'Titel', excerpt: '', cover: null, firstPublishedAt: '2026-01-01T00:00:00.000Z', publishedAt: '2026-01-03T00:00:00.000Z', topics: [{ name: 'Nuxt', slug: 'nuxt' }], alternates: [{ locale: 'de', slug: 'titel' }], seo: { image: { url: 'https://media.example.dev/og.jpg', width: 1200, height: 630, alt: 'Titel' } } } as unknown as BlogArticle
    const [posting, crumbs] = graph(articleJsonLd(context, article, 'Nome'))
    // F11-T2: without a cover, the share image
    expect(posting).toMatchObject({ '@type': 'BlogPosting', 'url': 'https://example.dev/de/blog/titel', 'keywords': 'Nuxt', 'inLanguage': 'de', 'image': 'https://media.example.dev/og.jpg' })
    expect(posting).not.toHaveProperty('description')
    expect((crumbs!.itemListElement as { name: string }[]).map(item => item.name)).toEqual(['Nome', 'Blog', 'Titel'])

    const project = { locale: 'en', title: 'Work', summary: 'S', cover: null, technologies: [{ name: 'Vue', slug: 'vue' }], repoUrl: null, alternates: [{ locale: 'en', slug: 'work' }], seo: { image: null } } as unknown as PublicProject
    expect(graph(projectJsonLd(context, project, 'Nome'))[0]).toMatchObject({ '@type': 'CreativeWork', 'url': 'https://example.dev/en/projects/work', 'keywords': 'Vue' })
    expect(graph(projectJsonLd(context, project, 'Nome'))[0]).not.toHaveProperty('image')

    expect(graph(blogListJsonLd(context, 'pt-BR', 'Nome', 2))[0]).toMatchObject({ '@type': 'CollectionPage', 'url': 'https://example.dev/blog?page=2' })
    expect(graph(blogListJsonLd(context, 'fr', 'Nome', 1, { name: 'Vue', slug: 'vue' }))[0]).toMatchObject({ url: 'https://example.dev/fr/blog/sujets/vue', name: 'Vue' })
  })
})

describe('section names', () => {
  it('match the UI messages in every locale', () => {
    for (const locale of LOCALES) {
      const messages = JSON.parse(readFileSync(`i18n/locales/${locale}.json`, 'utf8')) as { layout: { nav: Record<string, string> }, pages: { about: { title: string } } }
      expect(SECTION_NAMES.blog[locale], locale).toBe(messages.layout.nav.blog)
      expect(SECTION_NAMES.projects[locale], locale).toBe(messages.layout.nav.projects)
      expect(SECTION_NAMES.about[locale], locale).toBe(messages.pages.about.title)
    }
  })
})
