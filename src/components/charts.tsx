import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
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
  useEffect(() => {
    v.set(0)
    v.set(withDelay(250 + i * 70, withTiming(Math.max(4, h), { duration: 700, easing: Easing.out(Easing.back(1.4)) })))
  }, [h, i, v])
  const s = useAnimatedStyle(() => ({ height: v.value }))
  return <Animated.View style={[{ flex: width ? undefined : 1, width, borderRadius: 6, backgroundColor: color }, s]} />
}

/** Horizontal progress bar that fills in */
export function Meter({ value, color, track, height = 8, delay = 200 }: { value: number; color: string; track: string; height?: number; delay?: number }) {
  const v = useSharedValue(0)
  useEffect(() => {
    v.set(withDelay(delay, withTiming(Math.max(0, Math.min(1, value)), { duration: 800, easing: Easing.out(Easing.cubic) })))
  }, [value, v, delay])
  const s = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }))
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, s]} />
    </View>
  )
}
