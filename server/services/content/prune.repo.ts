// Autosave retention (data-model §4.3, F06-T2): per localization, at most the 10 newest autosaves and none older than
// 14 days. Manual, publish, restore and AI revisions are never touched, nor an autosave a localization points at
// (published or translation source). Each run deletes a bounded number of rows, so the cron stays within its CPU
import { sql } from 'drizzle-orm'
import type { ContentType } from '../../../shared/content/snapshot.ts'
import type { Db } from '../../db/client.ts'
import { contentTables } from './content-tables.ts'
import type { ContentTables } from './content-tables.ts'

export const AUTOSAVE_RETENTION = { perLocalization: 10, days: 14 } as const

/**
 * The cron fires every 5 minutes for every job; the prune runs once a day, in the first 5 minutes after 03:00 UTC
 * (a quiet hour in Brazil and Europe)
 */
export function isPruneWindow(now: Date): boolean {
  return now.getUTCHours() === 3 && now.getUTCMinutes() < 5
}

const tablesOf = (type: ContentType) => contentTables[type] as unknown as ContentTables['article']

/** Deletes up to `limit` expired autosaves of one content type; returns how many */
export async function pruneAutosaves(db: Db, type: ContentType, now: Date, limit: number): Promise<number> {
  const { revisions, localizations } = tablesOf(type)
  const cutoff = now.getTime() - AUTOSAVE_RETENTION.days * 24 * 60 * 60 * 1000
  const result = await db.run(sql`
    DELETE FROM ${revisions} WHERE id IN (
      SELECT id FROM (
        SELECT r.id AS id, r.created_at AS created_at,
          row_number() OVER (PARTITION BY r.localization_id ORDER BY r.number DESC) AS rank
        FROM ${revisions} r WHERE r.kind = 'autosave'
      ) ranked
      WHERE (ranked.rank > ${AUTOSAVE_RETENTION.perLocalization} OR ranked.created_at < ${cutoff})
        AND ranked.id NOT IN (SELECT published_revision_id FROM ${localizations} WHERE published_revision_id IS NOT NULL)
        AND ranked.id NOT IN (SELECT source_revision_id FROM ${localizations} WHERE source_revision_id IS NOT NULL)
      LIMIT ${limit}
    )`)
  return result.meta.changes ?? 0
}
