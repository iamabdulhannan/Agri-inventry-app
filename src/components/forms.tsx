import { Check, Phone, Plus, User, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useOrg } from '@/lib/app'
import type { Catalog } from '@/lib/catalog'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { PackType, PackUnit, Party, PartyKind, Product } from '@/lib/types'
import { LIQUID_PRESETS, PACK_TYPES, SOLID_PRESETS, fmtPack, measureOf, suggestPackType, type Preset } from '@/lib/units'
import { Button, Chip, ErrorBox, Field, Input, NumInput, PressScale, Row, Segmented, Select, Sheet, Txt } from './ui'

// ------------------------------------------------------------------ customer / supplier
export function PartyFormSheet({ open, onClose, kind, party, onSaved }: { open: boolean; onClose: () => void; kind: PartyKind; party?: Party | null; onSaved: (id: string) => void }) {
  const { t } = useI18n()
  const { c } = useTheme()
  const { org } = useOrg()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [opening, setOpening] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setName(party?.name ?? '')
    setPhone(party?.phone ?? '')
    setAddress(party?.address ?? '')
    setOpening(party && Number(party.opening_balance) ? String(Number(party.opening_balance)) : '')
    setNotes(party?.notes ?? '')
  }, [open, party])

  const save = async () => {
    setError('')
    if (!name.trim()) return setError(`${t('name')} *`)
    const row = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null, opening_balance: Number(opening) || 0, notes: notes.trim() || null }
    setBusy(true)
    const res = party
      ? await supabase.from('parties').update(row).eq('id', party.id).select('id').single()
      : await supabase.from('parties').insert({ ...row, org_id: org.id, kind }).select('id').single()
    setBusy(false)
    if (res.error) return setError(errText(res.error, t))
    onSaved(res.data.id)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={party ? t('editParty') : kind === 'customer' ? t('addCustomer') : t('addSupplier')}
      footer={<Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" icon={<Check size={18} color={c.primaryText} />} />}
    >
      <View style={{ gap: 14 }}>
        <Field label={t('name')}>
          <Input value={name} onChangeText={setName} placeholder={kind === 'customer' ? 'Muhammad Aslam' : 'Ali Akbar Group'} icon={<User size={18} color={c.muted} />} />
        </Field>
        <Field label={t('phone')} optional>
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0300-1234567" icon={<Phone size={18} color={c.muted} />} />
        </Field>
        <Field label={t('address')} optional>
          <Input value={address} onChangeText={setAddress} />
        </Field>
        <Field label={t('openingBalance')} hint={kind === 'customer' ? t('openingHintCustomer') : t('openingHintSupplier')}>
          <NumInput value={opening} onChangeText={setOpening} placeholder="0" keyboardType="numbers-and-punctuation" />
        </Field>
        <Field label={t('note')} optional>
          <Input value={notes} onChangeText={setNotes} />
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </View>
    </Sheet>
  )
}

// ------------------------------------------------------------------ product (several pack sizes at once)
interface SizeRow extends Preset { type: PackType; purchase: string; mrp: string }
const key = (s: Preset) => `${s.size}|${s.unit}`

export function ProductFormSheet({ open, onClose, catalog, product, onSaved }: { open: boolean; onClose: () => void; catalog: Catalog; product?: Product | null; onSaved: (ids: string[]) => void }) {
  const { t, pick, lang } = useI18n()
  const { c } = useTheme()
  const { org } = useOrg()
  const editing = !!product
  const [name, setName] = useState('')
  const [nameUr, setNameUr] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [newCompany, setNewCompany] = useState<string | null>(null)
  const [kind, setKind] = useState<'liquid' | 'dry' | 'pcs'>('liquid')
  const [sizes, setSizes] = useState<SizeRow[]>([])
  const [customSize, setCustomSize] = useState('')
  const [minStock, setMinStock] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setNewCompany(null)
    setCustomSize('')
    if (product) {
      setName(product.name)
      setNameUr(product.name_ur ?? '')
      setCategoryId(product.category_id)
      setCompanyId(product.company_id ?? '')
      const m = measureOf(product.pack_unit)
      setKind(m === 'volume' ? 'liquid' : m === 'weight' ? 'dry' : 'pcs')
      setSizes([{ size: Number(product.pack_size), unit: product.pack_unit, type: product.pack_type, purchase: product.purchase_price ? String(Number(product.purchase_price)) : '', mrp: product.sale_price ? String(Number(product.sale_price)) : '' }])
      setMinStock(product.min_stock ? String(product.min_stock) : '')
    } else {
      setName('')
      setNameUr('')
      setCategoryId(catalog.categories[0]?.id ?? '')
      setCompanyId('')
      setKind('liquid')
      setSizes([])
      setMinStock('')
    }
  }, [open, product, catalog.categories])

  const customUnit: PackUnit = kind === 'liquid' ? 'ml' : kind === 'dry' ? 'kg' : 'pcs'
  const presets = kind === 'liquid' ? LIQUID_PRESETS : kind === 'dry' ? SOLID_PRESETS : []
  const has = (p: Preset) => sizes.some((s) => key(s) === key(p))
  const toggle = (p: Preset) => {
    const row: SizeRow = { ...p, type: suggestPackType(p.size, p.unit), purchase: '', mrp: '' }
    if (editing) return setSizes([row])
    setSizes((list) => (has(p) ? list.filter((s) => key(s) !== key(p)) : [...list, row]))
  }
  const addCustom = () => {
    const n = Number(customSize)
    if (!(n > 0)) return
    const p = { size: n, unit: customUnit }
    if (!has(p)) toggle(p)
    setCustomSize('')
  }
  const patch = (k: string, v: Partial<SizeRow>) => setSizes((l) => l.map((s) => (key(s) === k ? { ...s, ...v } : s)))

  const save = async () => {
    setError('')
    if (!name.trim()) return setError(`${t('productName')} *`)
    if (!categoryId) return setError(t('selectCategory'))
    if (sizes.length === 0) return setError(`${t('selectSizes')} *`)
    setBusy(true)
    try {
      let company: string | null = companyId || null
      if (newCompany !== null && newCompany.trim()) {
        const nm = newCompany.trim()
        const existing = catalog.companies.find((x) => x.name.toLowerCase() === nm.toLowerCase())
        if (existing) company = existing.id
        else {
          const { data, error } = await supabase.from('companies').insert({ org_id: org.id, name: nm }).select('id').single()
          if (error) throw error
          company = data.id
        }
      }
      const base = { name: name.trim(), name_ur: nameUr.trim() || null, category_id: categoryId, company_id: company, min_stock: Math.max(0, Number(minStock) || 0) }
      if (editing && product) {
        const s = sizes[0]
        const { error } = await supabase
          .from('products')
          .update({ ...base, pack_size: s.size, pack_unit: s.unit, pack_type: s.type, purchase_price: Number(s.purchase) || 0, sale_price: Number(s.mrp) || 0 })
          .eq('id', product.id)
        if (error) throw error
        onSaved([product.id])
      } else {
        const rows = sizes.map((s) => ({ ...base, org_id: org.id, pack_size: s.size, pack_unit: s.unit, pack_type: s.type, purchase_price: Number(s.purchase) || 0, sale_price: Number(s.mrp) || 0 }))
        const { data, error } = await supabase.from('products').insert(rows).select('id')
        if (error) throw error
        onSaved((data ?? []).map((r) => r.id))
      }
    } catch (e) {
      setError(errText(e, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? t('editProduct') : t('addProduct')}
      full
      footer={<Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" icon={<Check size={18} color={c.primaryText} />} />}
    >
      <View style={{ gap: 14 }}>
        <Field label={t('productName')}>
          <Input value={name} onChangeText={setName} placeholder="Confidor 200 SL" />
        </Field>
        <Field label={t('urduName')} optional>
          <Input value={nameUr} onChangeText={setNameUr} placeholder="کونفیڈور" style={{}} textAlign="right" />
        </Field>
        <Field label={t('category')}>
          <Select title={t('category')} value={categoryId} onChange={setCategoryId} placeholder={t('selectCategory')} options={catalog.categories.map((x) => ({ value: x.id, label: pick(x.name, x.name_ur) }))} />
        </Field>
        <Field label={t('company')} optional>
          {newCompany === null ? (
            <Select
              title={t('company')}
              value={companyId}
              onChange={(v) => (v === '__new' ? setNewCompany('') : setCompanyId(v))}
              placeholder={t('selectCompany')}
              options={[{ value: '', label: '—' }, ...catalog.companies.map((x) => ({ value: x.id, label: x.name })), { value: '__new', label: `+ ${t('newCompany')}` }]}
            />
          ) : (
            <Row gap={8}>
              <Input value={newCompany} onChangeText={setNewCompany} placeholder={t('newCompany')} style={{ flex: 1 }} autoFocus />
              <Pressable onPress={() => setNewCompany(null)} style={{ padding: 10 }}><X size={20} color={c.muted} /></Pressable>
            </Row>
          )}
        </Field>

        {!editing && (
          <Segmented
            value={kind}
            onChange={(k) => { setKind(k); setSizes([]) }}
            items={[{ value: 'liquid', label: t('liquid') }, { value: 'dry', label: t('dry') }, { value: 'pcs', label: t('pt_piece') }]}
          />
        )}
        <Field label={t('packSize')} hint={!editing ? t('multiSizeHint') : undefined}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {presets.map((p) => <Chip key={key(p)} label={fmtPack(p.size, p.unit, lang)} active={has(p)} onPress={() => toggle(p)} />)}
          </View>
          <Row gap={8} style={{ marginTop: 6 }}>
            <NumInput value={customSize} onChangeText={setCustomSize} placeholder={t('customSize')} style={{ flex: 1 }} suffix={<Txt muted weight="bold">{customUnit}</Txt>} />
            <Button variant="secondary" icon={<Plus size={18} color={c.text} />} title={t('addSize')} onPress={addCustom} />
          </Row>
        </Field>

        {sizes.map((s) => (
          <View key={key(s)} style={{ backgroundColor: c.surface, borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border }}>
            <Row between>
              <Txt weight="extrabold">{fmtPack(s.size, s.unit, lang)}</Txt>
              {!editing && (
                <PressScale onPress={() => toggle(s)}><X size={18} color={c.muted} /></PressScale>
              )}
            </Row>
            <Select title={t('packType')} value={s.type} onChange={(v) => patch(key(s), { type: v as PackType })} options={PACK_TYPES.map((pt) => ({ value: pt, label: t(`pt_${pt}`) }))} />
            <Row gap={10}>
              <Field label={t('purchasePrice')} style={{ flex: 1 }}>
                <NumInput value={s.purchase} onChangeText={(v) => patch(key(s), { purchase: v })} placeholder="0" />
              </Field>
              <Field label={t('mrp')} style={{ flex: 1 }}>
                <NumInput value={s.mrp} onChangeText={(v) => patch(key(s), { mrp: v })} placeholder="0" />
              </Field>
            </Row>
          </View>
        ))}

        <Field label={t('minStock')} hint={t('minStockHint')}>
          <NumInput value={minStock} onChangeText={setMinStock} placeholder="0" />
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </View>
    </Sheet>
  )
}
