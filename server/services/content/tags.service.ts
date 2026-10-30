// Topics in the admin (F06-T1, decisions 1 and 3): list, create, rename and delete. The slug comes from the name
// unless given; a taken slug is a 409 on the field. A topic that articles use cannot be deleted
import type { z } from 'zod'
import type { tagCreateSchema, tagUpdateSchema } from '../../../shared/content/article-input.ts'
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

export function listTopics(db: Db) {
  return listTags(db, 'topic')
}

export async function createTopic(db: Db, userId: string, input: z.output<typeof tagCreateSchema>): Promise<TagItem> {
  const slug = slugOf(input.name, input.slug)
  if (await isTagSlugTaken(db, slug)) {
    throw slugConflict()
  }
  try {
    return await insertTag(db, userId, 'topic', input.name, slug)
  }
  catch (error) {
    // Someone took the slug between the check and the insert
    throw isUniqueViolation(error) ? slugConflict() : error
  }
}

async function findTopic(db: Db, id: string) {
  const tag = await findTag(db, id)
  if (!tag || tag.kind !== 'topic') {
    throw createAppError('not_found')
  }
  return tag
}

export async function updateTopic(db: Db, userId: string, id: string, input: z.output<typeof tagUpdateSchema>): Promise<TagItem> {
  const tag = await findTopic(db, id)
  if (input.slug !== undefined && input.slug !== tag.slug && await isTagSlugTaken(db, input.slug, id)) {
    throw slugConflict()
  }
  await updateTag(db, userId, id, input)
  return { id, name: input.name ?? tag.name, slug: input.slug ?? tag.slug }
}

export async function deleteTopic(db: Db, id: string): Promise<void> {
  const tag = await findTopic(db, id)
  if (tag.uses > 0) {
    throw createAppError('conflict', 'Topic in use', [{ path: 'uses', message: String(tag.uses) }])
  }
  await deleteTagRow(db, id)
}
