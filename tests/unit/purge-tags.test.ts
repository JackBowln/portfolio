// F06-T4: the tags a publication event purges are exactly ADR-0003 §3's
import { describe, expect, it } from 'vitest'
import { articlePurgeTags } from '../../shared/cache/purge'

describe('article purge tags', () => {
  it('purges the article in its locale, the lists, the sitemap and the feed', () => {
    expect(articlePurgeTags({ id: 'a1', locale: 'pt-BR', tagIds: [] })).toEqual(['article:a1:pt-BR', 'list:blog:pt-BR', 'sitemap', 'rss:pt-BR'])
  })

  it('adds the topics, once each, and redirects when one was created', () => {
    expect(articlePurgeTags({ id: 'a1', locale: 'de', tagIds: ['t1', 't2', 't1'], redirect: true }))
      .toEqual(['article:a1:de', 'list:blog:de', 'sitemap', 'rss:de', 'tag:t1', 'tag:t2', 'redirects'])
  })
})
