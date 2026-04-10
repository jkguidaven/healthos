/**
 * src/lib/db/queries/data-export.ts
 *
 * Drizzle query helper that dumps every row from every table into a single
 * typed payload. Used by the Settings → "Export all data" flow to give the
 * user a portable JSON snapshot of their entire HealthOS database.
 *
 * Pattern matches the rest of `src/lib/db/queries/*` — takes a DB handle so
 * it can be unit-tested against an in-memory SQLite instance.
 *
 * The export is intentionally a flat dump (no joins, no transforms). Restoring
 * is out of scope for now; the goal is portability and user trust ("my data
 * is mine, here it is").
 */

import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

import {
  bodyMetricTable,
  coachEntryTable,
  foodLogTable,
  planExerciseTable,
  profileTable,
  progressPhotoTable,
  sessionSetTable,
  sessionTable,
  waterLogTable,
  workoutDayTable,
  workoutPlanTable,
  type BodyMetric,
  type CoachEntry,
  type FoodLogEntry,
  type PlanExercise,
  type Profile,
  type ProgressPhoto,
  type Session,
  type SessionSet,
  type WaterLogEntry,
  type WorkoutDay,
  type WorkoutPlan,
} from '../schema'
import type * as schema from '../schema'

type DB = ExpoSQLiteDatabase<typeof schema>

// ─────────────────────────────────────────────
// Public payload shape
// ─────────────────────────────────────────────

/**
 * Bumped any time the export format changes in a non-additive way.
 * Importers (future work) should refuse to read a payload with an unknown
 * `schemaVersion`.
 */
export const DATA_EXPORT_SCHEMA_VERSION = 1

export interface DataExportTables {
  profile: Profile[]
  foodLog: FoodLogEntry[]
  waterLog: WaterLogEntry[]
  bodyMetric: BodyMetric[]
  progressPhoto: ProgressPhoto[]
  workoutPlan: WorkoutPlan[]
  workoutDay: WorkoutDay[]
  planExercise: PlanExercise[]
  session: Session[]
  sessionSet: SessionSet[]
  coachEntry: CoachEntry[]
}

export interface DataExportPayload {
  schemaVersion: typeof DATA_EXPORT_SCHEMA_VERSION
  exportedAt: string // ISO 8601
  app: 'healthos'
  appVersion: string
  tables: DataExportTables
}

// ─────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────

/**
 * Select every row from every table and return a typed payload ready to be
 * serialised to JSON.
 *
 * The queries run sequentially (rather than in parallel via `Promise.all`)
 * because the underlying SQLite handle is single-threaded — sequential
 * reads keep the contract simple and the order deterministic for tests.
 */
export async function dumpAllTables(
  db: DB,
  appVersion: string,
): Promise<DataExportPayload> {
  const profile = await db.select().from(profileTable)
  const foodLog = await db.select().from(foodLogTable)
  const waterLog = await db.select().from(waterLogTable)
  const bodyMetric = await db.select().from(bodyMetricTable)
  const progressPhoto = await db.select().from(progressPhotoTable)
  const workoutPlan = await db.select().from(workoutPlanTable)
  const workoutDay = await db.select().from(workoutDayTable)
  const planExercise = await db.select().from(planExerciseTable)
  const session = await db.select().from(sessionTable)
  const sessionSet = await db.select().from(sessionSetTable)
  const coachEntry = await db.select().from(coachEntryTable)

  return {
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'healthos',
    appVersion,
    tables: {
      profile,
      foodLog,
      waterLog,
      bodyMetric,
      progressPhoto,
      workoutPlan,
      workoutDay,
      planExercise,
      session,
      sessionSet,
      coachEntry,
    },
  }
}
