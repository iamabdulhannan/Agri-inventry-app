import { Info, PackageSearch } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { ProductAvatar, ProductPickerSheet, usePackLabel } from '@/components/domain'
import { Button, ErrorBox, Field, NumInput, Row, SelectButton, Sheet, Skeleton, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadCatalog } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import type { InvestorRow } from '@/lib/investors'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { fmtNum } from '@/lib/units'
import { Note, useInvErr } from './common'

/** Put some of the shop's current stock in his name */
export function StockSheet({ open, investor, onClose, onDone }: { open: boolean; investor: InvestorRow; onClose: () => void; onDone: () => void }) {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, today, version } = useOrg()
  const { toast } = useFeedback()
  const errOf = useInvErr()
  const label = usePackLabel()
  const { data: cat, error: catErr, reload } = useLoad(() => (open ? loadCatalog(org.id) : Promise.resolve(null)), [org.id, version, open])
  const [picking, setPicking] = useState(false)
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [rate, setRate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [last, setLast] = useState<boolean | null>(null)
  if (open !== last) {
    setLast(open)
    if (open) {
      setProductId('')
      setQty('')
      setRate('')
      setErr('')
    }
  }
  const p = cat?.byId.get(productId)
  const cost = (Number(qty) || 0) * (Number(rate) || 0)
  const over = cost > investor.available + 0.005
  const m = (v: number) => fmtMoney(v, lang)

  const choose = (id: string) => {
    setProductId(id)
    const pp = cat?.byId.get(id)
    setRate(pp && Number(pp.purchase_price) > 0 ? String(Number(pp.purchase_price)) : '')
  }

  const save = async () => {
    setErr('')
    if (!productId) return setErr(t('errChooseProduct'))
    if (!(Number(qty) > 0)) return setErr(t('errQty'))
    if (!(Number(rate) >= 0) || rate === '') return setErr(t('errInvalidPrice'))
    setBusy(true)
    const { error } = await supabase.rpc('assign_investor_stock', { p_org: org.id, p_investor: investor.id, p_product: productId, p_qty: Number(qty), p_unit_cost: Number(rate), p_date: today, p_purchase: null, p_note: null })
    setBusy(false)
    if (error) return setErr(errOf(error))
    toast(t('saved'))
    onDone()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('invAddStock')}
      subtitle={investor.name}
      footer={<Button title={t('save')} onPress={save} loading={busy} disabled={!cat} style={{ flex: 1 }} size="lg" />}
    >
      <View style={{ gap: 14 }}>
        <Note tone="blue" icon={<Info size={18} color={c.blue} />}>{t('invAddStockHint')}</Note>
        <Field label={t('product')}>
          {catErr && !cat ? (
            <ErrorBox error={catErr} onRetry={reload} />
          ) : !cat ? (
            <Skeleton h={58} r={14} />
          ) : (
            <SelectButton
              label={p ? pick(p.name, p.name_ur) : null}
              sub={p ? `${label(p)}${p.company_name ? ` · ${p.company_name}` : ''} · ${t('mInvInStockNow', { n: fmtNum(p.qty, 3) })}` : undefined}
              placeholder={t('mInvChooseProduct')}
              icon={p ? <ProductAvatar p={p} size={36} /> : <PackageSearch size={20} color={c.primary} />}
              onPress={() => setPicking(true)}
            />
          )}
        </Field>
        <Row gap={10} center={false}>
          <Field label={t('qtyPacks')} style={{ flex: 1 }} error={p && Number(qty) > p.qty + 0.000001 ? t('mInvInStockNow', { n: fmtNum(p.qty, 3) }) : null}>
            <NumInput value={qty} onChangeText={setQty} placeholder="0" />
          </Field>
          <Field label={t('purchasePrice')} style={{ flex: 1 }}>
            <NumInput value={rate} onChangeText={setRate} placeholder="0" />
          </Field>
        </Row>
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: over ? c.redSoft : c.surface2, borderWidth: 1, borderColor: over ? c.red + '40' : c.border, gap: 6 }}>
          <Row between>
            <Txt v="small" muted>{t('invCost')}</Txt>
            <Txt weight="extrabold">{m(cost)}</Txt>
          </Row>
          <Row between>
            <Txt v="small" muted>{t('invAvailable')}</Txt>
            <Txt v="small" weight="bold" color={over ? c.red : c.blue}>{m(investor.available)}</Txt>
          </Row>
          {cost > 0 && (
            <Txt v="tiny" color={over ? c.red : c.muted}>
              {over ? t('errInvestorNoFunds') : t('mInvLeftAfter', { amount: m(investor.available - cost) })}
            </Txt>
          )}
        </View>
        {!!err && <ErrorBox>{err}</ErrorBox>}
      </View>
      {!!cat && <ProductPickerSheet open={picking} onClose={() => setPicking(false)} catalog={cat} onPick={choose} inStockOnly priceKind="purchase" />}
    </Sheet>
  )
}
