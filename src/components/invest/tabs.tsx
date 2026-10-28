import { LinearGradient } from 'expo-linear-gradient'
import { FileSpreadsheet, History, Package, TrendingUp } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Bars, Meter } from '@/components/charts'
import { ProductAvatar } from '@/components/domain'
import { AnimatedNumber, Badge, Button, Card, Empty, ErrorBox, Loading, Row, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate, fmtMonth, isoOf, monthOf, monthRange, weekday } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { DailyProfit, InvestorEntry, InvestorRow, LotStatus, Settlement } from '@/lib/investors'
import { fmtMoney } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { useTheme, type Tone } from '@/lib/theme'
import { fmtNum, fmtPack } from '@/lib/units'
import { Fig, MonthNav, MoreButton, useMore } from './common'

// ===================================================================== his stock (lots)
export function LotsList({ lots, share }: { lots: LotStatus[]; share: number }) {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const m = (v: number) => fmtMoney(v, lang)
  const pg = useMore(lots, lots[0]?.investor_id ?? '')
  if (!lots.length) return <Card><Empty icon={<Package size={30} color={c.muted} />}>{t('invNoStock')}</Empty></Card>
  const tot = lots.reduce((s, l) => ({ cost: s.cost + l.qty * l.unit_cost, rev: s.rev + l.revenue, gp: s.gp + l.gross_profit }), { cost: 0, rev: 0, gp: 0 })

  return (
    <View style={{ gap: 10 }}>
      <Card style={{ padding: 14, gap: 10 }}>
        <Txt v="label" muted>{t('mInvLotTotals')}</Txt>
        <Row gap={8}>
          <View style={{ flex: 1 }}><Fig label={t('invCost')} value={m(tot.cost)} /></View>
          <View style={{ flex: 1 }}><Fig label={t('invRevenue')} value={m(tot.rev)} /></View>
          <View style={{ flex: 1 }}><Fig label={t('invProfit')} value={m(tot.gp)} color={tot.gp < 0 ? c.red : c.green} /></View>
        </Row>
        <Txt v="tiny" muted>{t('invGross')} · {t('invShareShort', { n: fmtNum(share) })}</Txt>
      </Card>
      {pg.items.map((l) => {
        const done = l.left_qty <= 0.000001
        const hasSales = !!(l.revenue || l.gross_profit)
        return (
          <Card key={l.id} style={{ padding: 14, gap: 12 }}>
            <Row gap={12}>
              <ProductAvatar p={{ name: l.product_name, pack_unit: l.pack_unit, pack_type: l.pack_type }} size={42} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="bold" numberOfLines={1}>
                  {pick(l.product_name, l.product_name_ur)} <Txt v="small" weight="bold" color={c.primary}>{fmtPack(l.pack_size, l.pack_unit, lang)}</Txt>
                </Txt>
                <Txt v="tiny" muted numberOfLines={1}>{[l.company_name, fmtDate(l.entry_date, lang)].filter(Boolean).join(' · ')}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt v="tiny" muted>{t('invLeft')}</Txt>
                <Txt v="h3" color={done ? c.faint : c.text}>{fmtNum(l.left_qty, 3)}</Txt>
              </View>
            </Row>
            <View style={{ gap: 6 }}>
              <Meter value={l.qty > 0 ? l.sold / l.qty : 0} color={done ? c.green : c.orange} track={c.surface2} height={6} />
              <Txt v="tiny" muted>{t('mInvSoldOf', { sold: fmtNum(l.sold, 3), qty: fmtNum(l.qty, 3) })}</Txt>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, padding: 12, borderRadius: 14, backgroundColor: c.surface2 }}>
              {[
                { label: t('invRate'), value: m(l.unit_cost) },
                { label: t('invCost'), value: m(l.qty * l.unit_cost) },
                { label: t('invRevenue'), value: l.revenue ? m(l.revenue) : '—' },
                { label: t('invProfit'), value: hasSales ? m(l.gross_profit) : '—', color: hasSales ? (l.gross_profit < 0 ? c.red : c.green) : c.muted },
              ].map((x) => (
                <View key={x.label} style={{ width: '50%', paddingEnd: 8 }}>
                  <Fig label={x.label} value={x.value} color={x.color} size={14} />
                </View>
              ))}
            </View>
          </Card>
        )
      })}
      <MoreButton pg={pg} />
    </View>
  )
}

// ===================================================================== profit day by day
export function DailyView({ investor }: { investor: InvestorRow }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today, version } = useOrg()
  const { toast } = useFeedback()
  const [month, setMonth] = useState(monthOf(today))
  const [from, to] = monthRange(month)
  const { data, error, loading, reload } = useLoad(async () => {
    const { data, error } = await supabase.rpc('investor_daily', { p_org: org.id, p_investor: investor.id, p_from: from, p_to: to })
    if (error) throw error
    return ((data ?? []) as DailyProfit[]).map((d) => ({ ...d, qty: +d.qty, revenue: +d.revenue, cost: +d.cost, gross_profit: +d.gross_profit, investor_profit: +d.investor_profit }))
  }, [org.id, investor.id, from, to, version])
  const m = (v: number) => fmtMoney(v, lang)
  const rows = useMemo(() => data ?? [], [data])
  const tot = rows.reduce((s, d) => ({ rev: s.rev + d.revenue, cost: s.cost + d.cost, gp: s.gp + d.gross_profit, inv: s.inv + d.investor_profit }), { rev: 0, cost: 0, gp: 0, inv: 0 })
  const pg = useMore(rows, `${investor.id}:${month}`, 31)

  // one bar per day of the month (gross profit, like the web's bar column)
  const series = useMemo(() => {
    const [y, mo] = month.split('-').map(Number)
    const last = Number(to.slice(8, 10))
    const byDay = new Map(rows.map((d) => [String(d.day).slice(0, 10), d.gross_profit]))
    return Array.from({ length: last }, (_, i) => byDay.get(isoOf(y, mo, i + 1)) ?? 0)
  }, [rows, month, to])

  const exportCsv = () =>
    shareCsv(`investor-${investor.name}-${month}`, [t('date'), t('qty'), t('invRevenue'), t('invCost'), t('invProfit'), t('invHisPart')],
      rows.map((d) => [d.day, d.qty, d.revenue, d.cost, d.gross_profit, d.investor_profit])).catch((e) => toast(errText(e, t), 'err'))

  return (
    <View style={{ gap: 12 }}>
      <MonthNav month={month} setMonth={setMonth} />
      {loading && !data ? <Loading rows={3} /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : (
        <>
          <View style={{ borderRadius: 24, overflow: 'hidden' }}>
            <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
              <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
              <Row between center={false}>
                <View style={{ flex: 1 }}>
                  <Txt v="label" color="rgba(236,255,240,0.7)">{t('invHisPart')}</Txt>
                  <AnimatedNumber value={tot.inv} format={m} size={30} color={tot.inv < 0 ? '#FECACA' : '#F4FFF6'} />
                </View>
                <TrendingUp size={22} color="#C8FF4D" />
              </Row>
              <Row gap={8} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                <View style={styles.chip}><Txt v="tiny" color="#E9FFE0">{t('invProfit')}: {m(tot.gp)}</Txt></View>
                <View style={styles.chip}><Txt v="tiny" color="#E9FFE0">{t('invRevenue')}: {m(tot.rev)}</Txt></View>
              </Row>
              <View style={{ marginTop: 16 }}>
                <Bars data={series} height={64} color="#C8FF4D" dim="rgba(236,255,240,0.35)" highlightLast={false} />
              </View>
              <Txt v="tiny" color="rgba(236,255,240,0.6)" style={{ marginTop: 8 }}>{t('mInvPerDay')} · {fmtMonth(month, lang)}</Txt>
            </LinearGradient>
          </View>

          {rows.length === 0 ? <Card><Empty icon={<TrendingUp size={30} color={c.muted} />}>{t('invNoSales')}</Empty></Card> : (
            <>
              <Card padded={false} style={{ paddingHorizontal: 14 }}>
                {pg.items.map((d, i) => (
                  <View key={d.day} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <View style={{ width: 46, alignItems: 'center' }}>
                      <Txt v="h3">{String(d.day).slice(8, 10)}</Txt>
                      <Txt v="tiny" muted numberOfLines={1}>{weekday(String(d.day).slice(0, 10), lang)}</Txt>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt v="small" weight="bold" numberOfLines={1}>{t('invRevenue')} {m(d.revenue)}</Txt>
                      <Txt v="tiny" muted numberOfLines={1}>{t('qty')} {fmtNum(d.qty, 3)} · {t('invCost')} {m(d.cost)}</Txt>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <Txt v="small" weight="extrabold" color={d.investor_profit < 0 ? c.red : c.green}>{m(d.investor_profit)}</Txt>
                      <Txt v="tiny" muted numberOfLines={1}>{t('invProfit')} {m(d.gross_profit)}</Txt>
                    </View>
                  </View>
                ))}
                <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.borderStrong, gap: 6 }}>
                  <Row between><Txt v="small" weight="bold">{t('total')} · {t('invRevenue')}</Txt><Txt v="small" weight="bold">{m(tot.rev)}</Txt></Row>
                  <Row between><Txt v="small" muted>{t('invCost')}</Txt><Txt v="small" weight="semibold">{m(tot.cost)}</Txt></Row>
                  <Row between><Txt v="small" muted>{t('invProfit')}</Txt><Txt v="small" weight="bold" color={tot.gp < 0 ? c.red : c.green}>{m(tot.gp)}</Txt></Row>
                  <Row between><Txt v="small" muted>{t('invHisPart')}</Txt><Txt v="small" weight="extrabold" color={tot.inv < 0 ? c.red : c.green}>{m(tot.inv)}</Txt></Row>
                </View>
              </Card>
              <MoreButton pg={pg} />
              <Button variant="secondary" size="sm" title={t('exportExcel')} icon={<FileSpreadsheet size={16} color={c.green} />} onPress={exportCsv} style={{ alignSelf: 'flex-start' }} />
            </>
          )}
        </>
      )}
    </View>
  )
}

// ===================================================================== history
const KIND_TONE: Record<InvestorEntry['kind'], Tone> = {
  deposit: 'blue', profit: 'green', reinvest: 'stone', withdraw_profit: 'orange', withdraw_capital: 'red',
}

export function HistoryList({ investor }: { investor: InvestorRow }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version } = useOrg()
  const { data, error, loading, reload } = useLoad(async () => {
    const [e, s] = await Promise.all([
      supabase.from('investor_entries').select('*').eq('org_id', org.id).eq('investor_id', investor.id).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('investor_settlements').select('*').eq('org_id', org.id).eq('investor_id', investor.id),
    ])
    if (e.error) throw e.error
    if (s.error) throw s.error
    return { entries: (e.data ?? []) as InvestorEntry[], settlements: new Map(((s.data ?? []) as Settlement[]).map((x) => [x.id, x])) }
  }, [org.id, investor.id, version])
  const pg = useMore(data?.entries ?? [], investor.id)
  if (loading && !data) return <Loading rows={4} />
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />
  if (!data?.entries.length) return <Card><Empty icon={<History size={30} color={c.muted} />}>{t('invNoHistory')}</Empty></Card>
  const m = (v: number) => fmtMoney(v, lang)

  return (
    <View>
      <Card padded={false} style={{ paddingHorizontal: 14 }}>
        {pg.items.map((e, i) => {
          const s = e.settlement_id ? data.settlements.get(e.settlement_id) : undefined
          const amt = Number(e.amount)
          const detail = e.kind === 'profit' && s ? t('invBooking', { gross: m(+s.gross_profit), inv: m(+s.investor_profit), shop: m(+s.shop_profit) }) : e.note
          return (
            <View key={e.id} style={{ flexDirection: 'row', gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  <Badge tone={e.kind === 'profit' && amt < 0 ? 'red' : KIND_TONE[e.kind]}>{t(`ie_${e.kind}`)}</Badge>
                  <Txt v="tiny" muted>{fmtDate(e.entry_date, lang)}</Txt>
                </Row>
                {!!detail && <Txt v="tiny" soft numberOfLines={3}>{detail}</Txt>}
                {!!e.created_by_name && <Txt v="tiny" muted>{t('by')} {e.created_by_name}</Txt>}
              </View>
              <Txt weight="extrabold" color={amt < 0 ? c.red : c.text}>{m(amt)}</Txt>
            </View>
          )
        })}
      </Card>
      <MoreButton pg={pg} />
    </View>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -60, opacity: 0.16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
})
