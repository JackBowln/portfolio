// Admin-only (boundaries: app/**/admin/**): imported by the admin SPA from F03-T2, never by public pages
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({ basePath: '/api/auth' })
