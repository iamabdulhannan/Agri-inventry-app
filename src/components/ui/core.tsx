import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
  type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { useI18n } from '@/lib/i18n'
import { fonts, radius, toneColors, useTheme, type Tone } from '@/lib/theme'

export const haptic = {
  tap: () => Haptics.selectionAsync().catch(() => {}),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
}

// ------------------------------------------------------------------ text
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'label'
const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontSize: 34, lineHeight: 40, fontFamily: fonts.extrabold, letterSpacing: -1 },
  h1: { fontSize: 26, lineHeight: 32, fontFamily: fonts.extrabold, letterSpacing: -0.6 },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: fonts.bold, letterSpacing: -0.3 },
  h3: { fontSize: 16, lineHeight: 22, fontFamily: fonts.bold },
  body: { fontSize: 15, lineHeight: 21, fontFamily: fonts.medium },
  small: { fontSize: 13, lineHeight: 18, fontFamily: fonts.medium },
  tiny: { fontSize: 11, lineHeight: 15, fontFamily: fonts.semibold },
  label: { fontSize: 11, lineHeight: 14, fontFamily: fonts.bold, letterSpacing: 1.1, textTransform: 'uppercase' },
}

export function Txt({
  v = 'body', color, weight, align, style, children, muted, soft, ...rest
}: TextProps & { v?: Variant; color?: string; weight?: keyof typeof fonts; align?: TextStyle['textAlign']; muted?: boolean; soft?: boolean }) {
  const { c } = useTheme()
  const { lang } = useI18n()
  return (
    <Text
      {...rest}
      style={[
        VARIANTS[v],
        { color: color ?? (muted ? c.muted : soft ? c.textSoft : c.text), textAlign: align, writingDirection: lang === 'ur' ? 'rtl' : 'ltr' },
        weight && { fontFamily: fonts[weight] },
        lang === 'ur' && v !== 'label' && { fontFamily: undefined, fontWeight: weight === 'regular' ? '400' : v === 'body' || v === 'small' ? '500' : '700', letterSpacing: 0, lineHeight: Math.round((VARIANTS[v].lineHeight ?? 20) * 1.4) },
        style,
      ]}
    >
      {children}
    </Text>
  )
}

/** Numbers: tabular, always LTR, never Urdu fallback */
export function Num({ style, size = 15, weight = 'bold', color, children, ...rest }: TextProps & { size?: number; weight?: keyof typeof fonts; color?: string }) {
  const { c } = useTheme()
  return (
    <Text {...rest} style={[{ fontSize: size, fontFamily: fonts[weight], color: color ?? c.text, fontVariant: ['tabular-nums'], letterSpacing: size > 22 ? -0.8 : -0.2, writingDirection: 'ltr' }, style]}>
      {children}
    </Text>
  )
}

// ------------------------------------------------------------------ press with spring scale
const APressable = Animated.createAnimatedComponent(Pressable)

export function PressScale({
  onPress, onLongPress, children, style, disabled, scaleTo = 0.96, hapticOnPress = true,
}: {
  onPress?: (e: GestureResponderEvent) => void
  onLongPress?: () => void
  children: ReactNode
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  scaleTo?: number
  hapticOnPress?: boolean
}) {
  const s = useSharedValue(1)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
  return (
    <APressable
      disabled={disabled}
      onPressIn={() => (s.set(withSpring(scaleTo, { damping: 15, stiffness: 400 })))}
      onPressOut={() => (s.set(withSpring(1, { damping: 12, stiffness: 300 })))}
      onPress={(e) => {
        if (hapticOnPress) haptic.tap()
        onPress?.(e)
      }}
      onLongPress={onLongPress}
      style={[style, anim, disabled && { opacity: 0.5 }]}
    >
      {children}
    </APressable>
  )
}

// ------------------------------------------------------------------ card
export function Card({ children, style, onPress, padded = true, glow }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean; glow?: Tone }) {
  const { c } = useTheme()
  const glowColor = glow ? toneColors(c, glow).fg : undefined
  const base: StyleProp<ViewStyle> = [
    { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: glowColor ? glowColor + '55' : c.border, padding: padded ? 16 : 0 },
    !c.dark && { shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    glowColor && { shadowColor: glowColor, shadowOpacity: c.dark ? 0.35 : 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
    style,
  ]
  if (onPress) return <PressScale onPress={onPress} scaleTo={0.98} style={base}>{children}</PressScale>
  return <View style={base}>{children}</View>
}

// ------------------------------------------------------------------ buttons
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'outline'

export function Button({
  title, onPress, variant = 'primary', icon, loading, disabled, size = 'md', style, full, color,
}: {
  title?: string
  onPress?: () => void
  variant?: BtnVariant
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  style?: StyleProp<ViewStyle>
  full?: boolean
  /** text color override */
  color?: string
}) {
  const { c } = useTheme()
  const h = size === 'lg' ? 58 : size === 'sm' ? 38 : 48
  const fg = color ??
    (variant === 'primary' ? c.primaryText
    : variant === 'danger' ? '#fff'
    : variant === 'warning' ? '#1A0F00'
    : variant === 'ghost' ? c.primary
    : c.text)
  const inner = (
    <View style={[styles.btnInner, { height: h, paddingHorizontal: size === 'sm' ? 12 : 16 }]}>
      {loading ? <ActivityIndicator color={fg} /> : icon}
      {!!title && (
        <Txt v={size === 'sm' ? 'small' : 'body'} weight="bold" color={fg} numberOfLines={1}>
          {title}
        </Txt>
      )}
    </View>
  )
  const shell: StyleProp<ViewStyle> = [
    { borderRadius: size === 'sm' ? 12 : 16, overflow: 'hidden' },
    full && { alignSelf: 'stretch' },
    variant === 'secondary' && { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
    variant === 'outline' && { borderWidth: 1.5, borderColor: c.borderStrong },
    variant === 'danger' && { backgroundColor: c.red },
    variant === 'primary' && c.dark && { shadowColor: c.primary, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
    style,
  ]
  return (
    <PressScale onPress={onPress} disabled={disabled || loading} style={shell}>
      {variant === 'primary' ? (
        <LinearGradient colors={c.dark ? ['#D4FF6A', '#9BE22F'] : ['#16A34A', '#15803D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {inner}
        </LinearGradient>
      ) : variant === 'warning' ? (
        <LinearGradient colors={['#FCD34D', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </PressScale>
  )
}

export function IconBtn({ icon, onPress, tone, size = 42, style, label }: { icon: ReactNode; onPress?: () => void; tone?: Tone; size?: number; style?: StyleProp<ViewStyle>; label?: string }) {
  const { c } = useTheme()
  const t = tone ? toneColors(c, tone) : { bg: c.surface2, fg: c.text }
  return (
    <PressScale
      onPress={onPress}
      style={[{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', borderWidth: tone ? 0 : 1, borderColor: c.border }, style]}
    >
      <View accessibilityLabel={label}>{icon}</View>
    </PressScale>
  )
}

// ------------------------------------------------------------------ badge / chip
export function Badge({ children, tone = 'stone', icon, style }: { children: ReactNode; tone?: Tone; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const t = toneColors(c, tone)
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: t.bg, paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: radius.pill }, style]}>
      {icon}
      <Txt v="tiny" color={t.fg} numberOfLines={1}>{children}</Txt>
    </View>
  )
}

export function Chip({ label, active, onPress, icon, count }: { label: string; active?: boolean; onPress?: () => void; icon?: ReactNode; count?: number }) {
  const { c } = useTheme()
  return (
    <PressScale
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: radius.pill,
        backgroundColor: active ? c.primary : c.surface, borderWidth: 1, borderColor: active ? c.primary : c.border,
      }}
    >
      {icon}
      <Txt v="small" weight="bold" color={active ? c.primaryText : c.textSoft}>{label}</Txt>
      {count !== undefined && (
        <View style={{ backgroundColor: active ? 'rgba(0,0,0,0.15)' : c.surface2, borderRadius: 8, paddingHorizontal: 6, minWidth: 20, alignItems: 'center' }}>
          <Num size={11} color={active ? c.primaryText : c.muted}>{count}</Num>
        </View>
      )}
    </PressScale>
  )
}

// ------------------------------------------------------------------ segmented control with sliding pill
export function Segmented<T extends string>({ value, onChange, items, style }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; icon?: ReactNode }[]; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const [w, setW] = useState(0)
  const idx = Math.max(0, items.findIndex((i) => i.value === value))
  const x = useSharedValue(0)
  const seg = w / items.length
  useEffect(() => {
    x.set(withSpring(idx * seg, { damping: 18, stiffness: 220 }))
  }, [idx, seg, x])
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 8)}
      style={[{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: c.border }, style]}
    >
      {w > 0 && (
        <Animated.View
          style={[{ position: 'absolute', top: 4, bottom: 4, left: 4, width: seg, borderRadius: 12, backgroundColor: c.dark ? c.surface3 : c.surface }, !c.dark && { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }, pill]}
        />
      )}
      {items.map((it) => (
        <Pressable
          key={it.value}
          onPress={() => {
            haptic.tap()
            onChange(it.value)
          }}
          style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
        >
          {it.icon}
          <Txt v="small" weight="bold" color={it.value === value ? c.text : c.muted} numberOfLines={1}>{it.label}</Txt>
        </Pressable>
      ))}
    </View>
  )
}

// ------------------------------------------------------------------ layout helpers
export function Row({ children, gap = 8, style, center = true, between }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; center?: boolean; between?: boolean }) {
  return <View style={[{ flexDirection: 'row', gap, alignItems: center ? 'center' : undefined, justifyContent: between ? 'space-between' : undefined }, style]}>{children}</View>
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong }, style]} />
}

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  const { c } = useTheme()
  return (
    <Row between style={{ marginTop: 8, marginBottom: 10 }}>
      <Txt v="h3">{children}</Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <Txt v="small" weight="bold" color={c.primary}>{action}</Txt>
        </Pressable>
      )}
    </Row>
  )
}

/** Icon in a soft tinted rounded square */
export function IconTile({ icon, tone = 'primary', size = 40 }: { icon: ReactNode; tone?: Tone; size?: number }) {
  const { c } = useTheme()
  const t = toneColors(c, tone)
  return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
}

/**
 * Fade + rise when mounted, staggered by index.
 * Once the animation has had time to finish, the animated style is dropped so the final look comes
 * from plain React props. Android can rebuild native views (e.g. when you come back to a screen) and
 * would otherwise restore Reanimated's starting style (invisible).
 */
export function Rise({ children, i = 0, style }: { children: ReactNode; i?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const delay = Math.min(i, 12) * 55
    // stagger with a JS timer (Reanimated's withDelay could stall on Android)
    const start = setTimeout(() => o.set(withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })), delay)
    const settle = setTimeout(() => setSettled(true), delay + 650)
    return () => {
      clearTimeout(start)
      clearTimeout(settle)
    }
  }, [o, i])
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: (1 - o.value) * 18 }] }))
  // collapsable={false}: stays one stable native view, so text fields inside keep focus on Android
  return <Animated.View collapsable={false} style={[style, !settled && a]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
})
