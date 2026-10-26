// Test-only (PORTFOLIO_TEST_BUILD=1): exercises strict body validation end to end
import { z } from 'zod'

const bodySchema = z.object({ name: z.string().min(1).max(50) })

export default defineEventHandler(async (event) => {
  const body = await readValidatedBodyStrict(event, bodySchema)
  return { name: body.name }
})
