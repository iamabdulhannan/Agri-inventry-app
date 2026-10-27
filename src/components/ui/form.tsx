import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Minus, Plus, Search } from 'lucide-react-native'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FlatList, Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { addDays, fmtDate, fmtMonth, isoOf } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fonts, radius, useTheme } from '@/lib/theme'
import { MAX_FONT_SCALE } from '@/lib/responsive'
import { haptic, PressScale, Row, Txt } from './core'
import { Sheet } from './sheet'

// ------------------------------------------------------------------ field wrapper
export function Field({ label, hint, error, children, optional, style }: { label?: string; hint?: ReactNode; error?: string | false | null; children: ReactNode; optional?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const { t } = useI18n()
  return (
    <View style={[{ gap: 7 }, style]}>
      {!!label && (
        <Row gap={6}>
          <Txt v="small" weight="bold" soft>{label}</Txt>
          {optional && <Txt v="tiny" muted>({t('optional')})</Txt>}
        </Row>
      )}
      {children}
      {error ? <Txt v="tiny" color={c.red}>{error}</Txt> : hint ? (typeof hint === 'string' ? <Txt v="tiny" muted>{hint}</Txt> : hint) : null}
    </View>
  )
}

// ------------------------------------------------------------------ text input
export function Input({
  icon, suffix, style, invalid, big, ...rest
}: Omit<TextInputProps, 'style'> & { style?: StyleProp<ViewStyle>; icon?: ReactNode; suffix?: ReactNode; invalid?: boolean; big?: boolean }) {
  const { c } = useTheme()
  const [focus, setFocus] = useState(false)
  return (
    // collapsable={false}: Android (new architecture) must never re-parent the native text field,
    // or it loses focus and the keyboard closes right after opening
    <View
      collapsable={false}
      style={[
        {
          flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1.5,
          borderColor: invalid ? c.red : focus ? c.primary : c.border, paddingHorizontal: 14, height: big ? 60 : 50,
        },
        style,
      ]}
    >
      {icon}
      <TextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        placeholderTextColor={c.faint}
        selectionColor={c.primary}
        {...rest}
        onFocus={(e) => {
          setFocus(true)
          rest.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocus(false)
          rest.onBlur?.(e)
        }}
        style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: fonts.semibold, fontSize: big ? 22 : 15.5, height: '100%', paddingVertical: 0 }}
      />
      {suffix}
    </View>
  )
}

export function NumInput(props: Omit<TextInputProps, 'style'> & { style?: StyleProp<ViewStyle>; icon?: ReactNode; suffix?: ReactNode; invalid?: boolean; big?: boolean }) {
  return <Input keyboardType="decimal-pad" inputMode="decimal" {...props} />
}

export function PasswordInput(props: Omit<TextInputProps, 'style'> & { style?: StyleProp<ViewStyle>; icon?: ReactNode }) {
  const { c } = useTheme()
  const [show, setShow] = useState(false)
  return (
    <Input
      {...props}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      suffix={
        <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
          {show ? <EyeOff size={20} color={c.muted} /> : <Eye size={20} color={c.muted} />}
        </Pressable>
      }
    />
  )
}

export function SearchBar({ value, onChangeText, placeholder, style }: { value: string; onChangeText: (s: string) => void; placeholder?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const { t } = useI18n()
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? t('search')}
      icon={<Search size={19} color={c.muted} />}
      autoCorrect={false}
      returnKeyType="search"
      clearButtonMode="while-editing"
      style={style}
    />
  )
}

// ------------------------------------------------------------------ pressable "select" look
export function SelectButton({ label, placeholder, onPress, icon, style, sub, chevron = true }: { label?: string | null; placeholder?: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; sub?: string; chevron?: boolean }) {
  const { c } = useTheme()
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.98}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, paddingHorizontal: 14, minHeight: 50, paddingVertical: 8 }, style]}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Txt weight="semibold" color={label ? c.text : c.faint} numberOfLines={1}>{label || placeholder}</Txt>
        {!!sub && <Txt v="tiny" muted numberOfLines={1}>{sub}</Txt>}
      </View>
      {chevron && <ChevronDown size={18} color={c.muted} />}
    </PressScale>
  )
}

// ------------------------------------------------------------------ searchable picker sheet
export interface Option { value: string; label: string; sub?: string; right?: ReactNode; icon?: ReactNode }

export function PickerSheet({
  open, onClose, title, options, value, onPick, searchable = true, footer, emptyText,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: Option[]
  value?: string
  onPick: (v: string) => void
  searchable?: boolean
  footer?: ReactNode
  emptyText?: string
}) {
  const { c } = useTheme()
  const { t } = useI18n()
  const [q, setQ] = useState('')
  useEffect(() => {
    if (open) setQ('')
  }, [open])
  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return terms.length ? options.filter((o) => terms.every((x) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(x))) : options
  }, [q, options])
  return (
    <Sheet open={open} onClose={onClose} title={title} scroll={false} full={options.length > 8}>
      {searchable && options.length > 6 && <SearchBar value={q} onChangeText={setQ} style={{ marginBottom: 10 }} />}
      <FlatList
        data={list}
        keyExtractor={(o) => o.value}
        keyboardShouldPersistTaps="handled"
        style={options.length > 8 ? { flexGrow: 1 } : { maxHeight: 460 }}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={<Txt muted align="center" style={{ padding: 24 }}>{emptyText ?? t('noData')}</Txt>}
        ListFooterComponent={footer ? <View style={{ marginTop: 8 }}>{footer}</View> : null}
        renderItem={({ item }) => {
          const active = item.value === value
          return (
            <Pressable
              onPress={() => {
                haptic.tap()
                onPick(item.value)
                onClose()
                setQ('')
              }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 14,
                backgroundColor: active ? c.primarySoft : pressed ? c.surface2 : 'transparent',
              })}
            >
              {item.icon}
              <View style={{ flex: 1 }}>
                <Txt weight="semibold" numberOfLines={1}>{item.label}</Txt>
                {!!item.sub && <Txt v="tiny" muted numberOfLines={1}>{item.sub}</Txt>}
              </View>
              {item.right}
              {active && <Check size={18} color={c.primary} />}
            </Pressable>
          )
        }}
      />
    </Sheet>
  )
}

export function Select({ value, options, onChange, title, placeholder, icon }: { value: string; options: Option[]; onChange: (v: string) => void; title: string; placeholder?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const cur = options.find((o) => o.value === value)
  return (
    <>
      <SelectButton label={cur?.label} sub={cur?.sub} placeholder={placeholder} onPress={() => setOpen(true)} icon={icon ?? cur?.icon} />
      <PickerSheet open={open} onClose={() => setOpen(false)} title={title} options={options} value={value} onPick={onChange} />
    </>
  )
}

// ------------------------------------------------------------------ quantity stepper
export function Stepper({ value, onChange, step = 1, min = 0, invalid }: { value: string; onChange: (v: string) => void; step?: number; min?: number; invalid?: boolean }) {
  const { c } = useTheme()
  const n = Number(value) || 0
  const bump = (d: number) => {
    haptic.light()
    const next = Math.max(min, Math.round((n + d) * 1000) / 1000)
    onChange(next ? String(next) : '')
  }
  const btn = (icon: ReactNode, d: number) => (
    <PressScale onPress={() => bump(d)} hapticOnPress={false} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </PressScale>
  )
  return (
    <View collapsable={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1.5, borderColor: invalid ? c.red : c.border, padding: 3 }}>
      {btn(<Minus size={18} color={c.text} />, -step)}
      <TextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={c.faint}
        selectionColor={c.primary}
        style={{ flex: 1, minWidth: 0, width: '100%', textAlign: 'center', color: c.text, fontFamily: fonts.extrabold, fontSize: 20, paddingVertical: 0, height: 44 }}
      />
      {btn(<Plus size={18} color={c.text} />, step)}
    </View>
  )
}

// ------------------------------------------------------------------ date field + calendar
export function DateField({ value, onChange, max, min, label, placeholder }: { value: string; onChange: (d: string) => void; max?: string; min?: string; label?: string; placeholder?: string }) {
  const { c } = useTheme()
  const { lang } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <SelectButton label={value ? fmtDate(value, lang) : null} placeholder={placeholder ?? 'DD MMM YYYY'} onPress={() => setOpen(true)} icon={<CalendarDays size={18} color={c.primary} />} chevron={false} />
      <CalendarSheet open={open} onClose={() => setOpen(false)} value={value} onPick={onChange} max={max} min={min} title={label} />
    </>
  )
}

const WEEK_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const WEEK_UR = ['پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ', 'اتوار']

export function CalendarSheet({ open, onClose, value, onPick, max, min, title }: { open: boolean; onClose: () => void; value: string; onPick: (d: string) => void; max?: string; min?: string; title?: string }) {
  const { c } = useTheme()
  const { t, lang } = useI18n()
  const base = value || max || new Date().toISOString().slice(0, 10)
  const [ym, setYm] = useState(base.slice(0, 7))
  const [mode, setMode] = useState<'days' | 'years'>('days')
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay() // 0 = Sunday
  const offset = (first + 6) % 7
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const shift = (d: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + d, 1))
    setYm(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const thisYear = new Date().getUTCFullYear()
  const years = Array.from({ length: 21 }, (_, i) => thisYear - 8 + i)
  const pick = (iso: string) => {
    haptic.tap()
    onPick(iso)
    onClose()
  }
  const quick: { label: string; iso: string }[] = max
    ? [{ label: t('today'), iso: max }, { label: '-1', iso: addDays(max, -1) }]
    : [
        { label: '+6m', iso: addDays(new Date().toISOString().slice(0, 10), 182) },
        { label: '+1y', iso: addDays(new Date().toISOString().slice(0, 10), 365) },
        { label: '+2y', iso: addDays(new Date().toISOString().slice(0, 10), 730) },
        { label: '+3y', iso: addDays(new Date().toISOString().slice(0, 10), 1095) },
      ]

  return (
    <Sheet open={open} onClose={onClose} title={title ?? t('date')}>
      <Row between style={{ marginBottom: 12 }}>
        <PressScale onPress={() => shift(-1)} style={{ padding: 10, borderRadius: 12, backgroundColor: c.surface2 }}><ChevronLeft size={20} color={c.text} /></PressScale>
        <Pressable onPress={() => setMode(mode === 'days' ? 'years' : 'days')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt v="h3">{fmtMonth(ym, lang)}</Txt>
          <ChevronDown size={16} color={c.muted} />
        </Pressable>
        <PressScale onPress={() => shift(1)} style={{ padding: 10, borderRadius: 12, backgroundColor: c.surface2 }}><ChevronRight size={20} color={c.text} /></PressScale>
      </Row>
      {mode === 'years' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {years.map((yr) => (
            <PressScale
              key={yr}
              onPress={() => {
                setYm(`${yr}-${String(m).padStart(2, '0')}`)
                setMode('days')
              }}
              style={{ width: '23%', paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: yr === y ? c.primary : c.surface2 }}
            >
              <Txt weight="bold" color={yr === y ? c.primaryText : c.text}>{yr}</Txt>
            </PressScale>
          ))}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row' }}>
            {(lang === 'ur' ? WEEK_UR : WEEK_EN).map((d) => (
              <Txt key={d} v="tiny" muted align="center" style={{ flex: 1, marginBottom: 6 }}>{d}</Txt>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 46 }} />
              const iso = isoOf(y, m, d)
              const disabled = (max && iso > max) || (min && iso < min)
              const sel = iso === value
              const isToday = iso === new Date().toISOString().slice(0, 10)
              return (
                <View key={i} style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable
                    disabled={!!disabled}
                    onPress={() => pick(iso)}
                    style={{
                      width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: sel ? c.primary : 'transparent', borderWidth: isToday && !sel ? 1.5 : 0, borderColor: c.primary,
                    }}
                  >
                    <Txt weight="bold" color={sel ? c.primaryText : disabled ? c.faint : c.text}>{d}</Txt>
                  </Pressable>
                </View>
              )
            })}
          </View>
        </>
      )}
      <Row gap={8} style={{ marginTop: 14, flexWrap: 'wrap' }}>
        {quick.map((q) => (
          <PressScale key={q.label} onPress={() => pick(q.iso)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: c.primarySoft }}>
            <Txt v="small" weight="bold" color={c.primary}>{q.label}</Txt>
          </PressScale>
        ))}
      </Row>
    </Sheet>
  )
}
