import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  AlertTriangle, ArrowDownToLine, BellRing, CheckCircle2, ChevronRight, Droplets, HandCoins, Landmark, NotebookPen,
  Package, ReceiptText, ScanBarcode, TrendingDown, TrendingUp, Wallet, Weight,
} from 'lucide-react-native'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Bars } from '@/components/charts'
import { MovementRow, ProductAvatar, ProductRow, usePackLabel } from '@/components/domain'
import { AnimatedNumber, Badge, Card, Empty, ErrorBox, IconTile, Loading, PressScale, Rise, Row, Screen, SectionTitle, StatTile, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadCatalog } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { addDays, fmtDate, weekday } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { toneColors, useTheme, type Tone } from '@/lib/theme'
import type { ExpiryAlert, MoneySummary, Movement, SalesDay } from '@/lib/types'
import { fmtBase, fmtNum, totalsByMeasure } from '@/lib/units'

export default function Home() {
  const { org, version, today, profile, refresh } = useOrg()
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const label = usePackLabel()

  const { data, error, loading, reload } = useLoad(async () => {
    const from = addDays(today, -6)
    const [catalog, alerts, recent, money, days] = await Promise.all([
      loadCatalog(org.id),
      supabase.from('expiry_alerts').select('*').eq('org_id', org.id).order('expiry_date').limit(200),
      supabase.from('stock_movements').select('*, batches(batch_no, expiry_date, product_id), profiles(full_name)').eq('org_id', org.id).order('created_at', { ascending: false }).limit(6),
      supabase.rpc('money_summary', { p_org: org.id, p_today: today }),
      supabase.rpc('sales_days', { p_org: org.id, p_from: from, p_to: today }),
    ])
    for (const r of [alerts, recent]) if (r.error) throw r.error
    const byDay = new Map(((days.data ?? []) as SalesDay[]).map((d) => [String(d.day).slice(0, 10), Number(d.sales)]))
    const week = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => ({ d, v: byDay.get(d) ?? 0 }))
    return {
      catalog,
      alerts: (alerts.data ?? []) as ExpiryAlert[],
      recent: (recent.data ?? []) as Movement[],
      money: money.error ? null : ((money.data as MoneySummary[])?.[0] ?? null),
      week,
    }
  }, [org.id, version, today])

  const hour = new Date().getHours()
  const greet = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening')
  const firstName = profile?.full_name?.split(' ')[0] ?? ''
  const m = (n: number) => fmtMoney(n, lang)

  const header = (
    <Row between style={{ marginBottom: 18 }}>
      <View style={{ flex: 1 }}>
        <Txt v="small" muted>{greet}{firstName ? `, ${firstName}` : ''} 👋</Txt>
        <Txt v="h1" numberOfLines={1}>{org.name}</Txt>
      </View>
      <PressScale onPress={() => router.push('/expiry')} style={[styles.bell, { backgroundColor: c.surface, borderColor: c.border }]}>
        <BellRing size={20} color={data?.alerts.length ? c.amber : c.textSoft} />
        {!!data?.alerts.length && (
          <View style={[styles.dot, { backgroundColor: c.red, borderColor: c.bg }]}>
            <Txt v="tiny" color="#fff" style={{ fontSize: 9 }}>{data.alerts.length > 99 ? '99+' : data.alerts.length}</Txt>
          </View>
        )}
      </PressScale>
    </Row>
  )

  if (loading && !data) return <Screen tabInset>{header}<Loading /></Screen>
  if (error && !data) return <Screen tabInset>{header}<ErrorBox error={error} onRetry={reload} /></Screen>
  if (!data) return null

  const { catalog, alerts, recent, money, week } = data
  const active = catalog.products.filter((p) => p.is_active)
  const totals = totalsByMeasure(active, (p) => ({ packs: Math.max(0, p.qty), size: p.pack_size, unit: p.pack_unit }))
  const low = active.filter((p) => p.min_stock > 0 && p.qty <= p.min_stock).sort((a, b) => a.qty - b.qty)
  const expired = alerts.filter((a) => a.days_left < 0)
  const yesterday = week[5]?.v ?? 0
  const todaySales = money?.today_sales ?? week[6]?.v ?? 0
  const change = yesterday > 0 ? ((todaySales - yesterday) / yesterday) * 100 : null

  const actions: { icon: typeof ScanBarcode; label: string; tone: Tone; go: () => void }[] = [
    { icon: ScanBarcode, label: t('newSale'), tone: 'primary', go: () => router.push('/sale') },
    { icon: ArrowDownToLine, label: t('navStockIn'), tone: 'green', go: () => router.push('/stock-in') },
    { icon: HandCoins, label: t('receivePayment'), tone: 'amber', go: () => router.push('/khata') },
    { icon: NotebookPen, label: t('navRoznamcha'), tone: 'violet', go: () => router.push('/roznamcha') },
  ]

  return (
    <Screen tabInset refreshing={loading} onRefresh={() => { refresh(); reload() }}>
      {header}

      {/* hero */}
      <Rise>
        <PressScale onPress={() => router.push('/invoices')} scaleTo={0.985} style={styles.heroShell}>
          <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={[styles.heroBlob, { backgroundColor: c.heroGlow, opacity: 0.18, top: -70, right: -50 }]} />
            <View style={[styles.heroBlob, { backgroundColor: '#34D399', opacity: 0.14, bottom: -90, left: -60 }]} />
            <Row between>
              <Txt v="label" color="rgba(236,255,240,0.7)">{t('todaySales')}</Txt>
              <Txt v="tiny" color="rgba(236,255,240,0.7)">{fmtDate(today, lang)}</Txt>
            </Row>
            <AnimatedNumber value={todaySales} format={m} size={40} color="#F4FFF6" style={{ marginTop: 6 }} />
            <Row gap={8} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {money && (
                <View style={styles.heroChip}>
                  <TrendingUp size={13} color="#C8FF4D" />
                  <Txt v="tiny" color="#E9FFE0">{t('profit')} {m(money.today_profit)}</Txt>
                </View>
              )}
              {change !== null && (
                <View style={styles.heroChip}>
                  {change >= 0 ? <TrendingUp size={13} color="#C8FF4D" /> : <TrendingDown size={13} color="#FDA4AF" />}
                  <Txt v="tiny" color="#E9FFE0">{change >= 0 ? '+' : ''}{fmtNum(change, 0)}%</Txt>
                </View>
              )}
              {money && (
                <View style={styles.heroChip}>
                  <Wallet size={13} color="#C8FF4D" />
                  <Txt v="tiny" color="#E9FFE0">{t('received')} {m(money.today_received)}</Txt>
                </View>
              )}
            </Row>
            <View style={{ marginTop: 18 }}>
              <Bars data={week.map((w) => w.v)} height={58} color="#C8FF4D" dim="rgba(236,255,240,0.22)" labels={week.map((w) => weekday(w.d, lang))} labelColor="rgba(236,255,240,0.6)" />
            </View>
          </LinearGradient>
        </PressScale>
      </Rise>

      {/* quick actions */}
      <Rise i={1}>
        <Row gap={10} center={false} style={{ marginTop: 16 }}>
          {actions.map(({ icon: Icon, label: l, tone, go }) => {
            const tc = toneColors(c, tone)
            return (
              <PressScale key={l} onPress={go} style={[styles.action, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={[styles.actionIcon, { backgroundColor: tc.bg }]}><Icon size={22} color={tc.fg} /></View>
                <Txt v="tiny" align="center" numberOfLines={2} style={{ marginTop: 8 }}>{l}</Txt>
              </PressScale>
            )
          })}
        </Row>
      </Rise>

      {/* expiry */}
      <Rise i={2}>
        <SectionTitle action={alerts.length ? t('viewAll') : undefined} onAction={() => router.push('/expiry')}>{t('expiryAlerts')}</SectionTitle>
        {alerts.length === 0 ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconTile icon={<CheckCircle2 size={20} color={c.green} />} tone="green" />
            <View style={{ flex: 1 }}>
              <Txt weight="bold">{t('allGood')}</Txt>
              <Txt v="tiny" muted>{t('noExpiry', { d: org.expiry_alert_days })}</Txt>
            </View>
          </Card>
        ) : (
          <>
            <Row gap={8} style={{ marginBottom: 10 }}>
              {expired.length > 0 && <Badge tone="red" icon={<AlertTriangle size={11} color={c.red} />}>{t('expiredCount', { n: expired.length })}</Badge>}
              {alerts.length - expired.length > 0 && <Badge tone="amber">{t('expiringCount', { n: alerts.length - expired.length, d: org.expiry_alert_days })}</Badge>}
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 20 }} style={{ marginHorizontal: -20, paddingLeft: 20 }}>
              {alerts.slice(0, 10).map((a) => {
                const bad = a.days_left < 0
                const tc = toneColors(c, bad ? 'red' : 'amber')
                return (
                  <PressScale key={a.batch_id} onPress={() => router.push(`/product/${a.product_id}`)} style={[styles.expCard, { backgroundColor: c.surface, borderColor: tc.fg + '50' }]}>
                    <Row between>
                      <ProductAvatar p={a} size={36} />
                      <View style={{ backgroundColor: tc.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }}>
                        <Txt v="tiny" color={tc.fg}>{bad ? t('expired') : a.days_left === 0 ? t('expiresToday') : t('daysLeft', { n: a.days_left })}</Txt>
                      </View>
                    </Row>
                    <Txt weight="bold" numberOfLines={1} style={{ marginTop: 10 }}>{pick(a.name, a.name_ur)}</Txt>
                    <Txt v="tiny" muted numberOfLines={1}>{label(a)} · #{a.batch_no}</Txt>
                    <Row between style={{ marginTop: 8 }}>
                      <Txt v="tiny" muted>{fmtDate(a.expiry_date, lang)}</Txt>
                      <Txt v="small" weight="extrabold">{fmtNum(a.qty, 3)}</Txt>
                    </Row>
                  </PressScale>
                )
              })}
            </ScrollView>
          </>
        )}
      </Rise>

      {/* money */}
      {money && (
        <Rise i={3}>
          <SectionTitle>{t('money')}</SectionTitle>
          <View style={styles.grid}>
            <StatTile icon={<Wallet size={18} color={c.primary} />} label={t('cashInHand')} value={money.cash_in_hand} format={m} onPress={() => router.push('/roznamcha')} />
            <StatTile icon={<TrendingUp size={18} color={c.green} />} tone="green" label={t('monthSales')} value={money.month_sales} format={m} sub={`${t('profit')}: ${m(money.month_profit)}`} onPress={() => router.push('/reports')} />
          </View>
          <View style={[styles.grid, { marginTop: 10 }]}>
            <StatTile icon={<HandCoins size={18} color={c.amber} />} tone="amber" label={t('totalReceivable')} value={money.receivable} format={m} onPress={() => router.push({ pathname: '/khata', params: { kind: 'customer' } })} />
            <StatTile icon={<Landmark size={18} color={c.red} />} tone="red" label={t('totalPayable')} value={money.payable} format={m} onPress={() => router.push({ pathname: '/khata', params: { kind: 'supplier' } })} />
          </View>
          <View style={[styles.grid, { marginTop: 10 }]}>
            <StatTile icon={<Package size={18} color={c.blue} />} tone="blue" label={t('stockValue')} value={money.stock_value} format={m} onPress={() => router.push('/products')} />
            <StatTile icon={<ReceiptText size={18} color={c.violet} />} tone="violet" label={t('todayExpenses')} value={money.today_expenses} format={m} onPress={() => router.push('/roznamcha')} />
          </View>
        </Rise>
      )}

      {/* stock */}
      <Rise i={4}>
        <SectionTitle>{t('stockOverview')}</SectionTitle>
        <Card padded={false} style={{ flexDirection: 'row' }}>
          {[
            { icon: <Package size={18} color={c.primary} />, label: t('totalProducts'), value: fmtNum(active.length) },
            { icon: <Droplets size={18} color={c.blue} />, label: t('totalLiters'), value: fmtBase(totals.volume, 'volume', lang) },
            { icon: <Weight size={18} color={c.amber} />, label: t('totalKg'), value: fmtBase(totals.weight, 'weight', lang) },
          ].map((s, i) => (
            <View key={s.label} style={{ flex: 1, padding: 14, gap: 6, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
              {s.icon}
              <Txt v="h3" numberOfLines={1} adjustsFontSizeToFit>{s.value}</Txt>
              <Txt v="tiny" muted numberOfLines={1}>{s.label}</Txt>
            </View>
          ))}
        </Card>
      </Rise>

      {low.length > 0 && (
        <Rise i={5}>
          <SectionTitle action={t('viewAll')} onAction={() => router.push({ pathname: '/products', params: { filter: 'low' } })}>
            {t('lowStock')} <Txt v="small" color={c.red}>({low.length})</Txt>
          </SectionTitle>
          <View style={{ gap: 8 }}>
            {low.slice(0, 4).map((p) => <ProductRow key={p.id} p={p} today={today} alertDays={org.expiry_alert_days} onPress={() => router.push(`/product/${p.id}`)} />)}
          </View>
        </Rise>
      )}

      <Rise i={6}>
        <SectionTitle action={t('viewAll')} onAction={() => router.push('/history')}>{t('recentActivity')}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {recent.length === 0 ? <Empty>{t('noActivity')}</Empty> : recent.map((mv, i) => (
            <View key={mv.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <MovementRow m={mv} p={mv.batches ? catalog.byId.get(mv.batches.product_id) : undefined} onPress={mv.batches ? () => router.push(`/product/${mv.batches!.product_id}`) : undefined} />
            </View>
          ))}
        </Card>
        <PressScale onPress={() => router.push('/reports')} style={[styles.reportLink, { backgroundColor: c.surface, borderColor: c.border }]}>
          <IconTile icon={<TrendingUp size={18} color={c.primary} />} />
          <View style={{ flex: 1 }}>
            <Txt weight="bold">{t('reports')}</Txt>
            <Txt v="tiny" muted>{t('salesProfit')} · {t('daily')} · {t('monthly')}</Txt>
          </View>
          <ChevronRight size={18} color={c.muted} />
        </PressScale>
      </Rise>
    </Screen>
  )
}

const styles = StyleSheet.create({
  bell: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dot: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2 },
  heroShell: { borderRadius: 30, overflow: 'hidden', shadowColor: '#0F5132', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  hero: { padding: 20, borderRadius: 30, overflow: 'hidden' },
  heroBlob: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  action: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderRadius: 22, borderWidth: 1 },
  actionIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  expCard: { width: 190, padding: 14, borderRadius: 22, borderWidth: 1 },
  grid: { flexDirection: 'row', gap: 10 },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, borderWidth: 1, marginTop: 12 },
})
