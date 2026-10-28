import { router, type Href } from 'expo-router'
import { CalendarClock, FileSpreadsheet, FileText, MoreHorizontal, PenLine, Pencil, Printer, Trash2, Undo2, Users } from 'lucide-react-native'
import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Badge, Button, Card, DateField, Empty, ErrorBox, Loading, PressScale, Row, Screen, SearchBar, Segmented, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { daysLeft } from '@/lib/due'
import { fetchAll, useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate, monthOf, monthRange } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney, r2 } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { Purchase, Sale } from '@/lib/types'

type SaleRow = Sale & { parties: { name: string } | null; markup?: number | null; advance_used?: number | null; due_date?: string | null }
type PurchaseRow = Purchase & { parties: { name: string } | null }
type Doc = { kind: 'sale'; row: SaleRow } | { kind: 'purchase'; row: PurchaseRow }

/** What the customer still owes on an invoice (crop-advance money counts as paid) */
const saleDue = (s: SaleRow) => r2(Number(s.total) - Number(s.paid) - (Number(s.advance_used) || 0))
const PAGE = 40

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
  const [shown, setShown] = useState(PAGE)
  const [sharing, setSharing] = useState(false)

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
  const sum = rows.reduce(
    (a, r) => ({ total: a.total + Number(r.total), paid: a.paid + Number(r.paid), adv: a.adv + (Number((r as SaleRow).advance_used) || 0) }),
    { total: 0, paid: 0, adv: 0 },
  )
  const outstanding = r2(sum.total - sum.paid - sum.adv)
  // start from the first page again whenever the list itself changes
  const listKey = `${tab}|${from}|${to}|${q}`
  const [lastKey, setLastKey] = useState(listKey)
  if (lastKey !== listKey) {
    setLastKey(listKey)
    setShown(PAGE)
  }

  const exportCsv = async () => {
    setSharing(true)
    try {
      if (tab === 'sales')
        await shareCsv(`invoices-${from}-${to}`, [t('invoiceNum'), t('date'), t('customer'), t('subtotal'), t('discount'), t('grandTotal'), t('received'), t('balanceDue'), t('by'), t('saleMarkup'), t('salePaidFromAdvance'), t('salePayBy')],
          sales.map((s) => [s.invoice_no, s.sale_date, s.parties?.name ?? s.customer_name ?? t('walkIn'), s.subtotal, s.discount, s.total, s.paid, saleDue(s), s.created_by_name, Number(s.markup) || 0, Number(s.advance_used) || 0, saleDue(s) > 0 ? s.due_date ?? '' : '']))
      else
        await shareCsv(`purchases-${from}-${to}`, ['#', t('date'), t('supplier'), t('reference'), t('grandTotal'), t('paidCol'), t('balanceDue'), t('by')],
          purchases.map((p) => [p.purchase_no, p.purchase_date, p.parties?.name ?? p.supplier_name, p.reference, p.total, p.paid, Number(p.total) - Number(p.paid), p.created_by_name]))
    } catch (e) {
      toast(errText(e, t), 'err')
    } finally {
      setSharing(false)
    }
  }

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
    const sale = isSale ? (r as SaleRow) : null
    const due = sale ? saleDue(sale) : r2(Number(r.total) - Number(r.paid))
    const adv = Number(sale?.advance_used) || 0
    const markup = Number(sale?.markup) || 0
    const payBy = sale?.due_date && due > 0 ? daysLeft(sale.due_date, today) : null
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
          {(markup > 0 || adv > 0) && (
            <Txt v="tiny" muted numberOfLines={1}>
              {markup > 0 ? `${t('saleMarkup')} +${fmtMoney(markup, lang)}` : ''}{markup > 0 && adv > 0 ? ' · ' : ''}{adv > 0 ? `${t('advance')} ${fmtMoney(adv, lang)}` : ''}
            </Txt>
          )}
          {(due > 0 || payBy !== null) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
              {due > 0 && <Badge tone={isSale ? 'amber' : 'red'}>{t('balanceDue')} {fmtMoney(due, lang)}</Badge>}
              {payBy !== null && sale?.due_date && (
                <Badge tone={payBy < 0 ? 'red' : payBy <= 7 ? 'amber' : 'stone'} icon={<CalendarClock size={11} color={payBy < 0 ? c.red : payBy <= 7 ? c.amber : c.muted} />}>
                  {t('saleDueOn', { date: fmtDate(sale.due_date, lang) })}
                </Badge>
              )}
            </View>
          )}
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
    <Screen
      back
      title={t('navSales')}
      refreshing={loading}
      onRefresh={reload}
      right={
        <PressScale onPress={exportCsv} disabled={sharing || rows.length === 0} style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.greenSoft }}>
          <FileSpreadsheet size={20} color={c.green} />
        </PressScale>
      }
    >
      <Segmented value={tab} onChange={setTab} items={[{ value: 'sales', label: t('invoices') }, { value: 'purchases', label: t('purchases') }]} />
      <Row gap={10} style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}><DateField value={from} onChange={setFrom} max={to} label={t('from')} /></View>
        <View style={{ flex: 1 }}><DateField value={to} onChange={setTo} max={today} min={from} label={t('to')} /></View>
      </Row>
      <SearchBar value={q} onChangeText={setQ} style={{ marginTop: 10 }} />
      <Card style={{ marginTop: 12, flexDirection: 'row' }} padded={false}>
        {[
          { l: `${t('total')} (${rows.length})`, v: sum.total, col: c.text },
          { l: tab === 'sales' ? t('received') : t('paidCol'), v: sum.paid + sum.adv, col: c.green },
          { l: t('balanceDue'), v: outstanding, col: outstanding > 0 ? c.amber : c.muted },
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
        ) : tab === 'sales' ? sales.slice(0, shown).map((s) => card({ kind: 'sale', row: s })) : purchases.slice(0, shown).map((p) => card({ kind: 'purchase', row: p }))}
        {rows.length > shown && (
          <Button variant="secondary" title={`${t('loadMore')} (${rows.length - shown})`} onPress={() => setShown((n) => n + PAGE)} />
        )}
      </View>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? (menu.kind === 'sale' ? `${t('invoiceNum')} ${menu.row.invoice_no}` : t('purchaseNo', { n: menu.row.purchase_no })) : ''}>
        {menu && (
          <View style={{ gap: 8 }}>
            {menu.kind === 'sale' && (
              <>
                <MenuItem icon={<Printer size={19} color={c.text} />} label={t('printReceipt')} onPress={() => { setMenu(null); router.push(`/receipt/${menu.row.id}`) }} />
                <MenuItem icon={<Undo2 size={19} color={c.text} />} label={t('mv_return_in')} onPress={() => { setMenu(null); router.push({ pathname: '/return', params: { invoice: String(menu.row.invoice_no) } }) }} />
                {!!menu.row.party_id && (
                  <MenuItem icon={<Users size={19} color={c.text} />} label={menu.row.parties?.name ?? t('navKhata')} onPress={() => { setMenu(null); router.push(`/party/${menu.row.party_id}`) }} />
                )}
                {isAdmin && (
                  <MenuItem icon={<PenLine size={19} color={c.text} />} label={t('crAction')} onPress={() => { setMenu(null); router.push(`/correct/${menu.row.id}` as Href) }} />
                )}
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
