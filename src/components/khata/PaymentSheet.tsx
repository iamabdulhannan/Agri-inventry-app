import { router, type Href } from 'expo-router'
import { Banknote, Check, Landmark, Wallet } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { Note, Pair } from '@/components/bank/shared'
import { AccountPicker, accountIcon } from '@/components/money'
import { Button, DateField, ErrorBox, Field, Input, NumInput, PressScale, Row, Segmented, Select, Sheet, Txt } from '@/components/ui'
import { useAccounts } from '@/lib/accounts'
import { useOrg } from '@/lib/app'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { radius, useTheme } from '@/lib/theme'
import type { PartyBalance } from '@/lib/types'

type Mode = 'money' | 'cheque'

/** Receive from a customer / pay a supplier: cash, bank / wallet, or a cheque (khata changes when it clears) */
export function PaymentSheet({ open, onClose, party, onSaved }: { open: boolean; onClose: () => void; party: PartyBalance; onSaved: (message: string) => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const { data: accounts } = useAccounts()
  const banks = (accounts ?? []).filter((a) => a.is_active)
  const [mode, setMode] = useState<Mode>('money')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [account, setAccount] = useState('')
  const [chequeNo, setChequeNo] = useState('')
  const [bank, setBank] = useState('')
  const [chequeDate, setChequeDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [last, setLast] = useState(false)
  if (open !== last) {
    setLast(open)
    if (open) {
      setMode('money')
      setAmount(party.balance > 0 ? String(party.balance) : '')
      setDate(today)
      setNote('')
      setAccount('')
      setChequeNo('')
      setBank('')
      setChequeDate(today)
      setError('')
    }
  }
  const isCustomer = party.kind === 'customer'
  // a cheque we give is drawn on one of our bank accounts
  const chequeAccount = mode === 'cheque' && !isCustomer && !account && banks[0] ? banks[0].id : account
  const switchMode = (m: Mode) => {
    setMode(m)
    setAccount('')
    setError('')
  }

  const save = async () => {
    setError('')
    const n = Number(amount)
    if (!(n > 0)) return setError(t('errInvalidAmount'))
    if (mode === 'money') {
      setBusy(true)
      // p_account only when an account is chosen (the 5-argument function before migration 013 has none)
      const { error } = await supabase.rpc('record_party_payment', {
        p_org: org.id, p_party: party.id, p_date: date, p_amount: n, p_note: note || null, ...(account ? { p_account: account } : {}),
      })
      setBusy(false)
      if (error) return setError(errText(error, t))
      return onSaved(t('paymentSaved'))
    }
    if (!isCustomer && !chequeAccount) return setError(t('khChequeNeedsBank'))
    setBusy(true)
    const { error } = await supabase.rpc('record_cheque', {
      p_org: org.id,
      p_direction: isCustomer ? 'received' : 'issued',
      p_party: party.id,
      p_amount: n,
      p_cheque_date: chequeDate,
      p_cheque_no: chequeNo || null,
      p_bank_name: bank || null,
      p_received_on: date,
      p_account: chequeAccount || null,
      p_note: note || null,
    })
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved(t('khChequeSaved'))
  }

  const depositOptions = [
    { value: '', label: t('khDecideLater') },
    ...banks.map((a) => {
      const Icon = accountIcon(a.kind)
      return { value: a.id, label: a.name, sub: a.account_no ?? undefined, icon: <Icon size={18} color={c.blue} /> }
    }),
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isCustomer ? t('receivePayment') : t('paySupplier')}
      subtitle={`${party.name} · ${t('balance')}: ${fmtMoney(party.balance, lang)}`}
      footer={<Button title={t('save')} icon={<Check size={18} color={c.primaryText} />} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" />}
    >
      <View collapsable={false} style={{ gap: 14 }}>
        <Segmented
          value={mode}
          onChange={switchMode}
          items={[
            { value: 'money', label: t('khCashBank'), icon: <Wallet size={15} color={mode === 'money' ? c.primary : c.muted} /> },
            { value: 'cheque', label: t('khCheque'), icon: <Banknote size={15} color={mode === 'cheque' ? c.primary : c.muted} /> },
          ]}
        />
        <Field label={t('amount')}>
          <NumInput value={amount} onChangeText={setAmount} big placeholder="0" autoFocus />
        </Field>
        {party.balance > 0 && (
          <Row gap={8}>
            {[0.25, 0.5, 1].map((f) => (
              <PressScale key={f} onPress={() => setAmount(String(Math.round(party.balance * f)))} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: c.primarySoft }}>
                <Txt v="small" weight="bold" color={c.primary}>{f === 1 ? t('all') : `${f * 100}%`}</Txt>
              </PressScale>
            ))}
          </Row>
        )}

        {mode === 'money' ? (
          <>
            {banks.length > 0 && (
              <Field label={isCustomer ? t('khReceivedIn') : t('khPaidFrom')}>
                <AccountPicker value={account} onChange={setAccount} title={isCustomer ? t('khReceivedIn') : t('khPaidFrom')} />
              </Field>
            )}
            <Field label={t('date')}>
              <DateField value={date} onChange={setDate} max={today} label={t('date')} />
            </Field>
          </>
        ) : (
          <>
            <Pair>
              <Field label={t('khChequeNo')} optional>
                <Input value={chequeNo} onChangeText={setChequeNo} keyboardType="number-pad" placeholder="445566" />
              </Field>
              <Field label={t('khChequeBank')} optional>
                <Input value={bank} onChangeText={setBank} placeholder="MCB, HBL…" />
              </Field>
            </Pair>
            <Pair>
              <Field label={t('khChequeDate')} hint={chequeDate > today ? t('khPostDated') : undefined}>
                <DateField value={chequeDate} onChange={setChequeDate} label={t('khChequeDate')} />
              </Field>
              <Field label={isCustomer ? t('khReceivedOn') : t('khGivenOn')}>
                <DateField value={date} onChange={setDate} max={today} label={isCustomer ? t('khReceivedOn') : t('khGivenOn')} />
              </Field>
            </Pair>
            {isCustomer ? (
              banks.length > 0 && (
                <Field label={t('khDepositInto')} optional>
                  <Select value={account} onChange={setAccount} options={depositOptions} title={t('khDepositInto')} />
                </Field>
              )
            ) : banks.length > 0 ? (
              <Field label={`${t('khDrawnOn')} *`}>
                <AccountPicker value={chequeAccount} onChange={setAccount} cash={false} title={t('khDrawnOn')} />
              </Field>
            ) : (
              <View style={{ gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.redSoft }}>
                <Txt v="small" weight="semibold" color={c.red}>{t('khChequeNeedsBank')}</Txt>
                <Button
                  size="sm"
                  variant="secondary"
                  title={t('khOpenBank')}
                  icon={<Landmark size={15} color={c.text} />}
                  onPress={() => { onClose(); router.push('/bank' as Href) }}
                  style={{ alignSelf: 'flex-start' }}
                />
              </View>
            )}
            <Note tone="blue">{t('khChequeExplain')}</Note>
          </>
        )}

        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {mode === 'money' && Number(amount) > 0 && (
          <Txt v="small" muted>{t('newBalance')}: <Txt v="small" weight="extrabold">{fmtMoney(party.balance - Number(amount), lang)}</Txt></Txt>
        )}
        {!!error && <ErrorBox>{error}</ErrorBox>}
      </View>
    </Sheet>
  )
}
