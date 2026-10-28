import { History, Pencil, Trash2, User } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { Badge, Chip, Empty, ErrorBox, HScroll, Loading, Num, Row, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { loadCatalog } from '@/lib/catalog'
import { fetchAll, useLoad } from '@/lib/data'
import { addDays, fmtDate, fmtDateTime } from '@/lib/format'
import { useI18n, type TKey } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { PackUnit } from '@/lib/types'
import { fmtNum, fmtPack } from '@/lib/units'
import { ListCard, migrationHint, RegisterHead, ShowMore, useShowMore, type PeriodProps } from './shared'

type AuditRow = {
  id: number; at: string; user_name: string | null; table_name: string; action: 'update' | 'delete'
  old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null
}
const TABLE_KEY: Record<string, TKey> = {
  stock_movements: 'atStock', sales: 'atInvoice', purchases: 'atPurchase', sale_returns: 'atReturn',
  cash_entries: 'atCash', parties: 'atParty', products: 'atProduct', organizations: 'atShop',
}
/** fields that are bookkeeping, not business data */
const HIDDEN = new Set(['id', 'org_id', 'created_at', 'created_by', 'created_by_name', 'invoice_seq', 'purchase_seq', 'batch_id', 'purchase_id', 'sale_id', 'return_id', 'party_id', 'category_id', 'company_id'])

type Change = { k: string; from: string; to: string }

export function AuditTrail({ from, to, period }: PeriodProps) {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org, version } = useOrg()
  const [action, setAction] = useState<'' | 'update' | 'delete'>('')
  const { data, error, loading, reload } = useLoad(async () => {
    const [catalog, rows] = await Promise.all([
      loadCatalog(org.id),
      fetchAll<AuditRow>((a, b) => supabase.from('audit_log').select('id, at, user_name, table_name, action, old_data, new_data')
        .eq('org_id', org.id).gte('at', `${from}T00:00:00+05:00`).lt('at', `${addDays(to, 1)}T00:00:00+05:00`).order('at', { ascending: false }).range(a, b)),
    ])
    // product names for stock entries (their batches may be gone)
    const batchIds = [...new Set(rows.map((r) => (r.old_data?.batch_id as string) ?? '').filter(Boolean))]
    const batches = new Map<string, { batch_no: string; product_id: string }>()
    for (let i = 0; i < batchIds.length; i += 200) {
      const { data } = await supabase.from('batches').select('id, batch_no, product_id').in('id', batchIds.slice(i, i + 200))
      for (const b of data ?? []) batches.set(b.id, b)
    }
    return { rows, catalog, batches }
  }, [org.id, from, to, version])
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !action || r.action === action), [data, action])
  const counts = useMemo(() => {
    const all = data?.rows ?? []
    return { all: all.length, update: all.filter((r) => r.action === 'update').length, delete: all.filter((r) => r.action === 'delete').length }
  }, [data])
  const pg = useShowMore(`${from}|${to}|${action}`)

  if (loading && !data) return <View style={{ marginTop: 14 }}><Loading rows={5} /></View>
  if (error) return <View style={{ marginTop: 14 }}><ErrorBox onRetry={reload}>{migrationHint(error, t)}</ErrorBox></View>
  if (!data) return null

  const fmtVal = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'number' ? fmtNum(v, 3) : String(v))
  /** what the row was: "INV-12", "Purchase #7 · Bill 123", "Bectal 200 ml · Sale -2" */
  const what = (r: AuditRow) => {
    const o = r.old_data ?? {}
    switch (r.table_name) {
      case 'sales': return `INV-${o.invoice_no} · ${fmtMoney(Number(o.total), lang)}`
      case 'purchases': return `#${o.purchase_no}${o.reference ? ` · ${t('billRef', { ref: String(o.reference) })}` : ''} · ${fmtMoney(Number(o.total), lang)}`
      case 'sale_returns': return fmtMoney(Number(o.total), lang)
      case 'cash_entries': return `${t(`ck_${o.kind}` as TKey)} · ${fmtMoney(Math.abs(Number(o.amount)), lang)}${o.note ? ` · ${o.note}` : ''}`
      case 'parties':
      case 'organizations': return String(o.name ?? '')
      case 'products': return `${o.name} ${fmtPack(Number(o.pack_size), o.pack_unit as PackUnit, lang)}`
      case 'stock_movements': {
        const b = data.batches.get(String(o.batch_id))
        const p = b ? data.catalog.byId.get(b.product_id) : undefined
        return [p ? `${pick(p.name, p.name_ur)} ${fmtPack(p.pack_size, p.pack_unit, lang)}` : '', t(`mv_${o.type}` as TKey), fmtNum(Number(o.qty), 3), o.movement_date ? fmtDate(String(o.movement_date), lang) : '', o.reference ? String(o.reference) : '']
          .filter(Boolean).join(' · ')
      }
      default: return ''
    }
  }
  const changes = (r: AuditRow): Change[] =>
    r.action === 'update' && r.new_data
      ? Object.keys(r.new_data)
          .filter((k) => !HIDDEN.has(k) && JSON.stringify(r.old_data?.[k]) !== JSON.stringify(r.new_data?.[k]))
          .map((k) => ({ k: k.replace(/_/g, ' '), from: fmtVal(r.old_data?.[k]), to: fmtVal(r.new_data?.[k]) }))
      : []
  const changeText = (x: Change) => `${x.k}: ${x.from} → ${x.to}`

  const exportCsv = () =>
    shareCsv(`audit-trail-${from}-to-${to}`, [t('when'), t('by'), t('record'), t('actionCol'), t('details'), t('changes')],
      rows.map((r) => [r.at, r.user_name, t(TABLE_KEY[r.table_name] ?? 'atStock'), r.action === 'delete' ? t('deletedWord') : t('editedWord'), what(r), changes(r).map(changeText).join('; ')]))

  return (
    <View>
      <RegisterHead title={t('auditTrail')} period={period} onExport={exportCsv} />
      <HScroll gap={8}>
        <Chip label={t('allChanges')} active={action === ''} count={counts.all} onPress={() => setAction('')} />
        <Chip label={t('editedWord')} active={action === 'update'} count={counts.update} icon={<Pencil size={14} color={action === 'update' ? c.primaryText : c.amber} />} onPress={() => setAction('update')} />
        <Chip label={t('deletedWord')} active={action === 'delete'} count={counts.delete} icon={<Trash2 size={14} color={action === 'delete' ? c.primaryText : c.red} />} onPress={() => setAction('delete')} />
      </HScroll>
      <View style={{ marginTop: 12 }}>
        {rows.length === 0 ? <Empty icon={<History size={30} color={c.muted} />}>{t('noAuditEntries')}</Empty> : (
          <ListCard
            rows={rows.slice(0, pg.n)}
            keyOf={(r) => String(r.id)}
            render={(r) => {
              const del = r.action === 'delete'
              const ch = changes(r)
              const desc = what(r)
              return (
                <View style={{ gap: 6 }}>
                  <Row gap={8}>
                    <Badge tone={del ? 'red' : 'amber'} icon={del ? <Trash2 size={11} color={c.red} /> : <Pencil size={11} color={c.amber} />}>
                      {del ? t('deletedWord') : t('editedWord')}
                    </Badge>
                    <Txt v="tiny" weight="bold" soft numberOfLines={1} style={{ flex: 1 }}>{t(TABLE_KEY[r.table_name] ?? 'atStock')}</Txt>
                    <Txt v="tiny" muted numberOfLines={1}>{fmtDateTime(r.at, lang)}</Txt>
                  </Row>
                  {!!desc && <Txt v="small" weight="bold">{desc}</Txt>}
                  <Row gap={5}>
                    <User size={12} color={c.muted} />
                    <Txt v="tiny" muted numberOfLines={1}>{r.user_name || '—'}</Txt>
                    {ch.length > 0 && <Txt v="tiny" muted>· {t('mAuditFieldsChanged', { n: ch.length })}</Txt>}
                  </Row>
                  {ch.length > 0 && (
                    <View style={{ backgroundColor: c.surface2, borderRadius: 12, padding: 10, gap: 6 }}>
                      {ch.map((x) => (
                        <View key={x.k} style={{ gap: 2 }}>
                          <Txt v="tiny" muted style={{ textTransform: 'capitalize' }}>{x.k}</Txt>
                          <Row gap={6} style={{ flexWrap: 'wrap' }}>
                            <Num size={12} weight="semibold" color={c.red} style={{ textDecorationLine: 'line-through', flexShrink: 1 }}>{x.from}</Num>
                            <Txt v="tiny" muted>→</Txt>
                            <Num size={12} weight="bold" color={c.green} style={{ flexShrink: 1 }}>{x.to}</Num>
                          </Row>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            }}
          />
        )}
        <ShowMore shown={Math.min(pg.n, rows.length)} total={rows.length} onMore={pg.more} />
      </View>
      <Txt v="tiny" muted style={{ marginTop: 10, paddingHorizontal: 4 }}>{t('auditTrailNote')}</Txt>
    </View>
  )
}
