import { router, useLocalSearchParams } from 'expo-router'
import { CalendarDays, Check, ChevronDown, Layers, Plus, ShoppingBag, Trash2, UserRound } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { BalanceBadge, PartyAvatar, PartyPickerSheet, ProductAvatar, ProductPickerSheet, usePackLabel } from '@/components/domain'
import { PartyFormSheet } from '@/components/forms'
import {
  Badge, Button, CalendarSheet, Card, ErrorBox, Field, IconBtn, Input, Loading, NumInput, PickerSheet, PressScale, Row, Screen, Segmented, Stepper, Txt, useFeedback, Rise } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadBatches, loadCatalog, loadParties } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { daysBetween, fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { canSellLoose, kgFits, kgStep, kgToPacks, packsToKg, perKg, perPack, type SaleUnit } from '@/lib/loose'
import { fmtMoney, r2 } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { OUT_TYPES, type BatchStock, type MovementType } from '@/lib/types'
import { fmtNum, fmtTotal, unitLabel } from '@/lib/units'

interface Line { key: number; product_id: string; batch_id: string; qty: string; rate: string; unit: SaleUnit }
const rateOf = (n?: number | null) => (Number(n) > 0 ? String(Number(n)) : '')
let seq = 1

export default function Sale() {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, today, refresh, version } = useOrg()
  const { toast } = useFeedback()
  const label = usePackLabel()
  const params = useLocalSearchParams<{ product?: string; party?: string; type?: string; batch?: string; qty?: string }>()

  const { data, loading, error, reload } = useLoad(async () => {
    const [catalog, batches, customers] = await Promise.all([loadCatalog(org.id), loadBatches(org.id), loadParties(org.id, 'customer')])
    return { catalog, batches, customers }
  }, [org.id, version])

  const [type, setType] = useState<MovementType>((OUT_TYPES as string[]).includes(params.type ?? '') ? (params.type as MovementType) : 'sale')
  const [date, setDate] = useState(today)
  const [partyId, setPartyId] = useState(params.party ?? '')
  const [party, setParty] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [discount, setDiscount] = useState('')
  const [received, setReceived] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [picking, setPicking] = useState(false)
  const [partyOpen, setPartyOpen] = useState(false)
  const [newParty, setNewParty] = useState(false)
  const [pendingParty, setPendingParty] = useState<string | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [batchFor, setBatchFor] = useState<number | null>(null)

  useEffect(() => {
    if (!data || lines.length || !params.product) return
    const p = data.catalog.byId.get(params.product)
    if (p) setLines([{ key: seq++, product_id: p.id, batch_id: params.batch ?? '', qty: params.qty ?? '1', rate: rateOf(p.sale_price), unit: 'pack' }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  useEffect(() => {
    if (pendingParty && data?.customers.some((p) => p.id === pendingParty)) {
      setPartyId(pendingParty)
      setPendingParty(null)
    }
  }, [pendingParty, data])

  const byProduct = useMemo(() => {
    const m = new Map<string, BatchStock[]>()
    for (const b of data?.batches ?? []) m.set(b.product_id, [...(m.get(b.product_id) ?? []), b])
    return m
  }, [data])

  if (loading && !data) return <Screen back title={t('newSale')}><Loading /></Screen>
  if (error && !data) return <Screen back title={t('newSale')}><ErrorBox error={error} onRetry={reload} /></Screen>
  if (!data) return null
  const { catalog } = data
  const isSale = type === 'sale'
  const customer = data.customers.find((x) => x.id === partyId)

  const eligible = (productId: string) => (byProduct.get(productId) ?? []).filter((b) => !isSale || b.expiry_date >= date)
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const looseOf = (l: Line) => l.unit === 'kg' && canSellLoose(catalog.byId.get(l.product_id))
  const sizeOf = (l: Line) => Number(catalog.byId.get(l.product_id)?.pack_size) || 1
  const packsOf = (l: Line) => (looseOf(l) ? kgToPacks(Number(l.qty) || 0, sizeOf(l)) : Number(l.qty) || 0)
  const packRateOf = (l: Line) => (looseOf(l) ? perPack(Number(l.rate) || 0, sizeOf(l)) : Number(l.rate) || 0)
  const amountOf = (l: Line) => r2(packsOf(l) * packRateOf(l))
  const switchUnit = (l: Line, unit: SaleUnit) => {
    if (unit === l.unit) return
    const size = sizeOf(l)
    const q = Number(l.qty)
    const r = Number(l.rate)
    set(l.key, unit === 'kg'
      ? { unit, qty: q > 0 ? String(packsToKg(q, size)) : l.qty, rate: r > 0 ? String(perKg(r, size)) : l.rate }
      : { unit, qty: q > 0 ? String(kgToPacks(q, size)) : l.qty, rate: r > 0 ? String(perPack(r, size)) : l.rate })
  }

  const subtotal = r2(lines.reduce((s, l) => s + amountOf(l), 0))
  const disc = Number(discount) || 0
  const total = r2(subtotal - disc)
  const paidNum = received === '' ? (partyId ? 0 : total) : Number(received) || 0
  const due = r2(total - paidNum)

  const addProduct = (id: string) => {
    const existing = lines.find((l) => l.product_id === id && !l.batch_id && l.unit === 'pack')
    if (existing) return set(existing.key, { qty: String((Number(existing.qty) || 0) + 1) })
    setLines((ls) => [...ls, { key: seq++, product_id: id, batch_id: '', qty: '1', rate: rateOf(catalog.byId.get(id)?.sale_price), unit: 'pack' }])
  }

  const save = async () => {
    setErr('')
    if (!lines.length) return setErr(t('errChooseProduct'))
    for (const l of lines) {
      if (!(Number(l.qty) > 0)) return setErr(t('errQty'))
      if (looseOf(l) && !kgFits(Number(l.qty), sizeOf(l))) return setErr(t('errKgStep', { size: fmtNum(sizeOf(l)), step: fmtNum(kgStep(sizeOf(l)), 3) }))
      if (isSale && !(Number(l.rate) >= 0 && l.rate !== '')) return setErr(t('errInvalidPrice'))
    }
    if (isSale) {
      if (disc < 0 || disc > subtotal) return setErr(t('errInvalidDiscount'))
      if (paidNum < 0 || paidNum > total) return setErr(t('errInvalidPaid'))
      if (due > 0 && !partyId) return setErr(t('errCreditNeedsParty'))
    }
    setBusy(true)
    if (isSale) {
      const { data: saleId, error } = await supabase.rpc('record_sale', {
        p_org: org.id,
        p_date: date,
        p_lines: lines.map((l) => ({ product_id: l.product_id, batch_id: l.batch_id || null, qty: packsOf(l), unit_price: packRateOf(l), loose: looseOf(l) })),
        p_party_id: partyId || null,
        p_customer_name: partyId ? null : party || null,
        p_discount: disc,
        p_paid: paidNum,
        p_note: note || null,
      })
      setBusy(false)
      if (error) return setErr(errText(error, t))
      const { data: s } = await supabase.from('sales').select('invoice_no').eq('id', saleId as string).single()
      toast(t('saleSaved', { n: s?.invoice_no ?? '' }))
      refresh()
      router.replace({ pathname: '/receipt/[id]', params: { id: saleId as string, fresh: '1' } })
      return
    }
    const { data: n, error } = await supabase.rpc('record_stock_out', {
      p_org: org.id,
      p_date: date,
      p_type: type,
      p_lines: lines.map((l) => ({ product_id: l.product_id, batch_id: l.batch_id || null, qty: Number(l.qty) })),
      p_party: party || null,
      p_reference: reference || null,
      p_note: note || null,
    })
    setBusy(false)
    if (error) return setErr(errText(error, t))
    toast(t('stockSaved', { n: n as number }))
    refresh()
    router.back()
  }

  const batchLine = lines.find((l) => l.key === batchFor)
  const batchProduct = batchLine ? catalog.byId.get(batchLine.product_id) : undefined

  return (
    <Screen
      back
      title={isSale ? t('newSale') : t(`mv_${type}`)}
      subtitle={org.name}
      right={
        <PressScale onPress={() => setTypeOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 38, borderRadius: 13, backgroundColor: isSale ? c.primarySoft : c.orangeSoft }}>
          <Txt v="small" weight="bold" color={isSale ? c.primary : c.orange}>{t(`mv_${type}`)}</Txt>
          <ChevronDown size={15} color={isSale ? c.primary : c.orange} />
        </PressScale>
      }
      footer={
        <View style={{ gap: 10 }}>
          {err ? <ErrorBox>{err}</ErrorBox> : null}
          <Row between>
            <View>
              <Txt v="tiny" muted>{isSale ? t('grandTotal') : t('totalItems', { n: lines.length })}</Txt>
              {isSale ? <Txt v="h1" style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(total, lang)}</Txt> : <Txt v="h2">{lines.length}</Txt>}
              {isSale && due > 0 && <Txt v="tiny" color={c.amber}>{t('balanceDue')}: {fmtMoney(due, lang)}</Txt>}
            </View>
            <Button size="lg" variant={isSale ? 'primary' : 'warning'} title={t('saveStock')} icon={<Check size={20} color={isSale ? c.primaryText : '#1A0F00'} />} onPress={save} loading={busy} disabled={!lines.length} style={{ minWidth: 150 }} />
          </Row>
        </View>
      }
    >
      {/* party + date */}
      <Row gap={10}>
        {isSale ? (
          <PressScale onPress={() => setPartyOpen(true)} scaleTo={0.98} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            {customer ? <PartyAvatar name={customer.name} kind="customer" size={40} /> : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><UserRound size={20} color={c.muted} /></View>}
            <View style={{ flex: 1 }}>
              <Txt v="tiny" muted>{t('customer')}</Txt>
              <Txt weight="bold" numberOfLines={1}>{customer?.name ?? t('walkIn')}</Txt>
            </View>
            <ChevronDown size={18} color={c.muted} />
          </PressScale>
        ) : (
          <View style={{ flex: 1 }}>
            <Input value={party} onChangeText={setParty} placeholder={type === 'return_out' ? t('supplier') : t('party')} />
          </View>
        )}
        <PressScale onPress={() => setDateOpen(true)} style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, minHeight: 50 }}>
          <CalendarDays size={18} color={c.primary} />
          <Txt v="tiny" weight="bold" style={{ marginTop: 3 }}>{date === today ? t('today') : fmtDate(date, lang)}</Txt>
        </PressScale>
      </Row>
      {isSale && customer && (
        <Row between style={{ marginTop: 8, paddingHorizontal: 4 }}>
          <Txt v="tiny" muted>{t('previousBalance')}</Txt>
          <BalanceBadge kind="customer" balance={customer.balance} />
        </Row>
      )}
      {isSale && !customer && (
        <Input value={party} onChangeText={setParty} placeholder={`${t('customerName')} (${t('optional')})`} style={{ marginTop: 10 }} />
      )}
      {!isSale && <Input value={reference} onChangeText={setReference} placeholder={`${t('invoiceNo')} (${t('optional')})`} style={{ marginTop: 10 }} />}

      {/* items */}
      <Row between style={{ marginTop: 22, marginBottom: 10 }}>
        <Txt v="h3">{t('items')} <Txt v="small" muted>({lines.length})</Txt></Txt>
      </Row>
      <View style={{ gap: 10 }}>
        {lines.map((l) => {
          const p = catalog.byId.get(l.product_id)
          if (!p) return null
          const options = eligible(l.product_id)
          const chosen = options.find((b) => b.id === l.batch_id)
          const available = chosen ? chosen.qty : options.reduce((s, b) => s + b.qty, 0)
          const loose = looseOf(l)
          const size = Number(p.pack_size) || 1
          const qty = packsOf(l)
          const over = qty > available
          const badStep = loose && Number(l.qty) > 0 && !kgFits(Number(l.qty), size)
          const kg = unitLabel('kg', lang)
          const plan: { b: BatchStock; take: number }[] = []
          if (qty > 0 && !over) {
            let need = qty
            for (const b of chosen ? [chosen] : options) {
              if (need <= 0) break
              const take = Math.min(need, b.qty)
              plan.push({ b, take })
              need -= take
            }
          }
          const cost = Number(p.purchase_price) / (loose ? size : 1)
          const profit = (Number(l.rate) - cost) * (Number(l.qty) || 0)
          return (
            <Rise key={l.key}>
              <Card style={{ padding: 14 }} glow={over || badStep ? 'red' : undefined}>
                <Row gap={12}>
                  <ProductAvatar p={p} size={42} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" numberOfLines={1}>{pick(p.name, p.name_ur)}</Txt>
                    <Txt v="tiny" muted numberOfLines={1}>{label(p)}</Txt>
                  </View>
                  <IconBtn size={34} icon={<Trash2 size={16} color={c.red} />} tone="red" onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} label={t('remove')} />
                </Row>

                {isSale && canSellLoose(p) && (
                  <Segmented
                    value={l.unit}
                    onChange={(u) => switchUnit(l, u)}
                    items={[{ value: 'pack', label: t(`pt_${p.pack_type}`) }, { value: 'kg', label: t('soldLoose') }]}
                    style={{ marginTop: 12 }}
                  />
                )}

                <Row gap={10} style={{ marginTop: 12, alignItems: 'flex-start' }}>
                  <Field label={`${t('qty')} (${loose ? kg : t(`pt_${p.pack_type}`)})`} style={{ flex: 1.15 }}>
                    <Stepper value={l.qty} onChange={(v) => set(l.key, { qty: v })} step={loose ? 1 : 1} invalid={over || badStep} />
                  </Field>
                  {isSale && (
                    <Field label={loose ? t('perKgRate') : t('rate')} style={{ flex: 1 }}>
                      <NumInput value={l.rate} onChangeText={(v) => set(l.key, { rate: v })} placeholder="0" style={{ height: 53 }} />
                    </Field>
                  )}
                </Row>
                <Txt v="tiny" color={over || badStep ? c.red : c.muted} style={{ marginTop: 6 }}>
                  {over
                    ? `${t('exceeds')} (${loose ? `${fmtNum(packsToKg(available, size), 3)} ${kg}` : fmtNum(available, 3)})`
                    : badStep
                      ? t('errKgStep', { size: fmtNum(size), step: fmtNum(kgStep(size), 3) })
                      : `${t('available')}: ${loose ? `${fmtNum(packsToKg(available, size), 3)} ${kg}` : fmtNum(available, 3)}${!loose && p.pack_unit !== 'pcs' ? ` = ${fmtTotal(available, p.pack_size, p.pack_unit, lang)}` : ''}`}
                </Txt>

                {/* batch + plan */}
                <Pressable onPress={() => setBatchFor(l.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: c.surface2 }}>
                  <Layers size={15} color={c.muted} />
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {chosen ? (
                      <Txt v="tiny" weight="bold">#{chosen.batch_no} · {fmtDate(chosen.expiry_date, lang)}</Txt>
                    ) : plan.length ? (
                      plan.map(({ b, take }) => <Txt key={b.id} v="tiny" soft>#{b.batch_no}: {fmtNum(take, 3)}</Txt>)
                    ) : (
                      <Txt v="tiny" soft>{t('batchAuto')}</Txt>
                    )}
                  </View>
                  <ChevronDown size={14} color={c.muted} />
                </Pressable>

                {isSale && amountOf(l) > 0 && (
                  <Row between style={{ marginTop: 10 }}>
                    {cost > 0 && Number(l.rate) > 0 ? <Badge tone={profit < 0 ? 'red' : 'green'}>{t('profit')} {fmtMoney(profit, lang)}</Badge> : <View />}
                    <Txt v="h3" style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(amountOf(l), lang)}</Txt>
                  </Row>
                )}
              </Card>
            </Rise>
          )
        })}

        <PressScale onPress={() => setPicking(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 64, borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: c.primary + '90', backgroundColor: c.primarySoft }}>
          <Plus size={22} color={c.primary} />
          <Txt weight="extrabold" color={c.primary}>{t('addItem')}</Txt>
        </PressScale>
        {lines.length === 0 && (
          <View style={{ alignItems: 'center', padding: 16, gap: 8 }}>
            <ShoppingBag size={34} color={c.faint} />
            <Txt v="small" muted align="center">{t('cartEmpty')}</Txt>
          </View>
        )}
      </View>

      {/* payment */}
      {isSale && lines.length > 0 && (
        <Card style={{ marginTop: 18, gap: 14 }}>
          <Row between>
            <Txt muted>{t('subtotal')}</Txt>
            <Txt weight="bold">{fmtMoney(subtotal, lang)}</Txt>
          </Row>
          <Field label={t('discount')} optional>
            <NumInput value={discount} onChangeText={setDiscount} placeholder="0" />
          </Field>
          <Field label={t('received')} hint={partyId ? t('receivedHintKhata') : t('receivedHintWalkIn')}>
            <NumInput value={received} onChangeText={setReceived} placeholder={partyId ? '0' : String(total)} />
          </Field>
          {!!partyId && total > 0 && (
            <Segmented
              value={paidNum === total ? 'full' : paidNum === 0 ? 'credit' : ('' as 'full')}
              onChange={(v) => setReceived(v === 'full' ? String(total) : '0')}
              items={[{ value: 'full', label: t('fullPayment') }, { value: 'credit', label: t('onCredit') }]}
            />
          )}
          <View style={{ padding: 12, borderRadius: 16, backgroundColor: due > 0 ? c.amberSoft : c.surface2 }}>
            <Row between>
              <Txt v="small" muted>{t('balanceDue')}</Txt>
              <Txt weight="extrabold" color={due > 0 ? c.amber : c.text}>{fmtMoney(due, lang)}</Txt>
            </Row>
            {due > 0 && !partyId && <Txt v="tiny" color={c.red} style={{ marginTop: 4 }}>{t('errCreditNeedsParty')}</Txt>}
            {due > 0 && customer && <Txt v="tiny" muted style={{ marginTop: 4 }}>{t('newBalance')}: {fmtMoney(customer.balance + due, lang)}</Txt>}
          </View>
        </Card>
      )}
      <Input value={note} onChangeText={setNote} placeholder={`${t('note')} (${t('optional')})`} style={{ marginTop: 14 }} />

      {/* sheets */}
      <ProductPickerSheet open={picking} onClose={() => setPicking(false)} catalog={catalog} onPick={addProduct} inStockOnly />
      <PartyPickerSheet
        open={partyOpen}
        onClose={() => setPartyOpen(false)}
        kind="customer"
        parties={data.customers}
        value={partyId}
        onPick={(id) => { setPartyId(id); setReceived('') }}
        noneLabel={t('walkIn')}
        onNew={() => setNewParty(true)}
      />
      <PartyFormSheet open={newParty} onClose={() => setNewParty(false)} kind="customer" onSaved={(id) => { setNewParty(false); setPendingParty(id); setReceived(''); reload() }} />
      <CalendarSheet open={dateOpen} onClose={() => setDateOpen(false)} value={date} onPick={setDate} max={today} />
      <PickerSheet
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title={t('saleType')}
        value={type}
        searchable={false}
        onPick={(v) => setType(v as MovementType)}
        options={OUT_TYPES.map((x) => ({ value: x, label: t(`mv_${x}`) }))}
      />
      <PickerSheet
        open={batchFor !== null}
        onClose={() => setBatchFor(null)}
        title={t('batch')}
        value={batchLine?.batch_id ?? ''}
        searchable={false}
        onPick={(v) => batchFor !== null && set(batchFor, { batch_id: v })}
        options={[
          { value: '', label: t('batchAuto') },
          ...(batchLine ? eligible(batchLine.product_id) : []).map((b) => {
            const left = daysBetween(today, b.expiry_date)
            return {
              value: b.id,
              label: `#${b.batch_no}`,
              sub: `${fmtDate(b.expiry_date, lang)}${left < 0 ? ` · ${t('expired')}` : left <= org.expiry_alert_days ? ` · ${t('daysLeft', { n: left })}` : ''}`,
              right: <Txt weight="extrabold">{fmtNum(b.qty, 3)} <Txt v="tiny" muted>{batchProduct ? t(`pt_${batchProduct.pack_type}`) : ''}</Txt></Txt>,
            }
          }),
        ]}
      />
    </Screen>
  )
}
