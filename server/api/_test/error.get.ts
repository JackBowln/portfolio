// Test-only (PORTFOLIO_TEST_BUILD=1): an unexpected failure whose message must never reach the client
export default defineEventHandler(() => {
  throw new Error('internal detail: d1 connection string and stack')
})
