// ═══════════════════════════════════════════════════════════════
// src/stores/notifications-store.ts
// ─────────────────────────────────────────────────────────────
// Tiny Zustand slice that mirrors whether the user has opted in to
// local daily reminders. The actual scheduling lives in
// `src/lib/notifications/notifications.ts`; this store only tracks
// the user-facing on/off state so the settings toggle can read it
// synchronously.
//
// Persistence: deferred. v1 keeps state in memory and re-syncs with
// the OS schedule on boot via `getNotificationStatus()`. If we find
// a real need to remember the toggle across cold launches before the
// OS settles, we'll wire AsyncStorage / localStorage here.
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand'

interface NotificationsStore {
  /** True when the user has the daily reminder toggle switched on. */
  enabled: boolean
  setEnabled: (value: boolean) => void
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  enabled: false,
  setEnabled: (value) => set({ enabled: value }),
}))
