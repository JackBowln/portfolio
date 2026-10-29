// Origins an embed may frame (ADR-0012 §1): the public CSP's frame-src and the facade's last check before it
// creates an iframe. Its own module, so the facade script stays free of the document schema
export const EMBED_FRAME_ORIGINS = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'] as const

export function isEmbedFrameUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (EMBED_FRAME_ORIGINS as readonly string[]).includes(url.origin) && url.username === '' && url.password === ''
  }
  catch {
    return false
  }
}
