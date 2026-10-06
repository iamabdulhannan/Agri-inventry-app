import { Stack } from 'expo-router'
import { useTheme } from '@/lib/theme'

export default function AppLayout() {
  const { c } = useTheme()
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="sale" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="stock-in" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="receipt/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  )
}
