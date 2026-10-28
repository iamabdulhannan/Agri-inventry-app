import { router, useLocalSearchParams } from 'expo-router'
import { Check, Info } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { ProductAvatar, usePackLabel } from '@/components/domain'
import { Button, Card, Empty, ErrorBox, Field, Loading, NumInput, Row, Screen, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { perKg, perPack } from '@/lib/loose'
import { fmtMoney, r2 } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { PackType, PackUnit } from '@/lib/types'
import { fmtNum, unitLabel } from '@/lib/units'

interface Group {
  key: string
  product_id: string
  name: string
  name_ur: string | null
  pack: { pack_size: number; pack_unit: PackUnit; pack_type: PackType }
  loose: boolean
  packs: number
  rate: string // as shown: per pack, or per kg for loose bags
  oldRate: number
}
interface Loaded {
  invoice_no: number
  sale_date: string
  party: string | null
  khata: boolean
  total: number
  markup: number
  returned: boolean
  groups: Group[]
}

/** Fix wrong rates (and discount / markup) on a saved invoice. Owner / admin. */
export default function CorrectRates() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const label = usePackLabel()
  const [data, setData] = useState<Loaded | null>(null)
  const [discount, setDiscount] = useState('')
  const [markup, setMarkup] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [s, m, r] = await Promise.all([
        supabase.from('sales').select('*, parties(name)').eq('id', id).single(),
        supabase.from('stock_movements').select('qty, unit_price, loose, batches(products(id, name, name_ur, pack_size, pack_unit, pack_type))').eq('sale_id', id).order('created_at'),
        supabase.from('sale_returns').select('id', { count: 'exact', head: true }).eq('sale_id', id),
      ])
      if (s.error || m.error) return setErr(errText(s.error ?? m.error, t))
      type Row = { qty: number; unit_price: number; loose?: boolean; batches: { products: { id: string; name: string; name_ur: string | null; pack_size: number; pack_unit: PackUnit; pack_type: PackType } } | null }
      const map = new Map<string, Group>()
      for (const x of (m.data ?? []) as unknown as Row[]) {
        const p = x.batches?.products
        if (!p) continue
        const loose = !!x.loose
        const key = `${p.id}|${loose}`
        const g = map.get(key)
        if (g) g.packs += -Number(x.qty)
        else {
          const size = Number(p.pack_size) || 1
          const rate = Number(x.unit_price)
          map.set(key, {
            key, product_id: p.id, name: p.name, name_ur: p.name_ur, pack: { pack_size: size, pack_unit: p.pack_unit, pack_type: p.pack_type },
            loose, packs: -Number(x.qty), oldRate: loose ? perKg(rate, size) : rate, rate: String(loose ? perKg(rate, size) : rate),
          })
        }
      }
      const sale = s.data
      setData({
        invoice_no: sale.invoice_no, sale_date: sale.sale_date, party: sale.parties?.name ?? sale.customer_name ?? null, khata: !!sale.party_id,
        total: Number(sale.total), markup: Number(sale.markup ?? 0), returned: (r.count ?? 0) > 0, groups: [...map.values()],
      })
      setDiscount(Number(sale.discount) ? String(Number(sale.discount)) : '')
      setMarkup(Number(sale.markup ?? 0) ? String(Number(sale.markup)) : '')
    })()
  }, [id, t])

  const setRate = (key: string, rate: string) => setData((d) => d && { ...d, groups: d.groups.map((g) => (g.key === key ? { ...g, rate } : g)) })
  const packRate = (g: Group) => (g.loose ? perPack(Number(g.rate) || 0, g.pack.pack_size) : Number(g.rate) || 0)
  const sub = data ? r2(data.groups.reduce((s, g) => s + r2(g.packs * packRate(g)), 0)) : 0
  const disc = Number(discount) || 0
  const mark = Number(markup) || 0
  const total = r2(sub - disc + mark)
  const diff = data ? r2(total - data.total) : 0
  const m = (v: number) => fmtMoney(v, lang)
  const unchanged = !!data && diff === 0 && data.groups.every((g) => Number(g.rate) === g.oldRate)

  const save = async () => {
    if (!data || !id) return
    setErr('')
    if (data.groups.some((g) => g.rate === '' || !(Number(g.rate) >= 0))) return setErr(t('errInvalidPrice'))
    if (disc < 0 || disc > sub) return setErr(t('errInvalidDiscount'))
    if (!(await confirm(t('crConfirm', { n: data.invoice_no, from: m(data.total), to: m(total) }), { danger: false, okLabel: t('save') }))) return
    setBusy(true)
    const { error } = await supabase.rpc('correct_sale_rates', {
      p_org: org.id, p_sale: id,
      p_lines: data.groups.map((g) => ({ product_id: g.product_id, loose: g.loose, unit_price: packRate(g) })),
      p_discount: disc, p_markup: mark,
    })
    setBusy(false)
    if (error) {
      const msg = String(error.message ?? '')
      return setErr(/correct_sale_rates|schema cache|PGRST20/.test(msg) ? t('errRunMigration', { n: '017' }) : errText(error, t))
    }
    toast(t('crSaved', { n: data.invoice_no }))
    refresh()
    router.replace({ pathname: '/receipt/[id]', params: { id } })
  }

  if (!isAdmin) return <Screen back title={t('crTitleShort')}><Empty>{t('errNotAllowed')}</Empty></Screen>

  return (
    <Screen
      back
      title={data ? t('crTitle', { n: data.invoice_no }) : t('crTitleShort')}
      subtitle={data ? `${fmtDate(data.sale_date, lang)} · ${data.party ?? t('walkIn')}` : undefined}
      footer={
        data && !data.returned ? (
          <View style={{ gap: 10 }}>
            {!!err && <ErrorBox>{err}</ErrorBox>}
            <Row between>
              <View>
                <Txt v="tiny" muted>{t('crNewTotal')}</Txt>
                <Txt v="h1" color={diff === 0 ? c.text : c.primary}>{m(total)}</Txt>
              </View>
              <Button size="lg" title={t('save')} icon={<Check size={20} color={c.primaryText} />} onPress={save} loading={busy} disabled={unchanged} style={{ minWidth: 140 }} />
            </Row>
          </View>
        ) : undefined
      }
    >
      {!data ? (err ? <ErrorBox>{err}</ErrorBox> : <Loading rows={3} />) : data.returned ? (
        <Card style={{ backgroundColor: c.amberSoft }}><Txt>{t('errSaleHasReturns')}</Txt></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {data.groups.map((g) => {
            const changed = Number(g.rate) !== g.oldRate
            const kg = unitLabel('kg', lang)
            return (
              <Card key={g.key} style={{ padding: 14, gap: 10 }} glow={changed ? 'primary' : undefined}>
                <Row gap={12}>
                  <ProductAvatar p={{ ...g.pack, name: g.name }} size={40} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" numberOfLines={1}>{pick(g.name, g.name_ur)}</Txt>
                    <Txt v="tiny" muted numberOfLines={1}>
                      {label(g.pack)} · {g.loose ? `${fmtNum(g.packs * g.pack.pack_size, 3)} ${kg}` : `× ${fmtNum(g.packs, 3)}`}
                    </Txt>
                  </View>
                  <Txt weight="extrabold">{m(r2(g.packs * packRate(g)))}</Txt>
                </Row>
                <Field label={`${g.loose ? t('perKgRate') : t('rate')} · ${t('crWas')} ${m(g.oldRate)}`}>
                  <NumInput value={g.rate} onChangeText={(v) => setRate(g.key, v)} />
                </Field>
              </Card>
            )
          })}
          <Row gap={10} center={false}>
            <Field label={t('discount')} optional style={{ flex: 1 }}>
              <NumInput value={discount} onChangeText={setDiscount} placeholder="0" />
            </Field>
            {(data.khata || data.markup > 0) && (
              <Field label={t('saleMarkup')} optional style={{ flex: 1 }}>
                <NumInput value={markup} onChangeText={setMarkup} placeholder="0" />
              </Field>
            )}
          </Row>
          <Row gap={10}>
            <Card style={{ flex: 1, padding: 12 }}>
              <Txt v="tiny" muted>{t('crOldTotal')}</Txt>
              <Txt v="h3">{m(data.total)}</Txt>
            </Card>
            <Card style={{ flex: 1, padding: 12, backgroundColor: c.primarySoft }}>
              <Txt v="tiny" muted>{t('crNewTotal')}</Txt>
              <Txt v="h3" color={c.primary}>{m(total)}</Txt>
            </Card>
          </Row>
          {diff !== 0 && (
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: diff > 0 ? c.amberSoft : c.blueSoft }}>
              <Txt v="small">
                {data.khata
                  ? diff > 0 ? t('crKhataUp', { amount: m(diff), name: data.party ?? '' }) : t('crKhataDown', { amount: m(-diff), name: data.party ?? '' })
                  : diff > 0 ? t('crCollect', { amount: m(diff) }) : t('crGiveBack', { amount: m(-diff) })}
              </Txt>
            </View>
          )}
          <Row gap={8} center={false}>
            <Info size={14} color={c.muted} style={{ marginTop: 2 }} />
            <Txt v="tiny" muted style={{ flex: 1 }}>{t('crHint')}</Txt>
          </Row>
        </View>
      )}
    </Screen>
  )
}
