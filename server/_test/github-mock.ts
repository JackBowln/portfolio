// TEST_AUTH — test-only (registered in nuxt.config only with PORTFOLIO_TEST_BUILD=1, never in a deploy build).
// Stands in for GitHub's OAuth token and user APIs inside the Worker, so the real Better Auth GitHub provider runs end
// to end without network. Tests call /api/auth/callback/github with `code=gh-<numeric id>`: that id becomes the
// GitHub user returned to Better Auth, so allowed and denied ids can both be exercised.
const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const API = 'https://api.github.com'
const TOKEN_PREFIX = 'mock-token-'

function githubIdFromAuthorization(headers: Headers): string | undefined {
  const token = headers.get('authorization')?.replace(/^(Bearer|token)\s+/i, '') ?? ''
  return token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : undefined
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

export default defineNitroPlugin(() => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const url = request.url.split('?')[0]

    if (url === TOKEN_URL) {
      const body = new URLSearchParams(await request.text())
      const code = body.get('code') ?? ''
      if (!/^gh-\d+$/.test(code)) {
        return json({ error: 'bad_verification_code' })
      }
      return json({ access_token: `${TOKEN_PREFIX}${code.slice(3)}`, token_type: 'bearer', scope: 'read:user,user:email' })
    }

    if (url === `${API}/user` || url === `${API}/user/emails`) {
      const id = githubIdFromAuthorization(request.headers)
      if (!id) {
        return json({ message: 'Bad credentials' }, 401)
      }
      const email = `github-${id}@example.test`
      return url.endsWith('/emails')
        ? json([{ email, primary: true, verified: true, visibility: 'private' }])
        : json({ id: Number(id), login: `user${id}`, name: `GitHub ${id}`, email, avatar_url: null })
    }

    return realFetch(input, init)
  }
})
