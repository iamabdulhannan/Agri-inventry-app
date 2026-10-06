import * as SplashScreen from 'expo-splash-screen'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue,
  withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg'
import { fonts } from '@/lib/theme'
import { haptic } from './ui/core'

const { width: W, height: H } = Dimensions.get('window')
const AnimatedPath = Animated.createAnimatedComponent(Path)

const BG = '#030A06'
const LIME = '#C8FF4D'
const EMERALD = '#10B981'
const MIN_SHOW = 2900

/**
 * Animated launch screen. It takes over from the native splash, plays the intro,
 * waits until the app is `ready`, then zooms through the logo into the app.
 */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [minDone, setMinDone] = useState(false)
  const exiting = useRef(false)

  // master timeline values
  const rings = useSharedValue(0)
  const badge = useSharedValue(0)
  const stem = useSharedValue(0)
  const leafL = useSharedValue(0)
  const leafR = useSharedValue(0)
  const word = useSharedValue(0)
  const tag = useSharedValue(0)
  const sweep = useSharedValue(0)
  const bar = useSharedValue(0)
  const spin = useSharedValue(0)
  const breathe = useSharedValue(0)
  const exit = useSharedValue(0)

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})
    const ease = Easing.bezier(0.22, 1, 0.36, 1)
    rings.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false))
    spin.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false))
    badge.set(withDelay(120, withSpring(1, { damping: 11, stiffness: 120, mass: 0.9 })))
    stem.set(withDelay(450, withTiming(1, { duration: 700, easing: ease })))
    leafL.set(withDelay(950, withSpring(1, { damping: 9, stiffness: 140 })))
    leafR.set(withDelay(1120, withSpring(1, { damping: 9, stiffness: 140 })))
    word.set(withDelay(1250, withTiming(1, { duration: 900, easing: ease })))
    tag.set(withDelay(1900, withTiming(1, { duration: 600, easing: ease })))
    sweep.set(withDelay(2000, withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withDelay(900, withTiming(0, { duration: 0 }))), -1, false)))
    bar.set(withDelay(1900, withTiming(0.82, { duration: 1400, easing: Easing.out(Easing.cubic) })))
    breathe.set(withDelay(1600, withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true)))
    const hp = setTimeout(() => haptic.light(), 1150)
    const t = setTimeout(() => setMinDone(true), MIN_SHOW)
    return () => {
      clearTimeout(t)
      clearTimeout(hp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !minDone || exiting.current) return
    exiting.current = true
    haptic.medium()
    bar.set(withTiming(1, { duration: 260 }))
    exit.set(withDelay(220, withTiming(1, { duration: 750, easing: Easing.bezier(0.7, 0, 0.84, 0) }, (fin) => {
      if (fin) runOnJS(onDone)()
    })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minDone])

  // ---------------------------------------------------------- styles
  const root = useAnimatedStyle(() => ({ opacity: interpolate(exit.value, [0, 0.55, 1], [1, 1, 0]) }))
  const stage = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(exit.value, [0, 1], [1, 9]) }],
    opacity: interpolate(exit.value, [0, 0.7, 1], [1, 0.9, 0]),
  }))
  const textOut = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.3], [1, 0]),
    transform: [{ translateY: interpolate(exit.value, [0, 0.4], [0, 40]) }],
  }))
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.value * 1.4),
    transform: [
      { scale: interpolate(badge.value, [0, 1], [0.3, 1]) * interpolate(breathe.value, [0, 1], [1, 1.035]) },
      { rotate: `${interpolate(badge.value, [0, 1], [-60, 0])}deg` },
    ],
  }))
  const spinStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.value),
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }))
  const glow = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.35, 0.7]) * Math.min(1, badge.value),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.9, 1.15]) }],
  }))
  const stemProps = useAnimatedProps(() => ({ strokeDashoffset: 70 * (1 - stem.value) }))
  const leafLStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, leafL.value * 2),
    transform: [{ scale: leafL.value }, { rotate: `${interpolate(leafL.value, [0, 1], [40, 0])}deg` }],
  }))
  const leafRStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, leafR.value * 2),
    transform: [{ scale: leafR.value }, { rotate: `${interpolate(leafR.value, [0, 1], [-40, 0])}deg` }],
  }))
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value, transform: [{ translateY: interpolate(tag.value, [0, 1], [12, 0]) }] }))
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(sweep.value, [0, 1], [-160, 320]) }, { rotate: '20deg' }] }))
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }))

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: BG }, root]}>
      <LinearGradient colors={['#071A10', BG, '#020604']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Aurora />
      <Particles />

      <Animated.View style={[styles.center, stage]}>
        {/* pulse rings */}
        {[0, 0.33, 0.66].map((o) => <Ring key={o} t={rings} offset={o} />)}

        {/* breathing glow */}
        <Animated.View style={[styles.glow, glow]} />

        {/* rotating comet ring */}
        <Animated.View style={[styles.comet, spinStyle]}>
          <LinearGradient colors={[LIME, 'rgba(200,255,77,0.0)', 'rgba(16,185,129,0.0)', EMERALD]} locations={[0, 0.35, 0.65, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.cometHole} />
        </Animated.View>

        {/* badge with the sprout */}
        <Animated.View style={[styles.badge, badgeStyle]}>
          <LinearGradient colors={['#123B26', '#0A2216']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 40 }]} />
          <View style={styles.badgeShine} />
          <View style={{ width: 120, height: 120 }}>
            <Svg width={120} height={120} viewBox="0 0 120 120" style={StyleSheet.absoluteFill}>
              <Defs>
                <SvgGradient id="stem" x1="0" y1="1" x2="0" y2="0">
                  <Stop offset="0" stopColor={EMERALD} />
                  <Stop offset="1" stopColor={LIME} />
                </SvgGradient>
              </Defs>
              <Path d="M30 101 Q60 92 90 101" stroke="rgba(200,255,77,0.35)" strokeWidth={4} strokeLinecap="round" fill="none" />
              <AnimatedPath d="M60 99 C60 84 59 70 60 48" stroke="url(#stem)" strokeWidth={6} strokeLinecap="round" fill="none" strokeDasharray="70" animatedProps={stemProps} />
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 60%' }, leafLStyle]}>
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Defs>
                  <SvgGradient id="lg" x1="1" y1="1" x2="0" y2="0">
                    <Stop offset="0" stopColor={EMERALD} />
                    <Stop offset="1" stopColor="#6EE7B7" />
                  </SvgGradient>
                </Defs>
                <Path d="M59 72 C40 73 24 61 20 40 C41 39 56 51 59 72 Z" fill="url(#lg)" />
                <Path d="M57 69 C47 60 38 52 27 45" stroke="rgba(3,10,6,0.35)" strokeWidth={2} strokeLinecap="round" fill="none" />
              </Svg>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: '50% 47%' }, leafRStyle]}>
              <Svg width={120} height={120} viewBox="0 0 120 120">
                <Defs>
                  <SvgGradient id="rg" x1="0" y1="1" x2="1" y2="0">
                    <Stop offset="0" stopColor="#7DD836" />
                    <Stop offset="1" stopColor={LIME} />
                  </SvgGradient>
                </Defs>
                <Path d="M61 57 C62 33 79 17 103 15 C103 41 86 57 61 57 Z" fill="url(#rg)" />
                <Path d="M64 54 C74 43 84 32 96 22" stroke="rgba(3,10,6,0.3)" strokeWidth={2} strokeLinecap="round" fill="none" />
              </Svg>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* wordmark */}
      <Animated.View style={[styles.wordWrap, textOut]}>
        <View style={{ overflow: 'hidden', paddingHorizontal: 6 }}>
          <View style={{ flexDirection: 'row' }}>
            {'AGRI'.split('').map((ch, i) => <Letter key={i} ch={ch} i={i} t={word} color="#F2FFF5" />)}
            <View style={{ width: 10 }} />
            {'INVENTORY'.split('').map((ch, i) => <Letter key={`b${i}`} ch={ch} i={i + 4} t={word} color={LIME} />)}
          </View>
          <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
            <LinearGradient colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <Animated.View style={tagStyle}>
          <Text style={styles.tagline}>SEEDS · FERTILIZERS · PESTICIDES</Text>
        </Animated.View>
        <Animated.View style={[styles.track, tagStyle]}>
          <Animated.View style={[styles.bar, barStyle]}>
            <LinearGradient colors={[EMERALD, LIME]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  )
}

function Letter({ ch, i, t, color }: { ch: string; i: number; t: SharedValue<number>; color: string }) {
  const s = useAnimatedStyle(() => {
    const start = i * 0.055
    const p = Math.min(1, Math.max(0, (t.value - start) / 0.4))
    const e = 1 - Math.pow(1 - p, 3)
    return {
      opacity: e,
      transform: [{ translateY: (1 - e) * 34 }, { rotateX: `${(1 - e) * 80}deg` }, { scale: 0.7 + e * 0.3 }],
    }
  })
  return <Animated.Text style={[styles.letter, { color }, s]}>{ch}</Animated.Text>
}

function Ring({ t, offset }: { t: SharedValue<number>; offset: number }) {
  const s = useAnimatedStyle(() => {
    const p = (t.value + offset) % 1
    return { opacity: interpolate(p, [0, 0.15, 1], [0, 0.45, 0]), transform: [{ scale: interpolate(p, [0, 1], [0.6, 3.2]) }] }
  })
  return <Animated.View style={[styles.ring, s]} />
}

/** two slow drifting colored blobs */
function Aurora() {
  const a = useSharedValue(0)
  useEffect(() => {
    a.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), -1, true))
  }, [a])
  const b1 = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(a.value, [0, 1], [-60, 40]) }, { translateY: interpolate(a.value, [0, 1], [-20, 50]) }] }))
  const b2 = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(a.value, [0, 1], [50, -50]) }, { translateY: interpolate(a.value, [0, 1], [30, -40]) }] }))
  return (
    <>
      <Animated.View style={[styles.blob, { top: H * 0.12, left: -W * 0.3, backgroundColor: 'rgba(16,185,129,0.16)' }, b1]} />
      <Animated.View style={[styles.blob, { bottom: H * 0.08, right: -W * 0.35, backgroundColor: 'rgba(200,255,77,0.11)' }, b2]} />
    </>
  )
}

/** rising pollen / seed particles (positions picked once, at load) */
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  x: Math.random() * W,
  size: 2 + Math.random() * 4,
  delay: Math.random() * 2400,
  dur: 3200 + Math.random() * 3200,
  drift: (Math.random() - 0.5) * 60,
  lime: i % 3 !== 0,
}))

function Particles() {
  return <>{PARTICLES.map((p, i) => <Particle key={i} {...p} />)}</>
}

function Particle({ x, size, delay, dur, drift, lime }: { x: number; size: number; delay: number; dur: number; drift: number; lime: boolean }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false)))
  }, [t, delay, dur])
  const s = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.15, 0.8, 1], [0, 0.9, 0.6, 0]),
    transform: [{ translateY: interpolate(t.value, [0, 1], [H * 0.95, H * 0.15]) }, { translateX: Math.sin(t.value * Math.PI * 2) * drift }],
  }))
  return (
    <Animated.View
      style={[{ position: 'absolute', left: x, top: 0, width: size, height: size, borderRadius: size, backgroundColor: lime ? LIME : '#6EE7B7', shadowColor: LIME, shadowOpacity: 0.9, shadowRadius: 6 }, s]}
    />
  )
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: H * 0.5 - 150, left: 0, right: 0, height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 1.5, borderColor: LIME },
  glow: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(200,255,77,0.18)', shadowColor: LIME, shadowOpacity: 1, shadowRadius: 60 },
  comet: { position: 'absolute', width: 178, height: 178, borderRadius: 89, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cometHole: { width: 170, height: 170, borderRadius: 85, backgroundColor: BG },
  badge: {
    width: 148, height: 148, borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(200,255,77,0.35)',
  },
  badgeShine: { position: 'absolute', top: -40, left: -30, width: 120, height: 90, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ rotate: '-25deg' }] },
  wordWrap: { position: 'absolute', top: H * 0.5 + 92, left: 0, right: 0, alignItems: 'center' },
  letter: { fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: 2.5 },
  sweep: { position: 'absolute', top: -10, bottom: -10, width: 60 },
  tagline: { marginTop: 10, color: 'rgba(220,255,230,0.55)', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 3.2 },
  track: { marginTop: 26, width: 160, height: 4, borderRadius: 2, backgroundColor: 'rgba(200,255,77,0.12)', overflow: 'hidden' },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  blob: { position: 'absolute', width: W * 1.1, height: W * 1.1, borderRadius: W * 0.55 },
})
