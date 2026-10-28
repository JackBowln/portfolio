// TEST_AUTH — test-only (PORTFOLIO_TEST_BUILD=1, never in a deploy build): empties the auth tables and the audit log
// so the bootstrap flow starts from "no owner" (tests/auth-flow runs alone, after the other projects)
export default defineEventHandler(async (event) => {
  const db = useEnv(event).DB
  await db.batch(['passkeys', 'sessions', 'accounts', 'verifications', 'users', 'audit_log'].map(table => db.prepare(`DELETE FROM ${table}`)))
  return { ok: true }
})
