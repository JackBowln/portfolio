// F03-T3: shared/auth/permissions.ts must match the authorization matrix in docs/architecture/security-model.md §4,
// which is read here, so every cell is checked without writing a case per cell
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { betterAuthRoles } from '../../server/services/auth/access'
import { can, canManageUser, canOnResource, ROLE_GRANTS, scopeOf, STATEMENTS } from '../../shared/auth/permissions'
import type { Action, Resource, Scope } from '../../shared/auth/permissions'
import { ROLES } from '../../shared/types/enums'

const CELLS: Record<string, Scope | undefined> = {
  '✅': 'any',
  // The owner exception is about the target user, not the permission (canManageUser below)
  '✅ (exceto owner)': 'any',
  '🟡': 'own',
  '🟡 (rascunho)': 'own-draft',
  '—': undefined,
}

/** Matrix as "resource:action" → role → scope, parsed from the markdown table */
function readMatrix(): Map<string, Record<string, Scope | undefined>> {
  const markdown = readFileSync('docs/architecture/security-model.md', 'utf8')
  const section = markdown.split('## 4. Matriz de autorização')[1]?.split('\n## ')[0] ?? ''
  const rows = section.split('\n').filter(line => line.startsWith('|')).map(line => line.split('|').slice(1, -1).map(cell => cell.trim()))
  const [header, , ...body] = rows
  const roles = header?.slice(1) ?? []
  expect(roles).toEqual([...ROLES])

  const matrix = new Map<string, Record<string, Scope | undefined>>()
  for (const [label = '', ...cells] of body) {
    // `article/project/page:publish`, `:schedule` → 3 resources × 2 actions; `media:create/update` → 1 × 2
    const tokens = [...label.matchAll(/`([^`]+)`/g)].map(match => match[1] ?? '')
    const [first = '', ...more] = tokens
    const [resources = '', firstActions = ''] = first.split(':')
    const actions = [...firstActions.split('/'), ...more.map(token => token.replace(/^:/, ''))]
    const scopes = Object.fromEntries(cells.map((cell, index) => {
      expect(Object.keys(CELLS), `cell "${cell}" in ${label}`).toContain(cell)
      return [roles[index], CELLS[cell]]
    }))
    for (const resource of resources.split('/')) {
      for (const action of actions) {
        matrix.set(`${resource}:${action}`, scopes)
      }
    }
  }
  return matrix
}

const matrix = readMatrix()
const permissions = (Object.keys(STATEMENTS) as Resource[]).flatMap(resource =>
  STATEMENTS[resource].map(action => ({ resource, action: action as Action })))

describe('permission matrix', () => {
  it('lists exactly the statements in permissions.ts (pages have no create)', () => {
    const fromCode = permissions.map(({ resource, action }) => `${resource}:${action}`).sort()
    const fromDoc = [...matrix.keys()].filter(key => key !== 'page:create').sort()
    expect(fromCode).toEqual(fromDoc)
    expect(STATEMENTS.page).not.toContain('create')
  })

  it('gives every role the scope the security model sets for every permission', () => {
    const fromCode: Record<string, Record<string, Scope | undefined>> = {}
    const fromDoc: Record<string, Record<string, Scope | undefined>> = {}
    for (const { resource, action } of permissions) {
      const key = `${resource}:${action}`
      fromCode[key] = Object.fromEntries(ROLES.map(role => [role, scopeOf(role, resource, action)]))
      fromDoc[key] = matrix.get(key) ?? {}
    }
    expect(fromCode).toEqual(fromDoc)
  })

  it('registers the same grants in Better Auth\'s access control', () => {
    for (const role of ROLES) {
      for (const { resource, action } of permissions) {
        const expected = can(role, { [resource]: [action] })
        expect(betterAuthRoles[role].authorize({ [resource]: [action] }).success, `${role} ${resource}:${action}`).toBe(expected)
      }
    }
    expect(Object.keys(ROLE_GRANTS).sort()).toEqual([...ROLES].sort())
  })
})

describe('can', () => {
  it('needs every requested action', () => {
    expect(can('editor', { article: ['read', 'publish'] })).toBe(true)
    expect(can('author', { article: ['read', 'publish'] })).toBe(false)
  })

  it('denies empty permissions and unknown roles', () => {
    expect(can('owner', {})).toBe(false)
    expect(can('owner', { article: [] })).toBe(false)
    expect(can('', { article: ['read'] })).toBe(false)
    expect(can('superuser', { article: ['read'] })).toBe(false)
    expect(can('__proto__', { article: ['read'] })).toBe(false)
  })

  it('never resolves inherited properties as grants', () => {
    for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(can('owner', { article: [name as Action<'article'>] }), name).toBe(false)
      expect(can('owner', { [name]: ['read'] } as never), name).toBe(false)
    }
  })
})

describe('canOnResource', () => {
  const author = { id: 'author-1', role: 'author' }
  const own = { authorId: 'author-1', status: 'published' as const }
  const others = { authorId: 'author-2', status: 'draft' as const }

  it('limits own-only grants to the user\'s items', () => {
    expect(canOnResource(author, { article: ['update'] }, own)).toBe(true)
    expect(canOnResource(author, { article: ['update'] }, others)).toBe(false)
    expect(canOnResource(author, { article: ['update'] }, { authorId: null, status: 'draft' })).toBe(false)
  })

  it('lets an author delete only their own drafts', () => {
    expect(canOnResource(author, { article: ['delete'] }, { ...own, status: 'draft' })).toBe(true)
    expect(canOnResource(author, { article: ['delete'] }, own)).toBe(false)
    expect(canOnResource(author, { media: ['delete'] }, { authorId: 'author-1' })).toBe(true)
    expect(canOnResource(author, { media: ['delete'] }, { authorId: 'author-2' })).toBe(false)
  })

  it('ignores ownership for roles with full grants and denies roles without the permission', () => {
    expect(canOnResource({ id: 'editor-1', role: 'editor' }, { article: ['delete'] }, own)).toBe(true)
    expect(canOnResource({ id: 'author-2', role: 'translator' }, { article: ['update'] }, others)).toBe(false)
  })
})

describe('canManageUser', () => {
  it('lets an owner manage anyone', () => {
    expect(canManageUser({ role: 'owner' }, { role: 'owner' }, 'owner')).toBe(true)
  })

  it('keeps an admin away from owners and from granting owner', () => {
    expect(canManageUser({ role: 'admin' }, { role: 'editor' }, 'author')).toBe(true)
    expect(canManageUser({ role: 'admin' }, { role: 'owner' })).toBe(false)
    expect(canManageUser({ role: 'admin' }, { role: 'editor' }, 'owner')).toBe(false)
  })

  it('denies every other role', () => {
    for (const role of ROLES.filter(role => role !== 'owner' && role !== 'admin')) {
      expect(canManageUser({ role }, { role: 'viewer' })).toBe(false)
    }
  })
})
