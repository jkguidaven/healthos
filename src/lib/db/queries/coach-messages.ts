/**
 * src/lib/db/queries/coach-messages.ts
 *
 * Persistence for the AI coach chat. Each turn (user or assistant text)
 * is one row. The screen loads the full history for display, but only
 * the last N turns are sent to Gemini on each request — keeps the token
 * cost flat no matter how long the user's conversation gets.
 */

import { asc, desc, eq } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

import {
  coachMessageTable,
  type CoachMessage,
  type NewCoachMessage,
} from '../schema'
import type * as schema from '../schema'

type DB = ExpoSQLiteDatabase<typeof schema>

/** All messages for a profile, oldest-first (render order). */
export async function getCoachMessages(
  db: DB,
  profileId: number,
): Promise<CoachMessage[]> {
  return db
    .select()
    .from(coachMessageTable)
    .where(eq(coachMessageTable.profileId, profileId))
    .orderBy(asc(coachMessageTable.id))
}

/**
 * Last N messages (oldest-first) for a profile. Used to build the
 * sliding-window context sent to Gemini so token cost stays flat.
 */
export async function getRecentCoachMessages(
  db: DB,
  profileId: number,
  limit: number,
): Promise<CoachMessage[]> {
  const rows = await db
    .select()
    .from(coachMessageTable)
    .where(eq(coachMessageTable.profileId, profileId))
    .orderBy(desc(coachMessageTable.id))
    .limit(limit)
  return rows.reverse()
}

export async function insertCoachMessage(
  db: DB,
  entry: NewCoachMessage,
): Promise<CoachMessage> {
  const rows = await db.insert(coachMessageTable).values(entry).returning()
  return rows[0]
}

/** Wipe the entire conversation for a profile. Backs the "New chat" button. */
export async function clearCoachMessages(
  db: DB,
  profileId: number,
): Promise<void> {
  await db
    .delete(coachMessageTable)
    .where(eq(coachMessageTable.profileId, profileId))
}
