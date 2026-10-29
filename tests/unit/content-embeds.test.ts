// F05-T5: the embed URL parser takes the addresses owners copy from YouTube and Vimeo and nothing else (look-alike
// hosts, credentials, other schemes, unlisted Vimeo videos), and the player URLs come only from valid ids
import { describe, expect, it } from 'vitest'
import { isEmbedFrameUrl } from '../../shared/content/embed-origins'
import { embedPlayerUrl, embedWatchUrl, isEmbedId, parseEmbedUrl } from '../../shared/content/embeds'

const ID = 'dQw4w9WgXcQ'

describe('parseEmbedUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc&t=10`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    `  https://WWW.YOUTUBE.COM/watch?v=${ID}  `,
  ])('reads a YouTube video from %s', (url) => {
    expect(parseEmbedUrl(url)).toEqual({ ok: true, provider: 'youtube', externalId: ID })
  })

  it.each([
    'https://vimeo.com/76979871',
    'https://www.vimeo.com/76979871?share=copy',
    'https://vimeo.com/channels/staffpicks/76979871',
    'https://player.vimeo.com/video/76979871',
    'https://player.vimeo.com/video/76979871?autoplay=1',
  ])('reads a Vimeo video from %s', (url) => {
    expect(parseEmbedUrl(url)).toEqual({ ok: true, provider: 'vimeo', externalId: '76979871' })
  })

  it.each([
    ['not a url', 'invalid'],
    ['youtube.com/watch?v=dQw4w9WgXcQ', 'invalid'],
    [`javascript:alert(1)//https://youtu.be/${ID}`, 'invalid'],
    [`ftp://youtu.be/${ID}`, 'invalid'],
    [`https://user:pass@www.youtube.com/watch?v=${ID}`, 'invalid'],
    [`https://www.youtube.com@evil.example/watch?v=${ID}`, 'invalid'],
    [`https://www.youtube.com:8443/watch?v=${ID}`, 'invalid'],
    [`https://www.youtube.com.evil.example/watch?v=${ID}`, 'provider'],
    [`https://evilyoutube.com/watch?v=${ID}`, 'provider'],
    [`https://music.youtube.com/watch?v=${ID}`, 'provider'],
    ['https://vimeo.com.evil.example/76979871', 'provider'],
    ['https://www.dailymotion.com/video/x7tgad0', 'provider'],
    ['https://www.youtube.com/watch?v=short', 'video'],
    [`https://www.youtube.com/watch?v=${ID}x`, 'video'],
    ['https://www.youtube.com/playlist?list=PL123', 'video'],
    ['https://www.youtube.com/@channel', 'video'],
    ['https://youtu.be/', 'video'],
    [`https://www.youtube.com/embed/${ID.slice(0, 10)}"onload`, 'video'],
    ['https://vimeo.com/channels/staffpicks', 'video'],
    ['https://vimeo.com/user123/videos/76979871', 'video'],
    ['https://player.vimeo.com/76979871', 'video'],
    ['https://vimeo.com/76979871/abcdef1234', 'unlisted'],
    ['https://vimeo.com/76979871?h=abcdef1234', 'unlisted'],
    ['https://player.vimeo.com/video/76979871?h=abcdef1234', 'unlisted'],
  ])('refuses %s (%s)', (url, reason) => {
    expect(parseEmbedUrl(url)).toEqual({ ok: false, reason })
  })
})

describe('embed URLs', () => {
  it('builds the privacy-preserving player and the watch link from a valid id', () => {
    expect(embedPlayerUrl('youtube', ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`)
    expect(embedPlayerUrl('vimeo', '76979871')).toBe('https://player.vimeo.com/video/76979871?dnt=1&autoplay=1')
    expect(embedWatchUrl('youtube', ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(embedWatchUrl('vimeo', '76979871')).toBe('https://vimeo.com/76979871')
  })

  it('builds nothing for an id or provider outside the patterns', () => {
    expect(embedPlayerUrl('youtube', `${ID}"><script>`)).toBeUndefined()
    expect(embedWatchUrl('vimeo', '1/../../evil')).toBeUndefined()
    expect(isEmbedId('constructor', ID)).toBe(false)
    expect(isEmbedId('__proto__', ID)).toBe(false)
    expect(isEmbedId('evil', ID)).toBe(false)
  })

  it('lets the facade frame only the two player origins', () => {
    expect(isEmbedFrameUrl(embedPlayerUrl('youtube', ID)!)).toBe(true)
    expect(isEmbedFrameUrl(embedPlayerUrl('vimeo', '1')!)).toBe(true)
    for (const url of ['https://www.youtube.com/embed/x', 'https://www.youtube-nocookie.com.evil.example/embed/x', 'javascript:alert(1)', 'https://user@player.vimeo.com/video/1', 'http://player.vimeo.com/video/1', '']) {
      expect(isEmbedFrameUrl(url), url).toBe(false)
    }
  })
})
