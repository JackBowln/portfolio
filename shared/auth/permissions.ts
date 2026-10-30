// RBAC from docs/architecture/security-model.md §4 (ADR-0005 §5). Pure data: the server builds Better Auth's access
// control from it and checks every admin route with it; the admin UI uses it only to hide actions, never as security.
// tests/unit/permissions.test.ts compares it cell by cell with the table in the security model.
import type { PublicationStatus, Role } from '../types/enums.ts'

const CONTENT_ACTIONS = ['read', 'update', 'delete', 'publish', 'schedule', 'restore'] as const

// Pages have fixed keys (PAGE_KEYS), so only articles and projects can be created
export const STATEMENTS = {
  article: ['create', ...CONTENT_ACTIONS],
  project: ['create', ...CONTENT_ACTIONS],
  page: CONTENT_ACTIONS,
  // Topics (F06-T1); reading them follows article:read
  tag: ['create', 'update', 'delete'],
  media: ['create', 'read', 'update', 'delete'],
  translation: ['run', 'review', 'approve'],
  settings: ['read', 'update'],
  user: ['invite', 'update-role', 'revoke-session'],
  audit: ['read'],
  // The user's own sessions (RF-03.5); other users' sessions are user:revoke-session
  session: ['read', 'revoke'],
} as const

export type Resource = keyof typeof STATEMENTS
export type Action<R extends Resource = Resource> = (typeof STATEMENTS)[R][number]
export type Permission = { [R in Resource]?: readonly Action<R>[] }

/** `any`: every item · `own`: only items the user authored · `own-draft`: only the user's own drafts */
export type Scope = 'any' | 'own' | 'own-draft'
type Grants = { [R in Resource]?: Partial<Record<Action<R>, Scope>> }

const RESOURCES = Object.keys(STATEMENTS) as Resource[]

function grant<R extends Resource>(resource: R, scope: Scope, actions: readonly Action<R>[] = STATEMENTS[resource]) {
  return Object.fromEntries(actions.map(action => [action, scope])) as Partial<Record<Action<R>, Scope>>
}

const contentRead = { article: grant('article', 'any', ['read']), project: grant('project', 'any', ['read']), page: grant('page', 'any', ['read']) }
// Every role manages only its own sessions, owner included
const ownSessions = { session: grant('session', 'own') }
const everything = {
  ...Object.fromEntries(RESOURCES.map(resource => [resource, grant(resource, 'any')])),
  ...ownSessions,
} as Grants

function authorContent<R extends 'article' | 'project' | 'page'>(resource: R) {
  return {
    ...grant(resource, 'any', resource === 'page' ? ['read'] : ['create', 'read'] as Action<R>[]),
    ...grant(resource, 'own', ['update', 'restore'] as Action<R>[]),
    ...grant(resource, 'own-draft', ['delete'] as Action<R>[]),
  }
}

export const ROLE_GRANTS: Record<Role, Grants> = {
  owner: everything,
  // Same permissions as owner; canManageUser() keeps an admin away from owners
  admin: everything,
  editor: {
    article: grant('article', 'any'),
    project: grant('project', 'any'),
    page: grant('page', 'any'),
    tag: grant('tag', 'any'),
    media: grant('media', 'any'),
    translation: grant('translation', 'any'),
    settings: grant('settings', 'any', ['read']),
    ...ownSessions,
  },
  author: {
    article: authorContent('article'),
    project: authorContent('project'),
    page: authorContent('page'),
    // Tagging their own article may need a new topic; renaming or deleting one changes every article
    tag: grant('tag', 'any', ['create']),
    media: { ...grant('media', 'any', ['create', 'read', 'update']), ...grant('media', 'own', ['delete']) },
    ...ownSessions,
  },
  translator: { ...contentRead, media: grant('media', 'any', ['read']), translation: grant('translation', 'any'), ...ownSessions },
  viewer: { ...contentRead, media: grant('media', 'any', ['read']), settings: grant('settings', 'any', ['read']), ...ownSessions },
}

function entries(permission: Permission): [Resource, readonly string[]][] {
  return Object.entries(permission) as [Resource, readonly string[]][]
}

/** The scope a role has for one action, or undefined when it is denied (unknown roles get nothing) */
export function scopeOf<R extends Resource>(role: string, resource: R, action: Action<R>): Scope | undefined {
  // Own keys only, so "__proto__", "constructor" and friends never resolve to something truthy
  const roleGrants = Object.hasOwn(ROLE_GRANTS, role) ? (ROLE_GRANTS as Record<string, Grants>)[role] : undefined
  const grants = roleGrants && Object.hasOwn(roleGrants, resource) ? roleGrants[resource] as Record<string, Scope> : undefined
  return grants && Object.hasOwn(grants, action) ? grants[action] : undefined
}

/** True when the role may perform every listed action, at least on its own items. An empty permission is never allowed */
export function can(role: string, permission: Permission): boolean {
  const requested = entries(permission)
  return requested.length > 0 && requested.every(([resource, actions]) =>
    actions.length > 0 && actions.every(action => scopeOf(role, resource, action as Action) !== undefined))
}

export interface OwnedResource {
  authorId: string | null
  status?: PublicationStatus
}

/** True when the user may perform every listed action on this specific item */
export function canOnResource(user: { id: string, role: string }, permission: Permission, resource: OwnedResource): boolean {
  if (!can(user.role, permission)) {
    return false
  }
  const isOwn = resource.authorId !== null && resource.authorId === user.id
  return entries(permission).every(([name, actions]) => actions.every((action) => {
    const scope = scopeOf(user.role, name, action as Action)
    return scope === 'any' || (scope === 'own' && isOwn) || (scope === 'own-draft' && isOwn && resource.status === 'draft')
  }))
}

/** "admin: ✅ (exceto owner)": an admin cannot act on an owner nor grant the owner role; only owners and admins manage users */
export function canManageUser(actor: { role: string }, target: { role: string }, newRole?: Role): boolean {
  if (actor.role === 'owner') {
    return true
  }
  if (actor.role === 'admin') {
    return target.role !== 'owner' && newRole !== 'owner'
  }
  return false
}
