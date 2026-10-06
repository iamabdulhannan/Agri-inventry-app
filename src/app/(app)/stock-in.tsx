import { router, useLocalSearchParams } from 'expo-router'
import { CalendarDays, Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, Truck, Undo2 } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated'
import { BalanceBadge, PartyAvatar, PartyPickerSheet, ProductAvatar, ProductPickerSheet, usePackLabel } from '@/components/domain'
import { PartyFormSheet, ProductFormSheet } from '@/components/forms'
import {
  Button, CalendarSheet, Card, DateField, ErrorBox, Field, IconBtn, IconTile, Input, Loading, NumInput, PressScale, Row, Screen, Segmented, Stepper, Txt, useFeedback,
} from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadBatches, loadCatalog, loadParties } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { daysBetween, fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney, r2 } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { BatchStock } from '@/lib/types'
import { fmtTotal } from '@/lib/units'

type Kind = 'purchase' | 'opening' | 'return_in'
interface Line { key: number; product_id: string; batch_no: string; mfg_date: string; expiry_date: string; qty: string; rate: string }
const rateOf = (n?: number | null) => (Number(n) > 0 ? String(Number(n)) : '')
let seq = 1
const blank = (product_id = '', rate = ''): Line => ({ key: seq++, product_id, batch_no: '', mfg_date: '', expiry_date: '', qty: '', rate })

export default function StockIn() {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, today, refresh, version } = useOrg()
  const { toast } = useFeedback()
  const label = usePackLabel()
  const params = useLocalSearchParams<{ product?: string; edit?: string; type?: string }>()

  const { data, loading, error, reload } = useLoad(async () => {
    const [catalog, batches, suppliers] = await Promise.all([loadCatalog(org.id), loadBatches(org.id, false), loadParties(org.id, 'supplier')])
    return { catalog, batches, suppliers }
  }, [org.id, version])

  const [kind, setKind] = useState<Kind>(params.type === 'return_in' ? 'return_in' : params.type === 'opening' ? 'opening' : 'purchase')
  const [date, setDate] = useState(today)
  const [partyId, setPartyId] = useState('')
  const [party, setParty] = useState('')
  const [paid, setPaid] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [picking, setPicking] = useState(false)
  const [partyOpen, setPartyOpen] = useState(false)
  const [newParty, setNewParty] = useState(false)
  const [newProduct, setNewProduct] = useState(false)
  const [pendingParty, setPendingParty] = useState<string | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [editing, setEditing] = useState<{ id: string; no: number } | null>(null)

  // prefill one product from the URL
  useEffect(() => {
    if (!data || lines.length || !params.product || params.edit) return
    setLines([blank(params.product, rateOf(data.catalog.byId.get(params.product)?.purchase_price))])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  useEffect(() => {
    if (pendingParty && data?.suppliers.some((p) => p.id === pendingParty)) {
      setPartyId(pendingParty)
      setPendingParty(null)
    }
  }, [pendingParty, data])

  // edit an existing purchase (owner / admin)
  useEffect(() => {
    if (!params.edit) return
    let cancelled = false
    ;(async () => {
      const [{ data: pur, error: e1 }, { data: moves, error: e2 }] = await Promise.all([
        supabase.from('purchases').select('*').eq('id', params.edit!).single(),
        supabase.from('stock_movements').select('qty, unit_price, batches(product_id, batch_no, expiry_date, mfg_date)').eq('purchase_id', params.edit!).order('created_at'),
      ])
      if (cancelled) return
      if (e1 || e2 || !pur) return setErr(errText(e1 ?? e2, t))
      type Row = { qty: number; unit_price: number | null; batches: { product_id: string; batch_no: string; expiry_date: string; mfg_date: string | null } }
      setKind('purchase')
      setDate(pur.purchase_date)
      setPartyId(pur.party_id ?? '')
      setParty(pur.party_id ? '' : pur.supplier_name ?? '')
      setReference(pur.reference ?? '')
      setNote(pur.note ?? '')
      setPaid(String(Number(pur.paid)))
      setLines(((moves ?? []) as unknown as Row[]).map((m) => ({
        key: seq++,
        product_id: m.batches.product_id,
        batch_no: m.batches.batch_no.startsWith('EXP-') ? '' : m.batches.batch_no,
        mfg_date: m.batches.mfg_date ?? '',
        expiry_date: m.batches.expiry_date,
        qty: String(Number(m.qty)),
        rate: m.unit_price == null ? '' : String(Number(m.unit_price)),
      })))
      setEditing({ id: pur.id, no: pur.purchase_no })
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.edit])

  const batchesByProduct = useMemo(() => {
    const m = new Map<string, BatchStock[]>()
    for (const b of data?.batches ?? []) m.set(b.product_id, [...(m.get(b.product_id) ?? []), b])
    return m
  }, [data])

  if ((loading && !data) || (params.edit && !editing && !err)) return <Screen back title={t('stockInTitle')}><Loading /></Screen>
  if (error && !data) return <Screen back title={t('stockInTitle')}><ErrorBox error={error} onRetry={reload} /></Screen>
  if (!data) return null
  const { catalog } = data
  const isPurchase = kind === 'purchase'
  const supplier = data.suppliers.find((s) => s.id === partyId)
  const total = r2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0))
  const paidNum = paid === '' ? (partyId ? 0 : total) : Number(paid) || 0
  const due = r2(total - paidNum)
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  // no supplier chosen or typed: use the company of the items as the supplier name
  const supplierName = () => {
    if (party.trim()) return party.trim()
    if (partyId || !isPurchase) return null
    const cos = [...new Set(lines.map((l) => catalog.byId.get(l.product_id)?.company_name).filter(Boolean) as string[])]
    return cos.length ? cos.slice(0, 3).join(', ') + (cos.length > 3 ? ' …' : '') : null
  }
  const payload = () =>
    lines.map((l) => ({
      product_id: l.product_id,
      batch_no: l.batch_no.trim() || null,
      mfg_date: l.mfg_date || null,
      expiry_date: l.expiry_date,
      qty: Number(l.qty),
      unit_price: l.rate === '' ? null : Number(l.rate),
    }))

  const save = async () => {
    setErr('')
    if (!lines.length) return setErr(t('errChooseProduct'))
    for (const l of lines) {
      if (!l.expiry_date) return setErr(t('errExpiryRequired'))
      if (!(Number(l.qty) > 0)) return setErr(t('errQty'))
      if (l.mfg_date && l.mfg_date > l.expiry_date) return setErr(`${t('mfgDate')} > ${t('expiryDate')}`)
      if (l.rate !== '' && !(Number(l.rate) >= 0)) return setErr(t('errInvalidPrice'))
    }
    if (isPurchase && (paidNum < 0 || paidNum > total)) return setErr(t('errInvalidPaid'))
    if (isPurchase && due > 0 && !partyId) return setErr(t('errCreditNeedsParty'))
    setBusy(true)
    if (editing) {
      const { error } = await supabase.rpc('update_purchase', {
        p_org: org.id, p_purchase: editing.id, p_date: date, p_lines: payload(), p_party: supplierName(),
        p_reference: reference || null, p_note: note || null, p_party_id: partyId || null, p_paid: paidNum,
      })
      setBusy(false)
      if (error) return setErr(errText(error, t))
      toast(t('purchaseUpdated', { n: editing.no }))
      refresh()
      router.back()
      return
    }
    const { data: n, error } = await supabase.rpc('record_stock_in', {
      p_org: org.id,
      p_date: date,
      p_type: kind === 'opening' ? 'purchase' : kind,
      p_lines: payload(),
      p_party: supplierName(),
      p_reference: reference || null,
      p_note: note || null,
      p_party_id: isPurchase && partyId ? partyId : null,
      p_paid: isPurchase ? paidNum : null,
      p_opening: kind === 'opening',
    })
    setBusy(false)
    if (error) return setErr(errText(error, t))
    let msg = t('stockInSaved')
    if (n) {
      const { data: pur } = await supabase.from('purchases').select('purchase_no').eq('id', n as string).single()
      if (pur) msg = t('purchaseSaved', { n: pur.purchase_no })
    }
    toast(msg)
    refresh()
    router.back()
  }

  return (
    <Screen
      back
      title={editing ? t('editPurchase', { n: editing.no }) : t('stockInTitle')}
      subtitle={t('stockInMore')}
      footer={
        <View style={{ gap: 10 }}>
          {err ? <ErrorBox>{err}</ErrorBox> : null}
          <Row between>
            <View>
              <Txt v="tiny" muted>{isPurchase && total > 0 ? t('grandTotal') : t('totalItems', { n: lines.length })}</Txt>
              {isPurchase && total > 0 ? <Txt v="h1" style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(total, lang)}</Txt> : <Txt v="h2">{lines.length}</Txt>}
              {isPurchase && due > 0 && <Txt v="tiny" color={c.amber}>{t('balanceDue')}: {fmtMoney(due, lang)}</Txt>}
            </View>
            <Button size="lg" title={t('saveStock')} icon={<Check size={20} color={c.primaryText} />} onPress={save} loading={busy} disabled={!lines.length} style={{ minWidth: 150 }} />
          </Row>
        </View>
      }
    >
      {editing && (
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 16, backgroundColor: c.amberSoft, marginBottom: 14 }}>
          <Pencil size={16} color={c.amber} />
          <Txt v="small" style={{ flex: 1 }}>{t('editPurchaseHint')}</Txt>
        </View>
      )}
      {!editing && (
        <Segmented
          value={kind}
          onChange={setKind}
          items={[{ value: 'purchase', label: t('mv_purchase') }, { value: 'opening', label: t('openingStock') }, { value: 'return_in', label: t('mv_return_in') }]}
          style={{ marginBottom: 14 }}
        />
      )}

      {kind === 'return_in' && (
        <PressScale onPress={() => router.push('/return')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.primary + '40', marginBottom: 14 }}>
          <IconTile icon={<Undo2 size={20} color={c.primary} />} />
          <View style={{ flex: 1 }}>
            <Txt weight="bold">{t('loadInvoice')}</Txt>
            <Txt v="tiny" muted>{t('saleInvoiceNo')} → {t('returnQty')}</Txt>
          </View>
          <ChevronRight size={18} color={c.primary} />
        </PressScale>
      )}
      {kind === 'opening' && <Txt v="small" muted style={{ marginBottom: 14 }}>{t('openingStockHint')}</Txt>}

      <Row gap={10}>
        {isPurchase ? (
          <PressScale onPress={() => setPartyOpen(true)} scaleTo={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            {supplier ? <PartyAvatar name={supplier.name} kind="supplier" size={40} /> : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><Truck size={19} color={c.muted} /></View>}
            <View style={{ flex: 1 }}>
              <Txt v="tiny" muted>{t('supplier')}</Txt>
              <Txt weight="bold" numberOfLines={1}>{supplier?.name ?? t('noKhata')}</Txt>
            </View>
            <ChevronDown size={18} color={c.muted} />
          </PressScale>
        ) : (
          <View style={{ flex: 1 }}>
            {kind === 'return_in' && <Input value={party} onChangeText={setParty} placeholder={`${t('customer')} (${t('optional')})`} />}
          </View>
        )}
        <PressScale onPress={() => setDateOpen(true)} style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, minHeight: 50 }}>
          <CalendarDays size={18} color={c.primary} />
          <Txt v="tiny" weight="bold" style={{ marginTop: 3 }}>{date === today ? t('today') : fmtDate(date, lang)}</Txt>
        </PressScale>
      </Row>
      {supplier && (
        <Row between style={{ marginTop: 8, paddingHorizontal: 4 }}>
          <Txt v="tiny" muted>{t('previousBalance')}</Txt>
          <BalanceBadge kind="supplier" balance={supplier.balance} />
        </Row>
      )}
      {isPurchase && !partyId && <Input value={party} onChangeText={setParty} placeholder={`${t('supplier')} (${t('optional')})`} style={{ marginTop: 10 }} />}
      {kind !== 'opening' && <Input value={reference} onChangeText={setReference} placeholder={`${t('invoiceNo')}${isPurchase ? '' : ` (${t('optional')})`}`} style={{ marginTop: 10 }} />}

      <Txt v="h3" style={{ marginTop: 22, marginBottom: 10 }}>{t('items')} <Txt v="small" muted>({lines.length})</Txt></Txt>
      <View style={{ gap: 10 }}>
        {lines.map((l) => {
          const p = catalog.byId.get(l.product_id)
          if (!p) return null
          const existing = (batchesByProduct.get(l.product_id) ?? []).slice(-8)
          const known = existing.find((b) => b.batch_no.toLowerCase() === l.batch_no.trim().toLowerCase())
          const expLeft = l.expiry_date ? daysBetween(today, l.expiry_date) : null
          return (
            <Animated.View key={l.key} entering={FadeInDown.springify().damping(16)} exiting={FadeOut.duration(180)} layout={LinearTransition.springify()}>
              <Card style={{ padding: 14, gap: 12 }}>
                <Row gap={12}>
                  <ProductAvatar p={p} size={42} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" numberOfLines={1}>{pick(p.name, p.name_ur)}</Txt>
                    <Txt v="tiny" muted numberOfLines={1}>{label(p)}{p.company_name ? ` · ${p.company_name}` : ''}</Txt>
                  </View>
                  <IconBtn size={34} icon={<Trash2 size={16} color={c.red} />} tone="red" onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} label={t('remove')} />
                </Row>
                {existing.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {existing.map((b) => {
                      const on = known?.id === b.id
                      return (
                        <Pressable key={b.id} onPress={() => set(l.key, { batch_no: b.batch_no, expiry_date: b.expiry_date, mfg_date: b.mfg_date ?? '' })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: on ? c.primary : c.surface2 }}>
                          <Txt v="tiny" color={on ? c.primaryText : c.textSoft}>#{b.batch_no} · {fmtDate(b.expiry_date, lang)}</Txt>
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                )}
                <Row gap={10}>
                  <Field label={t('batchNo')} style={{ flex: 1 }}>
                    <Input
                      value={l.batch_no}
                      autoCapitalize="characters"
                      onChangeText={(v) => {
                        const match = existing.find((b) => b.batch_no.toLowerCase() === v.trim().toLowerCase())
                        set(l.key, match ? { batch_no: v, expiry_date: match.expiry_date, mfg_date: match.mfg_date ?? '' } : { batch_no: v })
                      }}
                      placeholder={t('optional')}
                    />
                  </Field>
                  <Field label={t('expiryDate')} style={{ flex: 1.1 }} error={expLeft !== null && expLeft < 0 ? t('expiredAgo', { n: -expLeft }) : undefined} hint={expLeft !== null && expLeft >= 0 && expLeft <= org.expiry_alert_days ? <Txt v="tiny" color={c.amber}>{t('daysLeft', { n: expLeft })}</Txt> : undefined}>
                    {known ? <Input value={fmtDate(l.expiry_date, lang)} editable={false} /> : <DateField value={l.expiry_date} onChange={(d) => set(l.key, { expiry_date: d })} label={t('expiryDate')} placeholder={t('expiryDate')} />}
                  </Field>
                </Row>
                <Row gap={10} style={{ alignItems: 'flex-start' }}>
                  <Field label={`${t('qty')} (${t(`pt_${p.pack_type}`)})`} style={{ flex: 1.15 }} hint={Number(l.qty) > 0 && p.pack_unit !== 'pcs' ? `= ${fmtTotal(Number(l.qty), p.pack_size, p.pack_unit, lang)}` : undefined}>
                    <Stepper value={l.qty} onChange={(v) => set(l.key, { qty: v })} />
                  </Field>
                  <Field label={t('purchasePrice')} style={{ flex: 1 }} hint={Number(l.qty) > 0 && Number(l.rate) > 0 ? `= ${fmtMoney(Number(l.qty) * Number(l.rate), lang)}` : undefined}>
                    <NumInput value={l.rate} onChangeText={(v) => set(l.key, { rate: v })} placeholder="0" style={{ height: 53 }} />
                  </Field>
                </Row>
                {!known && (
                  <Field label={t('mfgDate')} optional>
                    <DateField value={l.mfg_date} onChange={(d) => set(l.key, { mfg_date: d })} max={today} label={t('mfgDate')} placeholder={t('mfgDate')} />
                  </Field>
                )}
              </Card>
            </Animated.View>
          )
        })}
        <PressScale onPress={() => setPicking(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 64, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: c.primary + '90', backgroundColor: c.primarySoft }}>
          <Plus size={22} color={c.primary} />
          <Txt weight="extrabold" color={c.primary}>{t('addItem')}</Txt>
        </PressScale>
      </View>

      {isPurchase && total > 0 && (
        <Card style={{ marginTop: 18, gap: 14 }}>
          <Field label={t('paidNow')} hint={partyId ? t('paidHintKhata') : undefined}>
            <NumInput value={paid} onChangeText={setPaid} placeholder={partyId ? '0' : String(total)} />
          </Field>
          {!!partyId && (
            <Segmented
              value={paidNum === total ? 'full' : paidNum === 0 ? 'credit' : ('' as 'full')}
              onChange={(v) => setPaid(v === 'full' ? String(total) : '0')}
              items={[{ value: 'full', label: t('fullPayment') }, { value: 'credit', label: t('onCredit') }]}
            />
          )}
          <Row between style={{ padding: 12, borderRadius: 16, backgroundColor: due > 0 ? c.amberSoft : c.surface2 }}>
            <Txt v="small" muted>{t('balanceDue')}</Txt>
            <Txt weight="extrabold" color={due > 0 ? c.amber : c.text}>{fmtMoney(due, lang)}</Txt>
          </Row>
          {due > 0 && !partyId && <Txt v="tiny" color={c.red}>{t('errCreditNeedsParty')}</Txt>}
        </Card>
      )}
      <Input value={note} onChangeText={setNote} placeholder={`${t('note')} (${t('optional')})`} style={{ marginTop: 14 }} />

      <ProductPickerSheet
        open={picking}
        onClose={() => setPicking(false)}
        catalog={catalog}
        priceKind="purchase"
        onPick={(id) => setLines((ls) => [...ls, blank(id, rateOf(catalog.byId.get(id)?.purchase_price))])}
        onCreate={() => setNewProduct(true)}
      />
      <ProductFormSheet
        open={newProduct}
        onClose={() => setNewProduct(false)}
        catalog={catalog}
        onSaved={(ids) => {
          setNewProduct(false)
          setLines((ls) => [...ls, ...ids.map((id) => blank(id))])
          toast(ids.length > 1 ? t('productsSaved', { n: ids.length }) : t('productSaved'))
          refresh()
        }}
      />
      <PartyPickerSheet open={partyOpen} onClose={() => setPartyOpen(false)} kind="supplier" parties={data.suppliers} value={partyId} onPick={(id) => { setPartyId(id); setPaid('') }} noneLabel={t('noKhata')} onNew={() => setNewParty(true)} />
      <PartyFormSheet open={newParty} onClose={() => setNewParty(false)} kind="supplier" onSaved={(id) => { setNewParty(false); setPendingParty(id); reload() }} />
      <CalendarSheet open={dateOpen} onClose={() => setDateOpen(false)} value={date} onPick={setDate} max={today} />
    </Screen>
  )
}
