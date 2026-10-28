import { router } from 'expo-router'
import { Boxes } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { ProductAvatar, usePackLabel } from '@/components/domain'
import { Empty, ErrorBox, Loading, Row, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadCatalog } from '@/lib/catalog'
import { fetchAll, useLoad } from '@/lib/data'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { fmtNum, fmtPack } from '@/lib/units'
import { ListCard, RegisterHead, ShowMore, TotalsStrip, useShowMore, type PeriodProps } from './shared'

type YearStockRow = { product_id: string; opening_qty: number; in_qty: number; out_qty: number; closing_qty: number; opening_value: number; closing_value: number }

export function StockRegister({ from, to, period }: PeriodProps) {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, version } = useOrg()
  const label = usePackLabel()
  const { data, error, loading, reload } = useLoad(async () => {
    const [catalog, rows] = await Promise.all([
      loadCatalog(org.id),
      fetchAll<YearStockRow>((a, b) => supabase.rpc('year_stock', { p_org: org.id, p_from: from, p_to: to }).order('product_id').range(a, b)),
    ])
    return rows
      .map((r) => ({ ...r, p: catalog.byId.get(r.product_id) }))
      .filter((r) => r.p && (Number(r.opening_qty) || Number(r.in_qty) || Number(r.out_qty) || Number(r.closing_qty)))
      .sort((a, b) => a.p!.name.localeCompare(b.p!.name) || a.p!.pack_size - b.p!.pack_size)
  }, [org.id, from, to, version])
  const pg = useShowMore(`${from}|${to}`)
  if (loading && !data) return <View style={{ marginTop: 14 }}><Loading rows={5} /></View>
  if (error) return <View style={{ marginTop: 14 }}><ErrorBox error={error} onRetry={reload} /></View>
  if (!data) return null
  const m = (n: number) => fmtMoney(n, lang)
  const openV = data.reduce((s, r) => s + Number(r.opening_value), 0)
  const closeV = data.reduce((s, r) => s + Number(r.closing_value), 0)

  const exportCsv = () =>
    shareCsv(`stock-register-${from}-to-${to}`, [t('product'), t('company'), t('packSize'), t('opening'), t('inLabel'), t('outLabel'), t('closing'), t('openingValue'), t('closingValue')], [
      ...data.map((r) => [r.p!.name, r.p!.company_name, fmtPack(r.p!.pack_size, r.p!.pack_unit), r.opening_qty, r.in_qty, r.out_qty, r.closing_qty, r.opening_value, r.closing_value]),
      [t('total'), '', '', '', '', '', '', openV, closeV],
    ])

  return (
    <View>
      <RegisterHead title={t('stockRegister')} period={period} onExport={exportCsv} />
      <TotalsStrip
        items={[
          { l: `${t('openingValue')} (${data.length})`, v: openV, col: c.textSoft },
          { l: t('closingValue'), v: closeV, col: c.primary },
        ]}
      />
      <View style={{ marginTop: 12 }}>
        {!data.length ? <Empty icon={<Boxes size={30} color={c.muted} />}>{t('noEntries')}</Empty> : (
          <ListCard
            rows={data.slice(0, pg.n)}
            keyOf={(r) => r.product_id}
            render={(r) => {
              const p = r.p!
              return (
                <Pressable onPress={() => router.push(`/product/${p.id}`)} style={{ gap: 10 }}>
                  <Row gap={10}>
                    <ProductAvatar p={p} size={36} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Txt v="small" weight="bold" numberOfLines={1}>{pick(p.name, p.name_ur)}</Txt>
                      <Txt v="tiny" muted numberOfLines={1}>{label(p)}{p.company_name ? ` · ${p.company_name}` : ''}</Txt>
                    </View>
                  </Row>
                  <Row gap={6}>
                    {[
                      { l: t('opening'), v: Number(r.opening_qty), col: c.textSoft, show: true },
                      { l: t('inLabel'), v: Number(r.in_qty), col: c.green, show: !!Number(r.in_qty) },
                      { l: t('outLabel'), v: Number(r.out_qty), col: c.orange, show: !!Number(r.out_qty) },
                      { l: t('closing'), v: Number(r.closing_qty), col: c.text, show: true },
                    ].map((x) => (
                      <View key={x.l} style={{ flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 7, borderRadius: 12, backgroundColor: c.surface2 }}>
                        <Txt v="tiny" muted numberOfLines={1}>{x.l}</Txt>
                        <Txt v="small" weight="extrabold" color={x.show ? x.col : c.faint} numberOfLines={1} adjustsFontSizeToFit>{x.show ? fmtNum(x.v, 3) : '—'}</Txt>
                      </View>
                    ))}
                  </Row>
                  <Row between gap={8}>
                    <Txt v="tiny" muted numberOfLines={1} style={{ flexShrink: 1 }}>{t('mAuditValueOpenClose')}</Txt>
                    <Txt v="tiny" weight="bold" numberOfLines={1}>
                      <Txt v="tiny" muted>{m(r.opening_value)}</Txt> → {m(r.closing_value)}
                    </Txt>
                  </Row>
                </Pressable>
              )
            }}
          />
        )}
        <ShowMore shown={Math.min(pg.n, data.length)} total={data.length} onMore={pg.more} />
      </View>
      <Txt v="tiny" muted style={{ marginTop: 10, paddingHorizontal: 4 }}>{t('auditNoteValuation')}</Txt>
    </View>
  )
}
