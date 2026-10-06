import { router, useLocalSearchParams } from 'expo-router'
import { CalendarDays, Check, ReceiptText, Search, Undo2 } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ProductAvatar, usePackLabel } from '@/components/domain'
import { Badge, Button, CalendarSheet, Card, Empty, ErrorBox, Field, IconTile, Input, Loading, NumInput, PressScale, Row, Screen, Stepper, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useCatalog } from '@/lib/catalog'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { kgFits, kgStep, kgToPacks, packsToKg } from '@/lib/loose'
import { fmtMoney, r2 } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { Sale } from '@/lib/types'
import { fmtNum, unitLabel } from '@/lib/units'

interface Returnable { batch_id: string; product_id: string; batch_no: string; expiry_date: string; sold: number; returned: number; remaining: number; rate: number; loose?: boolean }
type LoadedSale = Sale & { parties: { name: string; phone: string | null } | null }

/** Customer return against a sale invoice */
export default function InvoiceReturn() {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, today, refresh } = useOrg()
  const { toast } = useFeedback()
  const label = usePackLabel()
  const params = useLocalSearchParams<{ invoice?: string }>()
  const { data: catalog } = useCatalog()
  const [invoiceNo, setInvoiceNo] = useState(params.invoice ?? '')
  const [sale, setSale] = useState<LoadedSale | null>(null)
  const [lines, setLines] = useState<Returnable[]>([])
  const [qty, setQty] = useState<Record<string, string>>({})
  const [refund, setRefund] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [dateOpen, setDateOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sizeOf = (l: Returnable) => (l.loose ? Number(catalog?.byId.get(l.product_id)?.pack_size) || 1 : 1)

  const load = async (no = invoiceNo) => {
    setError('')
    const n = Number(no)
    if (!(n > 0)) return
    setLoading(true)
    const { data: s, error: e1 } = await supabase.from('sales').select('*, parties(name, phone)').eq('org_id', org.id).eq('invoice_no', n).maybeSingle()
    if (e1 || !s) {
      setLoading(false)
      setSale(null)
      return setError(e1 ? errText(e1, t) : t('invoiceNotFound', { n }))
    }
    const { data: rows, error: e2 } = await supabase.rpc('sale_returnable', { p_sale: s.id })
    setLoading(false)
    if (e2) return setError(errText(e2, t))
    const list = ((rows ?? []) as Returnable[]).map((l) => ({ ...l, sold: +l.sold, returned: +l.returned, remaining: +l.remaining, rate: +l.rate }))
    setSale(s as LoadedSale)
    setLines(list)
    setQty(Object.fromEntries(list.map((l) => [l.batch_id, '0'])))
    setRefund('')
    setNote('')
    setDate(today)
  }

  useEffect(() => {
    if (params.invoice && catalog) load(params.invoice)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.invoice, !!catalog])

  if (!catalog) return <Screen back title={t('mv_return_in')}><Loading rows={3} /></Screen>

  if (!sale) {
    return (
      <Screen back title={t('mv_return_in')}>
        <Card style={{ gap: 14 }}>
          <Row gap={12}>
            <IconTile icon={<ReceiptText size={20} color={c.primary} />} />
            <View style={{ flex: 1 }}>
              <Txt weight="bold">{t('saleInvoiceNo')}</Txt>
              <Txt v="tiny" muted>{t('loadInvoice')}</Txt>
            </View>
          </Row>
          <Input value={invoiceNo} onChangeText={setInvoiceNo} keyboardType="number-pad" placeholder="1042" big onSubmitEditing={() => load()} returnKeyType="search" />
          <Button title={t('loadInvoice')} icon={<Search size={18} color={c.primaryText} />} onPress={() => load()} loading={loading} disabled={!invoiceNo} size="lg" />
          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </Card>
        <Txt v="small" muted style={{ marginTop: 14 }}>{t('manualReturn')}</Txt>
      </Screen>
    )
  }

  const factor = Number(sale.subtotal) > 0 ? Number(sale.total) / Number(sale.subtotal) : 1
  const shown = (l: Returnable, packs: number) => (l.loose ? packsToKg(packs, sizeOf(l)) : packs)
  const packsOf = (l: Returnable) => (l.loose ? kgToPacks(Number(qty[l.batch_id]) || 0, sizeOf(l)) : Number(qty[l.batch_id]) || 0)
  const value = r2(lines.reduce((s, l) => s + packsOf(l) * l.rate * factor, 0))
  const khata = !!sale.party_id
  const refundNum = khata ? (refund === '' ? 0 : Number(refund) || 0) : value
  const credit = r2(value - refundNum)
  const nothingLeft = lines.every((l) => l.remaining <= 0)
  const customer = sale.parties?.name ?? sale.customer_name ?? t('walkIn')

  const save = async () => {
    setError('')
    for (const l of lines) {
      const q = packsOf(l)
      if (q < 0 || q > l.remaining) return setError(`${t('errReturnTooMuch')} (${l.batch_no}: ${fmtNum(shown(l, l.remaining), 3)})`)
      if (l.loose && !kgFits(Number(qty[l.batch_id]) || 0, sizeOf(l))) return setError(t('errKgStep', { size: fmtNum(sizeOf(l)), step: fmtNum(kgStep(sizeOf(l)), 3) }))
    }
    if (!(value > 0)) return setError(t('errQty'))
    if (refundNum < 0 || refundNum > value) return setError(t('errInvalidRefund'))
    setBusy(true)
    const { error } = await supabase.rpc('record_sale_return', {
      p_org: org.id,
      p_sale: sale.id,
      p_date: date,
      p_lines: lines.filter((l) => packsOf(l) > 0).map((l) => ({ batch_id: l.batch_id, qty: packsOf(l) })),
      p_refund: refundNum,
      p_note: note || null,
    })
    setBusy(false)
    if (error) return setError(errText(error, t))
    toast(t('returnSaved', { amount: fmtMoney(value, lang) }))
    refresh()
    router.back()
  }

  return (
    <Screen
      back
      title={t('returnFromInvoice', { n: sale.invoice_no })}
      subtitle={`${customer} · ${fmtDate(sale.sale_date, lang)} · ${fmtMoney(sale.total, lang)}`}
      footer={
        <View style={{ gap: 10 }}>
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <Row between>
            <View>
              <Txt v="tiny" muted>{t('returnValue')}</Txt>
              <Txt v="h1">{fmtMoney(value, lang)}</Txt>
            </View>
            <Button size="lg" title={t('saveReturn')} icon={<Check size={20} color={c.primaryText} />} onPress={save} loading={busy} disabled={!(value > 0)} />
          </Row>
        </View>
      }
    >
      <Row gap={10} style={{ marginBottom: 12 }}>
        <Button variant="secondary" size="sm" title={t('clearInvoice')} onPress={() => { setSale(null); setInvoiceNo('') }} />
        <PressScale onPress={() => setDateOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: 12, backgroundColor: c.surface2 }}>
          <CalendarDays size={15} color={c.primary} />
          <Txt v="small" weight="bold">{date === today ? t('today') : fmtDate(date, lang)}</Txt>
        </PressScale>
      </Row>
      {Number(sale.discount) > 0 && <Txt v="tiny" muted style={{ marginBottom: 10 }}>{t('returnDiscountNote')}</Txt>}
      {nothingLeft ? <Card><Empty icon={<Undo2 size={28} color={c.muted} />}>{t('nothingToReturn')}</Empty></Card> : (
        <View style={{ gap: 10 }}>
          {lines.map((l, i) => {
            const p = catalog.byId.get(l.product_id)
            const kg = unitLabel('kg', lang)
            const over = packsOf(l) > l.remaining
            return (
              <Animated.View key={l.batch_id} entering={FadeInDown.delay(i * 60).springify().damping(16)}>
                <Card style={{ padding: 14, gap: 10, opacity: l.remaining > 0 ? 1 : 0.5 }} glow={over ? 'red' : undefined}>
                  <Row gap={12}>
                    {p && <ProductAvatar p={p} size={40} />}
                    <View style={{ flex: 1 }}>
                      <Txt weight="bold" numberOfLines={1}>{p ? pick(p.name, p.name_ur) : '—'}</Txt>
                      <Txt v="tiny" muted>{p ? label(p) : ''} · #{l.batch_no}</Txt>
                    </View>
                    <Txt weight="bold">{fmtMoney(l.loose ? l.rate / sizeOf(l) : l.rate, lang)}</Txt>
                  </Row>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Badge>{t('sold')}: {fmtNum(shown(l, l.sold), 3)}{l.loose ? ` ${kg}` : ''}</Badge>
                    {l.returned > 0 && <Badge tone="amber">{t('alreadyReturned')}: {fmtNum(shown(l, l.returned), 3)}</Badge>}
                    {l.loose && <Badge tone="violet">{t('soldLoose')}</Badge>}
                  </Row>
                  {l.remaining > 0 && (
                    <Field label={`${t('returnQty')}${l.loose ? ` (${kg})` : ''}`} error={over ? `${t('errReturnTooMuch')} (${fmtNum(shown(l, l.remaining), 3)})` : undefined}>
                      <Stepper value={qty[l.batch_id] ?? ''} onChange={(v) => setQty((q) => ({ ...q, [l.batch_id]: v }))} invalid={over} />
                    </Field>
                  )}
                  {l.remaining > 0 && (
                    <Button size="sm" variant="ghost" title={`${t('all')}: ${fmtNum(shown(l, l.remaining), 3)}`} onPress={() => setQty((q) => ({ ...q, [l.batch_id]: String(shown(l, l.remaining)) }))} style={{ alignSelf: 'flex-start' }} />
                  )}
                </Card>
              </Animated.View>
            )
          })}
        </View>
      )}

      {!nothingLeft && (
        <Card style={{ marginTop: 16, gap: 12 }}>
          {khata ? (
            <>
              <Field label={t('refundNow')} hint={t('refundHintKhata')}>
                <NumInput value={refund} onChangeText={setRefund} placeholder="0" />
              </Field>
              <Row between>
                <Txt v="small" muted>{t('creditToKhata')}</Txt>
                <Txt weight="extrabold">{fmtMoney(credit, lang)}</Txt>
              </Row>
            </>
          ) : (
            <Row between>
              <Txt v="small" muted>{t('refundCash')}</Txt>
              <Txt weight="extrabold">{fmtMoney(value, lang)}</Txt>
            </Row>
          )}
          {!khata && <Txt v="tiny" muted>{t('refundHintWalkIn')}</Txt>}
          <Input value={note} onChangeText={setNote} placeholder={`${t('note')} (${t('optional')})`} />
        </Card>
      )}
      <CalendarSheet open={dateOpen} onClose={() => setDateOpen(false)} value={date} onPick={setDate} max={today} min={sale.sale_date} />
    </Screen>
  )
}
