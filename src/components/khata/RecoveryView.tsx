import { router } from 'expo-router'
import { AlarmClock, CalendarClock, HandCoins, MessageCircle } from 'lucide-react-native'
import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, RefreshControl, SectionList, View } from 'react-native'
import { PartyAvatar } from '@/components/domain'
import { Badge, Empty, ErrorBox, IconTile, Loading, PressScale, Row, Segmented, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { daysLeft } from '@/lib/due'
import { fmtDate, monthRange } from '@/lib/format'
import { useI18n, type TKey } from '@/lib/i18n'
import { DUE_TONE, dueGroupOf, dueText, loadDues, type DueGroup } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { softShadow, useLayout } from '@/lib/responsive'
import { radius, toneColors, useTheme, type Tone } from '@/lib/theme'
import type { PartyBalance } from '@/lib/types'
import { useRemind } from './DuesCard'
import { canWhatsApp } from './whatsapp'

type Filter = 'all' | 'overdue' | 'month'

interface DueRow {
  party: PartyBalance
  total: number
  overdue: number
  soon: number
  /** earliest due date of an unpaid bill */
  due: string | null
  group: DueGroup
  bills: number
}

const GROUPS: { g: DueGroup; key: TKey; tone: Tone }[] = [
  { g: 'overdue', key: 'khOverdue', tone: 'red' },
  { g: 'soon', key: 'khDue30', tone: 'amber' },
  { g: 'later', key: 'khLater', tone: 'stone' },
  { g: 'none', key: 'khNoDate', tone: 'stone' },
]

/** Recovery (wasooli): customers who owe money, grouped by due status, with WhatsApp reminders */
export function RecoveryView({ parties, q }: { parties: PartyBalance[]; q: string }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today, version } = useOrg()
  const { width, contentWidth } = useLayout()
  const side = (width - contentWidth) / 2
  const remind = useRemind()
  const [filter, setFilter] = useState<Filter>('all')
  const { data, error, loading, reload } = useLoad(() => loadDues(org.id), [org.id, version])
  const monthEnd = monthRange(today.slice(0, 7))[1]

  const rows = useMemo(() => {
    const byId = new Map(parties.map((p) => [p.id, p]))
    const map = new Map<string, DueRow>()
    for (const d of data ?? []) {
      const party = byId.get(d.party_id)
      if (!party || d.outstanding <= 0) continue
      const r = map.get(d.party_id) ?? { party, total: 0, overdue: 0, soon: 0, due: null, group: 'none' as DueGroup, bills: 0 }
      r.total += d.outstanding
      r.bills += 1
      if (d.due_date) {
        const n = daysLeft(d.due_date, today)
        if (n < 0) r.overdue += d.outstanding
        else if (n <= 30) r.soon += d.outstanding
        if (!r.due || d.due_date < r.due) r.due = d.due_date
      }
      map.set(d.party_id, r)
    }
    return [...map.values()].map((r) => ({ ...r, group: dueGroupOf(r.due, today) }))
  }, [data, parties, today])

  const sum = (l: DueRow[], f: (r: DueRow) => number) => l.reduce((s, r) => s + f(r), 0)
  const totals = { overdue: sum(rows, (r) => r.overdue), soon: sum(rows, (r) => r.soon), all: sum(rows, (r) => r.total) }

  const sections = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
    const shown = rows
      .filter((r) => (filter === 'overdue' ? r.overdue > 0 : filter === 'month' ? !!r.due && r.due <= monthEnd : true))
      .filter((r) => terms.every((x) => `${r.party.name} ${r.party.phone ?? ''} ${r.party.address ?? ''}`.toLowerCase().includes(x)))
      .sort((a, b) => (a.due && b.due ? a.due.localeCompare(b.due) : 0) || b.total - a.total)
    return GROUPS.map((g) => ({ ...g, data: shown.filter((r) => r.group === g.g) })).filter((s) => s.data.length > 0)
  }, [rows, filter, q, monthEnd])

  const header = (
    <View style={{ gap: 12, marginBottom: 4 }}>
      <View style={[{ padding: 16, borderRadius: radius.xl, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, !c.dark && softShadow(c.shadow, 0.06, 14, 6)]}>
        <Row gap={12}>
          <IconTile icon={<HandCoins size={20} color={c.primary} />} tone="primary" size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="small" muted numberOfLines={1}>{t('khTotalOnKhata')}</Txt>
            <Txt v="h1" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(totals.all, lang)}</Txt>
          </View>
        </Row>
      </View>
      <Row gap={10} center={false}>
        <SumTile tone="red" active={totals.overdue > 0} icon={<AlarmClock size={17} color={c.red} />} label={t('khOverdueTotal')} value={fmtMoney(totals.overdue, lang)} onPress={() => setFilter('overdue')} />
        <SumTile tone="amber" active={totals.soon > 0} icon={<CalendarClock size={17} color={c.amber} />} label={t('khDue30')} value={fmtMoney(totals.soon, lang)} />
      </Row>
      <Segmented
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: t('all') },
          { value: 'overdue', label: t('khOverdue') },
          { value: 'month', label: t('khThisMonth') },
        ]}
      />
    </View>
  )

  if (loading && !data) return <View style={{ paddingHorizontal: side, paddingTop: 12 }}><Loading rows={4} /></View>
  if (error && !data) return <View style={{ paddingHorizontal: side, paddingTop: 12 }}><ErrorBox error={error} onRetry={reload} /></View>

  return (
    <SectionList
      sections={sections}
      keyExtractor={(r) => r.party.id}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: side, paddingTop: 12, paddingBottom: 140 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={c.primary} colors={[c.primary]} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty icon={<HandCoins size={30} color={c.muted} />}>{rows.length === 0 ? t('khNoDues') : t('khNoMatch')}</Empty>}
      renderSectionHeader={({ section }) => {
        const tc = toneColors(c, section.tone)
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: section.tone === 'stone' ? c.surface2 : tc.bg }}>
            <Txt v="small" weight="extrabold" color={section.tone === 'stone' ? c.textSoft : tc.fg} numberOfLines={1} style={{ flexShrink: 1 }}>{t(section.key)} ({section.data.length})</Txt>
            <Txt v="small" weight="extrabold" color={section.tone === 'stone' ? c.textSoft : tc.fg} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(sum(section.data, (r) => r.total), lang)}</Txt>
          </View>
        )
      }}
      ItemSeparatorComponent={Gap}
      renderItem={({ item: r }) => (
        <Pressable
          onPress={() => router.push(`/party/${r.party.id}`)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: pressed ? c.surface2 : c.surface, borderWidth: 1, borderColor: r.group === 'overdue' ? c.red + '40' : c.border })}
        >
          <PartyAvatar name={r.party.name} kind="customer" size={42} />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Txt weight="bold" numberOfLines={1}>{r.party.name}</Txt>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {r.due && r.group !== 'later' && <Badge tone={DUE_TONE[r.group]}>{dueText(r.due, today, t)}</Badge>}
              <Txt v="tiny" muted numberOfLines={1}>
                {[r.due ? fmtDate(r.due, lang) : null, r.bills > 1 ? t('khBillsN', { n: r.bills }) : null, r.party.phone].filter(Boolean).join(' · ')}
              </Txt>
            </Row>
          </View>
          <View style={{ alignItems: 'flex-end', maxWidth: '38%' }}>
            <Txt weight="extrabold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}>{fmtMoney(r.total, lang)}</Txt>
            {r.overdue > 0 && r.overdue < r.total - 0.005 && (
              <Txt v="tiny" color={c.red} numberOfLines={1} adjustsFontSizeToFit>{t('khOverdueAmount', { amount: fmtMoney(r.overdue, lang) })}</Txt>
            )}
          </View>
          {canWhatsApp(r.party.phone) && (
            <PressScale onPress={() => remind(r.party, r.total, r.due)} style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.greenSoft }}>
              <View accessibilityLabel={t('khRemind')}><MessageCircle size={20} color={c.green} /></View>
            </PressScale>
          )}
        </Pressable>
      )}
    />
  )
}

function Gap() {
  return <View style={{ height: 8 }} />
}

function SumTile({ tone, active, icon, label, value, onPress }: { tone: Tone; active: boolean; icon: ReactNode; label: string; value: string; onPress?: () => void }) {
  const { c } = useTheme()
  const tc = toneColors(c, tone)
  const shell = { flex: 1, padding: 14, gap: 8, borderRadius: 22, backgroundColor: active ? tc.bg : c.surface, borderWidth: active ? 1.5 : 1, borderColor: active ? tc.fg + '66' : c.border }
  const body = (
    <>
      <IconTile icon={icon} tone={tone} size={34} />
      <Txt v="tiny" muted numberOfLines={2} style={{ minHeight: 30 }}>{label}</Txt>
      <Txt v="h3" weight="extrabold" color={active ? tc.fg : c.text} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
    </>
  )
  return onPress ? <PressScale onPress={onPress} style={shell}>{body}</PressScale> : <View style={shell}>{body}</View>
}
