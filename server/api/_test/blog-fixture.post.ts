// Test-only (PORTFOLIO_TEST_BUILD=1): the /blog/x article and /blog/temas/x topic in every locale (server/_test/blog-fixture.ts)
import { ensureBlogFixture } from '../../_test/blog-fixture.ts'

export default defineEventHandler(event => ensureBlogFixture(useDb(event)))
