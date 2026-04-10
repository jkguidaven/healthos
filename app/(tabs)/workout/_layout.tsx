import { Stack } from 'expo-router'

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="generate"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="session"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
    </Stack>
  )
}
