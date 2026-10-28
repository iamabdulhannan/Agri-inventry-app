import type { Href } from 'expo-router'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Button, Num, PressScale, Row, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { errText } from '@/lib/errors'
import { fmtMonth, monthOf } from '@/lib/format'
import { useI18n, type TFn, type TKey } from '@/lib/i18n'
import { investorStatus, type InvestorRow, type InvestorStatus } from '@/lib/investors'
import { toneColors, useTheme, type Tone } from '@/lib/theme'
import { fmtNum } from '@/lib/units'

/** route of one investor's page */
export const investorHref = (id: string) => `/investors/${id}` as Href

/** status of an investor: label key + badge tone (same as the web page) */
export const STATUS: Record<InvestorStatus, { key: TKey; tone: Tone }> = {
  selling: { key: 'invStatusSelling', tone: 'amber' },
  ready: { key: 'invStatusReady', tone: 'green' },
  idle: { key: 'invStatusIdle', tone: 'blue' },
  empty: { key: 'invStatusEmpty', tone: 'stone' },
}

export const statusText = (r: InvestorRow, t: TFn) => t(STATUS[investorStatus(r)].key, { n: fmtNum(r.units_left, 3) })

/** errors of an investor action; migration 015 not run yet -> say so */
export function useInvErr() {
  const { t } = useI18n()
  return (e: unknown) => {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
    return /investor|schema cache|PGRST20/.test(msg) && !/INVESTOR_/.test(msg) ? t('errRunMigration', { n: '015' }) : errText(e, t)
  }
}

/** Initials avatar for an investor */
export function InvestorAvatar({ name, size = 46, tone = 'violet' }: { name: string; size?: number; tone?: Tone }) {
  const { c } = useTheme()
  const tc = toneColors(c, tone)
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.36, backgroundColor: tc.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt weight="extrabold" color={tc.fg} style={{ fontSize: size * 0.36 }}>{initials || '?'}</Txt>
    </View>
  )
}

/** Small label + figure cell used inside cards */
export function Fig({ label, value, color, align = 'flex-start', size = 15 }: { label: string; value: string; color?: string; align?: 'flex-start' | 'flex-end' | 'center'; size?: number }) {
  return (
    <View style={{ alignItems: align, gap: 2, minWidth: 0 }}>
      <Txt v="tiny" muted numberOfLines={1}>{label}</Txt>
      <Num size={size} color={color} numberOfLines={1} adjustsFontSizeToFit>{value}</Num>
    </View>
  )
}

/** Tinted info / warning box */
export function Note({ tone = 'primary', icon, title, children }: { tone?: Tone; icon?: ReactNode; title?: string; children?: ReactNode }) {
  const { c } = useTheme()
  const tc = toneColors(c, tone)
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: tc.bg, borderWidth: 1, borderColor: tc.fg + '30' }}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        {!!title && <Txt v="small" weight="bold" color={tc.fg}>{title}</Txt>}
        {typeof children === 'string' ? <Txt v="small" soft>{children}</Txt> : children}
      </View>
    </View>
  )
}

/** Previous / next month (no future months) */
export function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { lang } = useI18n()
  const { c } = useTheme()
  const { today } = useOrg()
  const shift = (d: number) => {
    const [y, m] = month.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1 + d, 1))
    setMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const nav = [styles.nav, { backgroundColor: c.surface, borderColor: c.border }]
  return (
    <Row gap={8}>
      <PressScale onPress={() => shift(-1)} style={nav}><ChevronLeft size={20} color={c.text} /></PressScale>
      <View style={{ flex: 1, alignItems: 'center' }}><Txt v="h3">{fmtMonth(month, lang)}</Txt></View>
      <PressScale onPress={() => shift(1)} disabled={month >= monthOf(today)} style={nav}><ChevronRight size={20} color={c.text} /></PressScale>
    </Row>
  )
}

/** Show a long list a page at a time ("Load more"); resets when `key` changes */
export function useMore<T>(list: T[], key: string, size = 25) {
  const [state, setState] = useState({ key, n: size })
  const n = state.key === key ? state.n : size
  if (state.key !== key) setState({ key, n: size })
  return {
    items: list.slice(0, n),
    hasMore: list.length > n,
    more: () => setState({ key, n: n + size }),
  }
}

export function MoreButton({ pg }: { pg: { hasMore: boolean; more: () => void } }) {
  const { t } = useI18n()
  if (!pg.hasMore) return null
  return <Button variant="secondary" size="sm" title={t('loadMore')} onPress={pg.more} style={{ marginTop: 10, alignSelf: 'center' }} />
}

const styles = StyleSheet.create({
  nav: { padding: 12, borderRadius: 14, borderWidth: 1 },
})
