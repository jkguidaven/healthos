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
    </Stack>
  )
}
