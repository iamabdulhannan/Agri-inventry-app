import { CalendarDays } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { CalendarSheet, PressScale, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { DUE_PRESETS, dueFromRule } from '@/lib/due'
import { fmtDate } from '@/lib/format'
import { useI18n, type Lang } from '@/lib/i18n'
import { radius, useTheme } from '@/lib/theme'

/** 'MM-DD' -> "15 Nov" */
const dayMonth = (mmdd: string, lang: Lang) => fmtDate(`2000-${mmdd}`, lang).replace(/\s*2000$/, '')
const isCustomDate = (rule: string) => /^date:\d{2}-\d{2}$/.test(rule) && !DUE_PRESETS.some((p) => p.rule === rule)

/** label of a customer's default due rule ('date:12-31' -> "End of December"), or null */
export function useDueRuleLabel() {
  const { t, lang } = useI18n()
  return (rule: string | null | undefined): string | null => {
    if (!rule) return null
    const p = DUE_PRESETS.find((x) => x.rule === rule)
    if (p) return t(p.key)
    const [kind, val] = rule.split(':')
    if (kind === 'days' && Number(val) > 0) return t('khDaysN', { n: Number(val) })
    if (kind === 'date' && /^\d{2}-\d{2}$/.test(val)) return t('khEveryDate', { date: dayMonth(val, lang) })
    return rule
  }
}

function RuleChip({ label, on, onPress, disabled, icon }: { label: string; on: boolean; onPress: () => void; disabled?: boolean; icon?: ReactNode }) {
  const { c } = useTheme()
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, height: 36, borderRadius: radius.pill,
        backgroundColor: on ? c.primary : c.surface, borderWidth: 1, borderColor: on ? c.primary : c.borderStrong,
      }}
    >
      {icon}
      <Txt v="small" weight="bold" color={on ? c.primaryText : c.textSoft} numberOfLines={1}>{label}</Txt>
    </PressScale>
  )
}

/** Quick-pick chips for "usually pays by": End of December / End of June / 30 / 60 / 90 days / a custom date / None */
export function DueRuleChips({ value, onChange, disabled }: { value: string; onChange: (rule: string) => void; disabled?: boolean }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { today } = useOrg()
  const custom = isCustomDate(value)
  const [picking, setPicking] = useState(false)
  const items = [...DUE_PRESETS.map((p) => ({ rule: p.rule, label: t(p.key) })), { rule: '', label: t('khDueNone') }]
  return (
    <View collapsable={false} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((it) => (
          <RuleChip key={it.rule || 'none'} label={it.label} on={it.rule === value} disabled={disabled} onPress={() => onChange(it.rule)} />
        ))}
        {/* any day of the year, repeats every year (e.g. every 15 Nov) */}
        <RuleChip
          label={custom ? dayMonth(value.slice(5), lang) : t('khCustomDate')}
          on={custom}
          disabled={disabled}
          onPress={() => setPicking(true)}
          icon={<CalendarDays size={15} color={custom ? c.primaryText : c.textSoft} />}
        />
      </View>
      {custom && <Txt v="tiny" muted>{t('khCustomDateHint')}</Txt>}
      <CalendarSheet
        open={picking}
        onClose={() => setPicking(false)}
        title={t('khCustomDate')}
        value={dueFromRule(custom ? value : null, today) ?? today}
        onPick={(d) => onChange(`date:${d.slice(5)}`)}
      />
    </View>
  )
}
