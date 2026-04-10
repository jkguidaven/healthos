/**
 * src/lib/db/queries/progress-photos.ts
 *
 * Drizzle query helpers for the progress_photo table.
 * All functions take a DB handle as their first argument so they can be
 * unit-tested against an in-memory SQLite instance.
 *
 * The table only stores file URI references — the actual photo bytes live
 * on disk under expo-file-system's document directory and are managed by
 * the feature hook (`use-progress-photos.ts`).
 */

import { and, desc, eq } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import {
  progressPhotoTable,
  type NewProgressPhoto,
  type ProgressPhoto,
} from '../schema'
import type * as schema from '../schema'

type DB = ExpoSQLiteDatabase<typeof schema>

/**
 * List every progress photo for a profile, newest first.
 *
 * Sorts by date descending, then by takenAt descending so multiple photos
 * captured on the same day are ordered by capture time (most recent first).
 */
export async function listProgressPhotos(
  db: DB,
  profileId: number,
): Promise<ProgressPhoto[]> {
  return db
    .select()
    .from(progressPhotoTable)
    .where(eq(progressPhotoTable.profileId, profileId))
    .orderBy(desc(progressPhotoTable.date), desc(progressPhotoTable.takenAt))
}

/**
 * Insert a new progress photo row. Returns the inserted row so callers can
 * read the autoincremented id and the server-side `takenAt` default.
 */
export async function insertProgressPhoto(
  db: DB,
  entry: NewProgressPhoto,
): Promise<ProgressPhoto> {
  const rows = await db.insert(progressPhotoTable).values(entry).returning()
  return rows[0]
}

/**
 * Delete a progress photo by id, scoped to a profile so a stale id can't
 * delete another profile's row. Returns the deleted row (or null if no
 * matching row existed) so callers can clean up the on-disk file.
 */
export async function deleteProgressPhoto(
  db: DB,
  profileId: number,
  id: number,
): Promise<ProgressPhoto | null> {
  const rows = await db
    .delete(progressPhotoTable)
    .where(
      and(
        eq(progressPhotoTable.id, id),
        eq(progressPhotoTable.profileId, profileId),
      ),
    )
    .returning()
  return rows[0] ?? null
}
