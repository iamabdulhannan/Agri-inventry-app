import { router } from 'expo-router'
import { FileText } from 'lucide-react-native'
import { useMemo } from 'react'
import { Pressable, View } from 'react-native'
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

type SaleRow = { id: string; invoice_no: number; sale_date: string; customer_name: string | null; subtotal: number; discount: number; total: number; paid: number; parties: { name: string } | null }
type ReturnRow = { id: string; return_date: string; total: number; refund: number; sales: { invoice_no: number; customer_name: string | null } | null; parties: { name: string } | null }
type Line = { kind: 'sale'; x: SaleRow } | { kind: 'return'; r: ReturnRow }

export function SalesRegister({ from, to, period }: PeriodProps) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version } = useOrg()
  const { data, error, loading, reload } = useLoad(async () => {
    const [sales, returns] = await Promise.all([
      fetchAll<SaleRow>((a, b) => supabase.from('sales').select('*, parties(name)')
        .eq('org_id', org.id).gte('sale_date', from).lte('sale_date', to).order('sale_date').order('invoice_no').range(a, b)),
      fetchAll<ReturnRow>((a, b) => supabase.from('sale_returns').select('*, sales(invoice_no, customer_name), parties(name)')
        .eq('org_id', org.id).gte('return_date', from).lte('return_date', to).order('return_date').range(a, b)),
    ])
    return { sales, returns }
  }, [org.id, from, to, version])
  // invoices then returns, as one list (totals stay over everything)
  const lines = useMemo<Line[]>(
    () => [
      ...(data?.sales ?? []).map((x) => ({ kind: 'sale' as const, x })),
      ...(data?.returns ?? []).map((r) => ({ kind: 'return' as const, r })),
    ],
    [data],
  )
  const pg = useShowMore(`${from}|${to}`)

  if (loading && !data) return <View style={{ marginTop: 14 }}><Loading rows={5} /></View>
  if (error) return <View style={{ marginTop: 14 }}><ErrorBox error={error} onRetry={reload} /></View>
  if (!data) return null
  const m = (n: number) => fmtMoney(n, lang)
  const sum = (k: keyof SaleRow) => data.sales.reduce((s, x) => s + Number(x[k] ?? 0), 0)
  const retTotal = data.returns.reduce((s, x) => s + Number(x.total), 0)
  const who = (x: SaleRow) => x.parties?.name ?? x.customer_name ?? t('walkIn')

  const exportCsv = () =>
    shareCsv(`sales-register-${from}-to-${to}`, [t('date'), t('invoiceNum'), t('customer'), t('subtotal'), t('discount'), t('grandTotal'), t('received'), t('balanceDue')], [
      ...data.sales.map((x) => [x.sale_date, x.invoice_no, who(x), x.subtotal, x.discount, x.total, x.paid, Number(x.total) - Number(x.paid)]),
      ...data.returns.map((r) => [r.return_date, `${t('returnWord')} INV-${r.sales?.invoice_no ?? ''}`, r.parties?.name ?? r.sales?.customer_name ?? t('walkIn'), '', '', -Number(r.total), -Number(r.refund), '']),
      [t('total'), '', '', sum('subtotal'), sum('discount'), sum('total') - retTotal, sum('paid'), sum('total') - sum('paid')],
    ])

  const due = sum('total') - sum('paid')
  const empty = !data.sales.length && !data.returns.length

  return (
    <View>
      <RegisterHead title={t('salesRegister')} period={period} onExport={exportCsv} />
      <TotalsStrip
        items={[
          { l: `${t('netSales')} (${data.sales.length})`, v: sum('total') - retTotal },
          { l: t('received'), v: sum('paid'), col: c.green },
          { l: t('balanceDue'), v: due, col: due > 0 ? c.amber : c.muted },
        ]}
      />
      <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <Badge tone="stone">{t('subtotal')} {m(sum('subtotal'))}</Badge>
        {sum('discount') > 0 && <Badge tone="amber">{t('discount')} {m(sum('discount'))}</Badge>}
        {data.returns.length > 0 && <Badge tone="red">{t('mAuditReturns', { n: data.returns.length })} −{m(retTotal)}</Badge>}
      </Row>
      <View style={{ marginTop: 12 }}>
        {empty ? <Empty icon={<FileText size={30} color={c.muted} />}>{t('noEntries')}</Empty> : (
          <ListCard
            rows={lines.slice(0, pg.n)}
            keyOf={(l) => (l.kind === 'sale' ? `s${l.x.id}` : `r${l.r.id}`)}
            render={(l) => {
              if (l.kind === 'sale') {
                const x = l.x
                const bal = Number(x.total) - Number(x.paid)
                return (
                  <Pressable onPress={() => router.push(`/receipt/${x.id}`)}>
                    <Row gap={12}>
                      <NoTile no={x.invoice_no} tone="primary" />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt v="small" weight="bold" numberOfLines={1}>{who(x)}</Txt>
                        <Txt v="tiny" muted numberOfLines={1}>
                          {fmtDate(x.sale_date, lang)} · INV-{x.invoice_no}{Number(x.discount) ? ` · ${t('discount')} ${m(x.discount)}` : ''}
                        </Txt>
                        {bal > 0 && <Badge tone="amber">{t('balanceDue')} {m(bal)}</Badge>}
                      </View>
                      <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
                        <Txt v="small" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit>{m(x.total)}</Txt>
                        <Txt v="tiny" muted numberOfLines={1}>{t('received')} {m(x.paid)}</Txt>
                      </View>
                    </Row>
                  </Pressable>
                )
              }
              const r = l.r
              return (
                <Row gap={12}>
                  <NoTile no={r.sales?.invoice_no ?? '—'} tone="red" />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Txt v="small" weight="bold" numberOfLines={1}>{r.parties?.name ?? r.sales?.customer_name ?? t('walkIn')}</Txt>
                    <Txt v="tiny" color={c.red} numberOfLines={1}>{fmtDate(r.return_date, lang)} · {t('returnWord')} INV-{r.sales?.invoice_no ?? ''}</Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
                    <Txt v="small" weight="extrabold" color={c.red} numberOfLines={1} adjustsFontSizeToFit>−{m(r.total)}</Txt>
                    {Number(r.refund) ? <Txt v="tiny" color={c.red} numberOfLines={1}>−{m(r.refund)}</Txt> : null}
                  </View>
                </Row>
              )
            }}
          />
        )}
        <ShowMore shown={Math.min(pg.n, lines.length)} total={lines.length} onMore={pg.more} />
      </View>
    </View>
  )
}
