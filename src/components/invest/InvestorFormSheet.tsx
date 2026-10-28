import { useState } from 'react'
import { View } from 'react-native'
import { AccountPicker, useHasAccounts } from '@/components/money'
import { Button, ErrorBox, Field, Input, NumInput, PressScale, Row, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useI18n } from '@/lib/i18n'
import type { InvestorRow } from '@/lib/investors'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { useInvErr } from './common'

const SHARES = [25, 40, 50, 60]

/** Add / edit an investor (a new one can bring his first capital) */
export function InvestorFormSheet({ open, investor, onClose, onSaved }: { open: boolean; investor?: InvestorRow; onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const { toast } = useFeedback()
  const errOf = useInvErr()
  const hasAccounts = useHasAccounts()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [share, setShare] = useState('50')
  const [note, setNote] = useState('')
  const [capital, setCapital] = useState('')
  const [account, setAccount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [last, setLast] = useState<boolean | null>(null)
  if (open !== last) {
    setLast(open)
    if (open) {
      setName(investor?.name ?? '')
      setPhone(investor?.phone ?? '')
      setShare(String(investor?.profit_share ?? 50))
      setNote(investor?.note ?? '')
      setCapital('')
      setAccount('')
      setErr('')
    }
  }

  const save = async () => {
    setErr('')
    const pct = Number(share)
    if (!name.trim()) return setErr(t('invName'))
    if (share.trim() === '' || !(pct >= 0 && pct <= 100)) return setErr(t('invShareHint'))
    setBusy(true)
    const row = { name: name.trim(), phone: phone.trim() || null, profit_share: pct, note: note.trim() || null }
    const res = investor
      ? await supabase.from('investors').update(row).eq('id', investor.id).select('id').single()
      : await supabase.from('investors').insert({ ...row, org_id: org.id }).select('id').single()
    if (res.error) {
      setBusy(false)
      return setErr(errOf(res.error))
    }
    const id = res.data.id as string
    if (!investor && Number(capital) > 0) {
      const { error } = await supabase.rpc('investor_deposit', { p_org: org.id, p_investor: id, p_date: today, p_amount: Number(capital), p_account: account || null, p_note: null })
      if (error) {
        setBusy(false)
        toast(errOf(error), 'err')
        return onSaved(id)
      }
    }
    setBusy(false)
    toast(t('saved'))
    onSaved(id)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={investor ? t('invEdit') : t('invAdd')}
      footer={<Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" />}
    >
      <View style={{ gap: 14 }}>
        <Field label={t('invName')}>
          <Input value={name} onChangeText={setName} autoFocus={!investor} autoCapitalize="words" />
        </Field>
        <Field label={t('phone')} optional>
          <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" inputMode="tel" />
        </Field>
        <Field label={t('invShare')} hint={t('invShareHint')}>
          <NumInput value={share} onChangeText={setShare} suffix={<Txt weight="bold" muted>%</Txt>} />
          <Row gap={8}>
            {SHARES.map((n) => {
              const on = Number(share) === n && share.trim() !== ''
              return (
                <PressScale key={n} onPress={() => setShare(String(n))} style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: on ? c.primary : c.primarySoft }}>
                  <Txt v="small" weight="bold" color={on ? c.primaryText : c.primary}>{n}%</Txt>
                </PressScale>
              )
            })}
          </Row>
        </Field>
        {!investor && (
          <>
            <Field label={t('invFirstCapital')} optional>
              <NumInput value={capital} onChangeText={setCapital} />
            </Field>
            {hasAccounts && Number(capital) > 0 && (
              <Field label={t('accountLabel')}>
                <AccountPicker value={account} onChange={setAccount} />
              </Field>
            )}
          </>
        )}
        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {!!err && <ErrorBox>{err}</ErrorBox>}
      </View>
    </Sheet>
  )
}
