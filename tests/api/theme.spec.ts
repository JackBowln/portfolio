// F01-T2: the theme lives in the browser only; the cached HTML is the same for everyone and sets no cookie
import { expect, test } from '@playwright/test'
import { THEME_INIT_SCRIPT } from '../../shared/design/theme'

test('the home ships the inline theme script and the token CSS, without Set-Cookie or a theme', async ({ request }) => {
  const response = await request.get('/', { headers: { cookie: 'theme=dark' } })
  expect(response.status()).toBe(200)
  expect(response.headers()['set-cookie']).toBeUndefined()

  const html = await response.text()
  // Exactly the static script: F03-T4 allows it in the CSP by hash
  expect(html).toContain(`<script>${THEME_INIT_SCRIPT}</script>`)
  expect(html.indexOf(THEME_INIT_SCRIPT)).toBeLessThan(html.indexOf('</head>'))
  // The server never picks a theme, even when a cookie names one
  expect(html).not.toMatch(/<html[^>]*data-theme/)
  expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+entry\.[\w-]+\.css/)
})
