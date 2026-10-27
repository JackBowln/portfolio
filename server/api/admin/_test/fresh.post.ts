// TEST_AUTH — test-only example route (PORTFOLIO_TEST_BUILD=1): a sensitive action that needs a fresh session
export default defineAdminHandler({
  permission: { user: ['update-role'] },
  fresh: true,
  handler: () => ({ ok: true }),
})
