// TEST_AUTH — test-only (PORTFOLIO_TEST_BUILD=1, never in a deploy build): what the auth flow tests assert on,
// without exposing rows: counts of users, owners and passkeys, and the audit actions in order (with the stored IP hash)
export default defineEventHandler(async (event) => {
  const db = useEnv(event).DB
  const [users, owners, passkeys, audit] = await db.batch([
    db.prepare('SELECT count(*) AS n FROM users'),
    db.prepare('SELECT count(*) AS n FROM users WHERE role = \'owner\''),
    db.prepare('SELECT count(*) AS n FROM passkeys'),
    db.prepare('SELECT action, metadata, ip_hash AS ipHash FROM audit_log ORDER BY created_at, id'),
  ])
  const count = (result: D1Result | undefined) => (result?.results[0] as { n: number } | undefined)?.n ?? 0
  return {
    users: count(users),
    owners: count(owners),
    passkeys: count(passkeys),
    audit: (audit?.results ?? []) as { action: string, metadata: string | null, ipHash: string | null }[],
  }
})
