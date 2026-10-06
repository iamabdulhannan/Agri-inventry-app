import { router } from 'expo-router'
import { FileText, MoreHorizontal, Pencil, Printer, Trash2, Undo2 } from 'lucide-react-native'
import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Badge, Card, DateField, Empty, ErrorBox, Loading, PressScale, Row, Screen, SearchBar, Segmented, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { fetchAll, useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate, monthOf, monthRange } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { Purchase, Sale } from '@/lib/types'

type SaleRow = Sale & { parties: { name: string } | null }
type PurchaseRow = Purchase & { parties: { name: string } | null }
type Doc = { kind: 'sale'; row: SaleRow } | { kind: 'purchase'; row: PurchaseRow }

export default function Invoices() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today, version, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const [tab, setTab] = useState<'sales' | 'purchases'>('sales')
  const [from, setFrom] = useState(() => monthRange(monthOf(today))[0])
  const [to, setTo] = useState(today)
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState<Doc | null>(null)

  const { data, error, loading, reload } = useLoad(async () => {
    if (tab === 'sales') {
      const rows = await fetchAll<SaleRow>((a, b) =>
        supabase.from('sales').select('*, parties(name)').eq('org_id', org.id).gte('sale_date', from).lte('sale_date', to).order('invoice_no', { ascending: false }).range(a, b))
      return { sales: rows, purchases: [] as PurchaseRow[] }
    }
    const rows = await fetchAll<PurchaseRow>((a, b) =>
      supabase.from('purchases').select('*, parties(name)').eq('org_id', org.id).gte('purchase_date', from).lte('purchase_date', to).order('purchase_no', { ascending: false }).range(a, b))
    return { sales: [] as SaleRow[], purchases: rows }
  }, [org.id, tab, from, to, version])

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const sales = useMemo(() => (data?.sales ?? []).filter((s) => terms.every((x) => `${s.invoice_no} ${s.parties?.name ?? ''} ${s.customer_name ?? ''} ${s.note ?? ''}`.toLowerCase().includes(x))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, q])
  const purchases = useMemo(() => (data?.purchases ?? []).filter((p) => terms.every((x) => `${p.purchase_no} ${p.parties?.name ?? ''} ${p.supplier_name ?? ''} ${p.reference ?? ''}`.toLowerCase().includes(x))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, q])
  const rows = tab === 'sales' ? sales : purchases
  const sum = rows.reduce((a, r) => ({ total: a.total + Number(r.total), paid: a.paid + Number(r.paid) }), { total: 0, paid: 0 })

  const voidDoc = async (d: Doc) => {
    setMenu(null)
    const isSale = d.kind === 'sale'
    const no = isSale ? d.row.invoice_no : d.row.purchase_no
    if (!(await confirm(t(isSale ? 'voidInvoiceConfirm' : 'voidPurchaseConfirm', { n: no })))) return
    const { error } = await supabase.from(isSale ? 'sales' : 'purchases').delete().eq('id', d.row.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('voided'))
    refresh()
  }

  const card = (d: Doc) => {
    const r = d.row
    const isSale = d.kind === 'sale'
    const due = Number(r.total) - Number(r.paid)
    const no = isSale ? (r as SaleRow).invoice_no : (r as PurchaseRow).purchase_no
    const who = isSale ? (r.parties?.name ?? (r as SaleRow).customer_name ?? t('walkIn')) : (r.parties?.name ?? (r as PurchaseRow).supplier_name ?? '—')
    const date = isSale ? (r as SaleRow).sale_date : (r as PurchaseRow).purchase_date
    return (
      <Pressable
        key={r.id}
        onPress={() => (isSale ? router.push(`/receipt/${r.id}`) : setMenu(d))}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: c.border })}
      >
        <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: isSale ? c.primarySoft : c.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="tiny" muted>#</Txt>
          <Txt weight="extrabold" color={isSale ? c.primary : c.blue} style={{ marginTop: -3 }}>{no}</Txt>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Txt weight="bold" numberOfLines={1}>{who}</Txt>
          <Txt v="tiny" muted numberOfLines={1}>{fmtDate(date, lang)}{r.created_by_name ? ` · ${r.created_by_name}` : ''}{!isSale && (r as PurchaseRow).reference ? ` · ${(r as PurchaseRow).reference}` : ''}</Txt>
          {due > 0 && <Badge tone={isSale ? 'amber' : 'red'}>{t('balanceDue')} {fmtMoney(due, lang)}</Badge>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Txt weight="extrabold">{fmtMoney(r.total, lang)}</Txt>
          <PressScale onPress={() => setMenu(d)} style={{ padding: 6, borderRadius: 10, backgroundColor: c.surface2 }}>
            <MoreHorizontal size={16} color={c.muted} />
          </PressScale>
        </View>
      </Pressable>
    )
  }

  return (
    <Screen back title={t('navSales')} refreshing={loading} onRefresh={reload}>
      <Segmented value={tab} onChange={setTab} items={[{ value: 'sales', label: t('invoices') }, { value: 'purchases', label: t('purchases') }]} />
      <Row gap={10} style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}><DateField value={from} onChange={setFrom} max={to} label={t('from')} /></View>
        <View style={{ flex: 1 }}><DateField value={to} onChange={setTo} max={today} min={from} label={t('to')} /></View>
      </Row>
      <SearchBar value={q} onChangeText={setQ} style={{ marginTop: 10 }} />
      <Card style={{ marginTop: 12, flexDirection: 'row' }} padded={false}>
        {[
          { l: `${t('total')} (${rows.length})`, v: sum.total, col: c.text },
          { l: tab === 'sales' ? t('received') : t('paidCol'), v: sum.paid, col: c.green },
          { l: t('balanceDue'), v: sum.total - sum.paid, col: sum.total - sum.paid > 0 ? c.amber : c.muted },
        ].map((x, i) => (
          <View key={x.l} style={{ flex: 1, padding: 12, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.border }}>
            <Txt v="tiny" muted numberOfLines={1}>{x.l}</Txt>
            <Txt weight="extrabold" color={x.col} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(x.v, lang)}</Txt>
          </View>
        ))}
      </Card>
      <View style={{ gap: 8, marginTop: 12 }}>
        {loading && !data ? <Loading rows={5} /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : rows.length === 0 ? (
          <Empty icon={<FileText size={30} color={c.muted} />}>{t('noEntries')}</Empty>
        ) : tab === 'sales' ? sales.map((s) => card({ kind: 'sale', row: s })) : purchases.map((p) => card({ kind: 'purchase', row: p }))}
      </View>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? (menu.kind === 'sale' ? `${t('invoiceNum')} ${menu.row.invoice_no}` : t('purchaseNo', { n: menu.row.purchase_no })) : ''}>
        {menu && (
          <View style={{ gap: 8 }}>
            {menu.kind === 'sale' && (
              <>
                <MenuItem icon={<Printer size={19} color={c.text} />} label={t('printReceipt')} onPress={() => { setMenu(null); router.push(`/receipt/${menu.row.id}`) }} />
                <MenuItem icon={<Undo2 size={19} color={c.text} />} label={t('mv_return_in')} onPress={() => { setMenu(null); router.push({ pathname: '/return', params: { invoice: String(menu.row.invoice_no) } }) }} />
              </>
            )}
            {menu.kind === 'purchase' && (
              <View style={{ padding: 4, gap: 4, marginBottom: 6 }}>
                <Txt weight="bold">{menu.row.parties?.name ?? menu.row.supplier_name ?? '—'}</Txt>
                <Txt v="small" muted>{fmtDate(menu.row.purchase_date, lang)} · {fmtMoney(menu.row.total, lang)} · {t('paidCol')} {fmtMoney(menu.row.paid, lang)}</Txt>
              </View>
            )}
            {menu.kind === 'purchase' && isAdmin && (
              <MenuItem icon={<Pencil size={19} color={c.text} />} label={t('edit')} onPress={() => { setMenu(null); router.push({ pathname: '/stock-in', params: { edit: menu.row.id } }) }} />
            )}
            {isAdmin && <MenuItem danger icon={<Trash2 size={19} color={c.red} />} label={t('voidDoc')} onPress={() => voidDoc(menu)} />}
          </View>
        )}
      </Sheet>
    </Screen>
  )
}

function MenuItem({ icon, label, onPress, danger }: { icon: ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const { c } = useTheme()
  return (
    <PressScale onPress={onPress} scaleTo={0.98} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, backgroundColor: danger ? c.redSoft : c.surface }}>
      {icon}
      <Txt weight="bold" color={danger ? c.red : c.text}>{label}</Txt>
    </PressScale>
  )
}
