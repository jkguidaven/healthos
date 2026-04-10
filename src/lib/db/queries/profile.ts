/**
 * src/lib/db/queries/profile.ts
 *
 * Drizzle query helpers for the profile table.
 * HealthOS is single-user, so there is at most one profile row in the app.
 */

import { eq } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { profileTable, type Profile, type NewProfile } from '../schema'
import type * as schema from '../schema'

type DB = ExpoSQLiteDatabase<typeof schema>

/**
 * Get the user profile (there's only one profile row in the app).
 */
export async function getProfile(db: DB): Promise<Profile | null> {
  const rows = await db.select().from(profileTable).limit(1)
  return rows[0] ?? null
}

/**
 * Insert or update the user profile. There can only be one profile row,
 * so this either creates it (if none exists) or updates the existing row.
 */
export async function upsertProfile(
  db: DB,
  data: NewProfile,
): Promise<Profile> {
  const existing = await getProfile(db)
  if (existing) {
    const rows = await db
      .update(profileTable)
      .set(data)
      .where(eq(profileTable.id, existing.id))
      .returning()
    return rows[0]
  }
  const rows = await db.insert(profileTable).values(data).returning()
  return rows[0]
}

/**
 * Returns true if a profile row exists. Used by the boot sequence to
 * decide whether to send the user to onboarding.
 */
export async function hasProfile(db: DB): Promise<boolean> {
  const rows = await db
    .select({ id: profileTable.id })
    .from(profileTable)
    .limit(1)
  return rows.length > 0
}

/**
 * Partial update of the existing profile row by id.
 * Lets callers fix individual fields (e.g. height) without having to
 * pass the full NewProfile shape — important for editor flows that read
 * from the Zustand cache (which has slightly different field types
 * than the DB row).
 */
export async function updateProfile(
  db: DB,
  id: number,
  updates: Partial<NewProfile>,
): Promise<Profile> {
  const rows = await db
    .update(profileTable)
    .set(updates)
    .where(eq(profileTable.id, id))
    .returning()
  return rows[0]
}
