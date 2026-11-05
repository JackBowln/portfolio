// F06-T4: the tags a publication event purges are exactly ADR-0003 §3's; F11-T4: the events without a publish
import { describe, expect, it } from 'vitest'
import { articlePurgeTags, mediaPurgeTags, projectListPurgeTags, sitePurgeTags, tagPurgeTags } from '../../shared/cache/purge'
import { isValidCacheTag } from '../../shared/cache/tags'

describe('article purge tags', () => {
  it('purges the article in its locale, the lists, the sitemap and the feed', () => {
    expect(articlePurgeTags({ id: 'a1', locale: 'pt-BR', tagIds: [] })).toEqual(['article:a1:pt-BR', 'list:blog:pt-BR', 'sitemap', 'rss:pt-BR'])
  })

  it('adds the topics, once each, and redirects when one was created', () => {
    expect(articlePurgeTags({ id: 'a1', locale: 'de', tagIds: ['t1', 't2', 't1'], redirect: true }))
      .toEqual(['article:a1:de', 'list:blog:de', 'sitemap', 'rss:de', 'tag:t1', 'tag:t2', 'redirects'])
  })
})

describe('purges without a publish (F11-T4)', () => {
  it('a renamed topic or technology: its tag, every list and the sitemap', () => {
    const tags = tagPurgeTags('t1')
    expect(tags.slice(0, 1)).toEqual(['tag:t1'])
    expect(tags).toEqual(expect.arrayContaining(['list:blog:pt-BR', 'list:blog:fr', 'list:projects:en', 'list:projects:de', 'sitemap']))
    expect(tags).toHaveLength(1 + 10 + 1)
  })

  it('media, the project lists with the home, and the whole site', () => {
    expect(mediaPurgeTags('m1')).toEqual(['media:m1'])
    expect(projectListPurgeTags()).toEqual(expect.arrayContaining(['list:projects:pt-BR', 'page:home:pt-BR', 'list:projects:fr', 'page:home:fr']))
    expect(projectListPurgeTags()).toHaveLength(10)
    expect(sitePurgeTags()).toEqual(['site'])
    expect([...tagPurgeTags('t1'), ...projectListPurgeTags()].every(isValidCacheTag)).toBe(true)
  })
})
