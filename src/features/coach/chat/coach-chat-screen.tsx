/**
 * src/features/coach/chat/coach-chat-screen.tsx
 *
 * Conversational coach screen. Mint-tinted, rounded chat bubbles,
 * Poppins typography, soft atmosphere. Follows the HealthOS design
 * system — generous whitespace, rounded-3xl assistant cards, mint-500
 * primary send button.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { ApiKeyBanner } from '@components/ui/api-key-banner'
import { useCoachChat, type ChatMessage } from './use-coach-chat'

export function CoachChatScreen(): React.ReactElement {
  const { messages, loading, sending, error, needsProfile, send, clear } =
    useCoachChat()
  const [draft, setDraft] = useState<string>('')
  const scrollRef = useRef<ScrollView>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, sending, scrollToBottom])

  const handleSend = useCallback(async (): Promise<void> => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    await send(text)
  }, [draft, sending, send])

  return (
    <View className="flex-1 bg-mint-50">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Decorative blurred circle */}
        <View
          pointerEvents="none"
          className="absolute -top-16 -right-20 h-72 w-72 rounded-full bg-white/60"
          style={{ opacity: 0.5 }}
        />

        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full bg-white/80 active:opacity-70"
          >
            <Ionicons name="chevron-back" size={20} color="#0f172a" />
          </Pressable>
          <View className="items-center">
            <Text
              className="font-sans-bold text-[17px] text-slate-900"
              style={{ letterSpacing: -0.3 }}
            >
              Coach chat
            </Text>
            <Text className="font-sans text-[11px] text-mint-700">
              Powered by your data
            </Text>
          </View>
          <Pressable
            onPress={() => void clear()}
            hitSlop={10}
            disabled={messages.length === 0 || sending}
            accessibilityRole="button"
            accessibilityLabel="Start new chat"
            className={`h-10 w-10 items-center justify-center rounded-full bg-white/80 ${
              messages.length === 0 || sending ? 'opacity-40' : 'active:opacity-70'
            }`}
          >
            <Ionicons name="refresh" size={18} color="#0f172a" />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
          className="flex-1"
        >
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 16,
            }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
          >
            <View className="mb-3">
              <ApiKeyBanner />
            </View>

            {needsProfile ? (
              <EmptyState
                title="Finish onboarding to chat with your coach"
                body="Once your profile is set up, your coach can answer questions using your actual data."
              />
            ) : loading ? (
              <View className="mt-16 items-center">
                <ActivityIndicator color="#1D9E75" />
              </View>
            ) : messages.length === 0 ? (
              <WelcomeState />
            ) : (
              <View className="gap-3">
                {messages.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}
                {sending ? <TypingBubble /> : null}
              </View>
            )}

            {error ? (
              <View className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                <Text className="font-sans-semibold text-[13px] text-brand-coral">
                  Something went wrong
                </Text>
                <Text
                  className="mt-1 font-sans text-[12px] text-slate-600"
                  style={{ lineHeight: 18 }}
                >
                  {error.message}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Composer */}
          <View className="border-t border-white/60 bg-white/70 px-4 pb-3 pt-3">
            <View className="flex-row items-end gap-2">
              <View className="flex-1 rounded-3xl border border-mint-200 bg-white px-4 py-3">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Ask about your training, nutrition, progress…"
                  placeholderTextColor="#94a3b8"
                  multiline
                  editable={!needsProfile}
                  className="max-h-32 font-sans text-[15px] text-slate-900"
                  style={{ minHeight: 22, lineHeight: 20 }}
                />
              </View>
              <Pressable
                onPress={() => void handleSend()}
                disabled={!draft.trim() || sending || needsProfile}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                className={`h-12 w-12 items-center justify-center rounded-full ${
                  !draft.trim() || sending || needsProfile
                    ? 'bg-mint-200'
                    : 'bg-mint-500 active:opacity-80'
                }`}
                style={{
                  shadowColor: '#1D9E75',
                  shadowOpacity: 0.25,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                }}
              >
                {sending ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Ionicons name="arrow-up" size={20} color="#ffffff" />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Bubble
// ─────────────────────────────────────────────

function Bubble({ message }: { message: ChatMessage }): React.ReactElement {
  const isUser = message.role === 'user'
  if (isUser) {
    return (
      <View className="items-end">
        <View
          className="max-w-[82%] rounded-3xl rounded-br-md bg-mint-500 px-4 py-3"
          style={{
            shadowColor: '#1D9E75',
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          <Text
            className="font-sans text-[15px] text-white"
            style={{ lineHeight: 21 }}
          >
            {message.text}
          </Text>
        </View>
      </View>
    )
  }
  return (
    <View className="items-start">
      <View
        className="max-w-[88%] rounded-3xl rounded-bl-md bg-white px-4 py-3"
        style={{
          shadowColor: '#0f172a',
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}
      >
        <Text
          className="font-sans text-[15px] text-slate-800"
          style={{ lineHeight: 22 }}
        >
          {message.text}
        </Text>
      </View>
    </View>
  )
}

function TypingBubble(): React.ReactElement {
  return (
    <View className="items-start">
      <View className="rounded-3xl rounded-bl-md bg-white px-5 py-4">
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color="#1D9E75" size="small" />
          <Text className="font-sans text-[13px] text-slate-500">
            Thinking…
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Empty + welcome states
// ─────────────────────────────────────────────

function WelcomeState(): React.ReactElement {
  const suggestions = [
    'How am I doing this week?',
    'Did I hit my protein goal today?',
    'What should I focus on next?',
  ]
  return (
    <View className="mt-6 items-center">
      <View
        className="h-20 w-20 items-center justify-center rounded-full bg-white"
        style={{
          shadowColor: '#1D9E75',
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        }}
      >
        <Ionicons name="chatbubbles" size={32} color="#1D9E75" />
      </View>
      <Text
        className="mt-5 font-sans-bold text-[22px] text-slate-900"
        style={{ letterSpacing: -0.4 }}
      >
        Ask your coach
      </Text>
      <Text
        className="mt-2 max-w-[280px] text-center font-sans text-[14px] text-slate-500"
        style={{ lineHeight: 20 }}
      >
        Your coach knows your food logs, workouts, and body metrics. Ask
        anything about your progress.
      </Text>
      <View className="mt-6 w-full gap-2">
        {suggestions.map((s) => (
          <View
            key={s}
            className="rounded-2xl border border-white bg-white/70 px-4 py-3"
          >
            <Text className="font-sans-medium text-[13px] text-mint-700">
              {s}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

interface EmptyStateProps {
  title: string
  body: string
}

function EmptyState({ title, body }: EmptyStateProps): React.ReactElement {
  return (
    <View className="mt-16 items-center px-4">
      <Text
        className="text-center font-sans-bold text-[20px] text-slate-900"
        style={{ letterSpacing: -0.3 }}
      >
        {title}
      </Text>
      <Text
        className="mt-2 max-w-[280px] text-center font-sans text-[14px] text-slate-500"
        style={{ lineHeight: 20 }}
      >
        {body}
      </Text>
    </View>
  )
}

export default CoachChatScreen
