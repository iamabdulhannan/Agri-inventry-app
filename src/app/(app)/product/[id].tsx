import { router, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowDownToLine, Eye, EyeOff, Layers, Pencil, ScanBarcode, SlidersHorizontal, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ExpiryBadge, MovementRow, ProductAvatar, usePackLabel } from '@/components/domain'
import { ProductFormSheet } from '@/components/forms'
import { Badge, Button, Card, Empty, ErrorBox, Field, IconBtn, Input, Loading, NumInput, PressScale, Rise, Row, Screen, SectionTitle, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadCatalog } from '@/lib/catalog'
import { fetchAll, useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { daysBetween } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { BatchStock, Movement } from '@/lib/types'
import { fmtNum, fmtTotal } from '@/lib/units'

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, pick, lang } = useI18n()
  const { c } = useTheme()
  const { org, version, today, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const label = usePackLabel()
  const [editing, setEditing] = useState(false)
  const [adjusting, setAdjusting] = useState<BatchStock | null>(null)

  const { data, error, loading, reload } = useLoad(async () => {
    const [catalog, batches, moves] = await Promise.all([
      loadCatalog(org.id),
      fetchAll<BatchStock>((a, b) => supabase.from('batch_stock').select('*').eq('product_id', id).order('expiry_date').range(a, b)),
      supabase
        .from('stock_movements')
        .select('*, batches!inner(batch_no, expiry_date, mfg_date, product_id), profiles(full_name)')
        .eq('batches.product_id', id)
        .order('movement_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(150),
    ])
    if (moves.error) throw moves.error
    return { catalog, batches: batches.map((b) => ({ ...b, qty: Number(b.qty) })), moves: (moves.data ?? []) as Movement[] }
  }, [org.id, id, version])

  const p = data?.catalog.byId.get(id)
  if (loading && !data) return <Screen back><Loading /></Screen>
  if (error && !data) return <Screen back><ErrorBox error={error} onRetry={reload} /></Screen>
  if (!data || !p) return <Screen back><Empty>{t('noData')}</Empty></Screen>

  const withStock = data.batches.filter((b) => b.qty > 0)
  const finished = data.batches.filter((b) => b.qty <= 0)

  const toggleActive = async () => {
    const { error } = await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('saved'))
    refresh()
  }
  const remove = async () => {
    if (data.moves.length) return toast(t('errProductHasHistory'), 'err')
    if (!(await confirm(t('deleteProductConfirm')))) return
    const b = await supabase.from('batches').delete().eq('product_id', p.id)
    if (b.error) return toast(errText(b.error, t), 'err')
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('deleted'))
    refresh()
    router.back()
  }

  return (
    <Screen
      back
      title={pick(p.name, p.name_ur)}
      subtitle={`${label(p)}${p.company_name ? ` · ${p.company_name}` : ''}`}
      right={<IconBtn icon={<Pencil size={18} color={c.text} />} onPress={() => setEditing(true)} label={t('edit')} />}
      refreshing={loading}
      onRefresh={reload}
    >
      <Rise>
        <View style={styles.heroShell}>
          <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
            <Row gap={12}>
              <ProductAvatar p={p} size={50} />
              <View style={{ flex: 1 }}>
                <Txt v="label" color="rgba(236,255,240,0.7)">{t('stock')}</Txt>
                <Txt v="display" color="#F4FFF6" style={{ fontVariant: ['tabular-nums'] }}>{fmtNum(p.qty, 3)} <Txt v="body" color="rgba(236,255,240,0.75)">{t(`pt_${p.pack_type}`)}</Txt></Txt>
              </View>
            </Row>
            <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {p.pack_unit !== 'pcs' && <View style={styles.chip}><Txt v="tiny" color="#E9FFE0">= {fmtTotal(Math.max(0, p.qty), p.pack_size, p.pack_unit, lang)}</Txt></View>}
              <View style={styles.chip}><Txt v="tiny" color="#E9FFE0">{t('stockValue')}: {fmtMoney(p.stock_value, lang)}</Txt></View>
              <View style={styles.chip}><Txt v="tiny" color="#E9FFE0">{t('batches')}: {withStock.length}</Txt></View>
            </Row>
            <Row gap={10} style={{ marginTop: 16 }}>
              <View style={styles.price}>
                <Txt v="tiny" color="rgba(236,255,240,0.65)">{t('purchasePrice')}</Txt>
                <Txt v="h3" color="#F4FFF6">{fmtMoney(p.purchase_price, lang)}</Txt>
              </View>
              <View style={styles.price}>
                <Txt v="tiny" color="rgba(236,255,240,0.65)">{t('mrp')}</Txt>
                <Txt v="h3" color="#C8FF4D">{fmtMoney(p.sale_price, lang)}</Txt>
              </View>
            </Row>
          </LinearGradient>
        </View>
      </Rise>

      <Rise i={1}>
        <Row gap={10} style={{ marginTop: 14 }}>
          <Button title={t('newSale')} icon={<ScanBarcode size={18} color={c.primaryText} />} onPress={() => router.push({ pathname: '/sale', params: { product: p.id } })} disabled={p.qty <= 0} style={{ flex: 1 }} />
          <Button variant="secondary" title={t('navStockIn')} icon={<ArrowDownToLine size={18} color={c.text} />} onPress={() => router.push({ pathname: '/stock-in', params: { product: p.id } })} style={{ flex: 1 }} />
        </Row>
        <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <Badge>{pick(p.category_name, p.category_name_ur)}</Badge>
          {p.min_stock > 0 && <Badge tone={p.qty <= p.min_stock ? 'red' : 'stone'}>{t('minStock')}: {fmtNum(p.min_stock)}</Badge>}
          {!p.is_active && <Badge tone="amber">{t('inactive')}</Badge>}
        </Row>
      </Rise>

      <Rise i={2}>
        <SectionTitle>{t('batchesInStock')}</SectionTitle>
        {withStock.length === 0 ? (
          <Card><Empty icon={<Layers size={28} color={c.muted} />}>{t('noBatches')}</Empty></Card>
        ) : (
          <View style={{ gap: 8 }}>
            {withStock.map((b) => {
              const left = daysBetween(today, b.expiry_date)
              return (
                <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }} glow={left < 0 ? 'red' : left <= org.expiry_alert_days ? 'amber' : undefined}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Txt weight="bold">#{b.batch_no}</Txt>
                    <ExpiryBadge date={b.expiry_date} today={today} alertDays={org.expiry_alert_days} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt v="h3">{fmtNum(b.qty, 3)}</Txt>
                    {p.pack_unit !== 'pcs' && <Txt v="tiny" muted>{fmtTotal(b.qty, p.pack_size, p.pack_unit, lang)}</Txt>}
                  </View>
                  {isAdmin && (
                    <PressScale onPress={() => setAdjusting(b)} style={{ padding: 10, borderRadius: 12, backgroundColor: c.surface2 }}>
                      <SlidersHorizontal size={17} color={c.textSoft} />
                    </PressScale>
                  )}
                </Card>
              )
            })}
          </View>
        )}
        {finished.length > 0 && <Txt v="tiny" muted style={{ marginTop: 8 }}>{t('emptyBatches')}: {finished.map((b) => b.batch_no).join(', ')}</Txt>}
      </Rise>

      <Rise i={3}>
        <SectionTitle>{t('history')}</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          {data.moves.length === 0 ? <Empty>{t('noMovements')}</Empty> : data.moves.map((m, i) => (
            <View key={m.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <MovementRow m={m} p={p} showProduct={false} onPress={m.sale_id ? () => router.push(`/receipt/${m.sale_id}`) : undefined} />
            </View>
          ))}
        </Card>
      </Rise>

      {isAdmin && (
        <Row gap={10} style={{ marginTop: 16 }}>
          <Button variant="secondary" title={p.is_active ? t('deactivate') : t('activate')} icon={p.is_active ? <EyeOff size={17} color={c.text} /> : <Eye size={17} color={c.text} />} onPress={toggleActive} style={{ flex: 1 }} />
          {data.moves.length === 0 && <Button variant="secondary" title={t('delete')} color={c.red} icon={<Trash2 size={17} color={c.red} />} onPress={remove} style={{ flex: 1 }} />}
        </Row>
      )}

      <ProductFormSheet open={editing} onClose={() => setEditing(false)} catalog={data.catalog} product={p} onSaved={() => { setEditing(false); toast(t('productSaved')); refresh() }} />
      <AdjustSheet batch={adjusting} unit={t(`pt_${p.pack_type}`)} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); toast(t('saved')); refresh() }} />
    </Screen>
  )
}

function AdjustSheet({ batch, unit, onClose, onSaved }: { batch: BatchStock | null; unit: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const { org } = useOrg()
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [last, setLast] = useState<string | null>(null)
  if ((batch?.id ?? null) !== last) {
    setLast(batch?.id ?? null)
    setCounted(batch ? String(batch.qty) : '')
    setNote('')
    setError('')
  }
  const save = async () => {
    if (!batch) return
    const n = Number(counted)
    if (counted === '' || !(n >= 0)) return setError(t('errQty'))
    setBusy(true)
    const { error } = await supabase.rpc('adjust_batch', { p_org: org.id, p_batch: batch.id, p_counted: n, p_note: note || null })
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved()
  }
  return (
    <Sheet open={!!batch} onClose={onClose} title={t('adjust')} subtitle={batch ? `#${batch.batch_no} · ${fmtNum(batch.qty, 3)} ${unit}` : undefined} footer={<Button title={t('setCount')} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" />}>
      <View style={{ gap: 14 }}>
        <Txt v="small" muted>{t('adjustHint')}</Txt>
        <Field label={`${t('countedQty')} (${unit})`}>
          <NumInput value={counted} onChangeText={setCounted} big />
        </Field>
        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  heroShell: { borderRadius: 28, overflow: 'hidden' },
  hero: { padding: 18, borderRadius: 28, overflow: 'hidden' },
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -80, right: -60, opacity: 0.16 },
  chip: { backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  price: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 12, gap: 2 },
})
