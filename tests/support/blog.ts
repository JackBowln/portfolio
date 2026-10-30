// The /blog/x article and /blog/temas/x topic in every locale (test-only fixture route, F06-T5), for specs that
// open content routes without testing the blog itself
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from './auth'

export async function ensureBlogFixture(request: APIRequestContext): Promise<void> {
  const response = await request.post('/api/_test/blog-fixture', { headers: { origin: SITE_ORIGIN } })
  expect(response.status(), await response.text()).toBe(200)
}
