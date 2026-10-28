import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Coins, FileSpreadsheet, HandCoins, Lock, Package, Plus, TrendingUp, Wallet } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { investorHref, statusText, useInvErr } from '@/components/invest/common'
import { InvestorCard } from '@/components/invest/InvestorCard'
import { InvestorFormSheet } from '@/components/invest/InvestorFormSheet'
import { AnimatedNumber, Button, Card, Empty, ErrorBox, IconBtn, IconTile, Loading, Row, Screen, SectionTitle, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { loadInvestors, type InvestorRow } from '@/lib/investors'
import { fmtMoney } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { useTheme, type Tone } from '@/lib/theme'

export default function InvestorsList() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version, isAdmin, refresh } = useOrg()
  const { toast } = useFeedback()
  const errOf = useInvErr()
  const [adding, setAdding] = useState(false)
  const { data, error, loading, reload } = useLoad(() => (isAdmin ? loadInvestors(org.id) : Promise.resolve([] as InvestorRow[])), [org.id, version, isAdmin])

  if (!isAdmin) {
    return (
      <Screen back title={t('invTitle')}>
        <Empty icon={<Lock size={30} color={c.muted} />}>{t('mInvAdminOnly')}</Empty>
      </Screen>
    )
  }

  const list = data ?? []
  const tot = list.reduce((s, r) => ({ capital: s.capital + r.capital, stock: s.stock + r.stock_cost, profit: s.profit + r.profit_now, avail: s.avail + r.available }), { capital: 0, stock: 0, profit: 0, avail: 0 })
  const m = (v: number) => fmtMoney(v, lang)
  // share of the capital that sits in stock (the rest waits to buy stock)
  const split = tot.stock + tot.avail > 0.005
  const inStock = split ? tot.stock / (tot.stock + tot.avail) : 0

  const exportCsv = () =>
    shareCsv('investors', [t('name'), t('invShare'), t('invCapital'), t('invInStock'), t('invProfitSoFar'), t('invAvailable'), t('invPaidOut'), t('status')],
      list.map((r) => [r.name, r.profit_share, r.capital, r.stock_cost, r.profit_now, r.available, r.total_paid_out, statusText(r, t)])).catch((e) => toast(errOf(e), 'err'))

  return (
    <Screen
      back
      title={t('invTitle')}
      subtitle={list.length ? t('mInvCount', { n: list.length }) : undefined}
      right={
        <Row gap={8}>
          {list.length > 0 && <IconBtn icon={<FileSpreadsheet size={19} color={c.green} />} onPress={exportCsv} label={t('exportExcel')} />}
          <IconBtn icon={<Plus size={20} color={c.primaryText} />} onPress={() => setAdding(true)} style={{ backgroundColor: c.primary, borderWidth: 0 }} label={t('invAdd')} />
        </Row>
      }
      refreshing={loading && !!data}
      onRefresh={reload}
    >
      {loading && !data ? <Loading /> : error && !data ? <ErrorBox onRetry={reload}>{errOf(error)}</ErrorBox> : list.length === 0 ? (
        <Card style={{ marginTop: 4 }}>
          <Empty icon={<HandCoins size={30} color={c.muted} />} action={<Button title={t('invAdd')} icon={<Plus size={18} color={c.primaryText} />} onPress={() => setAdding(true)} />}>
            {t('invNone')}
          </Empty>
          <Txt v="tiny" muted align="center">{t('invSubtitle')}</Txt>
        </Card>
      ) : (
        <>
          <View style={{ borderRadius: 28, overflow: 'hidden' }}>
            <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
              <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
              <Row gap={8}>
                <Coins size={16} color="#C8FF4D" />
                <Txt v="label" color="rgba(236,255,240,0.75)" style={{ flex: 1 }} numberOfLines={1}>{t('invTotalCapital')}</Txt>
              </Row>
              <AnimatedNumber value={tot.capital} format={m} size={34} color="#F4FFF6" style={{ marginTop: 4 }} />
              {split && (
                <>
                  <Txt v="tiny" color="rgba(236,255,240,0.7)" style={{ marginTop: 14 }}>{t('mInvSplit')}</Txt>
                  <View style={styles.split}>
                    <View style={{ flex: Math.max(inStock, 0.0001), backgroundColor: '#C8FF4D' }} />
                    <View style={{ flex: Math.max(1 - inStock, 0.0001), backgroundColor: 'rgba(147,197,253,0.85)' }} />
                  </View>
                  <Row gap={14} style={{ marginTop: 10, flexWrap: 'wrap' }}>
                    <Row gap={6}><View style={[styles.dot, { backgroundColor: '#C8FF4D' }]} /><Txt v="tiny" color="#E9FFE0">{t('invInStock')} · {Math.round(inStock * 100)}%</Txt></Row>
                    <Row gap={6}><View style={[styles.dot, { backgroundColor: 'rgba(147,197,253,0.85)' }]} /><Txt v="tiny" color="#E9FFE0">{t('invAvailable')} · {Math.round((1 - inStock) * 100)}%</Txt></Row>
                  </Row>
                </>
              )}
            </LinearGradient>
          </View>

          <Card padded={false} style={{ marginTop: 12, paddingHorizontal: 14 }}>
            <TotalRow first icon={<Package size={18} color={c.amber} />} tone="amber" label={t('invTotalStock')} value={m(tot.stock)} />
            <TotalRow icon={<TrendingUp size={18} color={tot.profit < 0 ? c.red : c.green} />} tone={tot.profit < 0 ? 'red' : 'green'} label={t('invTotalProfit')} value={m(tot.profit)} color={tot.profit < 0 ? c.red : c.green} />
            <TotalRow icon={<Wallet size={18} color={c.blue} />} tone="blue" label={t('invTotalAvailable')} value={m(tot.avail)} color={c.blue} />
          </Card>

          <SectionTitle>{t('invTitle')}</SectionTitle>
          <View style={{ gap: 10 }}>
            {list.map((r) => <InvestorCard key={r.id} r={r} onPress={() => router.push(investorHref(r.id))} />)}
          </View>
        </>
      )}
      <InvestorFormSheet open={adding} onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); refresh(); router.push(investorHref(id)) }} />
    </Screen>
  )
}

function TotalRow({ icon, tone, label, value, color, first }: { icon: ReactNode; tone: Tone; label: string; value: string; color?: string; first?: boolean }) {
  const { c } = useTheme()
  return (
    <Row gap={12} style={{ paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <IconTile icon={icon} tone={tone} size={36} />
      <Txt v="small" soft style={{ flex: 1 }} numberOfLines={2}>{label}</Txt>
      <Txt weight="extrabold" color={color} style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
    </Row>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -100, right: -70, opacity: 0.16 },
  split: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 6, gap: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
})
