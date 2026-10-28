import { Boxes, FileBarChart, History, Receipt, ShieldCheck, Truck, Wallet } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { View } from 'react-native'
import { AuditTrail } from '@/components/audit/AuditTrail'
import { ExpensesList } from '@/components/audit/ExpensesList'
import { PeriodBar, type PeriodMode } from '@/components/audit/PeriodBar'
import { PurchaseRegister } from '@/components/audit/PurchaseRegister'
import { SalesRegister } from '@/components/audit/SalesRegister'
import { StockRegister } from '@/components/audit/StockRegister'
import { YearSummary } from '@/components/audit/YearSummary'
import { taxYearOf, taxYearRange } from '@/components/audit/shared'
import { Chip, Empty, HScroll, IconTile, Screen, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

type Tab = 'summary' | 'sales' | 'purchases' | 'stock' | 'expenses' | 'trail'

/** Year-end audit: FBR tax-year report, registers, audit trail and the year lock (owner / admin only) */
export default function Audit() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today, isAdmin, refresh } = useOrg()
  const currentTy = taxYearOf(today)
  const firstTy = Math.min(taxYearOf(org.created_at.slice(0, 10)) - 1, currentTy - 1)
  const [mode, setMode] = useState<PeriodMode>('year')
  const [ty, setTy] = useState(currentTy)
  const [customFrom, setCustomFrom] = useState(() => taxYearRange(currentTy)[0])
  const [customTo, setCustomTo] = useState(today)
  const [tab, setTab] = useState<Tab>('summary')
  const [from, to] = mode === 'custom' ? [customFrom, customTo] : taxYearRange(ty)
  const period = mode === 'custom'
    ? `${fmtDate(from, lang)} – ${fmtDate(to, lang)}`
    : `${t('taxYear', { n: ty })} (${fmtDate(from, lang)} – ${fmtDate(to, lang)})`

  const tabs = useMemo(
    () => [
      { value: 'summary' as const, label: t('yearReport'), Icon: FileBarChart },
      { value: 'sales' as const, label: t('salesRegister'), Icon: Receipt },
      { value: 'purchases' as const, label: t('purchaseRegister'), Icon: Truck },
      { value: 'stock' as const, label: t('stockRegister'), Icon: Boxes },
      { value: 'expenses' as const, label: t('expensesList'), Icon: Wallet },
      { value: 'trail' as const, label: t('auditTrail'), Icon: History },
    ],
    [t],
  )

  if (!isAdmin) {
    return (
      <Screen back title={t('navAudit')}>
        <Empty icon={<ShieldCheck size={30} color={c.muted} />}>{t('auditAdminOnly')}</Empty>
      </Screen>
    )
  }

  const props = { from, to, period }
  return (
    <Screen
      back
      title={t('auditTitle')}
      right={<IconTile icon={<ShieldCheck size={20} color={c.primary} />} tone="primary" size={42} />}
      refreshing={false}
      onRefresh={refresh}
    >
      <Txt v="small" muted style={{ marginBottom: 12 }}>{t('auditSubtitle')}</Txt>
      <PeriodBar
        mode={mode}
        setMode={setMode}
        ty={ty}
        setTy={setTy}
        currentTy={currentTy}
        firstTy={firstTy}
        from={from}
        to={to}
        customFrom={customFrom}
        customTo={customTo}
        setCustomFrom={setCustomFrom}
        setCustomTo={setCustomTo}
        today={today}
      />
      <View style={{ marginTop: 14 }}>
        <HScroll gap={8}>
          {tabs.map(({ value, label, Icon }) => (
            <Chip
              key={value}
              label={label}
              active={tab === value}
              icon={<Icon size={15} color={tab === value ? c.primaryText : c.muted} />}
              onPress={() => setTab(value)}
            />
          ))}
        </HScroll>
      </View>

      {tab === 'summary' && <YearSummary {...props} isTaxYear={mode === 'year'} />}
      {tab === 'sales' && <SalesRegister {...props} />}
      {tab === 'purchases' && <PurchaseRegister {...props} />}
      {tab === 'stock' && <StockRegister {...props} />}
      {tab === 'expenses' && <ExpensesList {...props} />}
      {tab === 'trail' && <AuditTrail {...props} />}
    </Screen>
  )
}
