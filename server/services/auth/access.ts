// Better Auth's admin plugin with the roles from shared/auth/permissions.ts (ADR-0005 §5). Its HTTP endpoints
// (/api/auth/admin/*) are disabled: users and sessions are managed through /api/admin/** routes, which go through
// defineAdminHandler and the meta-test like every other admin route (F03-T3 decision)
import { admin } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { ROLE_GRANTS, STATEMENTS } from '../../../shared/auth/permissions.ts'
import type { Resource } from '../../../shared/auth/permissions.ts'
import { ROLES } from '../../../shared/types/enums.ts'
import type { Role } from '../../../shared/types/enums.ts'

export const accessControl = createAccessControl(STATEMENTS)

function toBetterAuthRole(role: Role) {
  const statements = Object.fromEntries(Object.entries(ROLE_GRANTS[role]).map(([resource, actions]) => [resource, Object.keys(actions)]))
  return accessControl.newRole(statements as { [R in Resource]?: (typeof STATEMENTS)[R][number][] })
}

export const betterAuthRoles = Object.fromEntries(ROLES.map(role => [role, toBetterAuthRole(role)])) as Record<Role, ReturnType<typeof toBetterAuthRole>>

export function adminPlugin() {
  return admin({ ac: accessControl, roles: betterAuthRoles, defaultRole: 'viewer', adminRoles: ['owner', 'admin'] })
}

/** Every route the admin plugin would mount, relative to the auth base path, for `disabledPaths` */
export const ADMIN_PLUGIN_PATHS: readonly string[] = Object.values(adminPlugin().endpoints).map(endpoint => endpoint.path)
