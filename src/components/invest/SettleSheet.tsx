import { CheckCircle2, Circle, Lock, Scale } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { AccountPicker, useHasAccounts } from '@/components/money'
import { Button, DateField, ErrorBox, Field, Num, Row, Sheet, Txt, haptic, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useI18n } from '@/lib/i18n'
import type { InvestorRow } from '@/lib/investors'
import { fmtMoney, r2 } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { fmtNum } from '@/lib/units'
import { Note, useInvErr } from './common'

type Mode = 'reinvest_all' | 'withdraw_profit' | 'withdraw_all'

/** One-go settlement: reinvest everything / take profit, keep capital / withdraw everything */
export function SettleSheet({ open, investor, onClose, onDone }: { open: boolean; investor: InvestorRow; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const { toast } = useFeedback()
  const errOf = useInvErr()
  const hasAccounts = useHasAccounts()
  const [mode, setMode] = useState<Mode>('withdraw_profit')
  const [date, setDate] = useState(today)
  const [account, setAccount] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // first tap shows what will happen, second one settles (no dialog on top of a sheet)
  const [sure, setSure] = useState(false)
  const [last, setLast] = useState<boolean | null>(null)
  if (open !== last) {
    setLast(open)
    if (open) {
      setMode('withdraw_profit')
      setDate(today)
      setAccount('')
      setErr('')
      setSure(false)
    }
  }
  const m = (v: number) => fmtMoney(v, lang)
  const P = r2(investor.profit_now)
  const C = r2(investor.capital)
  const unsold = investor.units_left > 0.000001

  const options: { mode: Mode; title: string; text: string; pays: number; after: number }[] = [
    { mode: 'reinvest_all', title: t('invOptReinvest'), text: t('invOptReinvestText', { amount: m(C + P) }), pays: 0, after: C + P },
    {
      mode: 'withdraw_profit',
      title: t('invOptProfit'),
      text: P >= 0 ? t('invOptProfitText', { profit: m(P), capital: m(C) }) : t('invOptLossText', { loss: m(-P), capital: m(C + P) }),
      pays: Math.max(P, 0),
      after: P >= 0 ? C : C + P,
    },
    { mode: 'withdraw_all', title: t('invOptAll'), text: t('invOptAllText', { amount: m(Math.max(C + P, 0)) }), pays: Math.max(C + P, 0), after: 0 },
  ]
  const chosen = options.find((o) => o.mode === mode)!

  const pickMode = (v: Mode) => {
    haptic.tap()
    setMode(v)
    setSure(false)
  }

  const save = async () => {
    setErr('')
    if (!sure) return setSure(true)
    setBusy(true)
    const { error } = await supabase.rpc('settle_investor', { p_org: org.id, p_investor: investor.id, p_mode: mode, p_date: date, p_account: account || null, p_amount: null, p_note: null })
    setBusy(false)
    if (error) return setErr(errOf(error))
    toast(t('invSettleDone'))
    onDone()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('invSettleTitle', { name: investor.name })}
      footer={
        <Button
          title={sure ? `${t('confirm')}: ${chosen.title}` : t('invSettle')}
          variant={sure ? 'warning' : 'primary'}
          icon={<Scale size={18} color={sure ? '#1A0F00' : c.primaryText} />}
          onPress={save}
          loading={busy}
          disabled={unsold}
          style={{ flex: 1 }}
          size="lg"
        />
      }
    >
      {unsold ? (
        <Note tone="amber" icon={<Lock size={18} color={c.amber} />}>{t('invSettleLocked', { n: fmtNum(investor.units_left, 3) })}</Note>
      ) : (
        <View style={{ gap: 14 }}>
          <Row gap={10}>
            <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
              <Txt v="tiny" muted numberOfLines={1}>{t('invCapital')}</Txt>
              <Num size={19} weight="extrabold" numberOfLines={1} adjustsFontSizeToFit>{m(C)}</Num>
            </View>
            <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: P < 0 ? c.redSoft : c.greenSoft, borderWidth: 1, borderColor: c.border }}>
              <Txt v="tiny" muted numberOfLines={1}>{t('invProfitSoFar')}</Txt>
              <Num size={19} weight="extrabold" color={P < 0 ? c.red : c.green} numberOfLines={1} adjustsFontSizeToFit>{m(P)}</Num>
            </View>
          </Row>
          <Txt v="small" soft>{t('invSettleIntro')}</Txt>
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {options.map((o) => {
              const on = o.mode === mode
              return (
                <Pressable
                  key={o.mode}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => pickMode(o.mode)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: on ? 2 : 1,
                    borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : pressed ? c.surface2 : c.surface,
                  })}
                >
                  {on ? <CheckCircle2 size={22} color={c.primary} /> : <Circle size={22} color={c.faint} />}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt weight="bold">{o.title}</Txt>
                    <Txt v="small" soft>{o.text}</Txt>
                    <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 2 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: o.pays > 0 ? c.orangeSoft : c.surface2 }}>
                        <Txt v="tiny" color={o.pays > 0 ? c.orange : c.muted}>{o.pays > 0 ? t('mInvPaysNow', { amount: m(o.pays) }) : t('mInvNothingPaid')}</Txt>
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: c.blueSoft }}>
                        <Txt v="tiny" color={c.blue}>{t('mInvAfterCapital', { amount: m(o.after) })}</Txt>
                      </View>
                    </Row>
                  </View>
                </Pressable>
              )
            })}
          </View>
          {chosen.pays > 0 && hasAccounts && (
            <Field label={t('invPayFrom')}>
              <AccountPicker value={account} onChange={setAccount} title={t('invPayFrom')} />
            </Field>
          )}
          <Field label={t('date')}>
            <DateField value={date} onChange={setDate} max={today} />
          </Field>
          {sure && (
            <Note tone="amber" icon={<Scale size={18} color={c.amber} />} title={`${chosen.title}: ${investor.name}${chosen.pays ? ` · ${m(chosen.pays)}` : ''}?`} />
          )}
        </View>
      )}
      {!!err && <View style={{ marginTop: 12 }}><ErrorBox>{err}</ErrorBox></View>}
    </Sheet>
  )
}
