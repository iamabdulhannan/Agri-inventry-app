import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
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

function Bar({ h, i, color, width }: { h: number; i: number; color: string; width?: number }) {
  const v = useSharedValue(0)
  const target = Math.max(4, h)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    v.set(0)
    const start = setTimeout(() => v.set(withTiming(target, { duration: 700, easing: Easing.out(Easing.back(1.4)) })), 250 + i * 70)
    // then hand the final height to React (see Rise in ui/core for why)
    const settle = setTimeout(() => setSettled(true), 250 + i * 70 + 900)
    return () => {
      clearTimeout(start)
      clearTimeout(settle)
    }
  }, [target, i, v])
  const s = useAnimatedStyle(() => ({ height: v.value }))
  return <Animated.View style={[{ flex: width ? undefined : 1, width, borderRadius: 6, backgroundColor: color }, settled ? { height: target } : s]} />
}

/** Horizontal progress bar that fills in */
export function Meter({ value, color, track, height = 8, delay = 200 }: { value: number; color: string; track: string; height?: number; delay?: number }) {
  const v = useSharedValue(0)
  const target = Math.max(0, Math.min(1, value))
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    const start = setTimeout(() => v.set(withTiming(target, { duration: 800, easing: Easing.out(Easing.cubic) })), delay)
    const settle = setTimeout(() => setSettled(true), delay + 1000)
    return () => {
      clearTimeout(start)
      clearTimeout(settle)
    }
  }, [target, v, delay])
  const s = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }))
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, settled ? { width: `${target * 100}%` } : s]} />
    </View>
  )
}
