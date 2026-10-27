import { router } from 'expo-router'
import { History as HistoryIcon, Trash2 } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { MovementRow } from '@/components/domain'
import { Card, Chip, DateField, Empty, ErrorBox, Loading, PressScale, Row, Screen, SearchBar, Txt, useFeedback, HScroll } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadCatalog } from '@/lib/catalog'
import { fetchAll, useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { addDays, fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { ALL_TYPES, type Movement, type MovementType } from '@/lib/types'

/** Every stock entry with filters; admins can delete wrong single lines */
export default function History() {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, today, version, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const [from, setFrom] = useState(() => addDays(today, -30))
  const [to, setTo] = useState(today)
  const [type, setType] = useState<'' | MovementType>('')
  const [q, setQ] = useState('')

  const { data, error, loading, reload } = useLoad(async () => {
    const catalog = await loadCatalog(org.id)
    const moves = await fetchAll<Movement>((a, b) => {
      let qb = supabase
        .from('stock_movements')
        .select('*, batches!inner(batch_no, expiry_date, mfg_date, product_id), profiles(full_name)')
        .eq('org_id', org.id)
        .gte('movement_date', from)
        .lte('movement_date', to)
      if (type) qb = qb.eq('type', type)
      return qb.order('movement_date', { ascending: false }).order('created_at', { ascending: false }).range(a, b)
    })
    return { catalog, moves }
  }, [org.id, from, to, type, version])

  const rows = useMemo(() => {
    if (!data) return []
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return data.moves
    return data.moves.filter((m) => {
      const p = m.batches ? data.catalog.byId.get(m.batches.product_id) : undefined
      return terms.every((x) => `${p?.name ?? ''} ${p?.name_ur ?? ''} ${m.batches?.batch_no ?? ''} ${m.party ?? ''} ${m.reference ?? ''}`.toLowerCase().includes(x))
    })
  }, [data, q])

  // group by date for section headers
  const groups = useMemo(() => {
    const g: { day: string; items: Movement[] }[] = []
    for (const m of rows.slice(0, 400)) {
      const d = m.movement_date.slice(0, 10)
      if (g.at(-1)?.day !== d) g.push({ day: d, items: [] })
      g.at(-1)!.items.push(m)
    }
    return g
  }, [rows])

  const del = async (m: Movement) => {
    if (m.sale_id || m.return_id) return toast(t('errEditViaInvoice'), 'warn')
    if (!(await confirm(t(m.purchase_id ? 'deletePurchaseLineConfirm' : 'deleteEntryConfirm')))) return
    const isStockIn = (m.type === 'purchase' || m.type === 'return_in') && !m.sale_id && !m.return_id
    const res = isStockIn
      ? await supabase.rpc('delete_stock_in_line', { p_org: org.id, p_movement: m.id })
      : await supabase.from('stock_movements').delete().eq('id', m.id)
    if (res.error) {
      const msg = String(res.error.message ?? '')
      return toast(/INSUFFICIENT_STOCK/.test(msg) ? t('errDeleteSold') : errText(res.error, t), 'err')
    }
    toast(isStockIn && res.data === 'purchase' ? t('purchaseDeleted') : t('deleted'))
    refresh()
  }

  return (
    <Screen back title={t('navLedger')} subtitle={data ? t('results', { n: rows.length }) : undefined} refreshing={loading} onRefresh={reload}>
      <Row gap={10}>
        <View style={{ flex: 1 }}><DateField value={from} onChange={setFrom} max={to} label={t('from')} /></View>
        <View style={{ flex: 1 }}><DateField value={to} onChange={setTo} max={today} min={from} label={t('to')} /></View>
      </Row>
      <SearchBar value={q} onChangeText={setQ} style={{ marginTop: 10 }} />
      <HScroll gap={8} style={{ marginTop: 10 }}>
        <Chip label={t('allTypes')} active={type === ''} onPress={() => setType('')} />
        {ALL_TYPES.map((x) => <Chip key={x} label={t(`mv_${x}`)} active={type === x} onPress={() => setType(x)} />)}
      </HScroll>
      <View style={{ marginTop: 14, gap: 14 }}>
        {loading && !data ? <Loading rows={6} /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : groups.length === 0 ? (
          <Empty icon={<HistoryIcon size={30} color={c.muted} />}>{t('noEntries')}</Empty>
        ) : groups.map((g) => (
          <View key={g.day}>
            <Txt v="label" muted style={{ marginBottom: 6, marginLeft: 4 }}>{g.day === today ? t('today') : fmtDate(g.day, lang)}</Txt>
            <Card padded={false} style={{ paddingHorizontal: 14 }}>
              {g.items.map((m, i) => {
                const p = m.batches ? data!.catalog.byId.get(m.batches.product_id) : undefined
                return (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <View style={{ flex: 1 }}>
                      <MovementRow m={m} p={p} onPress={m.sale_id ? () => router.push(`/receipt/${m.sale_id}`) : p ? () => router.push(`/product/${p.id}`) : undefined} />
                    </View>
                    {isAdmin && !m.sale_id && !m.return_id && (
                      <PressScale onPress={() => del(m)} style={{ paddingLeft: 8, paddingVertical: 8 }}><Trash2 size={16} color={c.red} /></PressScale>
                    )}
                  </View>
                )
              })}
            </Card>
          </View>
        ))}
        {rows.length > 400 && <Txt v="tiny" muted align="center">{pick('Showing latest 400', 'تازہ ترین 400')}</Txt>}
      </View>
    </Screen>
  )
}
