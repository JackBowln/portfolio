// The /blog/x article and /blog/temas/x topic in every locale (test-only fixture route, F06-T5), for specs that
// open content routes without testing the blog itself
import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { SITE_ORIGIN } from './auth'

export async function ensureBlogFixture(request: APIRequestContext): Promise<void> {
  // Specs set up in parallel on an empty state: while another request is creating the fixture, this one can run into
  // a slug it has just taken, so it asks again once that one is done
  await expect.poll(async () => (await request.post('/api/_test/blog-fixture', { headers: { origin: SITE_ORIGIN } })).status(), { intervals: [500, 1000, 2000], timeout: 20_000 }).toBe(200)
}
