import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'
import Svg, { Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg'

/** The sprout mark, same drawing as the splash screen */
export function Sprout({ size = 60 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgGradient id="s1" x1="0" y1="1" x2="0" y2="0"><Stop offset="0" stopColor="#10B981" /><Stop offset="1" stopColor="#C8FF4D" /></SvgGradient>
        <SvgGradient id="s2" x1="1" y1="1" x2="0" y2="0"><Stop offset="0" stopColor="#10B981" /><Stop offset="1" stopColor="#6EE7B7" /></SvgGradient>
        <SvgGradient id="s3" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor="#7DD836" /><Stop offset="1" stopColor="#C8FF4D" /></SvgGradient>
      </Defs>
      <Path d="M30 101 Q60 92 90 101" stroke="rgba(200,255,77,0.35)" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M60 99 C60 84 59 70 60 48" stroke="url(#s1)" strokeWidth={6} strokeLinecap="round" fill="none" />
      <Path d="M59 72 C40 73 24 61 20 40 C41 39 56 51 59 72 Z" fill="url(#s2)" />
      <Path d="M61 57 C62 33 79 17 103 15 C103 41 86 57 61 57 Z" fill="url(#s3)" />
    </Svg>
  )
}

export function LogoBadge({ size = 56 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,255,77,0.35)', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={['#123B26', '#0A2216']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View>
        <Sprout size={size * 0.8} />
      </View>
    </View>
  )
}
