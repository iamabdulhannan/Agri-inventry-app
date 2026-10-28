import '@/lib/supabase'
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Splash } from '@/components/Splash'
import { FeedbackProvider } from '@/components/ui'
import { AppProvider, useApp } from '@/lib/app'
import { I18nProvider } from '@/lib/i18n'
import { ThemeProvider, useTheme } from '@/lib/theme'

SplashScreen.preventAutoHideAsync().catch(() => {})
// not supported inside Expo Go (only in real builds)
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) SplashScreen.setOptions({ fade: true, duration: 200 })

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  })
  // keep the native splash until fonts are in (the animated splash uses them)
  if (!fontsLoaded && !fontError) return null
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#030A06' }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AppProvider>
              <FeedbackProvider>
                <Root />
              </FeedbackProvider>
            </AppProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function Root() {
  const { c } = useTheme()
  const { ready, session, org } = useApp()
  const [splash, setSplash] = useState(true)

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.bg).catch(() => {})
  }, [c.bg])

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={splash || c.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !org}>
          <Stack.Screen name="no-org" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !!org}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
      {splash && <Splash ready={ready} onDone={() => setSplash(false)} />}
    </View>
  )
}
