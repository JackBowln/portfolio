// RSS of the pt-BR blog (F06-T5); the other locales are /{locale}/rss.xml
export default defineEventHandler(event => sendRss(event, 'pt-BR'))
