// RSS of a prefixed locale's blog: /en/rss.xml, /es/rss.xml, /de/rss.xml, /fr/rss.xml (F06-T5)
const PREFIXED = new Set(['en', 'es', 'de', 'fr'] as const)

export default defineEventHandler((event) => {
  const locale = getRouterParam(event, 'locale')
  if (!locale || !PREFIXED.has(locale as 'en')) {
    throw createAppError('not_found')
  }
  return sendRss(event, locale as 'en')
})
