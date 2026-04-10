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
// Runtime support:
//   - iOS device build / iOS simulator (with Apple ID): full support
//   - Android device / emulator (development build): full support
//   - Web: hard no-op, expo-notifications doesn't ship a web impl
//   - Expo Go (any platform): hard no-op. Expo Go dropped Android push
//     in SDK 53 and prints a loud warning at module-load time if you
//     even *import* expo-notifications. We avoid the warning by lazy-
//     requiring the module only inside functions, and by short-
//     circuiting before that lazy require ever fires when running in
//     Expo Go.
//
// Past incident: `expo-secure-store` was called directly in
// `api-key.ts` and crashed the web build at boot with
// `ExpoSecureStore.default.getValueWithKeyAsync is not a function`.
// Treating Expo Go the same way (boot-safe no-op) keeps us out of
// the same trap for `expo-notifications`.
// ═══════════════════════════════════════════════════════════════

import { Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

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

// ─────────────────────────────────────────────
// Runtime detection
// ─────────────────────────────────────────────

const isWeb = Platform.OS === 'web'

/**
 * True when the app is running inside the Expo Go store client (as
 * opposed to a development build or a standalone build). Expo Go on
 * SDK 53+ no longer ships the native modules required for
 * `expo-notifications` and even *importing* the package produces a
 * loud runtime warning, so we treat Expo Go the same as web here.
 */
const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient

const isUnsupported = isWeb || isExpoGo

// ─────────────────────────────────────────────
// Lazy expo-notifications loader
//
// Importing the module statically triggers its init at app boot,
// which (on Expo Go) prints a hard warning even if every function
// is gated behind isUnsupported. We side-step that by requiring it
// only inside functions, after the unsupported check has fired.
// ─────────────────────────────────────────────

type ExpoNotificationsModule = typeof import('expo-notifications')

let cachedModule: ExpoNotificationsModule | null = null

function loadNotifications(): ExpoNotificationsModule {
  if (cachedModule != null) return cachedModule
  // require() rather than dynamic import() so we stay synchronous —
  // dynamic import in Hermes returns a Promise and would force every
  // public function below to await an extra tick.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cachedModule = require('expo-notifications') as ExpoNotificationsModule
  return cachedModule
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Asks the OS for permission to display local notifications. Returns
 * true if the user granted permission (or if permission was already
 * granted in a previous session). Always returns false on web or
 * inside Expo Go (where the API is unavailable).
 */
export async function requestPermissions(): Promise<boolean> {
  if (isUnsupported) return false

  const Notifications = loadNotifications()
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
  if (isUnsupported) return

  const Notifications = loadNotifications()

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
 * Cancels every scheduled notification owned by HealthOS. Web /
 * Expo Go are no-ops.
 */
export async function cancelAllReminders(): Promise<void> {
  if (isUnsupported) return
  const Notifications = loadNotifications()
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Returns the current permission grant + whether any of our reminders
 * are currently scheduled with the OS. Used by the settings hook to
 * decide whether the toggle should appear "on" after a fresh launch.
 *
 * On web or Expo Go this always reports `'denied'` + `false` so the
 * settings UI can render a sensible "Notifications unavailable in
 * this environment" state instead of getting stuck.
 */
export async function getNotificationStatus(): Promise<NotificationStatus> {
  if (isUnsupported) {
    return { permission: 'denied', scheduled: false }
  }

  const Notifications = loadNotifications()

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

/**
 * Whether local notifications are usable in the current runtime.
 * The settings UI can read this to disable the toggle and show a
 * helpful explanation when the user is in Expo Go or on web.
 */
export function notificationsSupported(): boolean {
  return !isUnsupported
}
