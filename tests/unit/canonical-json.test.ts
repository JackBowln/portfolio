// F05-T1: canonical JSON and the hash of revisions (data-model §4.3): key order never changes the hash, values with
// no JSON form are refused instead of silently changed. Also the keyset cursor of the public lists
import { describe, expect, it } from 'vitest'
import { canonicalJson, contentHash, NonCanonicalValueError } from '../../shared/content/canonical-json'
import { decodePublishedCursor, encodePublishedCursor } from '../../shared/content/cursor'
import { snapshotOf } from '../../shared/content/snapshot'
import { uuidv7 } from '../../shared/utils/id'

describe('canonicalJson', () => {
  it('sorts object keys at every depth and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1, 2], c: null } })).toBe('{"a":{"c":null,"d":[3,1,2]},"b":1}')
  })

  it('sorts by code point, not by locale', () => {
    expect(canonicalJson({ b: 1, B: 2, á: 3, a: 4 })).toBe('{"B":2,"a":4,"b":1,"á":3}')
  })

  it('leaves out undefined members, like JSON.stringify', () => {
    expect(canonicalJson({ a: undefined, b: 'x' })).toBe('{"b":"x"}')
  })

  it('escapes strings like JSON.stringify and round-trips Unicode', () => {
    const value = { text: 'linha\n"aspas" 😀 \u2028 ação' }
    expect(JSON.parse(canonicalJson(value))).toEqual(value)
  })

  it.each([
    ['NaN', { a: Number.NaN }],
    ['Infinity', { a: Number.POSITIVE_INFINITY }],
    ['undefined in an array', [1, undefined]],
    ['a Date', { a: new Date(0) }],
    ['a Map', { a: new Map() }],
    ['a function', { a: () => 1 }],
    ['a bigint', { a: 1n }],
    ['undefined at the top', undefined],
  ])('refuses %s', (_name, value) => {
    expect(() => canonicalJson(value)).toThrow(NonCanonicalValueError)
  })

  it('accepts objects without a prototype', () => {
    const value = Object.assign(Object.create(null) as object, { b: 1, a: 2 })
    expect(canonicalJson(value)).toBe('{"a":2,"b":1}')
  })
})

describe('contentHash', () => {
  it('is the SHA-256 of the canonical text', async () => {
    // printf '{"a":1,"b":[true,null]}' | shasum -a 256
    expect(await contentHash({ b: [true, null], a: 1 })).toBe('1cc69c7fa23616ca2ec3ee70d24390a6225c8832db8a4c814c7e0e7f942f8668')
  })

  it('does not change with key order, and changes with any value', async () => {
    const one = { title: 'Olá', body: { type: 'doc', content: [{ type: 'paragraph', attrs: { id: 'x' } }] } }
    const reordered = { body: { content: [{ attrs: { id: 'x' }, type: 'paragraph' }], type: 'doc' }, title: 'Olá' }
    expect(await contentHash(reordered)).toBe(await contentHash(one))
    expect(await contentHash({ ...one, title: 'Ola' })).not.toBe(await contentHash(one))
    expect(await contentHash(one)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('snapshotOf', () => {
  it('picks the snapshot fields from a row and fills the column defaults', () => {
    const snapshot = snapshotOf('article', { coverMediaId: null, tagIds: [] }, {
      id: 'ignored',
      locale: 'pt-BR',
      title: 'T',
      slug: 't',
      body: { type: 'doc', content: [] },
    })
    expect(snapshot.localization).toEqual({ title: 'T', slug: 't', excerpt: '', body: { type: 'doc', content: [] }, seoTitle: null, seoDescription: null, ogImageMediaId: null, noindex: false })
  })
})

describe('published cursor', () => {
  it('round-trips and is URL safe', () => {
    const cursor = { publishedAt: 1_793_000_000_123, id: uuidv7() }
    const text = encodePublishedCursor(cursor)
    expect(text).toMatch(/^[\w-]+$/)
    expect(decodePublishedCursor(text)).toEqual(cursor)
  })

  it.each(['', 'not a cursor!', btoa('123:not-a-uuid'), btoa(`abc:${uuidv7()}`), 'a'.repeat(200)])('refuses %j', (text) => {
    expect(decodePublishedCursor(text)).toBeNull()
  })
})
