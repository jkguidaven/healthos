import { create } from 'zustand'

interface UIStore {
  hasApiKey: boolean
  setHasApiKey: (value: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  hasApiKey: false,
  setHasApiKey: (value) => set({ hasApiKey: value }),
}))
