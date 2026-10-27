import { Landmark, Smartphone, Wallet } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useAccounts, type MoneyAccount } from '@/lib/accounts'
import { useI18n } from '@/lib/i18n'
import { fmtMoney, fmtMoneyShort } from '@/lib/money'
import { useTheme } from '@/lib/theme'
import { Num, Select, Txt } from './ui'

export const accountIcon = (kind: 'cash' | 'bank' | 'wallet') => (kind === 'bank' ? Landmark : kind === 'wallet' ? Smartphone : Wallet)

export const accountLabel = (a: Pick<MoneyAccount, 'name' | 'bank_name'>) =>
  `${a.name}${a.bank_name && a.bank_name !== a.name ? ` · ${a.bank_name}` : ''}`

/**
 * Where money goes into / comes out of: Cash in hand ('') or a bank account / wallet (its id).
 * Renders nothing when the shop has no accounts (cash only) unless `always` is set.
 */
export function AccountPicker({ value, onChange, cash = true, always, title }: { value: string; onChange: (id: string) => void; cash?: boolean; always?: boolean; title?: string }) {
  const { t } = useI18n()
  const { c } = useTheme()
  const { data: accounts } = useAccounts()
  const list = (accounts ?? []).filter((a) => a.is_active || a.id === value)
  if (!always && list.length === 0) return null
  const options = [
    ...(cash ? [{ value: '', label: t('cashInHandOpt'), icon: <Wallet size={18} color={c.primary} /> }] : []),
    ...list.map((a) => {
      const Icon = accountIcon(a.kind)
      return { value: a.id, label: accountLabel(a), sub: a.account_no ?? undefined, icon: <Icon size={18} color={c.blue} /> }
    }),
  ]
  return <Select title={title ?? t('accountLabel')} value={value} onChange={onChange} options={options} placeholder={t('accountLabel')} />
}

/** True when the shop has at least one active bank account / wallet */
export function useHasAccounts() {
  const { data } = useAccounts()
  return (data ?? []).some((a) => a.is_active)
}

/**
 * Big money figure in the short Crore/Lakh form (e.g. "Rs 1.14 Cr"), tap to see the exact amount.
 * Small amounts are shown in full.
 */
export function MoneyValue({ amount, size = 20, color }: { amount: number; size?: number; color?: string }) {
  const { lang } = useI18n()
  const { c } = useTheme()
  const [full, setFull] = useState(false)
  const short = fmtMoneyShort(amount, lang)
  if (!short) return <Num size={size} weight="extrabold" color={color} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(amount, lang)}</Num>
  return (
    <Pressable onPress={() => setFull((f) => !f)} hitSlop={6}>
      {full ? (
        <Num size={size} weight="extrabold" color={color} numberOfLines={1} adjustsFontSizeToFit>{fmtMoney(amount, lang)}</Num>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Num size={size} weight="extrabold" color={color} numberOfLines={1} adjustsFontSizeToFit>{short.main}</Num>
          {!!short.alt && <Txt v="tiny" color={c.muted}>{short.alt}</Txt>}
        </View>
      )}
    </Pressable>
  )
}
