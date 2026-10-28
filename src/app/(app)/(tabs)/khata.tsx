import { router, useLocalSearchParams } from 'expo-router'
import { BellRing, HandCoins, Landmark, Plus, Sprout, Truck, Users, Wallet } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BalanceAmount, PartyAvatar } from '@/components/domain'
import { PartyFormSheet } from '@/components/forms'
import { AdvancesView } from '@/components/khata/AdvancesView'
import { RecoveryView } from '@/components/khata/RecoveryView'
import { Ambient, AnimatedNumber, Badge, Chip, Empty, ErrorBox, HScroll, IconBtn, Loading, PressScale, Row, SearchBar, Txt, haptic } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadParties } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { loadAdvances } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { useLayout } from '@/lib/responsive'
import { useTheme } from '@/lib/theme'
import type { PartyKind } from '@/lib/types'

// same ids as the web (/khata?kind=...): 'advance' = everyone holding an advance (customers and suppliers),
// 'recovery' = who owes money and by when, 'advances' = crop advances
const VIEWS = ['customer', 'supplier', 'advance', 'recovery', 'advances'] as const
type View_ = (typeof VIEWS)[number]
const asView = (p?: string): View_ => VIEWS.find((v) => v === p) ?? 'customer'

export default function Khata() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { width, contentWidth } = useLayout()
  const side = (width - contentWidth) / 2
  const { org, version, refresh } = useOrg()
  const params = useLocalSearchParams<{ kind?: string }>()
  const [view, setView] = useState<View_>(() => asView(params.kind))
  const [lastParam, setLastParam] = useState(params.kind)
  // opening /khata?kind=... again (e.g. from a home tile) switches the view
  if (params.kind !== lastParam) {
    setLastParam(params.kind)
    setView(asView(params.kind))
  }
  const kind: PartyKind = view === 'supplier' ? 'supplier' : 'customer'
  const partyView = view === 'customer' || view === 'supplier' || view === 'advance'
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, error, loading, reload } = useLoad(() => loadParties(org.id), [org.id, version])
  // crop advances (migration 013); the list view shows the error, the summary card just hides
  const crop = useLoad(() => loadAdvances(org.id), [org.id, version])
  const cropHeld = (crop.data ?? []).reduce((s, a) => s + Math.max(a.balance, 0), 0)
  const cropOpen = (crop.data ?? []).filter((a) => !a.is_closed).length

  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return (data ?? [])
      .filter((p) => (view === 'advance' ? p.balance < -0.005 : p.kind === view))
      .filter((p) => terms.every((x) => `${p.name} ${p.phone ?? ''} ${p.address ?? ''}`.toLowerCase().includes(x)))
      .sort((a, b) => (view === 'advance' ? a.balance - b.balance : b.balance - a.balance) || a.name.localeCompare(b.name))
  }, [data, view, q])

  const all = data ?? []
  const customers = all.filter((p) => p.kind === 'customer')
  const suppliers = all.filter((p) => p.kind === 'supplier')
  const receivable = customers.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const payable = suppliers.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const advances = all.filter((p) => p.balance < -0.005)
  const advanceIn = -advances.filter((p) => p.kind === 'customer').reduce((s, p) => s + p.balance, 0)
  const advanceOut = -advances.filter((p) => p.kind === 'supplier').reduce((s, p) => s + p.balance, 0)
  const m = (n: number) => fmtMoney(n, lang)
  const advanceSub = [advanceOut > 0 ? `${t('supplierAdvance')}: ${m(advanceOut)}` : null, cropHeld > 0 ? `${t('khCropHeld')}: ${m(cropHeld)}` : null].filter(Boolean).join('\n')

  const tint = (v: View_) => (view === v ? c.primaryText : c.muted)
  const chips: { v: View_; label: string; icon: React.ReactNode; count?: number }[] = [
    { v: 'customer', label: t('customers'), icon: <Users size={15} color={tint('customer')} />, count: customers.length },
    { v: 'supplier', label: t('suppliers'), icon: <Truck size={15} color={tint('supplier')} />, count: suppliers.length },
    { v: 'advance', label: t('advanceTab'), icon: <Wallet size={15} color={tint('advance')} />, count: advances.length },
    { v: 'recovery', label: t('khRecovery'), icon: <BellRing size={15} color={tint('recovery')} /> },
    { v: 'advances', label: t('khCropAdvances'), icon: <Sprout size={15} color={tint('advances')} />, count: cropOpen || undefined },
  ]
  const pick = (v: View_) => {
    setView(v)
    router.setParams({ kind: v })
  }

  const totals = (
    <Row gap={8} center={false} style={{ marginBottom: 4 }}>
      <TotalCard on={view === 'customer'} onPress={() => pick('customer')} icon={<HandCoins size={16} color={c.amber} />} label={t('totalReceivable')} value={receivable} format={m} color={c.amber} soft={c.amberSoft} />
      <TotalCard on={view === 'supplier'} onPress={() => pick('supplier')} icon={<Landmark size={16} color={c.red} />} label={t('totalPayable')} value={payable} format={m} color={c.red} soft={c.redSoft} />
      <TotalCard on={view === 'advance'} onPress={() => pick('advance')} icon={<Wallet size={16} color={c.blue} />} label={t('totalAdvance')} value={advanceIn} format={m} color={c.blue} soft={c.blueSoft} sub={advanceSub} />
    </Row>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient />
      <View collapsable={false} style={{ paddingTop: insets.top + 8, paddingHorizontal: side }}>
        <Row between>
          <Txt v="h1">{t('navKhata')}</Txt>
          {partyView && (
            <IconBtn icon={<Plus size={20} color={c.primaryText} />} onPress={() => setAdding(true)} style={{ backgroundColor: c.primary, borderWidth: 0 }} label={kind === 'customer' ? t('addCustomer') : t('addSupplier')} />
          )}
        </Row>
        <HScroll style={{ marginTop: 12 }} focus={chips.findIndex((x) => x.v === view)}>
          {chips.map((x) => <Chip key={x.v} label={x.label} icon={x.icon} count={x.count} active={view === x.v} onPress={() => pick(x.v)} />)}
        </HScroll>
        <SearchBar value={q} onChangeText={setQ} style={{ marginTop: 12 }} />
      </View>

      {view === 'advances' ? (
        <AdvancesView advances={crop.data} error={crop.error} loading={crop.loading} reload={crop.reload} q={q} customers={customers} />
      ) : loading && !data ? (
        <View style={{ paddingHorizontal: side, paddingVertical: 20 }}><Loading /></View>
      ) : error && !data ? (
        <View style={{ paddingHorizontal: side, paddingVertical: 20 }}><ErrorBox error={error} onRetry={reload} /></View>
      ) : view === 'recovery' ? (
        <RecoveryView parties={all} q={q} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: side, paddingTop: 12, paddingBottom: 140, gap: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={totals}
          ListEmptyComponent={
            <Empty icon={<Users size={30} color={c.muted} />}>{view === 'advance' ? t('noAdvances') : kind === 'customer' ? t('noCustomers') : t('noSuppliers')}</Empty>
          }
          renderItem={({ item: p }) => (
            <Pressable
              onPress={() => { haptic.tap(); router.push(`/party/${p.id}`) }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: c.border })}
            >
              <PartyAvatar name={p.name} kind={p.kind} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt weight="bold" numberOfLines={1}>{p.name}</Txt>
                {view === 'advance' && <Badge tone={p.kind === 'customer' ? 'green' : 'violet'}>{p.kind === 'customer' ? t('customer') : t('supplier')}</Badge>}
                <Txt v="tiny" muted numberOfLines={1}>{[p.phone, p.address, p.last_activity ? fmtDate(p.last_activity, lang) : null].filter(Boolean).join(' · ') || '—'}</Txt>
              </View>
              <BalanceAmount kind={p.kind} balance={p.balance} />
            </Pressable>
          )}
        />
      )}
      <PartyFormSheet open={adding} onClose={() => setAdding(false)} kind={kind} onSaved={(id) => { setAdding(false); refresh(); router.push(`/party/${id}`) }} />
    </View>
  )
}

function TotalCard({ on, onPress, icon, label, value, format, color, soft, sub }: { on: boolean; onPress: () => void; icon: React.ReactNode; label: string; value: number; format: (n: number) => string; color: string; soft: string; sub?: string }) {
  const { c } = useTheme()
  return (
    <PressScale onPress={onPress} style={[styles.total, { backgroundColor: on ? soft : c.surface, borderColor: on ? color + '70' : c.border }]}>
      <Row gap={6} center={false}>{icon}<Txt v="tiny" muted numberOfLines={2} style={{ flex: 1 }}>{label}</Txt></Row>
      <AnimatedNumber value={value} format={format} size={17} color={color} style={{ marginTop: 8 }} />
      {!!sub && <Txt v="tiny" muted numberOfLines={2} adjustsFontSizeToFit style={{ marginTop: 2 }}>{sub}</Txt>}
    </PressScale>
  )
}

const styles = StyleSheet.create({
  total: { flex: 1, minWidth: 0, padding: 12, borderRadius: 20, borderWidth: 1.5 },
})
