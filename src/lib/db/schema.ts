/**
 * src/lib/db/schema.ts
 *
 * Single source of truth for the HealthOS database schema.
 * All types are inferred from this file — never define DB types elsewhere.
 *
 * Rules:
 * - Dates stored as TEXT in YYYY-MM-DD format (no timezones needed for a personal local app)
 * - Weights stored as REAL in kg — unit conversion is a UI concern
 * - All measurements stored as REAL in cm or ml
 * - Calories stored as INTEGER, macros as REAL (to allow fractional grams)
 * - JSON blobs (e.g. muscle_groups array) stored as TEXT, parsed at the query layer
 *
 * Agent: after any schema change, run:
 *   pnpm db:generate   (creates migration in src/lib/db/migrations/)
 *   pnpm db:migrate    (applies migration to the local SQLite file)
 *
 * Never hand-edit migration files.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─────────────────────────────────────────────
// PROFILE
// One row per install. The app's identity.
// ─────────────────────────────────────────────

export const profileTable = sqliteTable('profile', {
  id:              integer('id').primaryKey({ autoIncrement: true }),

  // Biometrics
  age:             integer('age').notNull(),
  sex:             text('sex', { enum: ['male', 'female'] }).notNull(),
  heightCm:        real('height_cm').notNull(),
  weightKg:        real('weight_kg').notNull(),         // starting weight at onboarding
  units:           text('units', { enum: ['metric', 'imperial'] }).notNull().default('metric'),

  // Goal
  goal:            text('goal', { enum: ['recomposition', 'bulk', 'cut'] }).notNull().default('recomposition'),
  activityLevel:   text('activity_level', {
                     enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
                   }).notNull().default('moderate'),

  // Workout preferences (used by plan generator prompt)
  experienceLevel: text('experience_level', {
                     enum: ['beginner', 'intermediate', 'advanced'],
                   }).notNull().default('intermediate'),
  equipment:       text('equipment').notNull().default('[]'),   // JSON array of strings
  daysPerWeek:     integer('days_per_week').notNull().default(4),

  // Computed targets (stored so they don't need recalculating on every render)
  goalCalories:    integer('goal_calories').notNull(),
  goalProteinG:    real('goal_protein_g').notNull(),
  goalCarbsG:      real('goal_carbs_g').notNull(),
  goalFatG:        real('goal_fat_g').notNull(),

  // Meta
  createdAt:       text('created_at').notNull().default(sql`(date('now'))`),
  updatedAt:       text('updated_at').notNull().default(sql`(date('now'))`),
})

export type Profile    = typeof profileTable.$inferSelect
export type NewProfile = typeof profileTable.$inferInsert

// ─────────────────────────────────────────────
// FOOD LOG
// One row per food item per meal.
// ─────────────────────────────────────────────

export const foodLogTable = sqliteTable('food_log', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  profileId:   integer('profile_id').notNull().references(() => profileTable.id),

  date:        text('date').notNull(),          // YYYY-MM-DD
  meal:        text('meal', {
                 enum: ['breakfast', 'lunch', 'dinner', 'snack'],
               }).notNull(),

  // Food details
  name:        text('name').notNull(),
  calories:    integer('calories').notNull(),
  proteinG:    real('protein_g').notNull(),
  carbsG:      real('carbs_g').notNull(),
  fatG:        real('fat_g').notNull(),
  servingDesc: text('serving_desc'),            // e.g. "1 bowl (~400g)"

  // Source tracking
  source:      text('source', {
                 enum: ['ai_scan', 'barcode', 'manual'],
               }).notNull(),
  confidence:  text('confidence', {
                 enum: ['high', 'medium', 'low'],
               }),                              // null for manual / barcode entries
  aiNotes:     text('ai_notes'),               // Claude's estimation notes

  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type FoodLogEntry    = typeof foodLogTable.$inferSelect
export type NewFoodLogEntry = typeof foodLogTable.$inferInsert

// ─────────────────────────────────────────────
// WATER LOG
// Separate from food_log — simpler, no macros.
// ─────────────────────────────────────────────

export const waterLogTable = sqliteTable('water_log', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profileTable.id),
  date:      text('date').notNull(),            // YYYY-MM-DD
  amountMl:  integer('amount_ml').notNull(),
  loggedAt:  text('logged_at').notNull().default(sql`(datetime('now'))`),
})

export type WaterLogEntry    = typeof waterLogTable.$inferSelect
export type NewWaterLogEntry = typeof waterLogTable.$inferInsert

// ─────────────────────────────────────────────
// BODY METRICS
// One row per check-in day. Measurements optional.
// ─────────────────────────────────────────────

export const bodyMetricTable = sqliteTable('body_metric', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  profileId:      integer('profile_id').notNull().references(() => profileTable.id),

  date:           text('date').notNull().unique(),  // YYYY-MM-DD, one entry per day

  // Required
  weightKg:       real('weight_kg').notNull(),

  // Optional measurements (cm)
  waistCm:        real('waist_cm'),
  hipCm:          real('hip_cm'),
  chestCm:        real('chest_cm'),
  armCm:          real('arm_cm'),              // dominant arm, flexed
  thighCm:        real('thigh_cm'),            // dominant leg, relaxed

  // Computed (Navy method) — stored after calc so it can be trended
  bodyFatPct:     real('body_fat_pct'),
  leanMassKg:     real('lean_mass_kg'),
  fatMassKg:      real('fat_mass_kg'),

  // Navy method inputs (stored so recalculation is possible)
  navyWaistCm:    real('navy_waist_cm'),
  navyNeckCm:     real('navy_neck_cm'),

  loggedAt:       text('logged_at').notNull().default(sql`(datetime('now'))`),
})

export type BodyMetric    = typeof bodyMetricTable.$inferSelect
export type NewBodyMetric = typeof bodyMetricTable.$inferInsert

// ─────────────────────────────────────────────
// PROGRESS PHOTOS
// URI references only — actual files in expo-file-system.
// ─────────────────────────────────────────────

export const progressPhotoTable = sqliteTable('progress_photo', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profileTable.id),
  date:      text('date').notNull(),            // YYYY-MM-DD
  fileUri:   text('file_uri').notNull(),        // expo-file-system URI
  angle:     text('angle', {
               enum: ['front', 'side', 'back'],
             }).notNull().default('front'),
  notes:     text('notes'),
  takenAt:   text('taken_at').notNull().default(sql`(datetime('now'))`),
})

export type ProgressPhoto    = typeof progressPhotoTable.$inferSelect
export type NewProgressPhoto = typeof progressPhotoTable.$inferInsert

// ─────────────────────────────────────────────
// WORKOUT PLAN
// AI-generated plan header.
// ─────────────────────────────────────────────

export const workoutPlanTable = sqliteTable('workout_plan', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  profileId:     integer('profile_id').notNull().references(() => profileTable.id),

  name:          text('name').notNull(),              // e.g. "PPL Recomp — 8 weeks"
  splitType:     text('split_type', {
                   enum: ['full_body', 'upper_lower', 'ppl', 'custom'],
                 }).notNull(),
  weeksTotal:    integer('weeks_total').notNull(),
  daysPerWeek:   integer('days_per_week').notNull(),
  rationale:     text('rationale'),                   // Claude's plan explanation
  isActive:      integer('is_active', { mode: 'boolean' }).notNull().default(true),
  startDate:     text('start_date').notNull(),         // YYYY-MM-DD

  createdAt:     text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type WorkoutPlan    = typeof workoutPlanTable.$inferSelect
export type NewWorkoutPlan = typeof workoutPlanTable.$inferInsert

// ─────────────────────────────────────────────
// WORKOUT DAY
// One row per day within a plan (e.g. "Push A").
// ─────────────────────────────────────────────

export const workoutDayTable = sqliteTable('workout_day', {
  id:                 integer('id').primaryKey({ autoIncrement: true }),
  planId:             integer('plan_id').notNull().references(() => workoutPlanTable.id),

  dayName:            text('day_name').notNull(),      // e.g. "Push A"
  muscleGroups:       text('muscle_groups').notNull(), // JSON array: ["chest", "shoulders"]
  estimatedMinutes:   integer('estimated_minutes'),
  orderIndex:         integer('order_index').notNull().default(0),
})

export type WorkoutDay    = typeof workoutDayTable.$inferSelect
export type NewWorkoutDay = typeof workoutDayTable.$inferInsert

// ─────────────────────────────────────────────
// PLAN EXERCISE
// Exercises within a workout day.
// ─────────────────────────────────────────────

export const planExerciseTable = sqliteTable('plan_exercise', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  dayId:            integer('day_id').notNull().references(() => workoutDayTable.id),

  name:             text('name').notNull(),            // e.g. "Barbell bench press"
  sets:             integer('sets').notNull(),
  reps:             integer('reps').notNull(),
  restSeconds:      integer('rest_seconds').notNull(),
  weightKg:         real('weight_kg'),                 // null until user fills in
  tempo:            text('tempo'),                     // e.g. "2-0-1-0"
  progressionNote:  text('progression_note'),          // from Claude
  orderIndex:       integer('order_index').notNull().default(0),
})

export type PlanExercise    = typeof planExerciseTable.$inferSelect
export type NewPlanExercise = typeof planExerciseTable.$inferInsert

// ─────────────────────────────────────────────
// SESSION
// One row per completed workout session.
// ─────────────────────────────────────────────

export const sessionTable = sqliteTable('session', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  profileId:      integer('profile_id').notNull().references(() => profileTable.id),
  planId:         integer('plan_id').references(() => workoutPlanTable.id),  // null = unplanned session
  dayId:          integer('day_id').references(() => workoutDayTable.id),

  date:           text('date').notNull(),              // YYYY-MM-DD
  name:           text('name').notNull(),              // e.g. "Push A" or "Custom session"
  durationSeconds: integer('duration_seconds'),
  notes:          text('notes'),

  startedAt:      text('started_at').notNull().default(sql`(datetime('now'))`),
  completedAt:    text('completed_at'),
})

export type Session    = typeof sessionTable.$inferSelect
export type NewSession = typeof sessionTable.$inferInsert

// ─────────────────────────────────────────────
// SESSION SET
// One row per logged set within a session.
// ─────────────────────────────────────────────

export const sessionSetTable = sqliteTable('session_set', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  sessionId:       integer('session_id').notNull().references(() => sessionTable.id),
  planExerciseId:  integer('plan_exercise_id').references(() => planExerciseTable.id), // null = unplanned exercise
  exerciseName:    text('exercise_name').notNull(),    // denormalised for easy display

  setNumber:       integer('set_number').notNull(),
  weightKg:        real('weight_kg'),
  reps:            integer('reps'),
  rpe:             real('rpe'),                        // optional: 1–10
  isPr:            integer('is_pr', { mode: 'boolean' }).notNull().default(false),
  notes:           text('notes'),

  loggedAt:        text('logged_at').notNull().default(sql`(datetime('now'))`),
})

export type SessionSet    = typeof sessionSetTable.$inferSelect
export type NewSessionSet = typeof sessionSetTable.$inferInsert

// ─────────────────────────────────────────────
// COACH ENTRY
// Cached AI coaching responses.
// One row per date — regenerated at most once per day.
// ─────────────────────────────────────────────

export const coachEntryTable = sqliteTable('coach_entry', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  profileId:     integer('profile_id').notNull().references(() => profileTable.id),

  date:          text('date').notNull().unique(),   // YYYY-MM-DD
  entryType:     text('entry_type', {
                   enum: ['daily', 'weekly'],
                 }).notNull().default('daily'),
  content:       text('content').notNull(),         // JSON: CoachResult
  mood:          text('mood', {
                   enum: ['great', 'good', 'check_in'],
                 }).notNull(),                       // denormalised for fast dashboard read

  generatedAt:   text('generated_at').notNull().default(sql`(datetime('now'))`),
})

export type CoachEntry    = typeof coachEntryTable.$inferSelect
export type NewCoachEntry = typeof coachEntryTable.$inferInsert

// ─────────────────────────────────────────────
// COACH MESSAGE
// Persistent chat history between the user and the AI coach.
// One row per turn (user or assistant).
// ─────────────────────────────────────────────

export const coachMessageTable = sqliteTable('coach_message', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  profileId:   integer('profile_id').notNull().references(() => profileTable.id),

  role:        text('role', { enum: ['user', 'assistant'] }).notNull(),
  content:     text('content').notNull(),

  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
})

export type CoachMessage    = typeof coachMessageTable.$inferSelect
export type NewCoachMessage = typeof coachMessageTable.$inferInsert

// ─────────────────────────────────────────────
// CONVENIENCE: all tables exported as a group
// Useful for drizzle-kit config and migrations.
// ─────────────────────────────────────────────

export const schema = {
  profile:        profileTable,
  foodLog:        foodLogTable,
  waterLog:       waterLogTable,
  bodyMetric:     bodyMetricTable,
  progressPhoto:  progressPhotoTable,
  workoutPlan:    workoutPlanTable,
  workoutDay:     workoutDayTable,
  planExercise:   planExerciseTable,
  session:        sessionTable,
  sessionSet:     sessionSetTable,
  coachEntry:     coachEntryTable,
  coachMessage:   coachMessageTable,
}
