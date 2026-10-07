import { ArrowDownLeft, ArrowUpRight, Droplets, FlaskConical, Package, Plus, Sprout, Wheat } from 'lucide-react-native'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, View } from 'react-native'
import type { Catalog } from '@/lib/catalog'
import { daysBetween, fmtDate, fmtDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { toneColors, useTheme, type Tone } from '@/lib/theme'
import { authorOf, type Movement, type PackType, type PackUnit, type PartyBalance, type PartyKind, type ProductStock } from '@/lib/types'
import { fmtNum, fmtPack, fmtTotal, measureOf } from '@/lib/units'
import { Badge, Chip, haptic, Num, Row, SearchBar, Sheet, Txt } from './ui'

export function usePackLabel() {
  const { t, lang } = useI18n()
  return (p: { pack_size: number; pack_unit: PackUnit; pack_type: PackType }) => `${fmtPack(p.pack_size, p.pack_unit, lang)} ${t(`pt_${p.pack_type}`)}`
}

/** icon + tint per product kind (liquid, dry, seed-ish) */
export function ProductAvatar({ p, size = 44 }: { p: { pack_unit: PackUnit; pack_type: PackType; name: string }; size?: number }) {
  const { c } = useTheme()
  const m = measureOf(p.pack_unit)
  const tone: Tone = m === 'volume' ? 'blue' : p.pack_type === 'bag' ? 'amber' : m === 'weight' ? 'violet' : 'green'
  const Icon = m === 'volume' ? (p.pack_type === 'gallon' || p.pack_type === 'drum' ? Droplets : FlaskConical) : p.pack_type === 'bag' ? Wheat : m === 'weight' ? Package : Sprout
  const tc = toneColors(c, tone)
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: tc.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.46} color={tc.fg} />
    </View>
  )
}

export function ExpiryBadge({ date, today, alertDays }: { date: string | null; today: string; alertDays: number }) {
  const { t, lang } = useI18n()
  if (!date) return null
  const d = daysBetween(today, date)
  if (d < 0) return <Badge tone="red">{t('expired')} · {fmtDate(date, lang)}</Badge>
  if (d === 0) return <Badge tone="red">{t('expiresToday')}</Badge>
  if (d <= alertDays) return <Badge tone="amber">{t('daysLeft', { n: d })}</Badge>
  return <Badge>{fmtDate(date, lang)}</Badge>
}

export function stockTone(p: Pick<ProductStock, 'qty' | 'min_stock'>): Tone {
  if (p.qty <= 0) return 'red'
  if (p.min_stock > 0 && p.qty <= p.min_stock) return 'amber'
  return 'green'
}

/** "24 Bottle · 12 L" */
export function QtyText({ packs, p, size = 15 }: { packs: number; p: { pack_size: number; pack_unit: PackUnit; pack_type: PackType }; size?: number }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Num size={size} color={packs < 0 ? c.blue : c.text}>{fmtNum(packs, 3)} <Txt v="tiny" muted>{t(`pt_${p.pack_type}`)}</Txt></Num>
      {p.pack_unit !== 'pcs' && <Txt v="tiny" muted>{fmtTotal(Math.abs(packs), p.pack_size, p.pack_unit, lang)}</Txt>}
    </View>
  )
}

export function ProductRow({ p, onPress, today, alertDays, right }: { p: ProductStock; onPress?: () => void; today: string; alertDays: number; right?: React.ReactNode }) {
  const { c } = useTheme()
  const { pick, t } = useI18n()
  const label = usePackLabel()
  const tone = toneColors(c, stockTone(p))
  return (
    <Pressable
      onPress={() => {
        haptic.tap()
        onPress?.()
      }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: pressed ? c.surface2 : c.surface,
        borderWidth: 1, borderColor: c.border, opacity: p.is_active ? 1 : 0.55,
      })}
    >
      <ProductAvatar p={p} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt weight="bold" numberOfLines={1}>{pick(p.name, p.name_ur)}</Txt>
        <Txt v="tiny" muted numberOfLines={1}>{label(p)}{p.company_name ? ` · ${p.company_name}` : ''}</Txt>
        <Row gap={6} style={{ marginTop: 2, flexWrap: 'wrap' }}>
          {p.qty > 0 && <ExpiryBadge date={p.next_expiry} today={today} alertDays={alertDays} />}
          {!p.is_active && <Badge>{t('inactive')}</Badge>}
        </Row>
      </View>
      {right ?? (
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ backgroundColor: tone.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
            <Num size={15} color={tone.fg}>{fmtNum(p.qty, 3)}</Num>
          </View>
          {p.sale_price > 0 && <Txt v="tiny" muted>{fmtMoney(p.sale_price)}</Txt>}
        </View>
      )}
    </Pressable>
  )
}

export function MovementBadge({ type }: { type: Movement['type'] }) {
  const { t } = useI18n()
  const tone: Tone = type === 'purchase' || type === 'return_in' ? 'green' : type === 'sale' ? 'blue' : type === 'adjustment' ? 'stone' : type === 'expired' || type === 'damaged' ? 'red' : 'orange'
  return <Badge tone={tone}>{t(`mv_${type}`)}</Badge>
}

export function MovementRow({ m, p, showProduct = true, onPress }: { m: Movement; p?: ProductStock; showProduct?: boolean; onPress?: () => void }) {
  const { c } = useTheme()
  const { pick, lang } = useI18n()
  const label = usePackLabel()
  const inbound = Number(m.qty) > 0
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: inbound ? c.greenSoft : c.blueSoft }}>
        {inbound ? <ArrowDownLeft size={18} color={c.green} /> : <ArrowUpRight size={18} color={c.blue} />}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        {showProduct && p && <Txt weight="semibold" numberOfLines={1}>{pick(p.name, p.name_ur)} <Txt v="tiny" muted>{label(p)}</Txt></Txt>}
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <MovementBadge type={m.type} />
          {m.batches && <Txt v="tiny" muted>#{m.batches.batch_no}</Txt>}
        </Row>
        <Txt v="tiny" muted numberOfLines={1}>
          {fmtDateTime(m.created_at, lang)}{authorOf(m) ? ` · ${authorOf(m)}` : ''}{m.party ? ` · ${m.party}` : ''}
        </Txt>
      </View>
      {p && <QtyText packs={Number(m.qty)} p={p} size={14} />}
    </Pressable>
  )
}

export function BalanceBadge({ kind, balance }: { kind: PartyKind; balance: number }) {
  const { t, lang } = useI18n()
  if (Math.abs(balance) < 0.005) return <Badge>{t('settled')}</Badge>
  if (balance < 0) return <Badge tone="blue">{t('advance')} {fmtMoney(-balance, lang)}</Badge>
  return <Badge tone={kind === 'customer' ? 'amber' : 'red'}>{kind === 'customer' ? t('theyOwe') : t('youOwe')} {fmtMoney(balance, lang)}</Badge>
}

/** Right-aligned balance: big amount + small "owes you" line */
export function BalanceAmount({ kind, balance }: { kind: PartyKind; balance: number }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const settled = Math.abs(balance) < 0.005
  const color = settled ? c.muted : balance < 0 ? c.blue : kind === 'customer' ? c.amber : c.red
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Num size={15} color={color}>{fmtMoney(Math.abs(balance), lang)}</Num>
      <Txt v="tiny" muted>{settled ? t('settled') : balance < 0 ? t('advance') : kind === 'customer' ? t('theyOwe') : t('youOwe')}</Txt>
    </View>
  )
}

/** Initials avatar for customers / suppliers */
export function PartyAvatar({ name, kind, size = 44 }: { name: string; kind: PartyKind; size?: number }) {
  const { c } = useTheme()
  const tc = toneColors(c, kind === 'customer' ? 'green' : 'violet')
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tc.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Txt weight="extrabold" color={tc.fg} style={{ fontSize: size * 0.36 }}>{initials || '?'}</Txt>
    </View>
  )
}

// ------------------------------------------------------------------ product picker
export function ProductPickerSheet({
  open, onClose, catalog, onPick, inStockOnly, priceKind = 'sale', onCreate,
}: {
  open: boolean
  onClose: () => void
  catalog: Catalog
  onPick: (id: string) => void
  inStockOnly?: boolean
  priceKind?: 'sale' | 'purchase'
  onCreate?: () => void
}) {
  const { t, pick } = useI18n()
  const { c } = useTheme()
  const label = usePackLabel()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  // start clean every time: a leftover search would hide products
  useEffect(() => {
    if (open) {
      setQ('')
      setCat('all')
    }
  }, [open])
  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.products
      .filter((p) => p.is_active)
      .filter((p) => !inStockOnly || p.qty > 0)
      .filter((p) => cat === 'all' || p.category_id === cat)
      .filter((p) => terms.every((x) => `${p.name} ${p.name_ur ?? ''} ${p.company_name ?? ''} ${fmtPack(p.pack_size, p.pack_unit)}`.toLowerCase().includes(x)))
  }, [catalog, q, cat, inStockOnly])
  const cats = catalog.categories.filter((cg) => catalog.products.some((p) => p.category_id === cg.id && (!inStockOnly || p.qty > 0)))

  return (
    <Sheet open={open} onClose={onClose} title={t('pickProductTitle')} scroll={false} full>
      <SearchBar value={q} onChangeText={setQ} />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 'all', name: t('all'), name_ur: null }, ...cats]}
        keyExtractor={(x) => x.id}
        style={{ flexGrow: 0, marginVertical: 10 }}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => <Chip label={pick(item.name, item.name_ur)} active={cat === item.id} onPress={() => setCat(item.id)} />}
      />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
        initialNumToRender={14}
        ListHeaderComponent={onCreate ? (
          <Pressable onPress={() => { onClose(); onCreate() }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.primary, marginBottom: 2 }}>
            <Plus size={18} color={c.primary} />
            <Txt weight="bold" color={c.primary}>{t('newProduct')}</Txt>
          </Pressable>
        ) : null}
        ListEmptyComponent={<Txt muted align="center" style={{ padding: 30 }}>{q || cat !== 'all' ? t('noData') : t('noProducts')}</Txt>}
        renderItem={({ item: p }) => {
          const tone = toneColors(c, stockTone(p))
          const price = priceKind === 'sale' ? p.sale_price : p.purchase_price
          return (
            <Pressable
              onPress={() => {
                haptic.tap()
                onPick(p.id)
                onClose()
                setQ('')
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: c.border })}
            >
              <ProductAvatar p={p} size={40} />
              <View style={{ flex: 1 }}>
                <Txt weight="bold" numberOfLines={1}>{pick(p.name, p.name_ur)}</Txt>
                <Txt v="tiny" muted numberOfLines={1}>{label(p)}{p.company_name ? ` · ${p.company_name}` : ''}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Num size={14} color={tone.fg}>{fmtNum(p.qty, 3)}</Num>
                {price > 0 && <Txt v="tiny" muted>{fmtMoney(price)}</Txt>}
              </View>
            </Pressable>
          )
        }}
      />
    </Sheet>
  )
}

// ------------------------------------------------------------------ party picker
export function PartyPickerSheet({
  open, onClose, kind, parties, value, onPick, noneLabel, onNew,
}: {
  open: boolean
  onClose: () => void
  kind: PartyKind
  parties: PartyBalance[]
  value: string
  onPick: (id: string) => void
  noneLabel: string
  onNew: () => void
}) {
  const { t } = useI18n()
  const { c } = useTheme()
  const [q, setQ] = useState('')
  useEffect(() => {
    if (open) setQ('')
  }, [open])
  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return parties.filter((p) => p.is_active || p.id === value).filter((p) => terms.every((x) => `${p.name} ${p.phone ?? ''}`.toLowerCase().includes(x)))
  }, [parties, q, value])
  const choose = (id: string) => {
    haptic.tap()
    onPick(id)
    onClose()
    setQ('')
  }
  return (
    <Sheet open={open} onClose={onClose} title={kind === 'customer' ? t('chooseCustomer') : t('chooseSupplier')} scroll={false} full>
      <SearchBar value={q} onChangeText={setQ} />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, marginTop: 10 }}
        contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 8, marginBottom: 8 }}>
            <Pressable onPress={() => { onClose(); onNew() }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.primary }}>
              <Plus size={18} color={c.primary} />
              <Txt weight="bold" color={c.primary}>{kind === 'customer' ? t('newCustomer') : t('newSupplier')}</Txt>
            </Pressable>
            <Pressable onPress={() => choose('')} style={{ padding: 14, borderRadius: 18, backgroundColor: value === '' ? c.primarySoft : c.surface, borderWidth: 1, borderColor: c.border }}>
              <Txt weight="bold">{noneLabel}</Txt>
            </Pressable>
          </View>
        }
        renderItem={({ item: p }) => (
          <Pressable
            onPress={() => choose(p.id)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: p.id === value ? c.primarySoft : pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: c.border })}
          >
            <PartyAvatar name={p.name} kind={p.kind} size={40} />
            <View style={{ flex: 1 }}>
              <Txt weight="bold" numberOfLines={1}>{p.name}</Txt>
              {!!p.phone && <Txt v="tiny" muted>{p.phone}</Txt>}
            </View>
            <BalanceAmount kind={p.kind} balance={p.balance} />
          </Pressable>
        )}
      />
    </Sheet>
  )
}
