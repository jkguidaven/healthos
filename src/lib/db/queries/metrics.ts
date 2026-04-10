/**
 * src/lib/db/queries/metrics.ts
 *
 * Drizzle query helpers for the body_metric table.
 * All functions take a DB handle as their first argument so they can be
 * unit-tested against an in-memory SQLite instance.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import {
  bodyMetricTable,
  type BodyMetric,
  type NewBodyMetric,
} from '../schema'
import type * as schema from '../schema'

type DB = ExpoSQLiteDatabase<typeof schema>

/**
 * Get the most recent body metric entry for a profile.
 * Used by the metrics screen header tile.
 */
export async function getLatestBodyMetric(
  db: DB,
  profileId: number,
): Promise<BodyMetric | null> {
  const rows = await db
    .select()
    .from(bodyMetricTable)
    .where(eq(bodyMetricTable.profileId, profileId))
    .orderBy(desc(bodyMetricTable.date))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Get body metrics for a date range — used for trend charts.
 * Returns rows ordered oldest-first (chart-friendly).
 */
export async function getBodyMetricsRange(
  db: DB,
  profileId: number,
  fromDate: string, // YYYY-MM-DD
  toDate: string, // YYYY-MM-DD
): Promise<BodyMetric[]> {
  return db
    .select()
    .from(bodyMetricTable)
    .where(
      and(
        eq(bodyMetricTable.profileId, profileId),
        gte(bodyMetricTable.date, fromDate),
        lte(bodyMetricTable.date, toDate),
      ),
    )
    .orderBy(bodyMetricTable.date) // oldest first
}

/**
 * Update an existing body metric row by id. Used by the edit measurements
 * screen to fix mistakes in the most recent entry without creating a
 * duplicate row for today (which is what `upsertBodyMetric` would do
 * if the latest entry was from a different day).
 */
export async function updateBodyMetric(
  db: DB,
  id: number,
  updates: Partial<NewBodyMetric>,
): Promise<BodyMetric> {
  const rows = await db
    .update(bodyMetricTable)
    .set(updates)
    .where(eq(bodyMetricTable.id, id))
    .returning()
  return rows[0]
}

/**
 * Upsert today's body metric entry.
 * Conflict target is (date) — only one entry per day allowed.
 */
export async function upsertBodyMetric(
  db: DB,
  entry: NewBodyMetric,
): Promise<BodyMetric> {
  const rows = await db
    .insert(bodyMetricTable)
    .values(entry)
    .onConflictDoUpdate({
      target: bodyMetricTable.date,
      set: {
        weightKg: entry.weightKg,
        waistCm: entry.waistCm,
        hipCm: entry.hipCm,
        chestCm: entry.chestCm,
        armCm: entry.armCm,
        thighCm: entry.thighCm,
        bodyFatPct: entry.bodyFatPct,
        leanMassKg: entry.leanMassKg,
        fatMassKg: entry.fatMassKg,
        navyWaistCm: entry.navyWaistCm,
        navyNeckCm: entry.navyNeckCm,
      },
    })
    .returning()
  return rows[0]
}

/**
 * Get body metric from N days ago. Returns the closest entry on or before
 * that date. Used for delta comparisons (e.g. "30 days ago" for the
 * recomp coach context).
 */
export async function getBodyMetricNDaysAgo(
  db: DB,
  profileId: number,
  daysAgo: number,
): Promise<BodyMetric | null> {
  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() - daysAgo)
  const targetIso = targetDate.toISOString().split('T')[0]

  const rows = await db
    .select()
    .from(bodyMetricTable)
    .where(
      and(
        eq(bodyMetricTable.profileId, profileId),
        lte(bodyMetricTable.date, targetIso),
      ),
    )
    .orderBy(desc(bodyMetricTable.date))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Get the most recent body metric within the last N days. Returns null
 * if no entry exists in that window.
 */
export async function getLatestBodyMetricWithinDays(
  db: DB,
  profileId: number,
  withinDays: number,
): Promise<BodyMetric | null> {
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - withinDays)
  const fromIso = fromDate.toISOString().split('T')[0]

  const rows = await db
    .select()
    .from(bodyMetricTable)
    .where(
      and(
        eq(bodyMetricTable.profileId, profileId),
        gte(bodyMetricTable.date, fromIso),
      ),
    )
    .orderBy(desc(bodyMetricTable.date))
    .limit(1)
  return rows[0] ?? null
}
