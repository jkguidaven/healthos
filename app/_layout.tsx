import '../global.css'
import { Stack } from 'expo-router'
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins'
import migration0000 from '../src/lib/db/migrations/0000_handy_lucky_pierre.sql'
import migration0001 from '../src/lib/db/migrations/0001_military_garia.sql'
import { hydrateApiKeyStatus } from '../src/lib/ai/api-key'
import {
  notificationsSupported,
  scheduleAllReminders,
} from '../src/lib/notifications/notifications'
import { useNotificationsStore } from '../src/stores/notifications-store'

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
    { tag: '0001_military_garia', sql: migration0001 },
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

/**
 * Re-syncs the local notification schedule with the user's saved
 * `enabled` flag on every boot. The OS can clear scheduled
 * notifications across reboots/updates, so we re-arm them here if
 * the user previously opted in.
 *
 * Skips entirely on unsupported runtimes (web, Expo Go) — the
 * notifications module's own no-ops would handle it safely, but
 * short-circuiting here means we don't even touch the lazy require()
 * inside the wrapper, which avoids any startup overhead.
 */
function NotificationsBootSync(): null {
  const enabled = useNotificationsStore((state) => state.enabled)

  useEffect(() => {
    if (!notificationsSupported()) return
    if (!enabled) return
    scheduleAllReminders().catch((e) => {
      console.warn('[NotificationsBootSync] reschedule failed:', e)
    })
  }, [enabled])

  return null
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
      <View className="flex-1 items-center justify-center bg-white px-6">
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

/**
 * Web fallback shown when the page is NOT in a cross-origin-isolated
 * context. expo-sqlite's web build (wa-sqlite) requires SharedArrayBuffer,
 * which is only available when the dev server sends COOP + COEP headers.
 * Some Metro/proxy setups silently drop those headers, so instead of
 * crashing the app we render a friendly mobile-only message.
 */
function WebUnsupportedFallback(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <View className="w-full max-w-md items-center rounded-3xl border border-slate-100 bg-white p-8">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-100">
          <Text className="text-[28px]">📱</Text>
        </View>
        <Text
          className="mt-5 text-center font-sans-bold text-[22px] text-slate-900"
          style={{ letterSpacing: -0.3 }}
        >
          Open HealthOS on your phone
        </Text>
        <Text
          className="mt-3 text-center font-sans text-[14px] text-slate-600"
          style={{ lineHeight: 20 }}
        >
          The web preview can&apos;t access the device database. Run{' '}
          <Text className="font-sans-semibold">pnpm ios</Text> or{' '}
          <Text className="font-sans-semibold">pnpm android</Text> for the
          full experience.
        </Text>
        <Text className="mt-4 text-center font-sans text-[11px] text-slate-400">
          (SharedArrayBuffer is unavailable — your browser is not in a
          cross-origin-isolated context.)
        </Text>
      </View>
    </View>
  )
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

  // expo-sqlite's web build (wa-sqlite) requires SharedArrayBuffer, which
  // is only available when the page is cross-origin isolated (COOP + COEP
  // headers). On web we check this up-front and render a friendly fallback
  // instead of crashing inside the SQLiteProvider on the first read.
  if (Platform.OS === 'web' && !isWebSqliteAvailable()) {
    return <WebUnsupportedFallback />
  }

  return (
    <SQLiteProvider databaseName="healthos.db">
      <MigrationGate>
        <QueryClientProvider client={queryClient}>
          <NotificationsBootSync />
          <Stack screenOptions={{ headerShown: false }} />
        </QueryClientProvider>
      </MigrationGate>
    </SQLiteProvider>
  )
}

/**
 * Best-effort check for whether wa-sqlite can run in this browser.
 * SharedArrayBuffer is only defined in cross-origin-isolated contexts.
 */
function isWebSqliteAvailable(): boolean {
  if (typeof globalThis === 'undefined') return false
  // crossOriginIsolated is the canonical signal — true only when the
  // page was served with COOP: same-origin + COEP: require-corp.
  const coi = (globalThis as { crossOriginIsolated?: boolean })
    .crossOriginIsolated
  if (coi === false) return false
  // Belt-and-braces: SharedArrayBuffer must actually exist.
  return typeof (globalThis as { SharedArrayBuffer?: unknown })
    .SharedArrayBuffer !== 'undefined'
}
