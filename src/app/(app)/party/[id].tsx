import { router, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { HandCoins, MessageCircle, Pencil, Phone, ScanBarcode, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { PartyAvatar } from '@/components/domain'
import { PartyFormSheet } from '@/components/forms'
import { Badge, Button, CalendarSheet, Card, Empty, ErrorBox, Field, IconBtn, Input, Loading, NumInput, PressScale, Rise, Row, Screen, SectionTitle, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme, type Tone } from '@/lib/theme'
import type { LedgerRow, PartyBalance } from '@/lib/types'

export default function PartyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version, refresh, isAdmin } = useOrg()
  const { toast, confirm } = useFeedback()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)

  const { data, error, loading, reload } = useLoad(async () => {
    const [p, ledger] = await Promise.all([
      supabase.from('party_balances').select('*').eq('id', id).single(),
      supabase.rpc('party_ledger', { p_party: id }),
    ])
    if (p.error) throw p.error
    if (ledger.error) throw ledger.error
    return { party: { ...(p.data as PartyBalance), balance: Number(p.data.balance) }, ledger: (ledger.data ?? []) as LedgerRow[] }
  }, [id, version, org.id])

  if (loading && !data) return <Screen back><Loading /></Screen>
  if (error && !data) return <Screen back><ErrorBox error={error} onRetry={reload} /></Screen>
  if (!data) return null
  const { party, ledger } = data
  const isCustomer = party.kind === 'customer'
  const owes = party.balance > 0.005
  const phoneDigits = (party.phone ?? '').replace(/\D/g, '')
  const waNumber = phoneDigits.startsWith('0') ? `92${phoneDigits.slice(1)}` : phoneDigits

  const remove = async () => {
    if (!(await confirm(t('deletePartyConfirm')))) return
    const { error } = await supabase.from('parties').delete().eq('id', party.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('deleted'))
    refresh()
    router.back()
  }
  const remind = () => {
    const msg = `${org.name}: ${party.name}, ${t('balance')} ${fmtMoney(party.balance, lang)}`
    Linking.openURL(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`).catch(() => {})
  }

  const grad: readonly [string, string] = owes ? (isCustomer ? ['#7C4A03', '#B45309'] : ['#7F1D1D', '#B91C1C']) : [c.hero[0], c.hero[1]]

  return (
    <Screen
      back
      title={party.name}
      subtitle={isCustomer ? t('customers') : t('suppliers')}
      right={<IconBtn icon={<Pencil size={18} color={c.text} />} onPress={() => setEditing(true)} label={t('edit')} />}
      refreshing={loading}
      onRefresh={reload}
    >
      <Rise>
        <View style={{ borderRadius: 28, overflow: 'hidden' }}>
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
            <View style={[styles.blob, { backgroundColor: '#fff' }]} />
            <Row gap={12}>
              <PartyAvatar name={party.name} kind={party.kind} size={52} />
              <View style={{ flex: 1 }}>
                <Txt v="label" color="rgba(255,255,255,0.7)">{t('balance')}</Txt>
                <Txt v="display" color="#fff" style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(Math.abs(party.balance), lang)}</Txt>
              </View>
            </Row>
            <Txt v="small" weight="bold" color="rgba(255,255,255,0.85)" style={{ marginTop: 8 }}>
              {Math.abs(party.balance) < 0.005 ? t('settled') : party.balance < 0 ? t('advance') : isCustomer ? t('theyOwe') : t('youOwe')}
            </Txt>
            {(party.phone || party.address) && (
              <Txt v="tiny" color="rgba(255,255,255,0.7)" style={{ marginTop: 4 }}>{[party.phone, party.address].filter(Boolean).join(' · ')}</Txt>
            )}
          </LinearGradient>
        </View>
      </Rise>

      <Rise i={1}>
        <Row gap={10} style={{ marginTop: 14 }}>
          <Button title={isCustomer ? t('receivePayment') : t('paySupplier')} icon={<HandCoins size={18} color={c.primaryText} />} onPress={() => setPaying(true)} style={{ flex: 1.4 }} />
          {isCustomer && <Button variant="secondary" title={t('newSale')} icon={<ScanBarcode size={18} color={c.text} />} onPress={() => router.push({ pathname: '/sale', params: { party: party.id } })} style={{ flex: 1 }} />}
        </Row>
        {!!phoneDigits && (
          <Row gap={10} style={{ marginTop: 10 }}>
            <Button variant="secondary" size="sm" title={t('call')} icon={<Phone size={16} color={c.text} />} onPress={() => Linking.openURL(`tel:${phoneDigits}`)} style={{ flex: 1 }} />
            <Button variant="secondary" size="sm" title={t('whatsapp')} icon={<MessageCircle size={16} color={c.green} />} onPress={remind} style={{ flex: 1 }} />
          </Row>
        )}
      </Rise>

      <Rise i={2}>
        <SectionTitle>{t('ledger_')}</SectionTitle>
        {ledger.length === 0 ? <Card><Empty>{t('noEntries')}</Empty></Card> : (
          <Card padded={false} style={{ paddingHorizontal: 14 }}>
            {[...ledger].reverse().map((r, i) => {
              const tone: Tone = r.kind === 'receipt' || r.kind === 'payment' || r.kind === 'return' ? 'green' : r.kind === 'opening' ? 'stone' : isCustomer ? 'amber' : 'red'
              const tappable = r.kind === 'sale' && !!r.doc_id
              return (
                <Pressable key={i} disabled={!tappable} onPress={() => router.push(`/receipt/${r.doc_id}`)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Row gap={6}>
                      <Badge tone={tone}>{t(`lk_${r.kind}`)}</Badge>
                      {!!r.ref && <Txt v="tiny" muted>{r.ref}</Txt>}
                    </Row>
                    <Txt v="tiny" muted>{fmtDate(r.entry_date, lang)}{r.note ? ` · ${r.note}` : ''}</Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    {Number(r.bill) ? <Txt v="small" weight="bold">+ {fmtMoney(r.bill, lang)}</Txt> : null}
                    {Number(r.paid) ? <Txt v="small" weight="bold" color={c.green}>− {fmtMoney(r.paid, lang)}</Txt> : null}
                    <Txt v="tiny" muted>{t('balance')}: {fmtMoney(r.balance, lang)}</Txt>
                  </View>
                </Pressable>
              )
            })}
          </Card>
        )}
      </Rise>

      {isAdmin && ledger.length === 0 && (
        <Button variant="secondary" title={t('delete')} color={c.red} icon={<Trash2 size={17} color={c.red} />} onPress={remove} style={{ marginTop: 16 }} />
      )}

      <PartyFormSheet open={editing} onClose={() => setEditing(false)} kind={party.kind} party={party} onSaved={() => { setEditing(false); toast(t('partySaved')); refresh() }} />
      <PaymentSheet open={paying} onClose={() => setPaying(false)} party={party} onSaved={() => { setPaying(false); toast(t('paymentSaved')); refresh() }} />
    </Screen>
  )
}

function PaymentSheet({ open, onClose, party, onSaved }: { open: boolean; onClose: () => void; party: PartyBalance; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [dateOpen, setDateOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [last, setLast] = useState(false)
  if (open !== last) {
    setLast(open)
    if (open) {
      setAmount(party.balance > 0 ? String(party.balance) : '')
      setDate(today)
      setNote('')
      setError('')
    }
  }
  const isCustomer = party.kind === 'customer'
  const save = async () => {
    setError('')
    if (!(Number(amount) > 0)) return setError(t('errInvalidAmount'))
    setBusy(true)
    const { error } = await supabase.rpc('record_party_payment', { p_org: org.id, p_party: party.id, p_date: date, p_amount: Number(amount), p_note: note || null })
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved()
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isCustomer ? t('receivePayment') : t('paySupplier')}
      subtitle={`${party.name} · ${t('balance')}: ${fmtMoney(party.balance, lang)}`}
      footer={<Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" />}
    >
      <View style={{ gap: 14 }}>
        <Field label={t('amount')}>
          <NumInput value={amount} onChangeText={setAmount} big autoFocus />
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
        <Field label={t('date')}>
          <PressScale onPress={() => setDateOpen(true)} style={{ padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border }}>
            <Txt weight="semibold">{fmtDate(date, lang)}</Txt>
          </PressScale>
        </Field>
        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {Number(amount) > 0 && <Txt v="small" muted>{t('newBalance')}: <Txt v="small" weight="extrabold">{fmtMoney(party.balance - Number(amount), lang)}</Txt></Txt>}
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </View>
      <CalendarSheet open={dateOpen} onClose={() => setDateOpen(false)} value={date} onPick={setDate} max={today} />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -60, opacity: 0.1 },
})
