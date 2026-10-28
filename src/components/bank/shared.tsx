import { AlertTriangle, ChevronDown, HelpCircle, Info, X } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { Badge, Button, DateField, IconBtn, PressScale, Row, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { daysBetween } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useLayout } from '@/lib/responsive'
import { radius, useTheme } from '@/lib/theme'

/** One plain sentence explaining what a section is for */
export function Explain({ children, title, style }: { children: ReactNode; title?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  return (
    <View style={[{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }, style]}>
      <Info size={16} color={c.muted} style={{ marginTop: 2 }} />
      <Txt v="small" soft style={{ flex: 1 }}>
        {!!title && <Txt v="small" weight="bold">{title}: </Txt>}
        {children}
      </Txt>
    </View>
  )
}

/** "Due in 5 days" / "Due today" / "3 days late" for a cheque date */
export function ChequeDueBadge({ date }: { date: string }) {
  const { t } = useI18n()
  const { today } = useOrg()
  const d = daysBetween(today, date)
  if (d < 0) return <Badge tone="red">{t('bankDaysLate', { n: -d })}</Badge>
  if (d === 0) return <Badge tone="amber">{t('bankDueToday')}</Badge>
  return <Badge tone={d <= 7 ? 'amber' : 'stone'}>{t('bankDueIn', { n: d })}</Badge>
}

/** Days until a facility's expiry / repay-by date: amber within 60 days, red when passed */
export function ExpiryDays({ date }: { date: string }) {
  const { t } = useI18n()
  const { today } = useOrg()
  const d = daysBetween(today, date)
  if (d < 0) return <Badge tone="red">{t('bankOverdueDays', { n: -d })}</Badge>
  if (d === 0) return <Badge tone="red">{t('bankEndsToday')}</Badge>
  return <Badge tone={d <= 60 ? 'amber' : 'green'}>{t('daysLeft', { n: d })}</Badge>
}

/** Small label + big number block */
export function Figure({ label, value, color, style }: { label: string; value: string; color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]}>
      <Txt v="tiny" muted numberOfLines={1}>{label}</Txt>
      <Txt v="h3" weight="extrabold" color={color ?? c.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
    </View>
  )
}

/** Two fields side by side when there is room (tablets, sheets on big phones), stacked otherwise */
export function Pair({ children }: { children: [ReactNode, ReactNode] }) {
  const { width } = useLayout()
  if (width < 520) return <View style={{ gap: 14 }}>{children}</View>
  return (
    <Row gap={12} center={false}>
      <View style={{ flex: 1 }}>{children[0]}</View>
      <View style={{ flex: 1 }}>{children[1]}</View>
    </Row>
  )
}

/** A date that may be left empty (DateField has no "clear") */
export function OptionalDate({ value, onChange, label, max, min }: { value: string; onChange: (d: string) => void; label?: string; max?: string; min?: string }) {
  const { c } = useTheme()
  return (
    <Row gap={8}>
      <View style={{ flex: 1 }}>
        <DateField value={value} onChange={onChange} label={label} max={max} min={min} />
      </View>
      {!!value && <IconBtn size={46} icon={<X size={18} color={c.muted} />} onPress={() => onChange('')} label="clear" />}
    </Row>
  )
}

/** Soft warning / info strip */
export function Note({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'blue' | 'red' | 'stone' }) {
  const { c } = useTheme()
  const fg = tone === 'amber' ? c.amber : tone === 'blue' ? c.blue : tone === 'red' ? c.red : c.muted
  const bg = tone === 'amber' ? c.amberSoft : tone === 'blue' ? c.blueSoft : tone === 'red' ? c.redSoft : c.surface2
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: bg }}>
      {tone === 'blue' || tone === 'stone' ? <Info size={16} color={fg} style={{ marginTop: 2 }} /> : <AlertTriangle size={16} color={fg} style={{ marginTop: 2 }} />}
      <Txt v="small" weight="semibold" color={fg} style={{ flex: 1 }}>{children}</Txt>
    </View>
  )
}

/** A question asked inside a form sheet before saving (instead of a second, stacked confirm sheet) */
export interface Ask {
  msg: string
  run: () => Promise<void>
}

/**
 * Footer for the bank form sheets: Cancel + Save; once Save has asked its question, the question with No / Yes.
 * `left` (e.g. a delete button) shows before Cancel.
 */
export function FormFooter({
  ask, setAsk, busy, onCancel, onSave, saveTitle, saveIcon, disabled, left, danger,
}: {
  ask: Ask | null
  setAsk: (a: Ask | null) => void
  busy: boolean
  onCancel: () => void
  onSave: () => void
  saveTitle?: string
  saveIcon?: ReactNode
  disabled?: boolean
  left?: ReactNode
  danger?: boolean
}) {
  const { t } = useI18n()
  const { c } = useTheme()
  if (ask) {
    return (
      <View style={{ flex: 1, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: danger ? c.redSoft : c.primarySoft }}>
          <HelpCircle size={18} color={danger ? c.red : c.primary} style={{ marginTop: 1 }} />
          <Txt v="small" weight="semibold" style={{ flex: 1 }}>{ask.msg}</Txt>
        </View>
        <Row gap={10}>
          <Button variant="secondary" title={t('no')} onPress={() => setAsk(null)} disabled={busy} style={{ flex: 1 }} />
          <Button variant={danger ? 'danger' : 'primary'} title={t('yes')} onPress={() => { void ask.run() }} loading={busy} style={{ flex: 1.4 }} />
        </Row>
      </View>
    )
  }
  return (
    <>
      {left}
      <Button variant="secondary" title={t('cancel')} onPress={onCancel} style={{ flex: 1 }} />
      <Button title={saveTitle ?? t('save')} icon={saveIcon} onPress={onSave} loading={busy} disabled={disabled} style={{ flex: 1.4 }} />
    </>
  )
}

/** Glassy pill button for use on the gradient hero cards */
export function GlassButton({ title, icon, onPress, disabled, style }: { title: string; icon?: ReactNode; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' }, style]}
    >
      {icon}
      <Txt v="small" weight="bold" color="#fff" numberOfLines={1}>{title}</Txt>
    </PressScale>
  )
}

/** Show the first `size` items, then "Load more" */
export function usePaged<T>(list: T[], size: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, n: size })
  if (state.key !== resetKey) setState({ key: resetKey, n: size })
  const n = state.key === resetKey ? state.n : size
  return {
    items: list.slice(0, n),
    more: list.length > n,
    showMore: () => setState({ key: resetKey, n: n + size }),
  }
}

export function MoreButton({ onPress, left }: { onPress: () => void; left: number }) {
  const { t } = useI18n()
  const { c } = useTheme()
  return (
    <Button variant="ghost" size="sm" title={`${t('loadMore')} (${left})`} icon={<ChevronDown size={16} color={c.primary} />} onPress={onPress} style={{ alignSelf: 'center', marginTop: 4 }} />
  )
}
