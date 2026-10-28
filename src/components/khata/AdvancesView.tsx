import { router, type Href } from 'expo-router'
import { ChevronRight, Plus, Sprout } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { PartyAvatar } from '@/components/domain'
import { Badge, Button, Chip, Empty, ErrorBox, HScroll, Loading, PressScale, Row, Segmented, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useI18n } from '@/lib/i18n'
import { cropLabel, type CropAdvance } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { useLayout } from '@/lib/responsive'
import { radius, useTheme } from '@/lib/theme'
import type { PartyBalance } from '@/lib/types'
import { NewAdvanceSheet } from './AdvanceSheets'

type Status = 'open' | 'closed' | 'all'

/** party screen, scrolled to its crop advances */
export const partyAdvancesHref = (partyId: string) => ({ pathname: '/party/[id]', params: { id: partyId, focus: 'advances' } }) as Href

/** All crop advances of the shop, with totals per crop */
export function AdvancesView({
  advances, error, loading, reload, q, customers,
}: {
  advances: CropAdvance[] | null
  error: unknown
  loading: boolean
  reload: () => void
  q: string
  customers: PartyBalance[]
}) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { refresh } = useOrg()
  const { toast } = useFeedback()
  const { width, contentWidth, cols } = useLayout()
  const side = (width - contentWidth) / 2
  const [status, setStatus] = useState<Status>('open')
  const [crop, setCrop] = useState('')
  const [adding, setAdding] = useState(false)

  const crops = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of advances ?? []) m.set(a.crop.trim().toLowerCase(), a.crop.trim())
    return [...m.values()].sort((a, b) => a.localeCompare(b))
  }, [advances])

  const list = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    return (advances ?? [])
      .filter((a) => (status === 'all' ? true : status === 'open' ? !a.is_closed : a.is_closed))
      .filter((a) => !crop || a.crop.trim().toLowerCase() === crop.toLowerCase())
      .filter((a) => terms.every((x) => `${a.party_name} ${a.party_phone ?? ''} ${a.crop} ${cropLabel(a.crop, t)} ${a.season ?? ''}`.toLowerCase().includes(x)))
      .sort((a, b) => b.balance - a.balance || a.party_name.localeCompare(b.party_name))
  }, [advances, status, crop, q, t])

  const perCrop = useMemo(() => {
    const m = new Map<string, { crop: string; n: number; deposited: number; used: number; left: number }>()
    for (const a of list) {
      const k = a.crop.trim().toLowerCase()
      const r = m.get(k) ?? { crop: a.crop.trim(), n: 0, deposited: 0, used: 0, left: 0 }
      r.n += 1
      r.deposited += a.deposited
      r.used += a.used
      r.left += a.balance
      m.set(k, r)
    }
    return [...m.values()].sort((a, b) => b.left - a.left)
  }, [list])
  const total = list.reduce((s, a) => ({ deposited: s.deposited + a.deposited, used: s.used + a.used, left: s.left + a.balance }), { deposited: 0, used: 0, left: 0 })
  const tileW = Math.floor((contentWidth - 10 * (cols - 1)) / cols)

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <Row gap={10}>
        <Segmented
          value={status}
          onChange={setStatus}
          style={{ flex: 1 }}
          items={[
            { value: 'open', label: t('khOpenBadge') },
            { value: 'closed', label: t('khClosedBadge') },
            { value: 'all', label: t('all') },
          ]}
        />
      </Row>
      <Button title={t('khNewAdvance')} icon={<Plus size={18} color={c.primaryText} />} onPress={() => setAdding(true)} />
      {crops.length > 1 && (
        <HScroll>
          <Chip label={t('khAllCrops')} active={!crop} onPress={() => setCrop('')} />
          {crops.map((x) => <Chip key={x} label={cropLabel(x, t)} active={crop.toLowerCase() === x.toLowerCase()} onPress={() => setCrop(x)} />)}
        </HScroll>
      )}
      {perCrop.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {perCrop.map((x) => {
            const on = crop.toLowerCase() === x.crop.toLowerCase()
            return (
              <PressScale
                key={x.crop}
                onPress={() => setCrop(on ? '' : x.crop)}
                style={{ width: tileW, padding: 14, gap: 4, borderRadius: 22, backgroundColor: on ? c.blueSoft : c.surface, borderWidth: on ? 1.5 : 1, borderColor: on ? c.blue + '66' : c.border }}
              >
                <Row gap={6}>
                  <Sprout size={15} color={c.green} />
                  <Txt v="small" weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>{cropLabel(x.crop, t)}</Txt>
                  <Txt v="tiny" muted>({x.n})</Txt>
                </Row>
                <Txt v="h3" weight="extrabold" color={c.blue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(x.left, lang)}</Txt>
                <Txt v="tiny" muted numberOfLines={1} adjustsFontSizeToFit>{t('khDeposited')} {fmtMoney(x.deposited, lang)}</Txt>
              </PressScale>
            )
          })}
        </View>
      )}
    </View>
  )

  const footer = list.length > 0 ? (
    <View style={{ marginTop: 10, padding: 16, borderRadius: radius.lg, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, gap: 10 }}>
      <Txt weight="bold">{t('total')} ({list.length})</Txt>
      <Row gap={10} center={false}>
        <Figure label={t('khDeposited')} value={fmtMoney(total.deposited, lang)} />
        <Figure label={t('khUsed')} value={fmtMoney(total.used, lang)} />
        <Figure label={t('khLeft')} value={fmtMoney(total.left, lang)} color={c.blue} />
      </Row>
    </View>
  ) : null

  return (
    <View style={{ flex: 1 }}>
      {loading && !advances ? (
        <View style={{ paddingHorizontal: side, paddingTop: 12 }}><Loading rows={4} /></View>
      ) : error && !advances ? (
        <View style={{ paddingHorizontal: side, paddingTop: 12 }}><ErrorBox error={error} onRetry={reload} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(a) => a.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: side, paddingTop: 12, paddingBottom: 140, gap: 8 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={<Empty icon={<Sprout size={30} color={c.muted} />}>{(advances ?? []).length === 0 ? t('khNoAdvances') : t('khNoMatch')}</Empty>}
          renderItem={({ item: a }) => {
            const hasMoney = a.balance > 0.005
            return (
              <Pressable
                onPress={() => router.push(partyAdvancesHref(a.party_id))}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: c.border, opacity: a.is_closed ? 0.85 : 1 })}
              >
                <PartyAvatar name={a.party_name} kind="customer" size={42} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Txt weight="bold" numberOfLines={1}>{a.party_name}</Txt>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    <Badge tone="green" icon={<Sprout size={11} color={c.green} />}>{[cropLabel(a.crop, t), a.season].filter(Boolean).join(' · ')}</Badge>
                    {a.is_closed && <Badge>{t('khClosedBadge')}</Badge>}
                  </Row>
                  <Txt v="tiny" muted numberOfLines={1}>{t('khDeposited')} {fmtMoney(a.deposited, lang)} · {t('khUsed')} {fmtMoney(a.used, lang)}</Txt>
                </View>
                <View style={{ alignItems: 'flex-end', maxWidth: '36%' }}>
                  <Txt v="tiny" muted>{t('khLeft')}</Txt>
                  <Txt weight="extrabold" color={hasMoney ? c.blue : c.muted} numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}>{fmtMoney(a.balance, lang)}</Txt>
                </View>
                <ChevronRight size={16} color={c.faint} />
              </Pressable>
            )
          }}
        />
      )}

      <NewAdvanceSheet
        open={adding}
        onClose={() => setAdding(false)}
        parties={customers}
        onPartyCreated={refresh}
        onSaved={(pid) => {
          setAdding(false)
          toast(t('khAdvanceSaved'))
          refresh()
          router.push(partyAdvancesHref(pid))
        }}
      />
    </View>
  )
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  const { c } = useTheme()
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt v="tiny" muted numberOfLines={1}>{label}</Txt>
      <Txt v="small" weight="extrabold" color={color ?? c.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
    </View>
  )
}
