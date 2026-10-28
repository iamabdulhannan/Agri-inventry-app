import { FileSpreadsheet } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { Button, Card, Row, Txt, useFeedback } from '@/components/ui'
import { errText } from '@/lib/errors'
import type { TFn } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { useTheme } from '@/lib/theme'

/* ------------------------------------------------------------------ */
/* FBR tax year: Tax Year 2027 = 1 Jul 2026 to 30 Jun 2027             */
/* ------------------------------------------------------------------ */
export const taxYearOf = (d: string) => (Number(d.slice(5, 7)) >= 7 ? Number(d.slice(0, 4)) + 1 : Number(d.slice(0, 4)))
export const taxYearRange = (ty: number): [string, string] => [`${ty - 1}-07-01`, `${ty}-06-30`]

export interface PeriodProps { from: string; to: string; period: string }

/** Friendly message when migration 012 has not been run yet */
export function migrationHint(e: unknown, t: TFn) {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
  return /year_report|year_stock|set_locked_until|audit_log|schema cache|PGRST20/.test(msg) ? t('errRunMigration', { n: '012' }) : errText(e, t)
}

/** Rows shown per step of the "load more" button */
export const PAGE = 200

/** Long lists show the first 200 rows; "load more" adds 200. Starts over when `key` changes. */
export function useShowMore(key: string) {
  const [st, setSt] = useState({ key, n: PAGE })
  const n = st.key === key ? st.n : PAGE
  return { n, more: () => setSt({ key, n: n + PAGE }) }
}

export function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  const { t } = useI18n()
  if (total <= shown) return null
  return (
    <View style={{ alignItems: 'center', gap: 8, marginTop: 12 }}>
      <Txt v="tiny" muted>{t('pgShowing', { from: 1, to: shown, total })}</Txt>
      <Button size="sm" variant="secondary" title={t('loadMore')} onPress={onMore} />
    </View>
  )
}

/** Excel (CSV) share button with its own busy state and error toast */
export function ExportButton({ make }: { make: () => Promise<void> }) {
  const { t } = useI18n()
  const { c } = useTheme()
  const { toast } = useFeedback()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await make()
    } catch (e) {
      toast(errText(e, t), 'err')
    } finally {
      setBusy(false)
    }
  }
  return <Button size="sm" variant="secondary" title={t('exportExcel')} icon={<FileSpreadsheet size={15} color={c.green} />} loading={busy} onPress={run} />
}

/** Title + period on the left, Excel button on the right */
export function RegisterHead({ title, period, onExport, extra }: { title: string; period: string; onExport?: () => Promise<void>; extra?: ReactNode }) {
  return (
    <Row gap={10} style={{ marginTop: 16, marginBottom: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="h3" numberOfLines={1}>{title}</Txt>
        <Txt v="tiny" muted numberOfLines={2}>{period}</Txt>
      </View>
      {extra}
      {!!onExport && <ExportButton make={onExport} />}
    </Row>
  )
}

/** Totals strip: label over amount, split in equal cells */
export function TotalsStrip({ items }: { items: { l: string; v: number; col?: string }[] }) {
  const { c } = useTheme()
  const { lang } = useI18n()
  return (
    <Card padded={false} style={{ flexDirection: 'row', overflow: 'hidden' }}>
      {items.map((x, i) => (
        <View key={x.l} style={{ flex: 1, minWidth: 0, padding: 12, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
          <Txt v="tiny" muted numberOfLines={2}>{x.l}</Txt>
          <Txt weight="extrabold" color={x.col ?? c.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ marginTop: 2 }}>{fmtMoney(x.v, lang)}</Txt>
        </View>
      ))}
    </Card>
  )
}

/** A list inside one card, rows separated by hairlines */
export function ListCard<T>({ rows, render, keyOf }: { rows: T[]; render: (r: T) => ReactNode; keyOf: (r: T) => string }) {
  const { c } = useTheme()
  return (
    <Card padded={false} style={{ paddingHorizontal: 14 }}>
      {rows.map((r, i) => (
        <View key={keyOf(r)} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
          {render(r)}
        </View>
      ))}
    </Card>
  )
}

/** Small round number tile on the left of a register row (e.g. invoice no) */
export function NoTile({ no, tone }: { no: string | number; tone: 'primary' | 'blue' | 'red' | 'amber' }) {
  const { c } = useTheme()
  const bg = tone === 'primary' ? c.primarySoft : tone === 'blue' ? c.blueSoft : tone === 'red' ? c.redSoft : c.amberSoft
  const fg = tone === 'primary' ? c.primary : tone === 'blue' ? c.blue : tone === 'red' ? c.red : c.amber
  return (
    <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt v="tiny" muted>#</Txt>
      <Txt v="small" weight="extrabold" color={fg} numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: -3, maxWidth: 42 }}>{no}</Txt>
    </View>
  )
}
