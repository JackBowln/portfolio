// Server-side authorization for /api/admin/** (ADR-0005 §6). The session middleware authenticates; every handler
// declares its permission through defineAdminHandler, and tests/unit/admin-routes-meta.test.ts fails otherwise
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import { can, canOnResource } from '#shared/auth/permissions'
import type { OwnedResource, Permission } from '#shared/auth/permissions'
import { SESSION_POLICY } from '../services/auth/options.ts'

export interface AdminAuth {
  user: { id: string, role: string, name: string, email: string }
  session: { id: string, createdAt: Date }
}

export function requireAdminAuth(event: H3Event): AdminAuth {
  const auth = event.context.auth
  if (!auth) {
    throw createAppError('unauthorized')
  }
  return auth
}

export function requirePermission(event: H3Event, permission: Permission): AdminAuth {
  const auth = requireAdminAuth(event)
  if (!can(auth.user.role, permission)) {
    throw createAppError('forbidden')
  }
  return auth
}

/** For own-only grants (🟡 in the matrix): an author may only touch items they wrote, and delete only drafts */
export function assertOwnership(event: H3Event, permission: Permission, resource: OwnedResource): void {
  const auth = requireAdminAuth(event)
  if (!canOnResource(auth.user, permission, resource)) {
    throw createAppError('forbidden')
  }
}

export function requireFreshSession(event: H3Event): void {
  const { session } = requireAdminAuth(event)
  if (Date.now() - session.createdAt.getTime() > SESSION_POLICY.freshAge * 1000) {
    throw createAppError('session_not_fresh')
  }
}

interface AdminHandlerOptions<T> {
  permission: Permission
  /** Sensitive actions (roles, deleting published content, AI budget, removing a passkey) */
  fresh?: boolean
  handler: (event: H3Event, auth: AdminAuth) => T | Promise<T>
}

export type AdminEventHandler<T> = EventHandler<EventHandlerRequest, Promise<T>> & {
  readonly permission: Permission
  readonly fresh: boolean
}

export function defineAdminHandler<T>(options: AdminHandlerOptions<T>): AdminEventHandler<T> {
  const actions = Object.values(options.permission)
  if (actions.length === 0 || actions.some(list => list.length === 0)) {
    throw new Error('defineAdminHandler needs a non-empty permission')
  }
  const handler = defineEventHandler(async (event) => {
    // Checked again here, so a route stays closed even if a request slips past the session middleware
    const auth = requirePermission(event, options.permission)
    if (options.fresh) {
      requireFreshSession(event)
    }
    return options.handler(event, auth)
  })
  return Object.assign(handler, { permission: options.permission, fresh: options.fresh ?? false })
}
