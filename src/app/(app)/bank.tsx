import { useLocalSearchParams } from 'expo-router'
import { Banknote, Landmark, ReceiptText } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { AccountsTab } from '@/components/bank/AccountsTab'
import { ChequesTab } from '@/components/bank/ChequesTab'
import { FacilitiesTab } from '@/components/bank/FacilitiesTab'
import { Screen, Segmented } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

type Tab = 'accounts' | 'cheques' | 'finance'
const asTab = (p?: string): Tab => (p === 'cheques' || p === 'finance' ? p : 'accounts')

/** Bank accounts and wallets, cheques, bank finance and guarantees */
export default function Bank() {
  const { t } = useI18n()
  const { c } = useTheme()
  const { refresh } = useOrg()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(() => asTab(params.tab))
  const [lastParam, setLastParam] = useState(params.tab)
  const [pulling, setPulling] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // opening /bank?tab=... again (e.g. from a dashboard tile) switches the tab
  if (params.tab !== lastParam) {
    setLastParam(params.tab)
    setTab(asTab(params.tab))
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const onRefresh = () => {
    setPulling(true)
    refresh()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setPulling(false), 700)
  }

  const tint = (v: Tab) => (tab === v ? c.primary : c.muted)

  return (
    <Screen back title={t('bankTitle')} subtitle={t('bankSubtitle')} refreshing={pulling} onRefresh={onRefresh}>
      <Segmented
        value={tab}
        onChange={setTab}
        items={[
          { value: 'accounts', label: t('bankTabAccounts'), icon: <Landmark size={15} color={tint('accounts')} /> },
          { value: 'cheques', label: t('bankTabCheques'), icon: <ReceiptText size={15} color={tint('cheques')} /> },
          { value: 'finance', label: t('mBankTabFinance'), icon: <Banknote size={15} color={tint('finance')} /> },
        ]}
      />
      <View style={{ marginTop: 16 }}>
        {tab === 'accounts' ? <AccountsTab onTab={setTab} /> : tab === 'cheques' ? <ChequesTab /> : <FacilitiesTab />}
      </View>
    </Screen>
  )
}
