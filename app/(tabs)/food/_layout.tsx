import { Stack } from 'expo-router'

export default function FoodLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="scan"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
        }}
      />
      <Stack.Screen
        name="manual"
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="confirm"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="water"
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  )
}
