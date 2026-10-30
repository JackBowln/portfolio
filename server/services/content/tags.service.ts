// Tags in the admin (F06-T1, decisions 1 and 3; technologies since F07-T1): list, create, rename and delete topics
// and technologies. The slug comes from the name unless given; a taken slug (of any kind) is a 409 on the field. A
// tag that articles or projects use cannot be deleted
import type { z } from 'zod'
import type { tagCreateSchema, tagUpdateSchema } from '../../../shared/content/article-input.ts'
import type { TagKind } from '../../../shared/types/enums.ts'
import { slugify } from '../../../shared/utils/slugify.ts'
import type { Db } from '../../db/client.ts'
import { createAppError, isUniqueViolation } from '../../utils/errors.ts'
import type { TagItem } from './tags.repo.ts'
import { deleteTag as deleteTagRow, findTag, insertTag, isTagSlugTaken, listTags, updateTag } from './tags.repo.ts'

const slugConflict = () => createAppError('conflict', 'Slug already used', [{ path: 'slug', message: 'slug_taken' }])

function slugOf(name: string, slug: string | undefined): string {
  const value = slug ?? slugify(name)
  if (value === '') {
    throw createAppError('bad_request', 'Invalid input', [{ path: 'slug', message: 'the name has no letter or digit for a slug' }])
  }
  return value
}

export function listTagsOf(db: Db, kind: TagKind) {
  return listTags(db, kind)
}

export async function createTag(db: Db, userId: string, kind: TagKind, input: Pick<z.output<typeof tagCreateSchema>, 'name' | 'slug'>): Promise<TagItem> {
  const slug = slugOf(input.name, input.slug)
  if (await isTagSlugTaken(db, slug)) {
    throw slugConflict()
  }
  try {
    return await insertTag(db, userId, kind, input.name, slug)
  }
  catch (error) {
    // Someone took the slug between the check and the insert
    throw isUniqueViolation(error) ? slugConflict() : error
  }
}

async function findExisting(db: Db, id: string) {
  const tag = await findTag(db, id)
  if (!tag) {
    throw createAppError('not_found')
  }
  return tag
}

export async function renameTag(db: Db, userId: string, id: string, input: z.output<typeof tagUpdateSchema>): Promise<TagItem & { kind: TagKind }> {
  const tag = await findExisting(db, id)
  if (input.slug !== undefined && input.slug !== tag.slug && await isTagSlugTaken(db, input.slug, id)) {
    throw slugConflict()
  }
  await updateTag(db, userId, id, input)
  return { id, kind: tag.kind, name: input.name ?? tag.name, slug: input.slug ?? tag.slug }
}

export async function removeTag(db: Db, id: string): Promise<{ kind: TagKind }> {
  const tag = await findExisting(db, id)
  if (tag.uses > 0) {
    throw createAppError('conflict', `${tag.kind === 'topic' ? 'Topic' : 'Technology'} in use`, [{ path: 'uses', message: String(tag.uses) }])
  }
  await deleteTagRow(db, id)
  return { kind: tag.kind }
}

// The F06-T1 names, for topics
export const listTopics = (db: Db) => listTagsOf(db, 'topic')
export const createTopic = (db: Db, userId: string, input: Pick<z.output<typeof tagCreateSchema>, 'name' | 'slug'>) => createTag(db, userId, 'topic', input)
export const updateTopic = async (db: Db, userId: string, id: string, input: z.output<typeof tagUpdateSchema>): Promise<TagItem> => {
  const { kind: _kind, ...tag } = await renameTag(db, userId, id, input)
  return tag
}
export const deleteTopic = async (db: Db, id: string): Promise<void> => {
  await removeTag(db, id)
}
