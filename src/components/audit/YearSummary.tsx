import { LinearGradient } from 'expo-linear-gradient'
import { Banknote, Landmark, Lock, LockOpen, Scale, ShoppingCart, TrendingUp, Wallet } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { AnimatedNumber, Button, Card, ErrorBox, IconTile, Loading, Num, Row, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { addDays, fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { useLayout } from '@/lib/responsive'
import { shareCsv } from '@/lib/share'
import { supabase } from '@/lib/supabase'
import { radius, useTheme, type Tone } from '@/lib/theme'
import { migrationHint, RegisterHead, type PeriodProps } from './shared'

interface YearReport {
  opening_stock: number; purchases: number; purchase_bills: number; stock_without_bill: number; purchase_returns: number
  closing_stock: number; cost_of_goods_sold: number; written_off: number
  gross_sales: number; discounts: number; invoices: number; sale_returns: number; net_sales: number
  gross_profit: number; expenses: number; net_profit: number
  cash_opening: number; cash_in: number; cash_out: number; cash_closing: number
  receivable: number; payable: number; customer_advances: number; supplier_advances: number
  // from migration 013 (absent before it is run)
  cash_in_hand?: number; bank_balance?: number; bank_owed?: number; crop_advances_held?: number; cheques_in_hand?: number
  locked_until: string | null
}

type Kind = 'add' | 'sub' | 'total' | 'grand'
type LineRow = [string, number, Kind]

/* ------------------------------------------------------------------ */
/* Year report: trading account, P&L, position, lock                  */
/* ------------------------------------------------------------------ */
export function YearSummary({ from, to, period, isTaxYear }: PeriodProps & { isTaxYear: boolean }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { contentWidth } = useLayout()
  const { org, role, today, version, refresh, reloadOrgs } = useOrg()
  const { toast, confirm } = useFeedback()
  const [busy, setBusy] = useState(false)
  const { data, error, loading, reload } = useLoad(async () => {
    const { data, error } = await supabase.rpc('year_report', { p_org: org.id, p_from: from, p_to: to })
    if (error) throw error
    return data as YearReport
  }, [org.id, from, to, version])

  if (loading && !data) return <View style={{ marginTop: 14 }}><Loading rows={4} /></View>
  if (error) return <View style={{ marginTop: 14 }}><ErrorBox onRetry={reload}>{migrationHint(error, t)}</ErrorBox></View>
  if (!data) return null
  const r = data
  const m = (n: number) => fmtMoney(n, lang)
  const lockedUntil = r.locked_until !== undefined ? r.locked_until : (org.locked_until ?? null)
  const isOwner = role === 'owner'
  const yearLocked = !!lockedUntil && lockedUntil >= to
  const yearOver = to < today
  const wide = contentWidth >= 640

  const setLock = async (until: string | null, question: string, unlocking: boolean) => {
    if (!(await confirm(question, { danger: unlocking, title: unlocking ? t('unlockYear') : t('lockYear'), okLabel: unlocking ? t('unlockYear') : t('lockYear') }))) return
    setBusy(true)
    const { error } = await supabase.rpc('set_locked_until', { p_org: org.id, p_until: until })
    setBusy(false)
    if (error) return toast(migrationHint(error, t), 'err')
    toast(until ? t('lockedToast', { date: fmtDate(until, lang) }) : t('unlockedToast'))
    await reloadOrgs()
    refresh()
  }

  const rows: LineRow[] = [
    [t('openingStockCost'), r.opening_stock, 'add'],
    [`${t('purchasesBills')} (${r.purchase_bills})`, r.purchases, 'add'],
    ...(Number(r.stock_without_bill) ? [[t('stockWithoutBill'), r.stock_without_bill, 'add'] as LineRow] : []),
    ...(Number(r.purchase_returns) ? [[t('returnsToSuppliers'), r.purchase_returns, 'sub'] as LineRow] : []),
    [t('closingStock'), r.closing_stock, 'sub'],
    [t('costOfGoodsSold'), r.cost_of_goods_sold, 'total'],
  ]
  const salesRows: LineRow[] = [
    [`${t('grossSales')} (${r.invoices} ${t('invoicesWord')})`, r.gross_sales, 'add'],
    ...(Number(r.discounts) ? [[t('discountsGiven'), r.discounts, 'sub'] as LineRow] : []),
    ...(Number(r.sale_returns) ? [[t('customerReturns'), r.sale_returns, 'sub'] as LineRow] : []),
    [t('netSales'), r.net_sales, 'total'],
  ]

  const exportCsv = () =>
    shareCsv(`year-report-${from}-to-${to}`, [t('item'), t('amount')], [
      [period, ''],
      ...(org.ntn ? [[t('ntn'), org.ntn]] : []),
      ['', ''],
      [t('tradingAccount'), ''],
      ...rows.map(([l, v, k]) => [`${k === 'sub' ? '- ' : ''}${l}`, v]),
      ...salesRows.map(([l, v, k]) => [`${k === 'sub' ? '- ' : ''}${l}`, v]),
      [t('grossProfit'), r.gross_profit],
      [`- ${t('expensesWord')}`, r.expenses],
      [t('netProfit'), r.net_profit],
      ['', ''],
      [t('positionOn', { date: fmtDate(to, 'en') }), ''],
      ...(r.bank_balance != null
        ? [[t('cashInHand'), r.cash_in_hand], [t('auditBankBalance'), r.bank_balance], [t('auditChequesInHand'), r.cheques_in_hand]]
        : [[t('cashInHand'), r.cash_closing]]),
      ...(Number(r.bank_owed) > 0 ? [[t('auditBankOwed'), r.bank_owed]] : []),
      ...(Number(r.crop_advances_held) > 0 ? [[t('auditCropAdvances'), r.crop_advances_held]] : []),
      [t('totalReceivable'), r.receivable],
      [t('totalPayable'), r.payable],
      [t('customerAdvances'), r.customer_advances],
      [t('supplierAdvance'), r.supplier_advances],
      [t('stockAtCost'), r.closing_stock],
    ])

  const profitColor = Number(r.net_profit) < 0 ? '#FFC2C2' : '#F4FFF6'

  /* ---------------------------------------------------------------- sections */
  const trading = (
    <Ledger title={t('tradingAccount')} icon={<Scale size={18} color={c.blue} />} tone="blue">
      {rows.map(([label, value, kind], i) => <Line key={label} first={i === 0} label={label} value={value} kind={kind} />)}
      <View style={{ height: 8, backgroundColor: c.bgAlt }} />
      {salesRows.map(([label, value, kind], i) => <Line key={label} first={i === 0} label={label} value={value} kind={kind} />)}
      <Line label={t('grossProfit')} value={r.gross_profit} kind="total" tone={Number(r.gross_profit) < 0 ? 'red' : 'green'} />
    </Ledger>
  )
  const pnl = (
    <Ledger title={t('profitAndLoss')} icon={<TrendingUp size={18} color={c.green} />} tone="green">
      <Line first label={t('grossProfit')} value={r.gross_profit} kind="add" />
      <Line label={t('expensesWord')} value={r.expenses} kind="sub" />
      <Line label={t('netProfit')} value={r.net_profit} kind="grand" tone={Number(r.net_profit) < 0 ? 'red' : 'green'} />
    </Ledger>
  )
  const position = (
    <Ledger title={t('positionOn', { date: fmtDate(to, lang) })} icon={<Landmark size={18} color={c.violet} />} tone="violet">
      <Line first label={t('stockAtCost')} value={r.closing_stock} />
      {r.bank_balance != null ? (
        <>
          <Line label={t('cashInHand')} value={r.cash_in_hand ?? 0} tone={Number(r.cash_in_hand) < 0 ? 'red' : undefined} />
          {Number(r.bank_balance) !== 0 && <Line label={t('auditBankBalance')} value={r.bank_balance} />}
          {Number(r.cheques_in_hand) > 0 && <Line label={t('auditChequesInHand')} value={r.cheques_in_hand ?? 0} />}
        </>
      ) : (
        <Line label={t('cashInHand')} value={r.cash_closing} tone={Number(r.cash_closing) < 0 ? 'red' : undefined} />
      )}
      <Line label={t('totalReceivable')} value={r.receivable} />
      <Line label={t('totalPayable')} value={r.payable} />
      {Number(r.bank_owed) > 0 && <Line label={t('auditBankOwed')} value={r.bank_owed ?? 0} />}
      {Number(r.crop_advances_held) > 0 && <Line label={t('auditCropAdvances')} value={r.crop_advances_held ?? 0} />}
      {Number(r.customer_advances) > 0 && <Line label={t('customerAdvances')} value={r.customer_advances} />}
      {Number(r.supplier_advances) > 0 && <Line label={t('supplierAdvance')} value={r.supplier_advances} />}
    </Ledger>
  )
  const cash = (
    <Ledger title={t('cashMovement')} icon={<Wallet size={18} color={c.amber} />} tone="amber">
      <Line first label={t('openingCash')} value={r.cash_opening} />
      <Line label={t('cashIn')} value={r.cash_in} kind="add" />
      <Line label={t('cashOut')} value={r.cash_out} kind="sub" />
      <Line label={t('closingCash')} value={r.cash_closing} kind="total" tone={Number(r.cash_closing) < 0 ? 'red' : undefined} />
    </Ledger>
  )

  const notes: { text: string; warn?: boolean }[] = [
    { text: t('auditNoteValuation') },
    ...(Number(r.written_off) > 0 ? [{ text: t('auditNoteWrittenOff', { amount: m(r.written_off) }) }] : []),
    ...(Number(r.cash_closing) < 0 ? [{ text: t('auditNoteNegativeCash'), warn: true }] : []),
    { text: t('auditDisclaimer') },
  ]

  return (
    <View>
      <RegisterHead title={t('yearReport')} period={period} onExport={exportCsv} />

      {/* hero: net profit for the period */}
      <View style={{ borderRadius: radius.xl, overflow: 'hidden' }}>
        <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
          <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
          <Row between center={false} gap={10}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="label" color="rgba(236,255,240,0.7)">{t('netProfit')}</Txt>
              <AnimatedNumber value={Number(r.net_profit)} format={m} size={34} color={profitColor} />
            </View>
            <View style={styles.lockPill}>
              {yearLocked ? <Lock size={13} color="#C8FF4D" /> : <LockOpen size={13} color="rgba(236,255,240,0.8)" />}
              <Txt v="tiny" color="#E9FFE0" numberOfLines={1}>{yearLocked ? t('yearLocked') : t('yearOpen')}</Txt>
            </View>
          </Row>
          {(!!org.ntn || !!org.strn) && (
            <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
              {!!org.ntn && <View style={styles.chip}><Txt v="tiny" color="#E9FFE0">{t('ntn')}: {org.ntn}</Txt></View>}
              {!!org.strn && <View style={styles.chip}><Txt v="tiny" color="#E9FFE0">{t('strn')}: {org.strn}</Txt></View>}
            </Row>
          )}
          <View style={[styles.heroStats, { flexDirection: 'row' }]}>
            {[
              { l: t('netSales'), v: r.net_sales, icon: <ShoppingCart size={13} color="#C8FF4D" /> },
              { l: t('grossProfit'), v: r.gross_profit, icon: <TrendingUp size={13} color="#C8FF4D" /> },
              { l: t('expensesWord'), v: r.expenses, icon: <Banknote size={13} color="#C8FF4D" /> },
            ].map((x, i) => (
              <View key={x.l} style={{ flex: 1, minWidth: 0, paddingHorizontal: 8, borderLeftWidth: i ? 1 : 0, borderLeftColor: 'rgba(236,255,240,0.18)' }}>
                <Row gap={4}>
                  {x.icon}
                  <Txt v="tiny" color="rgba(236,255,240,0.75)" numberOfLines={1} style={{ flexShrink: 1 }}>{x.l}</Txt>
                </Row>
                <Num size={15} weight="extrabold" color="#F4FFF6" numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 2 }}>{m(Number(x.v))}</Num>
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>

      {/* year lock */}
      <Card glow={yearLocked ? 'primary' : undefined} style={{ marginTop: 12, gap: 12 }}>
        <Row gap={12} center={false}>
          <IconTile
            icon={yearLocked ? <Lock size={19} color={c.primary} /> : <LockOpen size={19} color={c.muted} />}
            tone={yearLocked ? 'primary' : 'stone'}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Txt v="h3">{yearLocked ? t('yearLocked') : t('yearOpen')}</Txt>
            <Txt v="small" soft>
              {lockedUntil ? t('lockedUntilText', { date: fmtDate(lockedUntil, lang) }) : t('nothingLocked')}
              {!yearLocked && !yearOver ? ` ${t('lockAfterYearEnd', { date: fmtDate(to, lang) })}` : ''}
            </Txt>
            {!isOwner && <Txt v="tiny" muted style={{ marginTop: 2 }}>{t('onlyOwnerLocks')}</Txt>}
          </View>
        </Row>
        {isOwner && isTaxYear && (
          yearLocked ? (
            <Button
              variant="secondary"
              title={t('unlockYear')}
              icon={<LockOpen size={17} color={c.text} />}
              loading={busy}
              onPress={() => setLock(addDays(from, -1), t('unlockConfirm', { date: fmtDate(from, lang) }), true)}
            />
          ) : yearOver ? (
            <Button
              title={t('lockYear')}
              icon={<Lock size={17} color={c.primaryText} />}
              loading={busy}
              onPress={() => setLock(to, t('lockConfirm', { date: fmtDate(to, lang) }), false)}
            />
          ) : null
        )}
      </Card>

      {/* statements */}
      {wide ? (
        <Row gap={12} center={false} style={{ marginTop: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>{trading}</View>
          <View style={{ flex: 1, minWidth: 0, gap: 12 }}>{pnl}{position}{cash}</View>
        </Row>
      ) : (
        <View style={{ gap: 12, marginTop: 12 }}>{trading}{pnl}{position}{cash}</View>
      )}

      <View style={{ gap: 6, marginTop: 14, paddingHorizontal: 4 }}>
        {notes.map((n) => (
          <Row key={n.text} gap={8} center={false}>
            <Txt v="tiny" color={n.warn ? c.amber : c.muted}>•</Txt>
            <Txt v="tiny" color={n.warn ? c.amber : c.muted} style={{ flex: 1 }}>{n.text}</Txt>
          </Row>
        ))}
      </View>
    </View>
  )
}

/** Statement card: tinted icon + title, then label / amount lines */
function Ledger({ title, icon, tone, children }: { title: string; icon: ReactNode; tone: Tone; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <Row gap={10} style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <IconTile icon={icon} tone={tone} size={34} />
        <Txt v="h3" style={{ flex: 1 }}>{title}</Txt>
      </Row>
      {children}
    </Card>
  )
}

function Line({ label, value, kind, tone, first }: { label: string; value: number; kind?: Kind; tone?: 'red' | 'green'; first?: boolean }) {
  const { c } = useTheme()
  const { lang } = useI18n()
  const strong = kind === 'total' || kind === 'grand'
  const grand = kind === 'grand'
  const color = tone === 'red' ? c.red : tone === 'green' ? c.green : c.text
  return (
    <Row
      gap={10}
      style={{
        paddingHorizontal: 14,
        paddingVertical: grand ? 14 : 11,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: c.borderStrong,
        backgroundColor: grand ? c.primarySoft : strong ? c.surface2 : undefined,
      }}
    >
      <Row gap={4} center={false} style={{ flex: 1, minWidth: 0 }}>
        {kind === 'sub' && <Txt v="small" muted>−</Txt>}
        {kind === 'add' && <Txt v="small" color={c.faint}>+</Txt>}
        <Txt v={grand ? 'body' : 'small'} weight={strong ? 'bold' : undefined} soft={!strong} style={{ flex: 1 }}>{label}</Txt>
      </Row>
      <Num size={grand ? 17 : 14} weight={strong ? 'extrabold' : 'semibold'} color={color} numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: '55%' }}>
        {fmtMoney(value, lang)}
      </Num>
    </Row>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -60, opacity: 0.16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  lockPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.22)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, maxWidth: '50%' },
  heroStats: { marginTop: 16, marginHorizontal: -8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(236,255,240,0.18)' },
})
