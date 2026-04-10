import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="food" options={{ title: 'Food' }} />
      <Tabs.Screen name="workout" options={{ title: 'Workout' }} />
      <Tabs.Screen name="body" options={{ title: 'Body' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
    </Tabs>
  )
}
