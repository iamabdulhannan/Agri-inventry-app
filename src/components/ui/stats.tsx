import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { toneColors, useTheme, type Tone } from '@/lib/theme'
import { IconTile, Num, PressScale, Txt } from './core'

/** Counts up from the previous value to the new one */
export function AnimatedNumber({ value, format, size = 24, color, style, duration = 900 }: { value: number; format: (n: number) => string; size?: number; color?: string; style?: StyleProp<TextStyle>; duration?: number }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = Date.now()
    const a = from.current
    const b = Number(value) || 0
    let raf = 0
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration)
      const e = 1 - Math.pow(1 - p, 4)
      setShown(a + (b - a) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = b
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  const rounded = Math.abs(value) >= 100 ? Math.round(shown) : Math.round(shown * 100) / 100
  return <Num size={size} weight="extrabold" color={color} style={style} numberOfLines={1} adjustsFontSizeToFit>{format(rounded)}</Num>
}

export function StatTile({
  icon, label, value, sub, tone = 'primary', onPress, style, format,
}: {
  icon: ReactNode
  label: string
  value: number | string
  sub?: string
  tone?: Tone
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  format?: (n: number) => string
}) {
  const { c } = useTheme()
  const t = toneColors(c, tone)
  const body = (
    <>
      <View style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: 45, backgroundColor: t.bg }} />
      <IconTile icon={icon} tone={tone} size={38} />
      <Txt v="small" muted style={{ marginTop: 12 }} numberOfLines={1}>{label}</Txt>
      {typeof value === 'number' && format ? <AnimatedNumber value={value} format={format} size={20} style={{ marginTop: 2 }} /> : <Num size={20} weight="extrabold" style={{ marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Num>}
      {!!sub && <Txt v="tiny" muted numberOfLines={1} style={{ marginTop: 2 }}>{sub}</Txt>}
    </>
  )
  const shell: StyleProp<ViewStyle> = [
    { flex: 1, minWidth: 150, backgroundColor: c.surface, borderRadius: 22, padding: 14, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    !c.dark && { shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
    style,
  ]
  return onPress ? <PressScale onPress={onPress} scaleTo={0.97} style={shell}>{body}</PressScale> : <View style={shell}>{body}</View>
}
