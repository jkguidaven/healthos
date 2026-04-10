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

import { useCallback, useEffect, useState } from 'react'
import {
  cancelAllReminders,
  getNotificationStatus,
  requestPermissions,
  scheduleAllReminders,
} from '@/lib/notifications/notifications'
import { useNotificationsStore } from '@/stores/notifications-store'

export interface UseNotificationsResult {
  enabled: boolean
  loading: boolean
  toggleEnabled: (value: boolean) => Promise<void>
}

export function useNotifications(): UseNotificationsResult {
  const enabled = useNotificationsStore((state) => state.enabled)
  const setEnabled = useNotificationsStore((state) => state.setEnabled)
  const [loading, setLoading] = useState<boolean>(true)

  // Hydrate the toggle on first mount by asking the OS what is
  // currently scheduled. This keeps the UI honest after the system
  // (or the user, in their device settings) clears notifications
  // outside the app.
  useEffect(() => {
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
  }, [setEnabled])

  const toggleEnabled = useCallback(
    async (value: boolean): Promise<void> => {
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
    [setEnabled],
  )

  return { enabled, loading, toggleEnabled }
}
