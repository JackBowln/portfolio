// Test-only (PORTFOLIO_TEST_BUILD=1): a public HTML page that wrongly sets a cookie; cache-policy must strip it
import { cacheTags } from '#shared/cache/tags'

export default defineEventHandler((event) => {
  setCachePolicy(event, 'public')
  setCacheTags(event, [cacheTags.page('home', 'pt-BR')])
  setCookie(event, 'leak', '1')
  setResponseHeader(event, 'content-type', 'text/html;charset=utf-8')
  return '<!doctype html><title>test</title>'
})
