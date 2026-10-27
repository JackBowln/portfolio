// TEST_AUTH — test-only example route (PORTFOLIO_TEST_BUILD=1): a static permission checked by defineAdminHandler itself
export default defineAdminHandler({
  permission: { audit: ['read'] },
  handler: () => ({ ok: true }),
})
