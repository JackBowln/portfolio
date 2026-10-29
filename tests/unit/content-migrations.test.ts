// F05-T2: the migration pattern of the document schema (ADR-0006, schemaVersion): the identity example, the chain
// of migrators and the errors that stop a document from being read with the wrong code
import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../../shared/content/document-schema'
import { DocumentVersionError, documentVersion, identityMigrator, migrateDocument, upgradeDocument } from '../../shared/content/migrations'
import type { Migrator } from '../../shared/content/migrations'
import { fullDocument } from '../support/documents'

describe('document migrations', () => {
  it('reads a document without a version as version 1', () => {
    const { attrs: _attrs, ...unversioned } = fullDocument()
    expect(documentVersion(unversioned)).toBe(1)
    expect(migrateDocument(unversioned)).toEqual(unversioned)
  })

  it('keeps a current document as it is', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
    expect(migrateDocument(fullDocument())).toEqual(fullDocument())
  })

  it('has an identity example that does not mutate its input', () => {
    const doc = fullDocument()
    const frozen = structuredClone(doc)
    const migrated = identityMigrator(doc)
    expect(migrated).toEqual(frozen)
    expect(migrated).not.toBe(doc)
    expect(doc).toEqual(frozen)
  })

  it('runs migrators in order up to the target', () => {
    const steps: number[] = []
    const migrators: Record<number, Migrator> = {
      1: (doc) => {
        steps.push(1)
        return { ...doc, attrs: { schemaVersion: 2 }, renamed: true }
      },
      2: (doc) => {
        steps.push(2)
        return { ...doc, attrs: { schemaVersion: 3 } }
      },
    }
    expect(upgradeDocument({ type: 'doc', content: [] }, migrators, 3)).toEqual({ type: 'doc', content: [], renamed: true, attrs: { schemaVersion: 3 } })
    expect(steps).toEqual([1, 2])
  })

  it.each<[string, unknown, Record<number, Migrator>, number, RegExp]>([
    ['a version newer than the code', { type: 'doc', attrs: { schemaVersion: 9 } }, {}, 1, /newer than this code/],
    ['a missing migrator', { type: 'doc', content: [] }, {}, 2, /no migrator from schemaVersion 1/],
    ['a migrator that skips a version', { type: 'doc' }, { 1: doc => ({ ...doc, attrs: { schemaVersion: 3 } }) }, 3, /produced version 3/],
    ['a version that is not an integer', { type: 'doc', attrs: { schemaVersion: '1' } }, {}, 1, /is not a version/],
    ['a version below 1', { type: 'doc', attrs: { schemaVersion: 0 } }, {}, 1, /is not a version/],
    ['an array', [], {}, 1, /a document is an object/],
    ['null', null, {}, 1, /a document is an object/],
  ])('refuses %s', (_name, input, migrators, target, pattern) => {
    expect(() => upgradeDocument(input, migrators, target)).toThrow(DocumentVersionError)
    expect(() => upgradeDocument(input, migrators, target)).toThrow(pattern)
  })

  it('validates the migrated document', () => {
    expect(() => migrateDocument({ type: 'doc', content: [{ type: 'script' }] })).toThrow(/Invalid discriminator value/)
  })
})
