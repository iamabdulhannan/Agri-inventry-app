import { router, useLocalSearchParams } from 'expo-router'
import { HandCoins, Landmark, Plus, Users } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BalanceAmount, PartyAvatar } from '@/components/domain'
import { PartyFormSheet } from '@/components/forms'
import { Ambient, AnimatedNumber, Empty, ErrorBox, IconBtn, Loading, PressScale, Row, SearchBar, Txt, haptic } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLayout } from '@/lib/responsive'
import { loadParties } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { useTheme } from '@/lib/theme'
import type { PartyKind } from '@/lib/types'

export default function Khata() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { width, contentWidth } = useLayout()
  const side = (width - contentWidth) / 2
  const { org, version, refresh } = useOrg()
  const params = useLocalSearchParams<{ kind?: string }>()
  const [kind, setKind] = useState<PartyKind>(params.kind === 'supplier' ? 'supplier' : 'customer')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, error, loading, reload } = useLoad(() => loadParties(org.id), [org.id, version])

  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return (data ?? [])
      .filter((p) => p.kind === kind)
      .filter((p) => terms.every((x) => `${p.name} ${p.phone ?? ''} ${p.address ?? ''}`.toLowerCase().includes(x)))
      .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  }, [data, kind, q])
  const receivable = (data ?? []).filter((p) => p.kind === 'customer' && p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const payable = (data ?? []).filter((p) => p.kind === 'supplier' && p.balance > 0).reduce((s, p) => s + p.balance, 0)
  const m = (n: number) => fmtMoney(n, lang)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: side }}>
        <Row between>
          <Txt v="h1">{t('navKhata')}</Txt>
          <IconBtn icon={<Plus size={20} color={c.primaryText} />} onPress={() => setAdding(true)} style={{ backgroundColor: c.primary, borderWidth: 0 }} label={kind === 'customer' ? t('addCustomer') : t('addSupplier')} />
        </Row>
        <Row gap={10} style={{ marginTop: 14 }}>
          <TotalCard on={kind === 'customer'} onPress={() => setKind('customer')} icon={<HandCoins size={17} color={c.amber} />} label={t('totalReceivable')} value={receivable} format={m} color={c.amber} soft={c.amberSoft} sub={`${(data ?? []).filter((p) => p.kind === 'customer').length} ${t('customers')}`} />
          <TotalCard on={kind === 'supplier'} onPress={() => setKind('supplier')} icon={<Landmark size={17} color={c.red} />} label={t('totalPayable')} value={payable} format={m} color={c.red} soft={c.redSoft} sub={`${(data ?? []).filter((p) => p.kind === 'supplier').length} ${t('suppliers')}`} />
        </Row>
        <SearchBar value={q} onChangeText={setQ} style={{ marginTop: 12 }} />
      </View>
      {loading && !data ? (
        <View style={{ paddingHorizontal: side, paddingVertical: 20 }}><Loading /></View>
      ) : error && !data ? (
        <View style={{ paddingHorizontal: side, paddingVertical: 20 }}><ErrorBox error={error} onRetry={reload} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: side, paddingTop: 12, paddingBottom: 140, gap: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={<Empty icon={<Users size={30} color={c.muted} />}>{kind === 'customer' ? t('noCustomers') : t('noSuppliers')}</Empty>}
          renderItem={({ item: p }) => (
            <Pressable
              onPress={() => { haptic.tap(); router.push(`/party/${p.id}`) }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: c.border })}
            >
              <PartyAvatar name={p.name} kind={p.kind} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight="bold" numberOfLines={1}>{p.name}</Txt>
                <Txt v="tiny" muted numberOfLines={1}>{[p.phone, p.last_activity ? fmtDate(p.last_activity, lang) : null].filter(Boolean).join(' · ') || '—'}</Txt>
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

function TotalCard({ on, onPress, icon, label, value, format, color, soft, sub }: { on: boolean; onPress: () => void; icon: React.ReactNode; label: string; value: number; format: (n: number) => string; color: string; soft: string; sub: string }) {
  const { c } = useTheme()
  return (
    <PressScale onPress={onPress} style={[styles.total, { backgroundColor: on ? soft : c.surface, borderColor: on ? color + '70' : c.border }]}>
      <Row gap={8} center={false}>{icon}<Txt v="small" muted numberOfLines={2} style={{ flex: 1 }}>{label}</Txt></Row>
      <AnimatedNumber value={value} format={format} size={20} color={color} style={{ marginTop: 8 }} />
      <Txt v="tiny" muted style={{ marginTop: 2 }}>{sub}</Txt>
    </PressScale>
  )
}

const styles = StyleSheet.create({
  total: { flex: 1, padding: 14, borderRadius: 22, borderWidth: 1.5 },
})
