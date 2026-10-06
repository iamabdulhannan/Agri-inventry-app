import { X } from 'lucide-react-native'
import { useEffect, useState, type ReactNode } from 'react'
import { Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/lib/theme'
import { IconBtn, Txt } from './core'

const H = Dimensions.get('window').height

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
  const [mounted, setMounted] = useState(open)
  const y = useSharedValue(H)
  const fade = useSharedValue(0)

  useEffect(() => {
    if (open) {
      setMounted(true)
      y.set(H)
      y.set(withSpring(0, { damping: 22, stiffness: 210, mass: 0.9 }))
      fade.set(withTiming(1, { duration: 240 }))
    } else if (mounted) {
      fade.set(withTiming(0, { duration: 200 }))
      y.set(withTiming(H, { duration: 260, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) runOnJS(setMounted)(false)
      }))
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
    <View style={{ paddingHorizontal: 20, paddingBottom: footer ? 12 : Math.max(insets.bottom, 16) + 8 }}>{children}</View>
  )
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }, backdrop]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View
            style={[
              {
                backgroundColor: c.bgAlt, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: H * 0.92,
                borderWidth: 1, borderColor: c.border, borderBottomWidth: 0,
              },
              full && { height: H * 0.9 },
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
              <ScrollView keyboardShouldPersistTaps="handled" style={full ? { flex: 1 } : undefined} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
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
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  )
}
