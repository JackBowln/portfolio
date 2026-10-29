// Revision snapshots (data-model §4.3): the localized fields plus the entity fields of that moment (cover, tags),
// the same shape for `published_snapshot` and for the working copy behind `working_hash`. Revisions store them as
// gzip of the canonical JSON
import { z } from 'zod'
import { TRANSLATION_STATES } from '../types/enums.ts'
import { canonicalJson } from './canonical-json.ts'
import { documentSchema } from './document-schema.ts'
import type { DocumentJson } from './document-schema.ts'

export const CONTENT_TYPES = ['article', 'project', 'page'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]
/** Content with a slug of its own; pages take their path from the i18n routes */
export type SluggedContentType = Exclude<ContentType, 'page'>

// The body is the shared document schema (F05-T2). Page blocks stay any JSON until the schemas per PageKey (F08)
export const documentJson = documentSchema
export type { DocumentJson }
export const pageBlocksJson = z.record(z.string(), z.json())

export const tocEntries = z.array(z.object({ id: z.string(), level: z.union([z.literal(2), z.literal(3)]), text: z.string() }).strict())
export const projectHighlights = z.array(z.object({ label: z.string(), value: z.string(), note: z.string().optional() }).strict())
export const segmentsMeta = z.record(z.string(), z.object({ sourceHash: z.string(), state: z.enum(TRANSLATION_STATES) }).strict())
export const idList = z.array(z.string())

// Defaults match the column defaults, so a row inserted without them hashes the same as its snapshot
const seo = {
  seoTitle: z.string().nullable().default(null),
  seoDescription: z.string().nullable().default(null),
  ogImageMediaId: z.string().nullable().default(null),
  noindex: z.boolean().default(false),
}

export const snapshotSchemas = {
  article: z.object({
    entity: z.object({ coverMediaId: z.string().nullable(), tagIds: idList }).strict(),
    localization: z.object({ title: z.string(), slug: z.string(), excerpt: z.string().default(''), body: documentJson, ...seo }).strict(),
  }).strict(),
  project: z.object({
    entity: z.object({
      coverMediaId: z.string().nullable(),
      galleryMediaIds: idList,
      technologyIds: idList,
      periodStart: z.string().nullable(),
      periodEnd: z.string().nullable(),
      repoUrl: z.string().nullable(),
      demoUrl: z.string().nullable(),
    }).strict(),
    localization: z.object({
      title: z.string(),
      slug: z.string(),
      summary: z.string().default(''),
      role: z.string().default(''),
      body: documentJson,
      highlights: projectHighlights.default([]),
      ...seo,
    }).strict(),
  }).strict(),
  page: z.object({
    entity: z.object({}).strict(),
    localization: z.object({ blocks: pageBlocksJson.default({}), ...seo }).strict(),
  }).strict(),
} as const

export type Snapshot<T extends ContentType> = z.output<(typeof snapshotSchemas)[T]>
export type SnapshotInput<T extends ContentType> = z.input<(typeof snapshotSchemas)[T]>
export type SnapshotEntity<T extends ContentType> = Snapshot<T>['entity']

/**
 * The snapshot of a working copy: the snapshot's localized fields picked from a localization row (or its insert
 * values, defaults filled in), validated against the type's schema
 */
export function snapshotOf<T extends ContentType>(type: T, entity: SnapshotEntity<T>, localization: object): Snapshot<T> {
  const schema = snapshotSchemas[type]
  const row = localization as Record<string, unknown>
  const picked = Object.fromEntries(Object.keys(schema.shape.localization.shape).map(field => [field, row[field]]))
  return schema.parse({ entity, localization: picked }) as Snapshot<T>
}

async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** gzip of the canonical JSON, with the native CompressionStream (workerd and browsers) */
export async function gzipSnapshot(value: unknown): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(canonicalJson(value)), new CompressionStream('gzip'))
}

export async function gunzipSnapshot<T extends ContentType>(type: T, bytes: Uint8Array): Promise<Snapshot<T>> {
  const text = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')))
  return snapshotSchemas[type].parse(JSON.parse(text)) as Snapshot<T>
}
