// Audit actions (ADR-0005 §8), shared so the admin can filter by them; the server writes only these
export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.github_rejected',
  'auth.bootstrap_rejected',
  'auth.bootstrap_completed',
  'auth.passkey_added',
  'auth.passkey_removed',
  'auth.session_revoked',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]
