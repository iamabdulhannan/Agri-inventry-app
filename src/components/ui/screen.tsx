import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, Inbox, RefreshCw, WifiOff } from 'lucide-react-native'
import { useEffect, type ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { radius, useTheme } from '@/lib/theme'
import { Button, IconBtn, Txt } from './core'

/** Soft glowing blobs behind the header: the app's signature backdrop */
export function Ambient({ height = 320 }: { height?: number }) {
  const { c } = useTheme()
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height, overflow: 'hidden' }]}>
      <LinearGradient
        colors={c.dark ? ['rgba(182,242,74,0.10)', 'rgba(52,211,153,0.05)', 'transparent'] : ['rgba(21,128,61,0.10)', 'rgba(132,204,22,0.05)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ position: 'absolute', top: -120, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: c.dark ? 'rgba(182,242,74,0.08)' : 'rgba(132,204,22,0.12)' }} />
      <View style={{ position: 'absolute', top: -60, left: -110, width: 240, height: 240, borderRadius: 120, backgroundColor: c.dark ? 'rgba(52,211,153,0.07)' : 'rgba(16,185,129,0.08)' }} />
    </View>
  )
}

export function Screen({
  title, subtitle, back, right, children, scroll = true, refreshing, onRefresh, footer, contentStyle, tabInset, headerExtra,
}: {
  title?: string
  subtitle?: string
  back?: boolean
  right?: ReactNode
  children: ReactNode
  scroll?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  footer?: ReactNode
  contentStyle?: StyleProp<ViewStyle>
  /** leave room for the floating tab bar */
  tabInset?: boolean
  headerExtra?: ReactNode
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const header = (!!title || back || !!right) && (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {back && <IconBtn icon={<ArrowLeft size={20} color={c.text} />} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label="back" />}
        <View style={{ flex: 1 }}>
          {!!title && <Txt v={back ? 'h2' : 'h1'} numberOfLines={1}>{title}</Txt>}
          {!!subtitle && <Txt v="small" muted numberOfLines={1}>{subtitle}</Txt>}
        </View>
        {right}
      </View>
      {headerExtra}
    </View>
  )
  const pad: StyleProp<ViewStyle> = [{ paddingHorizontal: 20, paddingBottom: tabInset ? 130 : footer ? 24 : insets.bottom + 32 }, contentStyle]
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient />
      {header}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={pad}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} progressBackgroundColor={c.surface} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, { paddingBottom: 0 }]}>{children}</View>
      )}
      {footer && (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bgAlt }}>
          {footer}
        </View>
      )}
    </View>
  )
}

// ------------------------------------------------------------------ shimmer skeleton
export function Skeleton({ h = 18, w = '100%', r = 10, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const o = useSharedValue(0.4)
  useEffect(() => {
    o.set(withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true))
  }, [o])
  const a = useAnimatedStyle(() => ({ opacity: o.value }))
  return <Animated.View style={[{ height: h, width: w, borderRadius: r, backgroundColor: c.surface3 }, a, style]} />
}

export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ gap: 12, paddingTop: 8 }}>
      <Skeleton h={130} r={radius.xl} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={68} r={radius.lg} style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </View>
  )
}

export function Empty({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20, gap: 12 }}>
      <View style={{ width: 72, height: 72, borderRadius: 26, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }}>
        {icon ?? <Inbox size={30} color={c.muted} />}
      </View>
      <Txt muted align="center">{children}</Txt>
      {action}
    </View>
  )
}

export function ErrorBox({ error, children, onRetry }: { error?: unknown; children?: ReactNode; onRetry?: () => void }) {
  const { c } = useTheme()
  const { t } = useI18n()
  const msg = children ?? errText(error, t)
  const offline = typeof msg === 'string' && /network/i.test(msg)
  return (
    <View style={{ backgroundColor: c.redSoft, borderRadius: radius.md, padding: 14, gap: 10, borderWidth: 1, borderColor: c.red + '40' }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        {offline && <WifiOff size={18} color={c.red} />}
        <Txt v="small" weight="semibold" color={c.red} style={{ flex: 1 }}>{msg}</Txt>
      </View>
      {onRetry && <Button size="sm" variant="secondary" title={t('retry')} icon={<RefreshCw size={15} color={c.text} />} onPress={onRetry} style={{ alignSelf: 'flex-start' }} />}
    </View>
  )
}
