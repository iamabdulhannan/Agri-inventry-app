import { Receipt } from 'lucide-react-native'
import { View } from 'react-native'
import { Empty, ErrorBox, IconTile, Loading, Row, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { fetchAll, useLoad } from '@/lib/data'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { ListCard, RegisterHead, ShowMore, TotalsStrip, useShowMore, type PeriodProps } from './shared'

type ExpenseRow = { id: string; entry_date: string; amount: number; note: string | null; created_by_name: string | null }

export function ExpensesList({ from, to, period }: PeriodProps) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version } = useOrg()
  const { data, error, loading, reload } = useLoad(
    () => fetchAll<ExpenseRow>((a, b) => supabase.from('cash_entries').select('id, entry_date, amount, note, created_by_name')
      .eq('org_id', org.id).eq('kind', 'expense').gte('entry_date', from).lte('entry_date', to).order('entry_date').range(a, b)),
    [org.id, from, to, version],
  )
  const pg = useShowMore(`${from}|${to}`)
  if (loading && !data) return <View style={{ marginTop: 14 }}><Loading rows={5} /></View>
  if (error) return <View style={{ marginTop: 14 }}><ErrorBox error={error} onRetry={reload} /></View>
  if (!data) return null
  const total = data.reduce((s, x) => s - Number(x.amount), 0)
  const exportCsv = () =>
    shareCsv(`expenses-${from}-to-${to}`, [t('date'), t('note'), t('amount'), t('by')], [
      ...data.map((x) => [x.entry_date, x.note, -Number(x.amount), x.created_by_name]),
      [t('total'), '', total, ''],
    ])

  return (
    <View>
      <RegisterHead title={t('expensesList')} period={period} onExport={exportCsv} />
      <TotalsStrip items={[{ l: `${t('total')} (${data.length})`, v: total, col: c.red }]} />
      <View style={{ marginTop: 12 }}>
        {!data.length ? <Empty icon={<Receipt size={30} color={c.muted} />}>{t('noEntries')}</Empty> : (
          <ListCard
            rows={data.slice(0, pg.n)}
            keyOf={(x) => x.id}
            render={(x) => (
              <Row gap={12}>
                <IconTile icon={<Receipt size={18} color={c.red} />} tone="red" size={40} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Txt v="small" weight="bold" numberOfLines={2}>{x.note || t('ck_expense')}</Txt>
                  <Txt v="tiny" muted numberOfLines={1}>{fmtDate(x.entry_date, lang)}{x.created_by_name ? ` · ${x.created_by_name}` : ''}</Txt>
                </View>
                <Txt v="small" weight="extrabold" color={c.red} numberOfLines={1} style={{ maxWidth: '42%' }} adjustsFontSizeToFit>{fmtMoney(-Number(x.amount), lang)}</Txt>
              </Row>
            )}
          />
        )}
        <ShowMore shown={Math.min(pg.n, data.length)} total={data.length} onMore={pg.more} />
      </View>
    </View>
  )
}
