// Document migrations (ADR-0006, risk "schema evolution"): `doc.attrs.schemaVersion` says which schema a stored
// document was written for, and absent means 1. A migrator is a pure function from version n to n + 1 that runs
// when a document is read or saved; stored documents are never rewritten in bulk without being asked.
//
// To change the schema: bump CURRENT_SCHEMA_VERSION in document-schema.ts, add `n: from n to n + 1` below with a
// test in tests/unit/content-migrations.test.ts, and make the new schema accept only the new shape
import { CURRENT_SCHEMA_VERSION, documentSchema } from '../document-schema.ts'
import type { DocumentJson } from '../document-schema.ts'

type UnknownDocument = Record<string, unknown> & { attrs?: Record<string, unknown> }
export type Migrator = (doc: UnknownDocument) => UnknownDocument

/**
 * The example of the pattern: version 1 to itself. A real migrator returns a new object (never mutates its input)
 * and sets `attrs.schemaVersion` to n + 1
 */
export const identityMigrator: Migrator = doc => ({ ...doc, attrs: { ...doc.attrs, schemaVersion: 1 } })

/** Migrators by the version they read; empty while version 1 is the only one */
export const MIGRATORS: Readonly<Record<number, Migrator>> = {}

export class DocumentVersionError extends Error {}

export function documentVersion(doc: UnknownDocument): number {
  const version = doc.attrs?.schemaVersion ?? 1
  if (!Number.isInteger(version) || (version as number) < 1) {
    throw new DocumentVersionError(`schemaVersion ${String(version)} is not a version`)
  }
  return version as number
}

/** Runs the migrators from the document's version up to `target`, without validating the result */
export function upgradeDocument(input: unknown, migrators: Readonly<Record<number, Migrator>>, target: number): UnknownDocument {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new DocumentVersionError('a document is an object')
  }
  let doc = input as UnknownDocument
  let version = documentVersion(doc)
  if (version > target) {
    throw new DocumentVersionError(`schemaVersion ${version} is newer than this code (${target})`)
  }
  while (version < target) {
    const migrator = migrators[version]
    if (!migrator) {
      throw new DocumentVersionError(`no migrator from schemaVersion ${version}`)
    }
    doc = migrator(doc)
    const next = documentVersion(doc)
    if (next !== version + 1) {
      throw new DocumentVersionError(`the migrator from ${version} produced version ${next}`)
    }
    version = next
  }
  return doc
}

/** Brings a stored document to the current version and validates it */
export function migrateDocument(input: unknown): DocumentJson {
  return documentSchema.parse(upgradeDocument(input, MIGRATORS, CURRENT_SCHEMA_VERSION))
}
