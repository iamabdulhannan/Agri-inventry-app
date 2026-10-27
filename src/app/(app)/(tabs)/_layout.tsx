import { BlurView } from 'expo-blur'
import { router } from 'expo-router'
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs'
import { LinearGradient } from 'expo-linear-gradient'
import { BookUser, House, LayoutGrid, Package, ScanBarcode } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { haptic, PressScale, Txt } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { softShadow, useLayout } from '@/lib/responsive'
import { useTheme } from '@/lib/theme'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, animation: 'shift' }} tabBar={(p) => <TabBar {...p} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="products" />
      <Tabs.Screen name="khata" />
      <Tabs.Screen name="more" />
    </Tabs>
  )
}

const ICONS = { index: House, products: Package, khata: BookUser, more: LayoutGrid } as const

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const [w, setW] = useState(0)
  const labels: Record<string, string> = { index: t('tabHome'), products: t('navProducts'), khata: t('navKhata'), more: t('tabMore') }
  // 5 slots: 2 tabs, the sell button, 2 tabs
  const slot = w / 5
  const slotOf = (i: number) => (i < 2 ? i : i + 1)
  const { width, isTablet } = useLayout()
  // native-driver spring: always lands on the selected tab
  const [x] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.spring(x, { toValue: slotOf(state.index) * slot, useNativeDriver: true, damping: 16, stiffness: 180, mass: 1 }).start()
  }, [state.index, slot, x])

  const tab = (route: (typeof state.routes)[number], i: number) => {
    const focused = state.index === i
    const Icon = ICONS[route.name as keyof typeof ICONS] ?? House
    return (
      <Pressable
        key={route.key}
        onPress={() => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !e.defaultPrevented) {
            haptic.tap()
            navigation.navigate(route.name)
          }
        }}
        style={styles.tab}
      >
        <Icon size={22} color={focused ? c.primary : c.muted} strokeWidth={focused ? 2.4 : 2} />
        <Txt v="tiny" color={focused ? c.text : c.muted} numberOfLines={1} style={{ marginTop: 3, fontSize: 10.5 }}>{labels[route.name]}</Txt>
      </Pressable>
    )
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }, isTablet && { left: (width - 520) / 2, right: (width - 520) / 2 }]}
    >
      <View style={[styles.bar, { borderColor: c.borderStrong }, softShadow(c.dark ? '#000' : c.shadow, 0.3, 20, 8)]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={60} tint={c.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'ios' ? c.tabBar : c.dark ? '#0E2016' : '#FFFFFF' }]} />
        {w > 0 && (
          <Animated.View style={[styles.indicatorSlot, { width: slot, transform: [{ translateX: x }] }]}>
            <View style={[styles.indicator, { backgroundColor: c.primarySoft }]} />
          </Animated.View>
        )}
        {state.routes.slice(0, 2).map((r, i) => tab(r, i))}
        <View style={styles.tab} />
        {state.routes.slice(2).map((r, i) => tab(r, i + 2))}
      </View>

      {/* center sell button */}
      <View pointerEvents="box-none" style={styles.fabWrap}>
        {/* crisp ring that cuts the button out of the bar */}
        <View style={[styles.ring, { backgroundColor: c.bg, borderColor: c.borderStrong }]} />
        <PressScale onPress={() => { haptic.medium(); router.push('/sale') }} hapticOnPress={false} scaleTo={0.92} style={[styles.fab, softShadow(c.primary, 0.45, 14, 4)]}>
          <LinearGradient colors={c.dark ? ['#E1FF7A', '#9BE22F'] : ['#22C55E', '#15803D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
            <ScanBarcode size={26} color={c.primaryText} strokeWidth={2.4} />
          </LinearGradient>
        </PressScale>
        <Txt v="tiny" weight="extrabold" color={c.text} style={{ marginTop: 4, fontSize: 10.5 }}>{t('tabSell')}</Txt>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  bar: {
    flexDirection: 'row', height: 68, borderRadius: 26, overflow: 'hidden', borderWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  indicatorSlot: { position: 'absolute', top: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  indicator: { width: 58, height: 52, borderRadius: 18 },
  fabWrap: { position: 'absolute', left: 0, right: 0, top: -26, alignItems: 'center' },
  fab: { width: 64, height: 64, borderRadius: 24 },
  fabInner: { flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  ring: { position: 'absolute', top: -6, width: 76, height: 76, borderRadius: 29, borderWidth: 1 },
})
