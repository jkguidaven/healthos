import { create } from 'zustand'

interface Profile {
  id: number
  age: number
  sex: 'male' | 'female'
  heightCm: number
  weightKg: number
  units: 'metric' | 'imperial'
  goal: 'recomposition' | 'bulk' | 'cut'
  activityLevel: number
  goalCalories: number
  goalProteinG: number
  goalCarbsG: number
  goalFatG: number
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
}

interface ProfileStore {
  profile: Profile | null
  setProfile: (profile: Profile) => void
  clearProfile: () => void
}

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clearProfile: () => set({ profile: null }),
}))
