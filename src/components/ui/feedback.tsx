import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react-native'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated as RNAnimated, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useI18n } from '@/lib/i18n'
import { radius, useTheme } from '@/lib/theme'
import { Button, haptic, Txt } from './core'
import { Sheet, sheetsSettled } from './sheet'

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
    (msg, opts) =>
      new Promise((resolve) => {
        sheetsSettled().then(() => setReq({ msg, danger: opts?.danger ?? true, title: opts?.title, okLabel: opts?.okLabel, resolve }))
      }),
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
            <ToastCard key={x.id} border={color + '55'} bg={c.dark ? '#102318' : '#0F2A1A'}>
              <Icon size={20} color={color} />
              <Txt v="small" weight="semibold" color="#ECF7EF" style={{ flex: 1 }}>{x.msg}</Txt>
            </ToastCard>
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

/**
 * Always fully opaque: it only slides in (native-driver transform), so a dropped animation
 * can never leave a half-faded toast over the screen.
 */
function ToastCard({ children, bg, border }: { children: ReactNode; bg: string; border: string }) {
  const [y] = useState(() => new RNAnimated.Value(-24))
  useEffect(() => {
    RNAnimated.spring(y, { toValue: 0, useNativeDriver: true, damping: 16, stiffness: 220, mass: 0.8 }).start()
  }, [y])
  return (
    <RNAnimated.View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: bg, paddingVertical: 13, paddingHorizontal: 16,
        borderRadius: radius.lg, borderWidth: 1, borderColor: border, transform: [{ translateY: y }],
      }}
    >
      {children}
    </RNAnimated.View>
  )
}
