// F03-T3 meta-test (ADR-0005 §6, ADR-0013): every file in server/api/admin/** must export
// `defineAdminHandler({ permission: { resource: ['action', …] }, … })`. Read with the TypeScript parser, not run
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { STATEMENTS } from '../../shared/auth/permissions'

const ADMIN_API_DIR = 'server/api/admin'

/** Why the route is not a declared admin handler, or undefined when it is */
function routeProblem(source: string): string | undefined {
  const file = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true)
  const exported = file.statements.find(ts.isExportAssignment)
  if (!exported || exported.isExportEquals) {
    return 'no default export'
  }
  const call = exported.expression
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== 'defineAdminHandler') {
    return 'default export is not defineAdminHandler(…)'
  }
  const [options] = call.arguments
  if (!options || !ts.isObjectLiteralExpression(options)) {
    return 'defineAdminHandler needs an object literal'
  }
  const permission = options.properties.find(property =>
    ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'permission')
  if (!permission || !ts.isPropertyAssignment(permission) || !ts.isObjectLiteralExpression(permission.initializer)) {
    return 'no permission object literal'
  }
  const grants = permission.initializer.properties
  if (grants.length === 0) {
    return 'empty permission'
  }
  for (const grant of grants) {
    if (!ts.isPropertyAssignment(grant) || !ts.isIdentifier(grant.name) || !ts.isArrayLiteralExpression(grant.initializer)) {
      return 'permission entries must be `resource: [\'action\']`'
    }
    const actions = (STATEMENTS as Record<string, readonly string[] | undefined>)[grant.name.text]
    const listed = grant.initializer.elements
    if (!actions || listed.length === 0 || !listed.every(element => ts.isStringLiteral(element) && actions.includes(element.text))) {
      return `unknown or empty permission ${grant.name.text}`
    }
  }
  return undefined
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? routeFiles(join(dir, entry.name)) : /\.[cm]?[jt]s$/.test(entry.name) ? [join(dir, entry.name)] : [])
}

describe('admin routes meta-test', () => {
  const files = routeFiles(ADMIN_API_DIR)

  it('finds the admin routes (the check is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('every admin route uses defineAdminHandler with a declared permission', () => {
    const problems = files.map(file => [file, routeProblem(readFileSync(file, 'utf8'))]).filter(([, problem]) => problem)
    expect(problems).toEqual([])
  })

  it('rejects routes that skip or weaken the declaration', () => {
    const bad = {
      plain: 'export default defineEventHandler(() => 1)',
      none: 'export const handler = defineAdminHandler({ permission: { audit: [\'read\'] }, handler: () => 1 })',
      missing: 'export default defineAdminHandler({ handler: () => 1 })',
      empty: 'export default defineAdminHandler({ permission: {}, handler: () => 1 })',
      emptyActions: 'export default defineAdminHandler({ permission: { audit: [] }, handler: () => 1 })',
      unknown: 'export default defineAdminHandler({ permission: { audit: [\'write\'] }, handler: () => 1 })',
      dynamic: 'const p = { audit: [\'read\'] }\nexport default defineAdminHandler({ permission: p, handler: () => 1 })',
      wrapped: 'export default wrap(defineAdminHandler({ permission: { audit: [\'read\'] }, handler: () => 1 }))',
    }
    for (const [name, source] of Object.entries(bad)) {
      expect(routeProblem(source), name).toBeDefined()
    }
    expect(routeProblem('export default defineAdminHandler({ permission: { article: [\'read\', \'update\'] }, handler: () => 1 })')).toBeUndefined()
  })
})
