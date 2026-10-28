import { X } from 'lucide-react-native'
import { useEffect, useState, type ReactNode } from 'react'
import { Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, runOnJS, SlideInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLayout } from '@/lib/responsive'
import { useTheme } from '@/lib/theme'
import { IconBtn, Txt } from './core'

const H = Dimensions.get('window').height

/**
 * Sheets that are still sliding away. iOS drops a modal presented while another one is being dismissed,
 * so the confirm dialog waits for this to reach 0 (see feedback.tsx).
 */
let closing = 0
export function sheetsSettled(maxWait = 700): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => (closing <= 0 || Date.now() - start > maxWait ? resolve() : setTimeout(check, 40))
    check()
  })
}

/** Bottom sheet: springs up, drag the handle down to close */
export function Sheet({
  open, onClose, title, subtitle, children, footer, scroll = true, full,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  scroll?: boolean
  /** take (almost) the full height, e.g. for lists with search */
  full?: boolean
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { isTablet } = useLayout()
  const [mounted, setMounted] = useState(open)
  // y is only the drag / close offset: the sheet's resting place (on screen) comes from React props,
  // so it shows even if Android drops a Reanimated update. Opening uses a mount animation (SlideInDown).
  const y = useSharedValue(0)
  const fade = useSharedValue(1)
  // Android: an edge-to-edge modal window is not always resized for the keyboard, so lift the sheet
  // by however much the keyboard still covers (0 when the window did resize, so it never adjusts twice)
  const [kb, setKb] = useState(0)
  const [rootH, setRootH] = useState(0)
  useEffect(() => {
    if (Platform.OS !== 'android' || !mounted) return
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKb(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [mounted])
  const lift = kb > 0 && rootH > 0 ? Math.max(0, kb - (Dimensions.get('screen').height - rootH)) : 0

  useEffect(() => {
    if (open) {
      y.set(0)
      fade.set(1)
      setMounted(true)
      return
    }
    if (!mounted) return
    fade.set(withTiming(0, { duration: 200 }))
    y.set(withTiming(H, { duration: 260, easing: Easing.in(Easing.cubic) }))
    // unmount on a timer rather than the animation callback, so a dropped animation can't leave an invisible sheet
    closing++
    let counted = true
    const settle = () => {
      if (counted) closing--
      counted = false
    }
    // a little after unmount, so the native modal has finished dismissing
    const id = setTimeout(() => setMounted(false), 280)
    const id2 = setTimeout(settle, 420)
    return () => {
      clearTimeout(id)
      clearTimeout(id2)
      settle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      y.set(Math.max(0, e.translationY))
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) runOnJS(onClose)()
      else y.set(withSpring(0, { damping: 20, stiffness: 220 }))
    })

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  const backdrop = useAnimatedStyle(() => ({ opacity: fade.value }))

  if (!mounted) return null
  const body = (
    // a full, non-scrolling sheet hands its height down so lists inside (flex: 1) get room
    <View style={[{ paddingHorizontal: 20, paddingBottom: footer ? 12 : Math.max(insets.bottom, 16) + 8 }, full && !scroll && { flex: 1 }]}>{children}</View>
  )
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={(e) => setRootH(e.nativeEvent.layout.height)}>
        <Animated.View entering={FadeIn.duration(240)} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }, backdrop]}>
            <Pressable style={{ flex: 1 }} onPress={onClose} />
          </Animated.View>
        </Animated.View>
        {/* Android already resizes the modal window for the keyboard; adjusting again pushed the sheet off screen */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'} style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: lift }} pointerEvents="box-none">
          {/* outer: mount (slide-in) animation and size limits; inner: the drag offset. Kept apart as Reanimated asks. */}
          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(210).mass(0.9)}
            collapsable={false}
            // fill the space above the keyboard instead of a fixed height, so the header and search stay on screen
            style={[full ? { flex: 1, marginTop: insets.top + 24 } : { maxHeight: '92%' }, isTablet && { width: '100%', maxWidth: 640, alignSelf: 'center' }]}
          >
            <Animated.View
              collapsable={false}
              style={[
                {
                  backgroundColor: c.bgAlt, borderTopLeftRadius: 30, borderTopRightRadius: 30,
                  borderWidth: 1, borderColor: c.border, borderBottomWidth: 0, flexShrink: 1,
                },
                full && { flex: 1 },
                sheetStyle,
              ]}
            >
              <GestureDetector gesture={pan}>
                <View style={{ paddingTop: 10, paddingBottom: 6, paddingHorizontal: 20 }}>
                  <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.borderStrong, marginBottom: 12 }} />
                  {(!!title || !!subtitle) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <View style={{ flex: 1 }}>
                        {typeof title === 'string' ? <Txt v="h2">{title}</Txt> : title}
                        {!!subtitle && <Txt v="small" muted style={{ marginTop: 2 }}>{subtitle}</Txt>}
                      </View>
                      <IconBtn size={36} icon={<X size={18} color={c.textSoft} />} onPress={onClose} label="close" />
                    </View>
                  )}
                </View>
              </GestureDetector>
              {scroll ? (
                <ScrollView keyboardShouldPersistTaps="handled" style={full ? { flex: 1 } : { flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                  {body}
                </ScrollView>
              ) : (
                <View style={full ? { flex: 1 } : undefined}>{body}</View>
              )}
              {footer && (
                <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14) + 4, borderTopWidth: 1, borderTopColor: c.border }}>
                  {footer}
                </View>
              )}
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}
