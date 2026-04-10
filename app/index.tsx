import { Redirect } from 'expo-router'
import { useUIStore } from '../src/stores/ui-store'

export default function Index() {
  const hasApiKey = useUIStore((s) => s.hasApiKey)

  // TODO: Phase 1 — also check profile row existence from DB via the profile
  // query layer. Spec rule is: "no profile OR !hasApiKey → onboarding".
  // Profile queries don't exist yet, so we only check hasApiKey for now.
  if (!hasApiKey) {
    return <Redirect href="/(onboarding)" />
  }

  return <Redirect href="/(tabs)" />
}
