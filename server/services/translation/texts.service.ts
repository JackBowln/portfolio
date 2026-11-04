// Short texts translated in batch (F09-T5): topic and technology names, media texts (alt, caption, credit) and the
// localized settings (role and bio, the title template and description, the footer). Each is an item with fields;
// only what the site shows counts (decision 1): topics used by published content, ready informative images in use
// with a pt-BR alt, settings with a pt-BR text. A job writes them `machine`; a reviewer edits (to `in_review`) and
// approves them in batch (decision 4), each with the source hashes it was approved against. Settings texts go to
// every page, so editing and approving them also needs settings:update (decision 2). Nothing reaches the site
// before it is approved (the public reads, F09-T1)
import { and, eq, exists, inArray, ne, sql } from 'drizzle-orm'
import { contentHash } from '../../../shared/content/canonical-json.ts'
import type { ProtectedTerm } from '../../../shared/content/inline-tags.ts'
import { untagPlainText } from '../../../shared/content/inline-tags.ts'
import { approvedMeta, fieldSegments, hashSegments } from '../../../shared/content/segment-hash.ts'
import type { SegmentsMeta } from '../../../shared/content/segment-hash.ts'
import { extractField } from '../../../shared/content/segmenter.ts'
import { cacheTags } from '../../../shared/cache/tags.ts'
import { settingSchemas } from '../../../shared/settings/schemas.ts'
import { canTransition } from '../../../shared/translation/states.ts'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { Locale, SiteSettingKey, TranslationState } from '../../../shared/types/enums.ts'
import { slugify } from '../../../shared/utils/slugify.ts'
import type { Db } from '../../db/client.ts'
import { articleLocalizations, articleTags, projectLocalizations, projectTechnologies } from '../../db/schema/content.ts'
import { media, mediaLocalizations, mediaUsages } from '../../db/schema/media.ts'
import { siteSettingLocalizations } from '../../db/schema/settings.ts'
import { tagLocalizations, tags } from '../../db/schema/taxonomy.ts'
import { createAppError } from '../../utils/errors.ts'
import type { JobSubject } from './run.service.ts'

export type TextKind = 'tag' | 'media' | 'setting'
export type FieldStatus = 'ok' | 'outdated' | 'missing'

export interface TextField {
  name: string
  source: string
  translation: string | null
  status: FieldStatus
}

export interface TextItem {
  /** `tag:<id>`, `media:<id>` or `setting:<key>` */
  key: string
  kind: TextKind
  /** What the reviewer recognizes it by: the pt-BR name, the file name, the settings key */
  label: string
  state: TranslationState
  slug: string | null
  fields: TextField[]
}

const LOCALIZED_SETTINGS = ['identity', 'seo_defaults', 'footer'] as const satisfies readonly SiteSettingKey[]
// A title template keeps its %s: protected like a glossary term, so a translation without it fails
const TEMPLATE_TERM: ProtectedTerm = { term: '%s', caseSensitive: true }

interface Row {
  key: string
  kind: TextKind
  label: string
  /** pt-BR texts by field */
  source: Record<string, string>
  /** A setting's whole pt-BR value, the base of its translation (empty fields included: the schema requires them) */
  base?: Record<string, unknown>
  target: { state: TranslationState, meta: SegmentsMeta, values: Record<string, string | null>, slug: string | null } | null
}

async function loadRows(db: Db, locale: Locale): Promise<Row[]> {
  const rows: Row[] = []

  // Topics and technologies used by published content
  const used = sql`(${exists(db.select({ one: sql`1` }).from(articleTags).innerJoin(articleLocalizations, eq(articleLocalizations.articleId, articleTags.articleId)).where(and(eq(articleTags.tagId, tags.id), sql`${articleLocalizations.publishedRevisionId} IS NOT NULL`)))}
    OR ${exists(db.select({ one: sql`1` }).from(projectTechnologies).innerJoin(projectLocalizations, eq(projectLocalizations.projectId, projectTechnologies.projectId)).where(and(eq(projectTechnologies.tagId, tags.id), sql`${projectLocalizations.publishedRevisionId} IS NOT NULL`)))})`
  const tagRows = await db.select({ id: tags.id, locale: tagLocalizations.locale, name: tagLocalizations.name, slug: tagLocalizations.slug, state: tagLocalizations.translationState, meta: tagLocalizations.segmentsMeta })
    .from(tags).innerJoin(tagLocalizations, eq(tagLocalizations.tagId, tags.id))
    .where(and(inArray(tagLocalizations.locale, [SOURCE_LOCALE, locale]), used))
  for (const source of tagRows.filter(row => row.locale === SOURCE_LOCALE)) {
    const target = tagRows.find(row => row.id === source.id && row.locale === locale)
    rows.push({
      key: `tag:${source.id}`,
      kind: 'tag',
      label: source.name,
      source: { name: source.name },
      target: target ? { state: target.state, meta: target.meta, values: { name: target.name }, slug: target.slug } : null,
    })
  }

  // Ready informative images in use, with a pt-BR alt
  const mediaRows = await db.select({ id: media.id, file: media.originalFilename, locale: mediaLocalizations.locale, alt: mediaLocalizations.alt, caption: mediaLocalizations.caption, credit: mediaLocalizations.credit, state: mediaLocalizations.translationState, meta: mediaLocalizations.segmentsMeta })
    .from(media).innerJoin(mediaLocalizations, eq(mediaLocalizations.mediaId, media.id))
    .where(and(eq(media.kind, 'image'), eq(media.status, 'ready'), eq(media.decorative, false), inArray(mediaLocalizations.locale, [SOURCE_LOCALE, locale]), exists(db.select({ one: sql`1` }).from(mediaUsages).where(eq(mediaUsages.mediaId, media.id)))))
  for (const source of mediaRows.filter(row => row.locale === SOURCE_LOCALE && row.alt.trim() !== '')) {
    const target = mediaRows.find(row => row.id === source.id && row.locale === locale)
    rows.push({
      key: `media:${source.id}`,
      kind: 'media',
      label: source.file,
      source: Object.fromEntries(Object.entries({ alt: source.alt, caption: source.caption, credit: source.credit }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')),
      target: target ? { state: target.state, meta: target.meta, values: { alt: target.alt || null, caption: target.caption, credit: target.credit }, slug: null } : null,
    })
  }

  // Localized settings with a pt-BR text
  const settingRows = await db.select().from(siteSettingLocalizations)
    .where(and(inArray(siteSettingLocalizations.key, [...LOCALIZED_SETTINGS]), inArray(siteSettingLocalizations.locale, [SOURCE_LOCALE, locale])))
  for (const source of settingRows.filter(row => row.locale === SOURCE_LOCALE)) {
    const value = source.value as Record<string, unknown>
    const texts = Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== ''))
    if (Object.keys(texts).length === 0) {
      continue
    }
    const target = settingRows.find(row => row.key === source.key && row.locale === locale)
    rows.push({
      key: `setting:${source.key}`,
      kind: 'setting',
      label: source.key,
      source: texts,
      base: value,
      target: target ? { state: target.translationState, meta: target.segmentsMeta, values: target.value as Record<string, string | null>, slug: null } : null,
    })
  }
  return rows
}

const fieldStatus = (row: Row, field: string): FieldStatus => {
  const value = row.target?.values[field]
  if (!row.target || value === null || value === undefined || value === '' || row.target.meta[field]?.state === 'missing') {
    return 'missing'
  }
  return row.target.meta[field]?.state === 'outdated' ? 'outdated' : 'ok'
}

const toItem = (row: Row): TextItem => ({
  key: row.key,
  kind: row.kind,
  label: row.label,
  state: row.target?.state ?? 'missing',
  slug: row.target?.slug ?? null,
  fields: Object.entries(row.source).map(([name, source]) => ({ name, source, translation: row.target?.values[name] ?? null, status: fieldStatus(row, name) })),
})

export async function listTextItems(db: Db, locale: Locale): Promise<TextItem[]> {
  return (await loadRows(db, locale)).map(toItem)
}

const termsFor = (row: Row, field: string, terms: readonly ProtectedTerm[]) => (row.key === 'setting:seo_defaults' && field === 'titleTemplate' ? [...terms, TEMPLATE_TERM] : terms)

/** A free slug for a translated topic name in the locale (unique per locale and slug, transliterated) */
async function freeTagSlug(db: Db, tagId: string, locale: Locale, name: string, wanted?: string): Promise<string> {
  const base = slugify(wanted ?? name) || 'tema'
  const taken = new Set((await db.select({ slug: tagLocalizations.slug }).from(tagLocalizations)
    .where(and(eq(tagLocalizations.locale, locale), ne(tagLocalizations.tagId, tagId), sql`${tagLocalizations.slug} LIKE ${`${base}%`}`))).map(row => row.slug))
  if (wanted !== undefined && taken.has(base)) {
    throw createAppError('conflict', 'Slug already used', [{ path: `items.tag:${tagId}.slug`, message: 'slug_taken' }])
  }
  let slug = base
  for (let n = 2; taken.has(slug); n++) {
    slug = `${base}-${n}`
  }
  return slug
}

/** Writes one item's texts in the locale, with its state and meta (the fields not given keep what they had) */
async function writeItem(db: Db, row: Row, locale: Locale, values: Record<string, string>, state: TranslationState, meta: SegmentsMeta, slug?: string): Promise<void> {
  const [kind, id] = [row.kind, row.key.slice(row.key.indexOf(':') + 1)]
  if (kind === 'tag') {
    const name = values.name ?? row.target?.values.name ?? row.source.name!
    const nextSlug = slug !== undefined || !row.target ? await freeTagSlug(db, id, locale, name, slug) : row.target.slug!
    await db.insert(tagLocalizations).values({ tagId: id, locale, name, slug: nextSlug, translationState: state, segmentsMeta: meta })
      .onConflictDoUpdate({ target: [tagLocalizations.tagId, tagLocalizations.locale], set: { name, slug: nextSlug, translationState: state, segmentsMeta: meta } })
    return
  }
  if (kind === 'media') {
    const fields = { ...values }
    await db.insert(mediaLocalizations).values({ mediaId: id, locale, alt: fields.alt ?? '', caption: fields.caption ?? null, credit: fields.credit ?? null, translationState: state, segmentsMeta: meta })
      .onConflictDoUpdate({ target: [mediaLocalizations.mediaId, mediaLocalizations.locale], set: { ...fields, translationState: state, segmentsMeta: meta, updatedAt: new Date() } })
    return
  }
  const key = id as (typeof LOCALIZED_SETTINGS)[number]
  const value = { ...row.base, ...(row.target?.values ?? {}), ...values }
  const parsed = settingSchemas[key].localized.safeParse(value)
  if (!parsed.success) {
    throw createAppError('bad_request', 'Invalid input', parsed.error.issues.map(issue => ({ path: `items.${row.key}.${issue.path.join('.')}`, message: 'invalid' })))
  }
  await db.insert(siteSettingLocalizations).values({ key, locale, value: parsed.data, translationState: state, segmentsMeta: meta })
    .onConflictDoUpdate({ target: [siteSettingLocalizations.key, siteSettingLocalizations.locale], set: { value: parsed.data, translationState: state, segmentsMeta: meta, updatedAt: new Date() } })
}

/** The meta after writing some fields: those get the current source hash and `state`; the others keep theirs */
async function metaFor(row: Row, fields: readonly string[], state: SegmentsMeta[string]['state']): Promise<SegmentsMeta> {
  const hashes = await hashSegments(fieldSegments(row.source))
  const meta: SegmentsMeta = {}
  for (const [field, sourceHash] of Object.entries(hashes)) {
    meta[field] = fields.includes(field) ? { sourceHash, state } : row.target?.meta[field] ?? { sourceHash, state: 'missing' }
  }
  return meta
}

/** The job subject for a batch (run.service.ts): one segment per chosen field, `<item key>:<field>` */
export async function textsSubject(db: Db, locale: Locale, terms: ProtectedTerm[], scope: string[] | undefined): Promise<JobSubject> {
  if (!scope) {
    throw createAppError('bad_request', 'Invalid input', [{ path: 'segmentIds', message: 'required' }])
  }
  const rows = await loadRows(db, locale)
  const tagged = new Map<string, { row: Row, field: string, tagged: ReturnType<typeof extractField>['tagged'], text: string }>()
  for (const row of rows) {
    for (const [field, text] of Object.entries(row.source)) {
      const id = `${row.key}:${field}`
      tagged.set(id, { row, field, text, tagged: extractField(id, text, termsFor(row, field, terms)).tagged })
    }
  }
  const segments = [...tagged.entries()].filter(([id]) => scope.includes(id)).map(([id, entry]) => ({ id, text: entry.tagged.text }))
  return {
    // Only the chosen texts: a change elsewhere does not stop this job
    sourceHash: await contentHash(Object.fromEntries(segments.map(segment => [segment.id, tagged.get(segment.id)!.text]))),
    segments: [...tagged.entries()].map(([id, entry]) => ({ id, text: entry.tagged.text })),
    accepts: (id, text) => {
      const entry = tagged.get(id)
      return entry !== undefined && untagPlainText(text, entry.tagged).ok
    },
    taggedOf: id => tagged.get(id)?.tagged,
    finish: async (texts) => {
      // Review text of a plain field is the text itself (its placeholders are terms, put back by withoutTerms)
      const byRow = new Map<Row, Record<string, string>>()
      for (const [id, text] of Object.entries(texts)) {
        const entry = tagged.get(id)!
        const values = byRow.get(entry.row) ?? {}
        values[entry.field] = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        byRow.set(entry.row, values)
      }
      for (const [row, values] of byRow) {
        const reviewed = row.target && row.target.state !== 'machine' && row.target.state !== 'missing'
        await writeItem(db, row, locale, values, reviewed ? 'in_review' : 'machine', await metaFor(row, Object.keys(values), 'machine'))
      }
    },
  }
}

export interface TextEdit {
  key: string
  fields: Record<string, string>
  slug?: string | undefined
}

const forbidden = (key: string) => createAppError('forbidden', 'Settings texts need settings:update', [{ path: `items.${key}`, message: 'settings_update' }])

/** Saves a reviewer's texts; each item goes to review */
export async function saveTextItems(db: Db, locale: Locale, edits: readonly TextEdit[], canSettings: boolean): Promise<TextItem[]> {
  const rows = new Map((await loadRows(db, locale)).map(row => [row.key, row]))
  for (const edit of edits) {
    const row = rows.get(edit.key)
    if (!row) {
      throw createAppError('bad_request', 'Invalid input', [{ path: `items.${edit.key}`, message: 'unknown_item' }])
    }
    if (row.kind === 'setting' && !canSettings) {
      throw forbidden(edit.key)
    }
    const unknown = Object.keys(edit.fields).filter(field => !(field in row.source))
    if (unknown.length > 0) {
      throw createAppError('bad_request', 'Invalid input', unknown.map(field => ({ path: `items.${edit.key}.${field}`, message: 'unknown_field' })))
    }
    if (row.key === 'setting:seo_defaults' && edit.fields.titleTemplate !== undefined && edit.fields.titleTemplate.split('%s').length !== 2) {
      throw createAppError('bad_request', 'Invalid input', [{ path: `items.${edit.key}.titleTemplate`, message: 'template' }])
    }
    const state = row.target?.state ?? 'missing'
    if (state !== 'in_review' && !canTransition(state, 'in_review')) {
      throw createAppError('conflict', 'Cannot review', [{ path: `items.${edit.key}`, message: state }])
    }
    await writeItem(db, row, locale, edit.fields, 'in_review', await metaFor(row, Object.keys(edit.fields), 'in_review'), row.kind === 'tag' ? edit.slug : undefined)
  }
  return listTextItems(db, locale)
}

/** Approves the chosen items as they are: every field translated; returns what to purge */
export async function approveTextItems(db: Db, locale: Locale, keys: readonly string[], canSettings: boolean): Promise<{ items: TextItem[], purge: string[] }> {
  const rows = new Map((await loadRows(db, locale)).map(row => [row.key, row]))
  const purge = new Set<string>()
  // Every item is checked before any is written: a refused batch changes nothing
  const approved = keys.map((key) => {
    const row = rows.get(key)
    if (!row || !row.target) {
      throw createAppError('bad_request', 'Invalid input', [{ path: `items.${key}`, message: 'unknown_item' }])
    }
    if (row.kind === 'setting' && !canSettings) {
      throw forbidden(key)
    }
    if (!canTransition(row.target.state, 'approved')) {
      throw createAppError('conflict', 'Cannot approve', [{ path: `items.${key}`, message: row.target.state }])
    }
    const missing = Object.keys(row.source).filter(field => fieldStatus(row, field) === 'missing')
    if (missing.length > 0) {
      throw createAppError('conflict', 'Cannot approve', missing.map(field => ({ path: `items.${key}.${field}`, message: 'missing' })))
    }
    return row
  })
  for (const row of approved) {
    const id = row.key.slice(row.key.indexOf(':') + 1)
    const meta = approvedMeta(await hashSegments(fieldSegments(row.source)))
    if (row.kind === 'tag') {
      await db.update(tagLocalizations).set({ translationState: 'approved', segmentsMeta: meta }).where(and(eq(tagLocalizations.tagId, id), eq(tagLocalizations.locale, locale)))
      purge.add(cacheTags.tag(id))
    }
    else if (row.kind === 'media') {
      await db.update(mediaLocalizations).set({ translationState: 'approved', segmentsMeta: meta }).where(and(eq(mediaLocalizations.mediaId, id), eq(mediaLocalizations.locale, locale)))
      purge.add(cacheTags.media(id))
    }
    else {
      await db.update(siteSettingLocalizations).set({ translationState: 'approved', segmentsMeta: meta }).where(and(eq(siteSettingLocalizations.key, id as SiteSettingKey), eq(siteSettingLocalizations.locale, locale)))
      purge.add(cacheTags.settings())
    }
  }
  return { items: await listTextItems(db, locale), purge: [...purge] }
}
