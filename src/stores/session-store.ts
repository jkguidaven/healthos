import { create } from 'zustand'

interface ActiveSession {
  sessionId: number
  planId: number
  dayId: number
  dayName: string
  startedAt: string
  completedSets: number
  totalSets: number
}

interface SessionStore {
  activeSession: ActiveSession | null
  startSession: (session: ActiveSession) => void
  updateCompletedSets: (count: number) => void
  endSession: () => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  activeSession: null,
  startSession: (session) => set({ activeSession: session }),
  updateCompletedSets: (count) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, completedSets: count }
        : null,
    })),
  endSession: () => set({ activeSession: null }),
}))
