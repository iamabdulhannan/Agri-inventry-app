import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '@/lib/i18n'
import { radius, useTheme } from '@/lib/theme'
import { Button, haptic, Txt } from './core'
import { Sheet } from './sheet'

type ToastKind = 'ok' | 'err' | 'warn'
interface ToastItem { id: number; msg: string; kind: ToastKind }
interface ConfirmReq { msg: string; danger: boolean; title?: string; okLabel?: string; resolve: (v: boolean) => void }

interface Feedback {
  toast: (msg: string, kind?: ToastKind) => void
  confirm: (msg: string, opts?: { danger?: boolean; title?: string; okLabel?: string }) => Promise<boolean>
}

const Ctx = createContext<Feedback | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { c } = useTheme()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [req, setReq] = useState<ConfirmReq | null>(null)
  const seq = useRef(0)

  const toast = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = ++seq.current
    if (kind === 'ok') haptic.success()
    else if (kind === 'err') haptic.error()
    else haptic.warn()
    setToasts((ts) => [...ts.slice(-2), { id, msg, kind }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), kind === 'err' ? 4200 : 2800)
  }, [])

  const confirm = useCallback<Feedback['confirm']>(
    (msg, opts) => new Promise((resolve) => setReq({ msg, danger: opts?.danger ?? true, title: opts?.title, okLabel: opts?.okLabel, resolve })),
    [],
  )
  const answer = (v: boolean) => {
    req?.resolve(v)
    setReq(null)
  }

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, gap: 8, zIndex: 9999 }}>
        {toasts.map((x) => {
          const color = x.kind === 'ok' ? c.green : x.kind === 'err' ? c.red : c.amber
          const Icon = x.kind === 'ok' ? CheckCircle2 : x.kind === 'err' ? XCircle : AlertTriangle
          return (
            <Animated.View
              key={x.id}
              entering={FadeInUp.springify().damping(16)}
              exiting={FadeOutUp.duration(220)}
              layout={LinearTransition}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.dark ? '#102318' : '#0F2A1A', paddingVertical: 13, paddingHorizontal: 16,
                borderRadius: radius.lg, borderWidth: 1, borderColor: color + '55',
                shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
              }}
            >
              <Icon size={20} color={color} />
              <Txt v="small" weight="semibold" color="#ECF7EF" style={{ flex: 1 }}>{x.msg}</Txt>
            </Animated.View>
          )
        })}
      </View>
      <Sheet
        open={!!req}
        onClose={() => answer(false)}
        title={req?.title ?? t('confirm')}
        footer={
          <>
            <Button variant="secondary" title={t('cancel')} onPress={() => answer(false)} style={{ flex: 1 }} />
            <Button variant={req?.danger ? 'danger' : 'primary'} title={req?.okLabel ?? t('yes')} onPress={() => answer(true)} style={{ flex: 1 }} />
          </>
        }
      >
        <Txt soft>{req?.msg}</Txt>
      </Sheet>
    </Ctx.Provider>
  )
}

export function useFeedback() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFeedback outside provider')
  return v
}
