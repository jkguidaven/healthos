import { create } from 'zustand'

interface UIStore {
  /** True when an API key is present in SecureStore. Hydrated at boot. */
  hasApiKey: boolean
  setHasApiKey: (value: boolean) => void

  /**
   * True when the most recent AI call failed with an authentication
   * error (401/403 or a 400 with an "API key" message). Set by the
   * call sites that catch APIKeyInvalidError and cleared when the user
   * saves a new key in Settings. Drives the inline "API key was
   * rejected" banner across all AI surfaces.
   */
  apiKeyInvalid: boolean
  setApiKeyInvalid: (value: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  hasApiKey: false,
  setHasApiKey: (value) =>
    // Saving / removing a key always clears the "invalid" flag — the
    // user has explicitly resolved the previous error.
    set({ hasApiKey: value, apiKeyInvalid: false }),

  apiKeyInvalid: false,
  setApiKeyInvalid: (value) => set({ apiKeyInvalid: value }),
}))
