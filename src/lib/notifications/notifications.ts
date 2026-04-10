// ═══════════════════════════════════════════════════════════════
// src/lib/notifications/notifications.ts
// ─────────────────────────────────────────────────────────────
// Local notification scheduling for HealthOS daily reminders.
//
// This file is the ONLY module in the codebase that imports
// `expo-notifications`. All feature code goes through the helpers
// exported here so we can keep the platform-specific quirks in one
// place.
//
// Reminders scheduled (all LOCAL — no push server):
//   1. Morning weigh-in       — daily at 08:00
//   2. Workout                — daily at 17:00 (v1: every day)
//   3. Water intake check     — daily at 14:00
//
// Platform support: iOS + Android only. `expo-notifications` is NOT
// supported on web; every entry point in this file short-circuits
// to a no-op when `Platform.OS === 'web'` so the web build does not
// crash at boot. Past incident: `expo-secure-store` was called
// directly in `api-key.ts` and crashed the web build with
// `ExpoSecureStore.default.getValueWithKeyAsync is not a function`.
// We do not want a repeat.
// ═══════════════════════════════════════════════════════════════

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type NotificationPermission = 'granted' | 'denied' | 'undetermined'

export interface NotificationStatus {
  permission: NotificationPermission
  scheduled: boolean
}

interface ReminderSpec {
  /** Stable identifier so we can detect duplicates and re-schedule cleanly. */
  identifier: string
  hour: number
  minute: number
  title: string
  body: string
}

// ─────────────────────────────────────────────
// Reminder definitions
// ─────────────────────────────────────────────

const REMINDERS: readonly ReminderSpec[] = [
  {
    identifier: 'healthos.reminder.weigh-in',
    hour: 8,
    minute: 0,
    title: 'Morning weigh-in',
    body: "Time for today's weigh-in 💪",
  },
  {
    identifier: 'healthos.reminder.workout',
    hour: 17,
    minute: 0,
    title: 'Workout time',
    body: 'Workout time — your plan is ready in the app',
  },
  {
    identifier: 'healthos.reminder.water',
    hour: 14,
    minute: 0,
    title: 'Hydration check',
    body: 'Hydration check — keep your fluids steady ☀️',
  },
] as const

const isWeb = Platform.OS === 'web'

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Asks the OS for permission to display local notifications. Returns
 * true if the user granted permission (or if permission was already
 * granted in a previous session). Always returns false on web.
 */
export async function requestPermissions(): Promise<boolean> {
  if (isWeb) return false

  const existing = await Notifications.getPermissionsAsync()
  if (existing.status === 'granted') return true

  // Don't re-prompt the user if they've already explicitly denied —
  // the system will simply return the cached "denied" status without
  // showing a dialog, but we still surface that result to the caller.
  const next = await Notifications.requestPermissionsAsync()
  return next.status === 'granted'
}

/**
 * Cancels every previously scheduled HealthOS reminder and re-schedules
 * the canonical set. Safe to call on every boot — the cancel-then-schedule
 * pattern keeps us free of duplicates if the reminder list ever changes.
 */
export async function scheduleAllReminders(): Promise<void> {
  if (isWeb) return

  // Wipe the slate first so we never end up with duplicate fires after
  // an app update that changed the schedule.
  await Notifications.cancelAllScheduledNotificationsAsync()

  for (const reminder of REMINDERS) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.identifier,
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: reminder.hour,
        minute: reminder.minute,
        repeats: true,
      },
    })
  }
}

/**
 * Cancels every scheduled notification owned by HealthOS. Web is a no-op.
 */
export async function cancelAllReminders(): Promise<void> {
  if (isWeb) return
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Returns the current permission grant + whether any of our reminders
 * are currently scheduled with the OS. Used by the settings hook to
 * decide whether the toggle should appear "on" after a fresh launch.
 */
export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (isWeb) {
    return { permission: 'denied', scheduled: false }
  }

  const permResult = await Notifications.getPermissionsAsync()
  const permission: NotificationPermission =
    permResult.status === 'granted'
      ? 'granted'
      : permResult.status === 'denied'
      ? 'denied'
      : 'undetermined'

  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const ours = scheduled.some((s) =>
    REMINDERS.some((r) => r.identifier === s.identifier),
  )

  return { permission, scheduled: ours }
}
