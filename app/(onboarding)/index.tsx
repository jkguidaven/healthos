import { View, Text } from 'react-native'

export default function WelcomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-medium text-zinc-900">HealthOS</Text>
      <Text className="text-sm text-zinc-500 mt-2">Welcome — setup coming soon</Text>
    </View>
  )
}
