// Owner bootstrap (ADR-0005 §3): open only while no owner exists and a BOOTSTRAP_TOKEN is configured. A correct token
// earns a short-lived signed grant; the GitHub sign-up then checks it (options.ts, validateUserInfo)
import type { Db } from '../../db/client.ts'
import { recordAudit } from '../audit/audit.service.ts'
import { ownerExists } from './auth.repo.ts'
import { resolveAuthSecret } from './options.ts'
import type { AuthEnv } from './options.ts'
import { bootstrapTokenUsable, createBootstrapGrant, tokensMatch } from './policies.ts'

export type BootstrapEnv = AuthEnv & { BOOTSTRAP_TOKEN?: string, IP_HASH_SALT?: string }

export async function isBootstrapOpen(db: Db, env: BootstrapEnv): Promise<boolean> {
  return bootstrapTokenUsable(env.BOOTSTRAP_TOKEN) && !(await ownerExists(db))
}

export type BootstrapStart
  = | { status: 'granted', grant: string }
    | { status: 'closed' }
    | { status: 'invalid_token' }

export async function startBootstrap(db: Db, env: BootstrapEnv, token: string, ip: string | null): Promise<BootstrapStart> {
  if (!(await isBootstrapOpen(db, env))) {
    return { status: 'closed' }
  }
  const secret = resolveAuthSecret(env)
  if (!(await tokensMatch(token, env.BOOTSTRAP_TOKEN ?? '', secret))) {
    await recordAudit(db, { action: 'auth.bootstrap_rejected', metadata: { reason: 'invalid_token' }, ip }, env.IP_HASH_SALT)
    return { status: 'invalid_token' }
  }
  return { status: 'granted', grant: await createBootstrapGrant(secret, Date.now()) }
}
