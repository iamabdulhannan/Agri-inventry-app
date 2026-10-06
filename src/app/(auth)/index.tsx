import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { BarChart3, BookUser, CalendarClock, Languages, Receipt, ScanLine, Ticket } from 'lucide-react-native'
import { useEffect } from 'react'
import { Dimensions, Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LogoBadge } from '@/components/Logo'
import { Button, Row, Txt } from '@/components/ui'
import { useApp } from '@/lib/app'
import { useI18n } from '@/lib/i18n'
import { supabaseConfigured } from '@/lib/supabase'

const { width: W } = Dimensions.get('window')

export default function Welcome() {
  const { t, lang, setLang } = useI18n()
  const { removed } = useApp()
  const insets = useSafeAreaInsets()
  const float = useSharedValue(0)
  useEffect(() => {
    float.set(withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true))
  }, [float])
  const floatA = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [-8, 8]) }, { rotate: '-6deg' }] }))
  const floatB = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [10, -6]) }, { rotate: '5deg' }] }))
  const floatC = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [-4, 10]) }, { rotate: '-2deg' }] }))

  const feats = [
    { icon: CalendarClock, label: t('expiry'), color: '#FBBF24' },
    { icon: Receipt, label: t('receipt'), color: '#C8FF4D' },
    { icon: BookUser, label: t('navKhata'), color: '#60A5FA' },
    { icon: BarChart3, label: t('profit'), color: '#34D399' },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: '#030A06' }}>
      <LinearGradient colors={['#0C3320', '#06180F', '#030A06']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, { top: -W * 0.4, right: -W * 0.4, backgroundColor: 'rgba(200,255,77,0.10)' }]} />
      <View style={[styles.blob, { top: W * 0.5, left: -W * 0.6, backgroundColor: 'rgba(16,185,129,0.10)' }]} />

      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Row gap={10}>
          <LogoBadge size={40} />
          <Txt v="h3" color="#F2FFF5">{t('appName')}</Txt>
        </Row>
        <Pressable onPress={() => setLang(lang === 'en' ? 'ur' : 'en')} style={styles.lang}>
          <Languages size={16} color="#C8FF4D" />
          <Txt v="small" weight="bold" color="#F2FFF5">{lang === 'en' ? 'اردو' : 'English'}</Txt>
        </Pressable>
      </View>

      {/* floating feature cards */}
      <View style={{ height: 300, marginTop: 10 }}>
        <Animated.View style={[styles.floatCard, { top: 30, left: 24 }, floatA]}>
          <View style={[styles.dot, { backgroundColor: 'rgba(251,191,36,0.18)' }]}><CalendarClock size={18} color="#FBBF24" /></View>
          <View>
            <Txt v="tiny" color="rgba(236,247,239,0.6)">Confidor 200 SL</Txt>
            <Txt v="small" weight="bold" color="#FBBF24">{t('daysLeft', { n: 12 })}</Txt>
          </View>
        </Animated.View>
        <Animated.View style={[styles.floatCard, { top: 110, right: 22, paddingVertical: 16 }, floatB]}>
          <View>
            <Txt v="tiny" color="rgba(236,247,239,0.6)">{t('todaySales')}</Txt>
            <Txt v="h2" color="#C8FF4D" style={{ fontVariant: ['tabular-nums'] }}>Rs 84,250</Txt>
            <Row gap={4} style={{ marginTop: 6 }}>
              {[18, 30, 22, 40, 28, 46, 38].map((h, i) => (
                <View key={i} style={{ width: 8, height: h, borderRadius: 3, backgroundColor: i === 5 ? '#C8FF4D' : 'rgba(200,255,77,0.3)', alignSelf: 'flex-end' }} />
              ))}
            </Row>
          </View>
        </Animated.View>
        <Animated.View style={[styles.floatCard, { top: 205, left: 46 }, floatC]}>
          <View style={[styles.dot, { backgroundColor: 'rgba(96,165,250,0.18)' }]}><ScanLine size={18} color="#60A5FA" /></View>
          <View>
            <Txt v="tiny" color="rgba(236,247,239,0.6)">{t('invoiceNum')} 1042</Txt>
            <Txt v="small" weight="bold" color="#F2FFF5">Rs 3,450 · {t('fullPayment')}</Txt>
          </View>
        </Animated.View>
      </View>

      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 22, paddingBottom: insets.bottom + 18 }}>
        <Animated.View entering={FadeInDown.delay(150).duration(600)}>
          <Txt v="display" color="#F2FFF5" style={{ fontSize: 38, lineHeight: 44 }}>{t('welcomeTitle')}</Txt>
          <Txt color="rgba(236,247,239,0.65)" style={{ marginTop: 10 }}>{t('welcomeText')}</Txt>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(280).duration(600)}>
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 18 }}>
            {feats.map(({ icon: Icon, label, color }) => (
              <View key={label} style={styles.pill}>
                <Icon size={14} color={color} />
                <Txt v="tiny" color="#E6F5EA">{label}</Txt>
              </View>
            ))}
          </Row>
        </Animated.View>
        {removed && <Txt v="small" color="#FBBF24" style={{ marginTop: 14 }}>{t('removedBanner')}</Txt>}
        {!supabaseConfigured && <Txt v="small" color="#FB7185" style={{ marginTop: 14 }}>{t('errNotConfigured')}</Txt>}
        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={{ gap: 10, marginTop: 24 }}>
          <Button size="lg" title={t('createOrgBtn')} onPress={() => router.push({ pathname: '/sign-up', params: { mode: 'create' } })} style={{ shadowColor: '#C8FF4D', shadowOpacity: 0.5, shadowRadius: 18 }} />
          <Row gap={10}>
            <Button size="lg" variant="outline" color="#F2FFF5" title={t('signIn')} onPress={() => router.push('/sign-in')} style={{ flex: 1, borderColor: 'rgba(236,247,239,0.25)' }} />
            <Button size="lg" variant="outline" icon={<Ticket size={18} color="#C8FF4D" />} color="#F2FFF5" title={t('joinOrg')} onPress={() => router.push({ pathname: '/sign-up', params: { mode: 'join' } })} style={{ flex: 1.5, borderColor: 'rgba(236,247,239,0.25)' }} />
          </Row>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: W * 1.2, height: W * 1.2, borderRadius: W * 0.6 },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  floatCard: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingRight: 18, borderRadius: 22,
    backgroundColor: 'rgba(16,40,26,0.85)', borderWidth: 1, borderColor: 'rgba(200,255,77,0.18)',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  dot: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
})
