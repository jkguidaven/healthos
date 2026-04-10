/**
 * src/features/settings/use-notifications.ts
 *
 * Feature hook that powers the Notifications row in the Settings
 * overlay. Handles the full lifecycle of the local daily reminders:
 *
 *   - On mount: reads the OS permission + scheduled status and
 *     reconciles the in-memory Zustand flag so the toggle reflects
 *     reality after a cold launch.
 *   - `toggleEnabled(true)`: requests permission if needed, schedules
 *     all reminders, and persists the on state.
 *   - `toggleEnabled(false)`: cancels every scheduled reminder and
 *     persists the off state.
 *
 * Plain async — NOT react-query. Other settings rows follow the same
 * pattern (`use-api-key.ts`).
 *
 * Web is gracefully unsupported: every entry into the wrapper module
 * short-circuits to a no-op, so calling `toggleEnabled` on web simply
 * leaves the toggle off and never crashes.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelAllReminders,
  getNotificationStatus,
  notificationsSupported,
  requestPermissions,
  scheduleAllReminders,
} from '@/lib/notifications/notifications'
import { useNotificationsStore } from '@/stores/notifications-store'

export interface UseNotificationsResult {
  enabled: boolean
  loading: boolean
  /**
   * False on web and inside Expo Go (where `expo-notifications` is
   * unavailable). The settings UI should disable the toggle and
   * surface an explanation when this is false.
   */
  supported: boolean
  toggleEnabled: (value: boolean) => Promise<void>
}

export function useNotifications(): UseNotificationsResult {
  const enabled = useNotificationsStore((state) => state.enabled)
  const setEnabled = useNotificationsStore((state) => state.setEnabled)
  // Memoise so the value is stable across renders even though the
  // underlying check is a synchronous platform read.
  const supported = useMemo(() => notificationsSupported(), [])
  const [loading, setLoading] = useState<boolean>(supported)

  // Hydrate the toggle on first mount by asking the OS what is
  // currently scheduled. This keeps the UI honest after the system
  // (or the user, in their device settings) clears notifications
  // outside the app. Skipped entirely on unsupported runtimes.
  useEffect(() => {
    if (!supported) {
      setEnabled(false)
      setLoading(false)
      return
    }
    let cancelled = false
    void (async (): Promise<void> => {
      try {
        const status = await getNotificationStatus()
        if (cancelled) return
        const isOn = status.permission === 'granted' && status.scheduled
        setEnabled(isOn)
      } catch (e) {
        console.warn('[useNotifications] hydrate failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [setEnabled, supported])

  const toggleEnabled = useCallback(
    async (value: boolean): Promise<void> => {
      if (!supported) {
        // Unsupported runtime — keep the toggle off and don't try to
        // load the native module. The settings UI should already be
        // disabling the switch in this state.
        setEnabled(false)
        return
      }
      setLoading(true)
      try {
        if (value) {
          const granted = await requestPermissions()
          if (!granted) {
            // Permission denied — leave the switch off so the UI
            // never lies about what the OS will actually deliver.
            setEnabled(false)
            return
          }
          await scheduleAllReminders()
          setEnabled(true)
        } else {
          await cancelAllReminders()
          setEnabled(false)
        }
      } catch (e) {
        console.warn('[useNotifications] toggle failed:', e)
        setEnabled(false)
      } finally {
        setLoading(false)
      }
    },
    [setEnabled, supported],
  )

  return { enabled, loading, supported, toggleEnabled }
}
