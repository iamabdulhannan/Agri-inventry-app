import { useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Banknote, CheckCircle2, Info, Lock, Package, PackagePlus, Pencil, Phone, Scale, TrendingUp, Wallet } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { InvestorAvatar, Note, statusText, useInvErr } from '@/components/invest/common'
import { InvestorFormSheet } from '@/components/invest/InvestorFormSheet'
import { MoneySheet } from '@/components/invest/MoneySheet'
import { SettleSheet } from '@/components/invest/SettleSheet'
import { StockSheet } from '@/components/invest/StockSheet'
import { DailyView, HistoryList, LotsList } from '@/components/invest/tabs'
import { AnimatedNumber, Empty, ErrorBox, Grid, IconBtn, IconTile, Loading, PressScale, Row, Screen, SectionTitle, Segmented, StatTile, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { fetchAll, useLoad } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { investorStatus, loadInvestors, type LotStatus } from '@/lib/investors'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { toneColors, useTheme, type Tone } from '@/lib/theme'
import { fmtNum } from '@/lib/units'

type Tab = 'stock' | 'daily' | 'history'
type Dialog = null | 'capital' | 'stock' | 'withdraw' | 'settle' | 'edit'

export default function InvestorDetail() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version, isAdmin, refresh } = useOrg()
  const errOf = useInvErr()
  const [tab, setTab] = useState<Tab>('stock')
  const [dialog, setDialog] = useState<Dialog>(null)
  const { data, error, loading, reload } = useLoad(async () => {
    if (!isAdmin) return null
    const [all, lots] = await Promise.all([
      loadInvestors(org.id),
      fetchAll<LotStatus>((a, b) => supabase.from('investor_lot_status').select('*').eq('investor_id', id).order('entry_date', { ascending: false }).range(a, b)),
    ])
    return {
      inv: all.find((x) => x.id === id) ?? null,
      lots: lots.map((l) => ({ ...l, qty: +l.qty, unit_cost: +l.unit_cost, sold: +l.sold, left_qty: +l.left_qty, revenue: +l.revenue, gross_profit: +l.gross_profit, pack_size: +l.pack_size })),
    }
  }, [org.id, id, version, isAdmin])

  if (!isAdmin) return <Screen back title={t('invTitle')}><Empty icon={<Lock size={30} color={c.muted} />}>{t('mInvAdminOnly')}</Empty></Screen>
  if (loading && !data) return <Screen back><Loading /></Screen>
  if (error && !data) return <Screen back title={t('invTitle')}><ErrorBox onRetry={reload}>{errOf(error)}</ErrorBox></Screen>
  if (!data?.inv) return <Screen back title={t('invTitle')}><Empty>{t('errNotFound')}</Empty></Screen>

  const r = data.inv
  const m = (v: number) => fmtMoney(v, lang)
  const st = investorStatus(r)
  const close = () => setDialog(null)
  const done = () => {
    setDialog(null)
    refresh()
  }
  const actions: { key: Exclude<Dialog, null | 'edit'>; label: string; icon: (color: string) => ReactNode; tone: Tone; disabled?: boolean; glow?: boolean }[] = [
    { key: 'capital', label: t('invAddCapital'), icon: (col) => <Banknote size={20} color={col} />, tone: 'primary' },
    { key: 'stock', label: t('invAddStock'), icon: (col) => <PackagePlus size={20} color={col} />, tone: 'blue' },
    { key: 'withdraw', label: t('invWithdrawProfit'), icon: (col) => <Wallet size={20} color={col} />, tone: 'orange', disabled: r.profit_now <= 0 },
    { key: 'settle', label: t('invSettle'), icon: (col) => <Scale size={20} color={col} />, tone: 'amber', disabled: st === 'empty', glow: st === 'ready' },
  ]

  return (
    <Screen
      back
      title={r.name}
      subtitle={t('invTitle')}
      right={<IconBtn icon={<Pencil size={18} color={c.text} />} onPress={() => setDialog('edit')} label={t('edit')} />}
      refreshing={loading}
      onRefresh={reload}
    >
      {/* hero: capital, share, status */}
      <View style={{ borderRadius: 28, overflow: 'hidden' }}>
        <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
          <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
          <Row gap={12}>
            <InvestorAvatar name={r.name} size={50} tone="primary" />
            <View style={{ flex: 1 }}>
              <Txt v="label" color="rgba(236,255,240,0.7)">{t('invCapital')}</Txt>
              <AnimatedNumber value={r.capital} format={m} size={32} color="#F4FFF6" />
            </View>
          </Row>
          <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <View style={styles.chip}><TrendingUp size={12} color="#C8FF4D" /><Txt v="tiny" color="#E9FFE0">{t('invShareShort', { n: fmtNum(r.profit_share) })}</Txt></View>
            <View style={styles.chip}>
              {st === 'ready' ? <CheckCircle2 size={12} color="#C8FF4D" /> : st === 'selling' ? <Package size={12} color="#FCD34D" /> : <Wallet size={12} color="#93C5FD" />}
              <Txt v="tiny" color="#E9FFE0">{statusText(r, t)}</Txt>
            </View>
            {!!r.phone && <View style={styles.chip}><Phone size={12} color="#C8FF4D" /><Txt v="tiny" color="#E9FFE0">{r.phone}</Txt></View>}
          </Row>
          {Math.abs(r.open_gross) > 0.005 && (
            <Txt v="tiny" color="rgba(236,255,240,0.75)" style={{ marginTop: 10 }}>
              {t('invGross')}: {m(r.open_gross)} · {t('invShopShare')}: {m(r.open_gross - r.open_profit)}
            </Txt>
          )}
        </LinearGradient>
      </View>

      {/* figures */}
      <Grid style={{ marginTop: 12 }}>
        <StatTile icon={<Package size={17} color={c.amber} />} tone="amber" label={t('invInStock')} value={r.stock_cost} format={m} sub={r.units_left > 0 ? t('invUnitsLeft', { n: fmtNum(r.units_left, 3) }) : undefined} />
        <StatTile icon={<TrendingUp size={17} color={r.profit_now < 0 ? c.red : c.green} />} tone={r.profit_now < 0 ? 'red' : 'green'} label={t('invProfitSoFar')} value={r.profit_now} format={m} />
        <StatTile icon={<Wallet size={17} color={c.blue} />} tone="blue" label={t('invAvailable')} value={r.available} format={m} />
        <StatTile icon={<Banknote size={17} color={c.orange} />} tone="orange" label={t('invPaidOut')} value={r.total_paid_out} format={m} />
      </Grid>

      {/* actions */}
      <SectionTitle>{t('mInvActions')}</SectionTitle>
      <Grid>
        {actions.map((a) => {
          const tc = toneColors(c, a.tone)
          return (
            <PressScale
              key={a.key}
              onPress={() => setDialog(a.key)}
              disabled={a.disabled}
              style={{ flex: 1, minHeight: 92, padding: 12, gap: 10, borderRadius: 20, backgroundColor: a.glow ? tc.bg : c.surface, borderWidth: a.glow ? 1.5 : 1, borderColor: a.glow ? tc.fg + '70' : c.border }}
            >
              <IconTile icon={a.icon(tc.fg)} tone={a.tone} size={36} />
              <Txt v="small" weight="bold" numberOfLines={2}>{a.label}</Txt>
            </PressScale>
          )
        })}
      </Grid>
      {st === 'ready' && (
        <View style={{ marginTop: 10 }}>
          <Note tone="green" icon={<CheckCircle2 size={18} color={c.green} />}>{t('invStatusReady')}</Note>
        </View>
      )}
      <View style={{ marginTop: 10 }}>
        <Note tone="stone" icon={<Info size={16} color={c.muted} />}>{t('mInvHowItWorks', { n: fmtNum(r.profit_share) })}</Note>
      </View>

      {/* tabs */}
      <Segmented
        value={tab}
        onChange={setTab}
        items={[
          { value: 'stock', label: t('invTabStock') },
          { value: 'daily', label: t('invTabDaily') },
          { value: 'history', label: t('invTabHistory') },
        ]}
        style={{ marginTop: 18, marginBottom: 12 }}
      />
      {tab === 'stock' && <LotsList lots={data.lots} share={r.profit_share} />}
      {tab === 'daily' && <DailyView investor={r} />}
      {tab === 'history' && <HistoryList investor={r} />}

      <MoneySheet kind="capital" open={dialog === 'capital'} investor={r} onClose={close} onDone={done} />
      <MoneySheet kind="withdraw" open={dialog === 'withdraw'} investor={r} onClose={close} onDone={done} />
      <StockSheet open={dialog === 'stock'} investor={r} onClose={close} onDone={done} />
      <SettleSheet open={dialog === 'settle'} investor={r} onClose={close} onDone={done} />
      <InvestorFormSheet open={dialog === 'edit'} investor={r} onClose={close} onSaved={done} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -100, right: -70, opacity: 0.16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
})
