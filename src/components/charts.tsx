import { useEffect, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import { Txt } from './ui'

/** Bars that grow in one after another */
export function Bars({
  data, height = 64, color, dim, highlightLast = true, labels, labelColor, barWidth,
}: {
  data: number[]
  height?: number
  color: string
  dim: string
  highlightLast?: boolean
  labels?: string[]
  labelColor?: string
  barWidth?: number
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(0, d)))
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height }}>
        {data.map((d, i) => (
          <Bar key={i} i={i} h={(Math.max(0, d) / max) * height} color={highlightLast && i === data.length - 1 ? color : dim} width={barWidth} />
        ))}
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {labels.map((l, i) => (
            <Txt key={i} v="tiny" align="center" color={labelColor} style={{ flex: barWidth ? undefined : 1, width: barWidth, fontSize: 9.5 }} numberOfLines={1}>{l}</Txt>
          ))}
        </View>
      )}
    </View>
  )
}

// Bars and meters use React Native's built-in Animated (see Rise in ui/core for why not Reanimated).
// When the animation ends (or after a safety timeout) they get their final size as a plain value.

function Bar({ h, i, color, width }: { h: number; i: number; color: string; width?: number }) {
  const target = Math.max(4, h)
  const [v] = useState(() => new Animated.Value(0))
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDone(false)
    v.setValue(0)
    const delay = 250 + i * 70
    const anim = Animated.timing(v, { toValue: target, duration: 650, delay, easing: Easing.out(Easing.back(1.3)), useNativeDriver: false })
    anim.start(() => setDone(true))
    const safety = setTimeout(() => setDone(true), delay + 1000)
    return () => {
      anim.stop()
      clearTimeout(safety)
    }
  }, [target, i, v])
  return <Animated.View style={{ flex: width ? undefined : 1, width, borderRadius: 6, backgroundColor: color, height: done ? target : v }} />
}

/** Horizontal progress bar that fills in */
export function Meter({ value, color, track, height = 8, delay = 200 }: { value: number; color: string; track: string; height?: number; delay?: number }) {
  const target = Math.max(0, Math.min(1, value))
  const [v] = useState(() => new Animated.Value(0))
  const [done, setDone] = useState(false)
  useEffect(() => {
    setDone(false)
    v.setValue(0)
    const anim = Animated.timing(v, { toValue: target, duration: 750, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false })
    anim.start(() => setDone(true))
    const safety = setTimeout(() => setDone(true), delay + 1100)
    return () => {
      anim.stop()
      clearTimeout(safety)
    }
  }, [target, v, delay])
  const width = done ? `${target * 100}%` : v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color, width: width as `${number}%` }} />
    </View>
  )
}
