// Topic queries (F06-T1, data-model §4.7): a tag and its pt-BR name and slug; translations of names come with the
// translation flow (F09). Uses count the articles that carry the topic in their working copy or published version
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { SOURCE_LOCALE } from '../../../shared/types/enums.ts'
import type { TagKind } from '../../../shared/types/enums.ts'
import { uuidv7 } from '../../../shared/utils/id.ts'
import type { Db } from '../../db/client.ts'
import { articleTags, articles } from '../../db/schema/content.ts'
import { tagLocalizations, tags } from '../../db/schema/taxonomy.ts'

export interface TagItem {
  id: string
  name: string
  slug: string
}

// Articles (not deleted) that list the tag in draft_tag_ids, or publish it through article_tags
const usesOf = sql<number>`(
  SELECT count(DISTINCT a.id) FROM ${articles} a
  WHERE a.deleted_at IS NULL AND (
    EXISTS (SELECT 1 FROM json_each(a.draft_tag_ids) j WHERE j.value = ${tags.id})
    OR EXISTS (SELECT 1 FROM ${articleTags} t WHERE t.article_id = a.id AND t.tag_id = ${tags.id})
  )
)`

export async function listTags(db: Db, kind: TagKind): Promise<(TagItem & { uses: number })[]> {
  return db.select({ id: tags.id, name: tagLocalizations.name, slug: tagLocalizations.slug, uses: usesOf.mapWith(Number) }).from(tags)
    .innerJoin(tagLocalizations, and(eq(tagLocalizations.tagId, tags.id), eq(tagLocalizations.locale, SOURCE_LOCALE)))
    .where(eq(tags.kind, kind))
    .orderBy(asc(tagLocalizations.name))
}

export async function findTag(db: Db, id: string): Promise<(TagItem & { kind: TagKind, uses: number }) | undefined> {
  const [row] = await db.select({ id: tags.id, kind: tags.kind, name: tagLocalizations.name, slug: tagLocalizations.slug, uses: usesOf.mapWith(Number) }).from(tags)
    .innerJoin(tagLocalizations, and(eq(tagLocalizations.tagId, tags.id), eq(tagLocalizations.locale, SOURCE_LOCALE)))
    .where(eq(tags.id, id))
  return row
}

/** The ids among `ids` that are tags of this kind */
export async function existingTagIds(db: Db, ids: readonly string[], kind: TagKind): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set()
  }
  const rows = await db.select({ id: tags.id }).from(tags).where(and(inArray(tags.id, [...ids]), eq(tags.kind, kind)))
  return new Set(rows.map(row => row.id))
}

export async function isTagSlugTaken(db: Db, slug: string, exceptTagId?: string): Promise<boolean> {
  const [row] = await db.select({ id: tagLocalizations.tagId }).from(tagLocalizations)
    .where(and(eq(tagLocalizations.locale, SOURCE_LOCALE), eq(tagLocalizations.slug, slug), exceptTagId ? sql`${tagLocalizations.tagId} <> ${exceptTagId}` : undefined))
  return row !== undefined
}

/** The tag and its pt-BR name in one batch: a taken slug fails both */
export async function insertTag(db: Db, userId: string, kind: TagKind, name: string, slug: string): Promise<TagItem> {
  const id = uuidv7()
  await db.batch([
    db.insert(tags).values({ id, kind, createdBy: userId, updatedBy: userId }),
    db.insert(tagLocalizations).values({ tagId: id, locale: SOURCE_LOCALE, name, slug, translationState: 'source' }),
  ])
  return { id, name, slug }
}

export async function updateTag(db: Db, userId: string, id: string, values: { name?: string | undefined, slug?: string | undefined }): Promise<void> {
  const changes = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
  await db.batch([
    db.update(tagLocalizations).set(changes).where(and(eq(tagLocalizations.tagId, id), eq(tagLocalizations.locale, SOURCE_LOCALE))),
    db.update(tags).set({ updatedBy: userId }).where(eq(tags.id, id)),
  ])
}

/** Deletes the tag and its names; deleted articles may still list it in draft_tag_ids, which reads skip */
export async function deleteTag(db: Db, id: string): Promise<void> {
  await db.delete(tags).where(eq(tags.id, id))
}
