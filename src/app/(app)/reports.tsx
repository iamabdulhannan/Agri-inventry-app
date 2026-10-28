import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronLeft, ChevronRight, Coins, FileSpreadsheet, Percent, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react-native'
import { useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Bars, Meter } from '@/components/charts'
import { ProductAvatar, usePackLabel } from '@/components/domain'
import { AnimatedNumber, Button, Card, Chip, DateField, Empty, ErrorBox, Loading, PressScale, Rise, Row, Screen, SectionTitle, Segmented, StatTile, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadCatalog } from '@/lib/catalog'
import { fetchAll, useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate, fmtMonth, isoOf, monthOf, monthRange } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { ProductSalesRow, SalesDay, SummaryRow } from '@/lib/types'
import { fmtNum, fmtPack, fmtTotal } from '@/lib/units'

type Tab = 'profit' | 'stock'
/** stock movement + what the sold quantity brought in (net of customer returns) */
type ReportRow = SummaryRow & { soldQty: number; revenue: number; cost: number; profit: number }
/** average price one pack was sold at */
const soldAt = (r: ReportRow) => (r.soldQty > 0 ? r.revenue / r.soldQty : 0)
const PAGE = 40

/** Share-sheet button for the "Excel" export, same as the web report buttons */
function ExcelButton({ onPress, disabled }: { onPress: () => Promise<void>; disabled?: boolean }) {
  const { c } = useTheme()
  const { t } = useI18n()
  const { toast } = useFeedback()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onPress()
    } catch (e) {
      toast(errText(e, t), 'err')
    } finally {
      setBusy(false)
    }
  }
  return (
    <PressScale onPress={run} disabled={disabled || busy} style={[styles.nav, { backgroundColor: c.greenSoft, borderColor: c.green + '40' }]}>
      <FileSpreadsheet size={20} color={c.green} />
    </PressScale>
  )
}

export default function Reports() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('profit')
  return (
    <Screen back title={t('reports')}>
      <Segmented value={tab} onChange={setTab} items={[{ value: 'profit', label: t('salesProfit') }, { value: 'stock', label: t('stock') }]} />
      {tab === 'profit' ? <ProfitReport /> : <StockReport />}
    </Screen>
  )
}

function MonthNav({ month, setMonth, right }: { month: string; setMonth: (m: string) => void; right?: ReactNode }) {
  const { lang } = useI18n()
  const { c } = useTheme()
  const { today } = useOrg()
  const shift = (d: number) => {
    const [y, m] = month.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1 + d, 1))
    setMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return (
    <Row gap={8} style={{ marginTop: 14 }}>
      <PressScale onPress={() => shift(-1)} style={[styles.nav, { backgroundColor: c.surface, borderColor: c.border }]}><ChevronLeft size={20} color={c.text} /></PressScale>
      <View style={{ flex: 1, alignItems: 'center' }}><Txt v="h3">{fmtMonth(month, lang)}</Txt></View>
      <PressScale onPress={() => shift(1)} disabled={month >= monthOf(today)} style={[styles.nav, { backgroundColor: c.surface, borderColor: c.border }]}><ChevronRight size={20} color={c.text} /></PressScale>
      {right}
    </Row>
  )
}

function ProfitReport() {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, today, version } = useOrg()
  const label = usePackLabel()
  const [month, setMonth] = useState(monthOf(today))
  const [from, lastDay] = monthRange(month)
  const to = lastDay > today ? today : lastDay

  const { data, error, loading, reload } = useLoad(async () => {
    if (from > today) return null
    const [catalog, days, prods] = await Promise.all([
      loadCatalog(org.id),
      supabase.rpc('sales_days', { p_org: org.id, p_from: from, p_to: to }),
      supabase.rpc('product_sales', { p_org: org.id, p_from: from, p_to: to }),
    ])
    if (days.error) throw days.error
    if (prods.error) throw prods.error
    return { catalog, days: (days.data ?? []) as SalesDay[], prods: ((prods.data ?? []) as ProductSalesRow[]).sort((a, b) => Number(b.profit) - Number(a.profit)) }
  }, [org.id, from, to, version])

  const tot = (data?.days ?? []).reduce(
    (a, d) => ({ inv: a.inv + Number(d.invoices), sales: a.sales + Number(d.sales), disc: a.disc + Number(d.discount), cost: a.cost + Number(d.cost), profit: a.profit + Number(d.profit), rec: a.rec + Number(d.received) }),
    { inv: 0, sales: 0, disc: 0, cost: 0, profit: 0, rec: 0 },
  )
  const margin = tot.sales ? Math.round((tot.profit / tot.sales) * 100) : 0
  const m = (n: number) => fmtMoney(n, lang)

  // one bar per day of the month
  const series = useMemo(() => {
    const [y, mo] = month.split('-').map(Number)
    const last = Number(lastDay.slice(8, 10))
    const byDay = new Map((data?.days ?? []).map((d) => [String(d.day).slice(0, 10), Number(d.sales)]))
    return Array.from({ length: last }, (_, i) => byDay.get(isoOf(y, mo, i + 1)) ?? 0)
  }, [data, month, lastDay])
  const maxProfit = Math.max(1, ...(data?.prods ?? []).map((p) => Number(p.profit)))
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '')
  const exportCsv = async () => {
    if (!data) return
    await shareCsv(`sales-profit-${month}`, [t('date'), t('invoices'), t('sales_'), t('discount'), t('cost'), t('profit'), t('margin'), t('received')],
      data.days.map((d) => [d.day, d.invoices, d.sales, d.discount, d.cost, d.profit, pct(Number(d.profit), Number(d.sales)), d.received]))
  }

  return (
    <View>
      <MonthNav month={month} setMonth={setMonth} right={<ExcelButton onPress={exportCsv} disabled={!data?.days.length} />} />
      {loading && !data ? <View style={{ marginTop: 14 }}><Loading rows={4} /></View> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : !data ? <Empty>{t('noData')}</Empty> : (
        <>
          <Rise>
            <View style={{ borderRadius: 28, overflow: 'hidden', marginTop: 14 }}>
              <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
                <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
                <Txt v="label" color="rgba(236,255,240,0.7)">{t('profit')}</Txt>
                <AnimatedNumber value={tot.profit} format={m} size={36} color="#F4FFF6" />
                <Row gap={8} style={{ marginTop: 6 }}>
                  <View style={styles.chip}><Percent size={12} color="#C8FF4D" /><Txt v="tiny" color="#E9FFE0">{t('margin')} {margin}%</Txt></View>
                  <View style={styles.chip}><Receipt size={12} color="#C8FF4D" /><Txt v="tiny" color="#E9FFE0">{tot.inv} {t('invoices')}</Txt></View>
                </Row>
                <View style={{ marginTop: 16 }}>
                  <Bars data={series} height={70} color="#C8FF4D" dim="rgba(236,255,240,0.35)" highlightLast={false} />
                </View>
              </LinearGradient>
            </View>
          </Rise>
          <Row gap={10} style={{ marginTop: 12 }}>
            <StatTile icon={<Coins size={17} color={c.primary} />} label={t('sales_')} value={tot.sales} format={m} sub={tot.disc > 0 ? `${t('discount')}: ${m(tot.disc)}` : undefined} />
            <StatTile icon={<Wallet size={17} color={c.green} />} tone="green" label={t('received')} value={tot.rec} format={m} sub={`${t('balanceDue')}: ${m(tot.sales - tot.rec)}`} />
          </Row>

          <SectionTitle>{t('topProducts')}</SectionTitle>
          {data.prods.length === 0 ? <Card><Empty>{t('noEntries')}</Empty></Card> : (
            <Card padded={false} style={{ paddingHorizontal: 14 }}>
              {data.prods.slice(0, 25).map((r, i) => {
                const p = data.catalog.byId.get(r.product_id)
                if (!p) return null
                return (
                  <PressScale key={r.product_id} onPress={() => router.push(`/product/${p.id}`)} scaleTo={0.99} style={{ paddingVertical: 12, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <Row gap={10}>
                      <Txt v="small" weight="extrabold" muted style={{ width: 20 }}>{i + 1}</Txt>
                      <ProductAvatar p={p} size={34} />
                      <View style={{ flex: 1 }}>
                        <Txt v="small" weight="bold" numberOfLines={1}>{pick(p.name, p.name_ur)}</Txt>
                        <Txt v="tiny" muted>{label(p)} · {fmtNum(r.qty, 3)} {t('sold')}</Txt>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt v="small" weight="extrabold" color={Number(r.profit) < 0 ? c.red : c.green}>{m(Number(r.profit))}</Txt>
                        <Txt v="tiny" muted>{m(Number(r.revenue))}</Txt>
                      </View>
                    </Row>
                    <Meter value={Number(r.profit) / maxProfit} color={c.primary} track={c.surface2} height={5} delay={200 + i * 40} />
                  </PressScale>
                )
              })}
            </Card>
          )}
          {data.prods.some((r) => !Number(r.cost)) && <Txt v="tiny" muted style={{ marginTop: 8 }}>{t('unpricedNote')}</Txt>}
        </>
      )}
    </View>
  )
}

function StockReport() {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, today, version } = useOrg()
  const label = usePackLabel()
  const [period, setPeriod] = useState<'day' | 'month'>('day')
  const [date, setDate] = useState(today)
  const [month, setMonth] = useState(monthOf(today))
  const [onlyMoved, setOnlyMoved] = useState(true)
  const [shown, setShown] = useState(PAGE)
  const [from, lastDay] = period === 'day' ? [date, date] : monthRange(month)
  const to = lastDay > today ? today : lastDay
  // back to the first page whenever the list changes
  const listKey = `${from}|${to}|${onlyMoved}`
  const [lastKey, setLastKey] = useState(listKey)
  if (lastKey !== listKey) {
    setLastKey(listKey)
    setShown(PAGE)
  }

  const { data, error, loading, reload } = useLoad(async () => {
    const [catalog, rows, sales] = await Promise.all([
      loadCatalog(org.id),
      fetchAll<SummaryRow>((a, b) => supabase.rpc('stock_summary', { p_org: org.id, p_from: from, p_to: to }).order('product_id').range(a, b)),
      fetchAll<ProductSalesRow>((a, b) => supabase.rpc('product_sales', { p_org: org.id, p_from: from, p_to: to }).order('product_id').range(a, b)),
    ])
    const byProduct = new Map(sales.map((x) => [x.product_id, x]))
    return {
      catalog,
      rows: rows.map((r): ReportRow => {
        const x = byProduct.get(r.product_id)
        return {
          ...r, opening: +r.opening, purchased: +r.purchased, returned_in: +r.returned_in, sold: +r.sold, returned_out: +r.returned_out,
          damaged: +r.damaged, expired: +r.expired, adjusted: +r.adjusted, closing: +r.closing,
          soldQty: +(x?.qty ?? 0), revenue: +(x?.revenue ?? 0), cost: +(x?.cost ?? 0), profit: +(x?.profit ?? 0),
        }
      }),
    }
  }, [org.id, from, to, version])

  const inOf = (r: SummaryRow) => r.purchased + r.returned_in
  const outOf = (r: SummaryRow) => r.sold + r.returned_out + r.damaged + r.expired
  const rows = (data?.rows ?? [])
    .filter((r) => !onlyMoved || inOf(r) !== 0 || outOf(r) !== 0 || r.adjusted !== 0)
    .map((r) => ({ r, p: data!.catalog.byId.get(r.product_id) }))
    .filter((x) => x.p)
    .sort((a, b) => a.p!.name.localeCompare(b.p!.name))
  const money = rows.reduce((s, { r }) => ({ revenue: s.revenue + r.revenue, cost: s.cost + r.cost, profit: s.profit + r.profit }), { revenue: 0, cost: 0, profit: 0 })
  const m = (n: number) => fmtMoney(n, lang)
  const profitText = (n: number) => (n < 0 ? `${t('repLoss')} ${m(-n)}` : m(n))
  const exportCsv = async () => {
    if (!data) return
    await shareCsv(`stock-${period === 'day' ? date : month}`,
      [t('product'), t('company'), t('packSize'), t('opening'), t('purchased'), t('returnIn'), t('sold'), t('returnOut'), t('damaged'), t('expiredCol'), t('repSoldAt'), t('repSales'), t('repCost'), t('repProfit'), t('adjusted'), t('closing'), t('closingTotal')],
      rows.map(({ p, r }) => [p!.name, p!.company_name, fmtPack(p!.pack_size, p!.pack_unit), r.opening, r.purchased, r.returned_in, r.sold, r.returned_out, r.damaged, r.expired,
        r.soldQty > 0 ? Math.round(soldAt(r) * 100) / 100 : '', r.revenue || '', r.cost || '', r.revenue || r.profit ? r.profit : '', r.adjusted, r.closing, fmtTotal(r.closing, p!.pack_size, p!.pack_unit)]))
  }

  return (
    <View>
      <Segmented value={period} onChange={setPeriod} items={[{ value: 'day', label: t('daily') }, { value: 'month', label: t('monthly') }]} style={{ marginTop: 14 }} />
      {period === 'day' ? (
        <Row gap={8} style={{ marginTop: 12 }}>
          <View style={{ flex: 1 }}><DateField value={date} onChange={setDate} max={today} /></View>
          <ExcelButton onPress={exportCsv} disabled={!rows.length} />
        </Row>
      ) : (
        <MonthNav month={month} setMonth={setMonth} right={<ExcelButton onPress={exportCsv} disabled={!rows.length} />} />
      )}
      <Row gap={8} style={{ marginTop: 12 }}>
        <Chip label={t('onlyMoved')} active={onlyMoved} onPress={() => setOnlyMoved(true)} />
        <Chip label={t('allProducts')} active={!onlyMoved} onPress={() => setOnlyMoved(false)} />
      </Row>
      <Txt v="tiny" muted style={{ marginTop: 8 }}>{fmtDate(from, lang)} – {fmtDate(to, lang)} · {t('results', { n: rows.length })}</Txt>
      {(money.revenue !== 0 || money.profit !== 0) && (
        <Row gap={10} style={{ marginTop: 10 }}>
          <StatTile icon={<Coins size={17} color={c.primary} />} label={t('repSales')} value={money.revenue} format={m} sub={money.cost ? `${t('repCost')}: ${m(money.cost)}` : undefined} />
          <StatTile
            icon={money.profit < 0 ? <TrendingDown size={17} color={c.red} /> : <TrendingUp size={17} color={c.green} />}
            tone={money.profit < 0 ? 'red' : 'green'}
            label={t('repProfit')}
            value={money.profit}
            format={profitText}
          />
        </Row>
      )}
      <View style={{ gap: 8, marginTop: 10 }}>
        {loading && !data ? <Loading rows={5} /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : rows.length === 0 ? <Empty>{t('noData')}</Empty> : rows.slice(0, shown).map(({ r, p }) => (
          <Card key={r.product_id} onPress={() => router.push(`/product/${p!.id}`)} style={{ padding: 12, gap: 10 }}>
            <Row gap={10}>
              <ProductAvatar p={p!} size={36} />
              <View style={{ flex: 1 }}>
                <Txt v="small" weight="bold" numberOfLines={1}>{pick(p!.name, p!.name_ur)}</Txt>
                <Txt v="tiny" muted>{label(p!)}</Txt>
              </View>
            </Row>
            <Row gap={6}>
              {[
                { l: t('opening'), v: r.opening, col: c.textSoft },
                { l: t('in'), v: inOf(r), col: c.green },
                { l: t('out'), v: outOf(r), col: c.blue },
                ...(r.adjusted ? [{ l: t('adjusted'), v: r.adjusted, col: c.amber }] : []),
                { l: t('closing'), v: r.closing, col: c.text },
              ].map((x) => (
                <View key={x.l} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: c.surface2 }}>
                  <Txt v="tiny" muted numberOfLines={1}>{x.l}</Txt>
                  <Txt v="small" weight="extrabold" color={x.col} numberOfLines={1} adjustsFontSizeToFit>{fmtNum(x.v, 3)}</Txt>
                </View>
              ))}
            </Row>
            {(r.revenue !== 0 || r.profit !== 0) && (
              <Row gap={6}>
                <View style={[styles.money, { backgroundColor: c.primarySoft }]}>
                  <Txt v="tiny" muted numberOfLines={1}>{t('repSoldAt')}</Txt>
                  <Txt v="small" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit>{r.soldQty > 0 ? m(soldAt(r)) : '—'}</Txt>
                  {r.soldQty > 0 && r.cost > 0 && <Txt v="tiny" muted numberOfLines={1}>{t('repCostShort')} {m(r.cost / r.soldQty)}</Txt>}
                </View>
                <View style={[styles.money, { backgroundColor: c.surface2 }]}>
                  <Txt v="tiny" muted numberOfLines={1}>{t('repSales')}</Txt>
                  <Txt v="small" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit>{m(r.revenue)}</Txt>
                </View>
                <View style={[styles.money, { backgroundColor: r.profit < 0 ? c.redSoft : c.greenSoft }]}>
                  <Txt v="tiny" muted numberOfLines={1}>{t('repProfit')}</Txt>
                  <Txt v="small" weight="extrabold" color={r.profit < 0 ? c.red : c.green} numberOfLines={1} adjustsFontSizeToFit>{profitText(r.profit)}</Txt>
                </View>
              </Row>
            )}
          </Card>
        ))}
        {rows.length > shown && <Button variant="secondary" title={`${t('loadMore')} (${rows.length - shown})`} onPress={() => setShown((n) => n + PAGE)} />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  nav: { padding: 12, borderRadius: 14, borderWidth: 1 },
  money: { flex: 1, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center' },
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -60, opacity: 0.16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
})
