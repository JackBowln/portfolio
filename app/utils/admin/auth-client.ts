// Admin-only (boundaries: app/**/admin/**): imported by the admin pages, never by public pages
import { passkeyClient } from '@better-auth/passkey/client'
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({ basePath: '/api/auth', plugins: [passkeyClient()] })

/** Better Auth error codes the admin screens explain to the user */
export const AUTH_ERRORS = {
  sessionNotFresh: 'SESSION_NOT_FRESH',
  lastPasskey: 'LAST_PASSKEY',
} as const
