import { router, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { HandCoins, MessageCircle, Pencil, Phone, ScanBarcode, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, View } from 'react-native'
import { PartyAvatar } from '@/components/domain'
import { PartyFormSheet } from '@/components/forms'
import { DuesCard, useRemind } from '@/components/khata/DuesCard'
import { PartyAdvances } from '@/components/khata/PartyAdvances'
import { PaymentSheet } from '@/components/khata/PaymentSheet'
import { PendingCheques } from '@/components/khata/PendingCheques'
import { canWhatsApp, openWhatsApp } from '@/components/khata/whatsapp'
import { Badge, Button, Card, Empty, ErrorBox, IconBtn, Loading, Rise, Row, Screen, SectionTitle, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { ledgerLabel, loadAdvanceEntries, loadAdvances, loadDues, loadPendingCheques, type LedgerKind, type PartyWithRule } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme, type Tone } from '@/lib/theme'
import type { LedgerRow, PartyBalance } from '@/lib/types'

/** a part that needs migration 013: on error, show nothing instead of breaking the screen */
const optional = <T,>(p: Promise<T>, empty: T): Promise<T> => p.catch(() => empty)

export default function PartyDetail() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>()
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version, refresh, isAdmin } = useOrg()
  const { toast, confirm } = useFeedback()
  const remindDue = useRemind()
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)

  const { data, error, loading, reload } = useLoad(async () => {
    const [p, ledger, cheques, dues, advances] = await Promise.all([
      supabase.from('party_balances').select('*').eq('id', id).single(),
      supabase.rpc('party_ledger', { p_party: id }),
      optional(loadPendingCheques(id), []),
      optional(loadDues(org.id, id), null),
      optional(loadAdvances(org.id, id), null),
    ])
    if (p.error) throw p.error
    if (ledger.error) throw ledger.error
    const entries = await optional(loadAdvanceEntries((advances ?? []).map((a) => a.id)), [])
    return {
      party: { ...(p.data as PartyBalance & PartyWithRule), balance: Number(p.data.balance) },
      ledger: (ledger.data ?? []) as (Omit<LedgerRow, 'kind'> & { kind: LedgerKind })[],
      cheques, dues, advances, entries,
    }
  }, [id, version, org.id])

  if (loading && !data) return <Screen back><Loading /></Screen>
  if (error && !data) return <Screen back><ErrorBox error={error} onRetry={reload} /></Screen>
  if (!data) return null
  const { party, ledger, cheques, dues, advances, entries } = data
  const isCustomer = party.kind === 'customer'
  const owes = party.balance > 0.005
  const phoneDigits = (party.phone ?? '').replace(/\D/g, '')

  const remove = async () => {
    if (!(await confirm(t('deletePartyConfirm')))) return
    const { error } = await supabase.from('parties').delete().eq('id', party.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('deleted'))
    refresh()
    router.back()
  }
  // a customer who owes gets the payment reminder (with the earliest due date); otherwise just open the chat
  const remind = async () => {
    if (isCustomer && owes) {
      const due = (dues ?? []).map((d) => d.due_date).filter((d): d is string => !!d).sort()[0] ?? null
      return remindDue(party, party.balance, due)
    }
    if (!(await openWhatsApp(party.phone, ''))) toast(t('mKhWaFailed'), 'err')
  }
  const advancesCard = isCustomer && advances && (
    <PartyAdvances party={party} advances={advances} entries={entries} onChanged={refresh} />
  )

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
            {canWhatsApp(party.phone) && (
              <Button variant="secondary" size="sm" title={t('whatsapp')} icon={<MessageCircle size={16} color={c.green} />} onPress={remind} style={{ flex: 1 }} />
            )}
          </Row>
        )}
      </Rise>

      <PendingCheques cheques={cheques} balance={party.balance} />
      {isCustomer && dues && <DuesCard party={party} dues={dues} onChanged={refresh} />}
      {/* opened from the crop advances list: show them before the ledger */}
      {focus === 'advances' && advancesCard}

      <Rise i={2}>
        <View style={{ marginTop: 14 }}><SectionTitle>{t('ledger_')}</SectionTitle></View>
        {ledger.length === 0 ? <Card><Empty>{t('noEntries')}</Empty></Card> : (
          <Card padded={false} style={{ paddingHorizontal: 14 }}>
            {[...ledger].reverse().map((r, i) => {
              const tone: Tone = r.kind === 'bank_paid' || r.kind === 'advance_moved' ? 'blue' : r.kind === 'receipt' || r.kind === 'payment' || r.kind === 'return' ? 'green' : r.kind === 'opening' ? 'stone' : isCustomer ? 'amber' : 'red'
              const tappable = r.kind === 'sale' && !!r.doc_id
              return (
                <Pressable key={i} disabled={!tappable} onPress={() => router.push(`/receipt/${r.doc_id}`)} style={{ flexDirection: 'row', gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Row gap={6}>
                      <Badge tone={tone}>{ledgerLabel(r.kind, t)}</Badge>
                      {r.ref === 'CHQ' ? <Badge tone="orange">{t('khCheque')}</Badge> : !!r.ref && <Txt v="tiny" muted>{r.ref}</Txt>}
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

      {focus !== 'advances' && advancesCard}

      {isAdmin && ledger.length === 0 && (
        <Button variant="secondary" title={t('delete')} color={c.red} icon={<Trash2 size={17} color={c.red} />} onPress={remove} style={{ marginTop: 16 }} />
      )}

      <PartyFormSheet open={editing} onClose={() => setEditing(false)} kind={party.kind} party={party} onSaved={() => { setEditing(false); toast(t('partySaved')); refresh() }} />
      <PaymentSheet open={paying} onClose={() => setPaying(false)} party={party} onSaved={(msg) => { setPaying(false); toast(msg); refresh() }} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -60, opacity: 0.1 },
})
