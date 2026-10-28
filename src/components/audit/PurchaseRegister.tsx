import { Truck } from 'lucide-react-native'
import { View } from 'react-native'
import { Badge, Empty, ErrorBox, Loading, Row, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { fetchAll, useLoad } from '@/lib/data'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { ListCard, NoTile, RegisterHead, ShowMore, TotalsStrip, useShowMore, type PeriodProps } from './shared'

type PurchaseRow = { id: string; purchase_no: number; purchase_date: string; supplier_name: string | null; reference: string | null; total: number; paid: number; parties: { name: string } | null }

export function PurchaseRegister({ from, to, period }: PeriodProps) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version } = useOrg()
  const { data, error, loading, reload } = useLoad(
    () => fetchAll<PurchaseRow>((a, b) => supabase.from('purchases').select('*, parties(name)')
      .eq('org_id', org.id).gte('purchase_date', from).lte('purchase_date', to).order('purchase_date').order('purchase_no').range(a, b)),
    [org.id, from, to, version],
  )
  const pg = useShowMore(`${from}|${to}`)
  if (loading && !data) return <View style={{ marginTop: 14 }}><Loading rows={5} /></View>
  if (error) return <View style={{ marginTop: 14 }}><ErrorBox error={error} onRetry={reload} /></View>
  if (!data) return null
  const m = (n: number) => fmtMoney(n, lang)
  const total = data.reduce((s, x) => s + Number(x.total), 0)
  const paid = data.reduce((s, x) => s + Number(x.paid), 0)
  const who = (x: PurchaseRow) => x.parties?.name ?? x.supplier_name ?? ''

  const exportCsv = () =>
    shareCsv(`purchase-register-${from}-to-${to}`, [t('date'), t('purchaseNum'), t('supplier'), t('billRefCol'), t('grandTotal'), t('paidCol'), t('balanceDue')], [
      ...data.map((x) => [x.purchase_date, x.purchase_no, who(x), x.reference, x.total, x.paid, Number(x.total) - Number(x.paid)]),
      [t('total'), '', '', '', total, paid, total - paid],
    ])

  return (
    <View>
      <RegisterHead title={t('purchaseRegister')} period={period} onExport={exportCsv} />
      <TotalsStrip
        items={[
          { l: `${t('total')} (${data.length})`, v: total },
          { l: t('paidCol'), v: paid, col: c.green },
          { l: t('balanceDue'), v: total - paid, col: total - paid > 0 ? c.red : c.muted },
        ]}
      />
      <View style={{ marginTop: 12 }}>
        {!data.length ? <Empty icon={<Truck size={30} color={c.muted} />}>{t('noEntries')}</Empty> : (
          <ListCard
            rows={data.slice(0, pg.n)}
            keyOf={(x) => x.id}
            render={(x) => {
              const bal = Number(x.total) - Number(x.paid)
              return (
                <Row gap={12}>
                  <NoTile no={x.purchase_no} tone="blue" />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Txt v="small" weight="bold" numberOfLines={1}>{who(x) || '—'}</Txt>
                    <Txt v="tiny" muted numberOfLines={1}>
                      {fmtDate(x.purchase_date, lang)}{x.reference ? ` · ${t('billRef', { ref: x.reference })}` : ''}
                    </Txt>
                    {bal > 0 && <Badge tone="red">{t('balanceDue')} {m(bal)}</Badge>}
                  </View>
                  <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
                    <Txt v="small" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit>{m(x.total)}</Txt>
                    <Txt v="tiny" muted numberOfLines={1}>{t('paidCol')} {m(x.paid)}</Txt>
                  </View>
                </Row>
              )
            }}
          />
        )}
        <ShowMore shown={Math.min(pg.n, data.length)} total={data.length} onMore={pg.more} />
      </View>
    </View>
  )
}
