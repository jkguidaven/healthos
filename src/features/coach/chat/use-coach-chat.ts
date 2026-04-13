/**
 * src/features/coach/chat/use-coach-chat.ts
 *
 * Conversational coach hook. Loads chat history from SQLite on mount,
 * sends new messages through `sendCoachMessage` (which handles the
 * Gemini tool-calling loop), and persists both turns.
 *
 * Sliding window: only the last SLIDING_WINDOW turns are sent to Gemini.
 * The full history stays on-screen so the user can scroll back.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { useSQLiteContext } from 'expo-sqlite'

import * as schema from '@db/schema'
import {
  clearCoachMessages,
  getCoachMessages,
  getRecentCoachMessages,
  insertCoachMessage,
} from '@db/queries/coach-messages'
import { sendCoachMessage } from '@/lib/ai/prompts/coach-chat'
import { APIKeyInvalidError, APIKeyMissingError } from '@/lib/ai/types'
import { useApiKey } from '@/lib/ai/use-api-key'
import { useProfileStore } from '@/stores/profile-store'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  createdAt: string
}

const SLIDING_WINDOW = 10

export interface UseCoachChatReturn {
  messages: ChatMessage[]
  loading: boolean
  sending: boolean
  error: Error | null
  needsProfile: boolean
  send: (text: string) => Promise<void>
  clear: () => Promise<void>
}

export function useCoachChat(): UseCoachChatReturn {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])
  const profileId = useProfileStore((s) => s.profile?.id ?? null)
  const { markInvalid: markApiKeyInvalid } = useApiKey()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [sending, setSending] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const handleError = useCallback(
    (e: Error): void => {
      if (e instanceof APIKeyInvalidError) markApiKeyInvalid()
      if (!(e instanceof APIKeyMissingError)) setError(e)
    },
    [markApiKeyInvalid],
  )

  useEffect(() => {
    if (profileId === null) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      try {
        const rows = await getCoachMessages(db, profileId)
        if (cancelled) return
        setMessages(
          rows.map((r) => ({
            id: r.id,
            role: r.role,
            text: r.content,
            createdAt: r.createdAt,
          })),
        )
      } catch (e) {
        if (cancelled) return
        handleError(e instanceof Error ? e : new Error('Failed to load chat'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [db, profileId, handleError])

  const send = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim()
      if (!trimmed || profileId === null || sending) return
      setError(null)
      setSending(true)

      // Optimistic insert of the user message
      const userRow = await insertCoachMessage(db, {
        profileId,
        role: 'user',
        content: trimmed,
      })
      const userMsg: ChatMessage = {
        id: userRow.id,
        role: 'user',
        text: trimmed,
        createdAt: userRow.createdAt,
      }
      setMessages((prev) => [...prev, userMsg])

      try {
        const recent = await getRecentCoachMessages(
          db,
          profileId,
          SLIDING_WINDOW,
        )
        // Exclude the just-inserted user row — sendCoachMessage appends it itself.
        const history = recent
          .filter((r) => r.id !== userRow.id)
          .map((r) => ({ role: r.role, text: r.content }))

        const replyText = await sendCoachMessage({
          db,
          profileId,
          history,
          userMessage: trimmed,
        })

        const assistantRow = await insertCoachMessage(db, {
          profileId,
          role: 'assistant',
          content: replyText,
        })
        setMessages((prev) => [
          ...prev,
          {
            id: assistantRow.id,
            role: 'assistant',
            text: replyText,
            createdAt: assistantRow.createdAt,
          },
        ])
      } catch (e) {
        handleError(e instanceof Error ? e : new Error('Coach reply failed'))
      } finally {
        setSending(false)
      }
    },
    [db, profileId, sending, handleError],
  )

  const clear = useCallback(async (): Promise<void> => {
    if (profileId === null) return
    await clearCoachMessages(db, profileId)
    setMessages([])
    setError(null)
  }, [db, profileId])

  return {
    messages,
    loading,
    sending,
    error,
    needsProfile: profileId === null,
    send,
    clear,
  }
}
