// ═══════════════════════════════════════════════════════════════
// src/lib/ai/api-key.ts
// ─────────────────────────────────────────────────────────────
// All SecureStore operations for the API key.
// This is the ONLY file that reads or writes the API key.
// ═══════════════════════════════════════════════════════════════

import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { useUIStore } from '../../stores/ui-store'

const SECURE_KEY = 'anthropic_api_key'
const TEST_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-6'

// expo-secure-store is not supported on web (it uses iOS Keychain / Android
// Keystore). On web we fall back to localStorage so the dev experience works,
// but production builds target iOS/Android where the secure enclave is used.
const isWeb = Platform.OS === 'web'

async function readKey(): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(SECURE_KEY) ?? null
  return SecureStore.getItemAsync(SECURE_KEY)
}

async function writeKey(value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(SECURE_KEY, value)
    return
  }
  await SecureStore.setItemAsync(SECURE_KEY, value)
}

async function deleteKey(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(SECURE_KEY)
    return
  }
  await SecureStore.deleteItemAsync(SECURE_KEY)
}

export async function getApiKey(): Promise<string | null> {
  return readKey()
}

export async function saveApiKey(key: string): Promise<void> {
  await writeKey(key)
  useUIStore.getState().setHasApiKey(true)
}

export async function clearApiKey(): Promise<void> {
  await deleteKey()
  useUIStore.getState().setHasApiKey(false)
}

export async function hydrateApiKeyStatus(): Promise<void> {
  const key = await readKey()
  useUIStore.getState().setHasApiKey(!!key)
}

export interface ValidationResult {
  valid: boolean
  error?: 'invalid_key' | 'network_error' | 'rate_limit'
}

export async function validateApiKey(key: string): Promise<ValidationResult> {
  try {
    const response = await fetch(TEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })

    if (response.status === 401) return { valid: false, error: 'invalid_key' }
    if (response.status === 429) return { valid: false, error: 'rate_limit' }
    // 400 = request shape rejected but the key itself was accepted by auth
    if (response.ok || response.status === 400) return { valid: true }
    return { valid: false, error: 'network_error' }
  } catch {
    return { valid: false, error: 'network_error' }
  }
}
