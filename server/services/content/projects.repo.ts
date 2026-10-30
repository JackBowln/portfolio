// Project queries for the admin (F07-T1, data-model §4.5): the entity, the list in its manual order, the insert of a
// new project and the order writes. Working copies and saves are shared with articles (working-copy.repo.ts). The
// author of a project is who created it (projects have no author_id). Soft-deleted rows are hidden everywhere here
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.ts'
import { users } from '../../db/schema/auth.ts'
import { projectLocalizations, projects } from '../../db/schema/content.ts'

export type ProjectRow = typeof projects.$inferSelect
export type ProjectLocalizationRow = typeof projectLocalizations.$inferSelect

export async function findProject(db: Db, id: string): Promise<(ProjectRow & { authorName: string | null }) | undefined> {
  const [row] = await db.select({ project: projects, authorName: users.name }).from(projects)
    .leftJoin(users, eq(users.id, projects.createdBy))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
  return row ? { ...row.project, authorName: row.authorName } : undefined
}

/** Every live project in the manual order (first = 0); ties, if any, newest first */
export async function listProjectRows(db: Db) {
  return db.select({ project: projects, authorName: users.name }).from(projects)
    .leftJoin(users, eq(users.id, projects.createdBy))
    .where(isNull(projects.deletedAt))
    .orderBy(asc(projects.sortOrder), sql`${projects.id} DESC`)
}

/** The position after the last project, for a new one */
export async function nextSortOrder(db: Db): Promise<number> {
  const [row] = await db.select({ last: sql<number | null>`max(${projects.sortOrder})` }).from(projects).where(isNull(projects.deletedAt))
  return row?.last === null || row?.last === undefined ? 0 : Number(row.last) + 1
}

/** Insert statements for a new project and its pt-BR working copy, for the caller's batch */
export function insertProjectStatements(db: Db, project: typeof projects.$inferInsert, localization: typeof projectLocalizations.$inferInsert) {
  return [db.insert(projects).values(project), db.insert(projectLocalizations).values(localization)] as const
}

/** The manual order as one batch: each project takes its index in `ids` */
export function orderStatements(db: Db, ids: readonly string[], userId: string) {
  return ids.map((id, index) => db.update(projects).set({ sortOrder: index, updatedBy: userId })
    .where(and(eq(projects.id, id), isNull(projects.deletedAt))))
}
