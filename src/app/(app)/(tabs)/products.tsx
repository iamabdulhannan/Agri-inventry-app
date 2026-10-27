import { router, useLocalSearchParams } from 'expo-router'
import { ArrowDownUp, PackageSearch, Plus } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, View } from 'react-native'
import { ProductRow } from '@/components/domain'
import { ProductFormSheet } from '@/components/forms'
import { Ambient, Chip, Empty, ErrorBox, IconBtn, Loading, PickerSheet, Row, SearchBar, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLayout } from '@/lib/responsive'
import { useCatalog } from '@/lib/catalog'
import { daysBetween } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { useTheme } from '@/lib/theme'
import type { ProductStock } from '@/lib/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type StockFilter = 'all' | 'in' | 'low' | 'out' | 'expiring'
type SortKey = 'name' | 'stockHigh' | 'stockLow' | 'expiry' | 'value'

export default function Products() {
  const { t, pick, lang } = useI18n()
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { width, contentWidth } = useLayout()
  const side = (width - contentWidth) / 2
  const { today, org, refresh } = useOrg()
  const { toast } = useFeedback()
  const params = useLocalSearchParams<{ filter?: string }>()
  const { data: cat, error, loading, reload } = useCatalog()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [stock, setStock] = useState<StockFilter>((['in', 'low', 'out', 'expiring'] as string[]).includes(params.filter ?? '') ? (params.filter as StockFilter) : 'all')
  const [sort, setSort] = useState<SortKey>('name')
  const [sortOpen, setSortOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const alertDays = org.expiry_alert_days ?? 60

  const is = (p: ProductStock, f: StockFilter) =>
    f === 'all' ? true
    : f === 'in' ? p.qty > 0
    : f === 'out' ? p.qty <= 0
    : f === 'low' ? p.min_stock > 0 && p.qty <= p.min_stock
    : p.qty > 0 && !!p.next_expiry && daysBetween(today, p.next_expiry) <= alertDays

  const list = useMemo(() => {
    if (!cat) return []
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    const rows = cat.products
      .filter((p) => p.is_active || stock === 'all')
      .filter((p) => category === 'all' || p.category_id === category)
      .filter((p) => is(p, stock))
      .filter((p) => terms.every((x) => `${p.name} ${p.name_ur ?? ''} ${p.company_name ?? ''} ${p.category_name}`.toLowerCase().includes(x)))
    const s = [...rows]
    if (sort === 'stockHigh') s.sort((a, b) => b.qty - a.qty)
    if (sort === 'stockLow') s.sort((a, b) => a.qty - b.qty)
    if (sort === 'expiry') s.sort((a, b) => (a.next_expiry ?? '9999').localeCompare(b.next_expiry ?? '9999'))
    if (sort === 'value') s.sort((a, b) => b.stock_value - a.stock_value)
    return s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q, category, stock, sort, today])

  const count = (f: StockFilter) => (cat ? cat.products.filter((p) => p.is_active && is(p, f)).length : 0)
  const value = list.reduce((s, p) => s + Math.max(0, p.stock_value), 0)

  const filters: { v: StockFilter; label: string }[] = [
    { v: 'all', label: t('all') },
    { v: 'in', label: t('inStock') },
    { v: 'low', label: t('lowStock') },
    { v: 'expiring', label: t('expiringSoon') },
    { v: 'out', label: t('outOfStock') },
  ]
  const sorts: SortKey[] = ['name', 'stockHigh', 'stockLow', 'expiry', 'value']
  const sortLabel = (s: SortKey) => t(`sort${s[0].toUpperCase()}${s.slice(1)}` as 'sortName')

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: side }}>
        <Row between>
          <View>
            <Txt v="h1">{t('navProducts')}</Txt>
            {cat && <Txt v="small" muted>{t('results', { n: list.length })} · {fmtMoney(value, lang)}</Txt>}
          </View>
          <Row gap={8}>
            <IconBtn icon={<ArrowDownUp size={18} color={c.text} />} onPress={() => setSortOpen(true)} label={t('sortBy')} />
            <IconBtn icon={<Plus size={20} color={c.primaryText} />} onPress={() => setAdding(true)} style={{ backgroundColor: c.primary, borderWidth: 0 }} label={t('addProduct')} />
          </Row>
        </Row>
        <SearchBar value={q} onChangeText={setQ} style={{ marginTop: 14 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -side, marginTop: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: side }}>
          {filters.map((f) => <Chip key={f.v} label={f.label} active={stock === f.v} onPress={() => setStock(f.v)} count={f.v === 'all' ? undefined : count(f.v)} />)}
        </ScrollView>
        {cat && cat.categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -side, marginTop: 8, flexGrow: 0 }} contentContainerStyle={{ gap: 14, paddingHorizontal: side + 2, paddingVertical: 6 }}>
            {[{ id: 'all', name: t('all'), name_ur: null }, ...cat.categories].map((x) => (
              <Txt key={x.id} v="small" weight="bold" color={category === x.id ? c.primary : c.muted} onPress={() => setCategory(x.id)} style={category === x.id ? { textDecorationLine: 'underline' } : undefined}>
                {pick(x.name, x.name_ur)}
              </Txt>
            ))}
          </ScrollView>
        )}
      </View>

      {loading && !cat ? (
        <View style={{ paddingHorizontal: side }}><Loading rows={6} /></View>
      ) : error && !cat ? (
        <View style={{ paddingHorizontal: side, paddingVertical: 20 }}><ErrorBox error={error} onRetry={reload} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: side, paddingTop: 10, paddingBottom: 140, gap: 8 }}
          initialNumToRender={12}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={<Empty icon={<PackageSearch size={30} color={c.muted} />}>{t('noProducts')}</Empty>}
          renderItem={({ item }) => <ProductRow p={item} today={today} alertDays={alertDays} onPress={() => router.push(`/product/${item.id}`)} />}
        />
      )}

      <PickerSheet open={sortOpen} onClose={() => setSortOpen(false)} title={t('sortBy')} value={sort} onPick={(v) => setSort(v as SortKey)} searchable={false} options={sorts.map((s) => ({ value: s, label: sortLabel(s) }))} />
      {cat && (
        <ProductFormSheet
          open={adding}
          onClose={() => setAdding(false)}
          catalog={cat}
          onSaved={(ids) => {
            setAdding(false)
            toast(ids.length > 1 ? t('productsSaved', { n: ids.length }) : t('productSaved'))
            refresh()
          }}
        />
      )}
    </View>
  )
}
