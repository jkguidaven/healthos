import '../global.css'
import { Stack } from 'expo-router'
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins'
import migration0000 from '../src/lib/db/migrations/0000_handy_lucky_pierre.sql'
import { hydrateApiKeyStatus } from '../src/lib/ai/api-key'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 },
    mutations: { retry: 0 },
  },
})

/**
 * Inner component that runs SQLite migrations against the SQLiteProvider db.
 *
 * Note: drizzle-orm@0.45.2's expo-sqlite migrator generates `SERIAL PRIMARY KEY`
 * (postgres syntax) for the `__drizzle_migrations` bookkeeping table, which is
 * invalid SQLite. Until that's fixed upstream we run a tiny custom migrator that
 * tracks applied migrations in our own `_migrations` table and executes the SQL
 * via expo-sqlite's `execAsync` directly.
 */
async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Bookkeeping table — tracks which migration files have already been applied
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      tag TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)

  const APPLIED: readonly { tag: string; sql: string }[] = [
    { tag: '0000_handy_lucky_pierre', sql: migration0000 },
  ]

  for (const m of APPLIED) {
    const row = await db.getFirstAsync<{ tag: string }>(
      'SELECT tag FROM _migrations WHERE tag = ?',
      m.tag,
    )
    if (row) continue

    // execAsync handles multiple statements separated by `;` and `--> statement-breakpoint`
    const cleaned = m.sql.replace(/--> statement-breakpoint/g, '')
    await db.execAsync(cleaned)
    await db.runAsync('INSERT INTO _migrations (tag, applied_at) VALUES (?, ?)', m.tag, Date.now())
  }
}

function MigrationGate({ children }: { children: React.ReactNode }) {
  const sqlite = useSQLiteContext()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    runMigrations(sqlite)
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
  }, [sqlite])

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-mint-50 px-6">
        <Text className="font-sans-bold text-[18px] text-slate-900 mb-2">
          Database setup failed
        </Text>
        <Text className="font-sans text-[13px] text-slate-600 text-center">
          {error.message}
        </Text>
      </View>
    )
  }

  if (!ready) return null

  return <>{children}</>
}

export default function RootLayout() {
  const [bootReady, setBootReady] = useState(false)

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  })

  useEffect(() => {
    async function boot() {
      try {
        await hydrateApiKeyStatus()
      } catch (e) {
        console.warn('Boot error:', e)
      } finally {
        setBootReady(true)
      }
    }
    boot()
  }, [])

  useEffect(() => {
    if (bootReady && fontsLoaded) {
      SplashScreen.hideAsync()
    }
  }, [bootReady, fontsLoaded])

  if (!bootReady || !fontsLoaded) return null

  return (
    <SQLiteProvider databaseName="healthos.db">
      <MigrationGate>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </MigrationGate>
    </SQLiteProvider>
  )
}
