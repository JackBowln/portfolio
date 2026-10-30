// TEST_AUTH — test-only (PORTFOLIO_TEST_BUILD=1, never in a deploy build): empties the auth tables and the audit log
// so the bootstrap flow starts from "no owner" (tests/auth-flow runs alone, after the other projects). Articles the
// other projects created go first, since their author must exist (F06-T1); localizations and revisions point at
// each other, so the published pointers are cleared before either is deleted
const CLEAR_ARTICLES = [
  `UPDATE article_localizations SET published_revision_id = NULL, published_snapshot = NULL, published_slug = NULL, source_revision_id = NULL`,
  `DELETE FROM media_usages WHERE entity_type = 'article'`,
  'DELETE FROM article_tags',
  'DELETE FROM article_revisions',
  'DELETE FROM article_localizations',
  'DELETE FROM articles',
]

export default defineEventHandler(async (event) => {
  const db = useEnv(event).DB
  const tables = ['passkeys', 'sessions', 'accounts', 'verifications', 'users', 'audit_log']
  await db.batch([...CLEAR_ARTICLES, ...tables.map(table => `DELETE FROM ${table}`)].map(statement => db.prepare(statement)))
  return { ok: true }
})
