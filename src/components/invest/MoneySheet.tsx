import { Wallet } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { AccountPicker, useHasAccounts } from '@/components/money'
import { Button, DateField, ErrorBox, Field, Input, NumInput, PressScale, Row, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useI18n } from '@/lib/i18n'
import type { InvestorRow } from '@/lib/investors'
import { fmtMoney, r2 } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { Note, useInvErr } from './common'

/** Add capital / withdraw part of the profit */
export function MoneySheet({ kind, open, investor, onClose, onDone }: { kind: 'capital' | 'withdraw'; open: boolean; investor: InvestorRow; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const { toast } = useFeedback()
  const errOf = useInvErr()
  const hasAccounts = useHasAccounts()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // withdrawing pays money out: the first tap shows a summary, the second one saves
  // (a confirm dialog can't open on top of this sheet on iOS)
  const [sure, setSure] = useState(false)
  const [last, setLast] = useState<boolean | null>(null)
  const max = r2(investor.profit_now)
  if (open !== last) {
    setLast(open)
    if (open) {
      setAmount(kind === 'withdraw' && max > 0 ? String(max) : '')
      setDate(today)
      setAccount('')
      setNote('')
      setErr('')
      setSure(false)
    }
  }
  const changeAmount = (v: string) => {
    setAmount(v)
    setSure(false)
  }

  const save = async () => {
    setErr('')
    const n = Number(amount)
    if (!(n > 0)) return setErr(t('errInvalidAmount'))
    if (kind === 'withdraw' && n > max + 0.005) return setErr(t('errInvestorNoProfit'))
    if (kind === 'withdraw' && !sure) return setSure(true)
    setBusy(true)
    const { error } = kind === 'capital'
      ? await supabase.rpc('investor_deposit', { p_org: org.id, p_investor: investor.id, p_date: date, p_amount: n, p_account: account || null, p_note: note || null })
      : await supabase.rpc('settle_investor', { p_org: org.id, p_investor: investor.id, p_mode: 'withdraw_some', p_date: date, p_account: account || null, p_amount: n, p_note: note || null })
    setBusy(false)
    if (error) return setErr(errOf(error))
    toast(t('saved'))
    onDone()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={kind === 'capital' ? t('invAddCapital') : t('invWithdrawProfit')}
      subtitle={investor.name}
      footer={<Button title={sure ? t('confirm') : t('save')} variant={sure ? 'warning' : 'primary'} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" />}
    >
      <View style={{ gap: 14 }}>
        {kind === 'withdraw' && (
          <Note tone="green" icon={<Wallet size={18} color={c.green} />} title={t('invProfitAvailable', { amount: fmtMoney(max, lang) })}>
            {t('invWithdrawHint')}
          </Note>
        )}
        <Field label={t('amount')}>
          <NumInput value={amount} onChangeText={changeAmount} big autoFocus={kind === 'capital'} />
        </Field>
        {kind === 'withdraw' && max > 0 && (
          <Row gap={8}>
            {[0.25, 0.5, 1].map((f) => (
              <PressScale key={f} onPress={() => changeAmount(String(f === 1 ? max : Math.floor(max * f)))} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: c.primarySoft }}>
                <Txt v="small" weight="bold" color={c.primary}>{f === 1 ? t('all') : `${f * 100}%`}</Txt>
              </PressScale>
            ))}
          </Row>
        )}
        <Field label={t('date')}>
          <DateField value={date} onChange={setDate} max={today} />
        </Field>
        {hasAccounts && (
          <Field label={kind === 'capital' ? t('accountLabel') : t('invPayFrom')}>
            <AccountPicker value={account} onChange={setAccount} title={kind === 'capital' ? t('accountLabel') : t('invPayFrom')} />
          </Field>
        )}
        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {sure && (
          <Note tone="amber" icon={<Wallet size={18} color={c.amber} />} title={`${t('invWithdrawProfit')}: ${fmtMoney(Number(amount), lang)} · ${investor.name}?`} />
        )}
        {!!err && <ErrorBox>{err}</ErrorBox>}
      </View>
    </Sheet>
  )
}
