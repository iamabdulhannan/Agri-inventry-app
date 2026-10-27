import { router } from 'expo-router'
import { CalendarCheck2, PackageX } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { ProductAvatar, usePackLabel } from '@/components/domain'
import { Button, Card, Chip, Empty, ErrorBox, Loading, Row, Screen, Txt, HScroll } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadBatches, loadCatalog } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { daysBetween, fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { toneColors, useTheme } from '@/lib/theme'
import type { ExpiryAlert } from '@/lib/types'
import { fmtNum, fmtTotal } from '@/lib/units'

type F = 'expired' | '30' | 'alert' | 'all'

export default function Expiry() {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, version, today } = useOrg()
  const label = usePackLabel()
  const [f, setF] = useState<F>('alert')

  const { data, error, loading, reload } = useLoad(async () => {
    const [catalog, batches] = await Promise.all([loadCatalog(org.id), loadBatches(org.id)])
    const rows: ExpiryAlert[] = []
    for (const b of batches) {
      const p = catalog.byId.get(b.product_id)
      if (!p) continue
      rows.push({
        batch_id: b.id, org_id: b.org_id, product_id: b.product_id, batch_no: b.batch_no, mfg_date: b.mfg_date, expiry_date: b.expiry_date, qty: b.qty,
        name: p.name, name_ur: p.name_ur, pack_size: p.pack_size, pack_unit: p.pack_unit, pack_type: p.pack_type, company_name: p.company_name, days_left: daysBetween(today, b.expiry_date),
      })
    }
    return rows
  }, [org.id, version, today])

  const counts = useMemo(() => {
    const r = data ?? []
    return { expired: r.filter((x) => x.days_left < 0).length, '30': r.filter((x) => x.days_left >= 0 && x.days_left <= 30).length, alert: r.filter((x) => x.days_left <= org.expiry_alert_days).length, all: r.length }
  }, [data, org.expiry_alert_days])
  const rows = (data ?? []).filter((x) => (f === 'expired' ? x.days_left < 0 : f === '30' ? x.days_left >= 0 && x.days_left <= 30 : f === 'alert' ? x.days_left <= org.expiry_alert_days : true))

  return (
    <Screen back title={t('navExpiry')} subtitle={t('expiryReport')} refreshing={loading} onRefresh={reload}>
      <HScroll gap={8}>
        <Chip label={t('withinN', { n: org.expiry_alert_days })} active={f === 'alert'} onPress={() => setF('alert')} count={counts.alert} />
        <Chip label={t('expired')} active={f === 'expired'} onPress={() => setF('expired')} count={counts.expired} />
        <Chip label={t('within30')} active={f === '30'} onPress={() => setF('30')} count={counts['30']} />
        <Chip label={t('allBatches')} active={f === 'all'} onPress={() => setF('all')} count={counts.all} />
      </HScroll>
      <View style={{ gap: 10, marginTop: 14 }}>
        {loading && !data ? <Loading rows={5} /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : rows.length === 0 ? (
          <Empty icon={<CalendarCheck2 size={30} color={c.green} />}>{t('noExpiry', { d: org.expiry_alert_days })}</Empty>
        ) : rows.map((a) => {
          const tone = a.days_left < 0 ? 'red' : a.days_left <= 30 ? 'orange' : a.days_left <= org.expiry_alert_days ? 'amber' : 'green'
          const tc = toneColors(c, tone)
          const pct = Math.max(0, Math.min(1, a.days_left / Math.max(org.expiry_alert_days, 1)))
          return (
            <Card key={a.batch_id} onPress={() => router.push(`/product/${a.product_id}`)} style={{ padding: 14, gap: 10 }} glow={a.days_left < 0 ? 'red' : undefined}>
              <Row gap={12}>
                <ProductAvatar p={a} size={42} />
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" numberOfLines={1}>{pick(a.name, a.name_ur)}</Txt>
                  <Txt v="tiny" muted numberOfLines={1}>{label(a)} · #{a.batch_no}{a.company_name ? ` · ${a.company_name}` : ''}</Txt>
                </View>
                <View style={{ alignItems: 'center', minWidth: 58, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 14, backgroundColor: tc.bg }}>
                  <Txt v="h3" color={tc.fg}>{Math.abs(a.days_left)}</Txt>
                  <Txt v="tiny" color={tc.fg} style={{ fontSize: 9 }}>{a.days_left < 0 ? t('expiredCol') : t('daysLeftCol')}</Txt>
                </View>
              </Row>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' }}>
                <View style={{ width: `${a.days_left < 0 ? 100 : (1 - pct) * 100}%`, height: 6, borderRadius: 3, backgroundColor: tc.fg }} />
              </View>
              <Row between>
                <Txt v="tiny" muted>{t('expiryDate')}: {fmtDate(a.expiry_date, lang)}</Txt>
                <Txt v="small" weight="extrabold">{fmtNum(a.qty, 3)} {t(`pt_${a.pack_type}`)}{a.pack_unit !== 'pcs' ? ` · ${fmtTotal(a.qty, a.pack_size, a.pack_unit, lang)}` : ''}</Txt>
              </Row>
              {a.days_left < 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  color={c.red}
                  title={t('writeOff')}
                  icon={<PackageX size={15} color={c.red} />}
                  onPress={() => router.push({ pathname: '/sale', params: { type: 'expired', product: a.product_id, batch: a.batch_id, qty: String(a.qty) } })}
                  style={{ alignSelf: 'flex-start' }}
                />
              )}
            </Card>
          )
        })}
      </View>
    </Screen>
  )
}
