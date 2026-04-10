import '../global.css'
import { Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import { hydrateApiKeyStatus } from '../src/lib/ai/api-key'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 },
    mutations: { retry: 0 },
  },
})

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function boot() {
      try {
        await hydrateApiKeyStatus()
      } catch (e) {
        console.warn('Boot error:', e)
      } finally {
        setReady(true)
        await SplashScreen.hideAsync()
      }
    }
    boot()
  }, [])

  if (!ready) return null

  return (
    <SQLiteProvider databaseName="healthos.db">
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SQLiteProvider>
  )
}
