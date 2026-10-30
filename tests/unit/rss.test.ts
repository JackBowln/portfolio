// F06-T5: RSS 2.0 per locale: escaped text, absolute links as guids, RFC 822 dates and the self link
import { describe, expect, it } from 'vitest'
import { pageCount, parsePage, priorityCover } from '../../shared/content/blog'
import { buildRss, rfc822 } from '../../shared/seo/rss'

describe('RSS', () => {
  it('escapes text and dates items in RFC 822', () => {
    const xml = buildRss({
      title: 'Blog <teste> & "aspas"',
      description: 'Descrição',
      link: 'https://example.com/blog',
      self: 'https://example.com/rss.xml',
      language: 'pt-BR',
      items: [{ title: 'A & B <script>', url: 'https://example.com/blog/a-b?x=1&y=2', description: 'Resumo com </description> dentro', publishedAt: new Date('2026-10-30T12:00:00Z') }],
    })
    expect(xml).toContain('<title>Blog &lt;teste&gt; &amp; &quot;aspas&quot;</title>')
    expect(xml).toContain('<title>A &amp; B &lt;script&gt;</title>')
    expect(xml).toContain('<guid isPermaLink="true">https://example.com/blog/a-b?x=1&amp;y=2</guid>')
    expect(xml).toContain('<description>Resumo com &lt;/description&gt; dentro</description>')
    expect(xml).toContain('<pubDate>Fri, 30 Oct 2026 12:00:00 GMT</pubDate>')
    expect(xml).toContain('<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>')
    expect(xml).not.toContain('<script>')
    expect(rfc822(new Date('2026-01-05T03:04:05Z'))).toBe('Mon, 05 Jan 2026 03:04:05 GMT')
  })

  it('has no lastBuildDate and no items when the locale has no article', () => {
    const xml = buildRss({ title: 'B', description: 'D', link: 'https://e.com/en/blog', self: 'https://e.com/en/rss.xml', language: 'en', items: [] })
    expect(xml).not.toContain('<item>')
    expect(xml).not.toContain('lastBuildDate')
  })
})

describe('blog pages', () => {
  it('counts pages and reads ?page strictly', () => {
    expect([pageCount(0), pageCount(10), pageCount(11), pageCount(25)]).toEqual([1, 1, 2, 3])
    expect([parsePage(undefined), parsePage(''), parsePage('2'), parsePage('120')]).toEqual([1, 1, 2, 120])
    for (const value of ['0', '-1', '1.5', 'abc', '01', '9999999']) {
      expect(parsePage(value), String(value)).toBeNull()
    }
  })

  it('gives priority to the first cover among the first two cards only', () => {
    const card = (cover: boolean) => ({ cover: cover ? {} : null })
    expect(priorityCover([card(true), card(true)])).toBe(0)
    expect(priorityCover([card(false), card(true)])).toBe(1)
    expect(priorityCover([card(false), card(false), card(true)])).toBe(-1)
    expect(priorityCover([])).toBe(-1)
  })
})
