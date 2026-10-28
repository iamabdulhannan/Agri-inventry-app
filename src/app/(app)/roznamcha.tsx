import { router, useLocalSearchParams, type Href } from 'expo-router'
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, ReceiptText, Trash2, Wallet } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { AccountPicker, useHasAccounts } from '@/components/money'
import { Badge, Button, CalendarSheet, Card, DateField, Empty, ErrorBox, Field, Input, Loading, NumInput, PressScale, Row, Screen, Segmented, Sheet, StatTile, Txt, useFeedback } from '@/components/ui'
import { useAccounts, type MoneyAccount } from '@/lib/accounts'
import { useOrg } from '@/lib/app'
import { CASH_SELECT, canDeleteCash, cashType, describeCash, loadCashItems, loadTransferPeers, type CashEntryFull, type PayMethod } from '@/lib/cashDetail'
import { fetchAll, useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { addDays, fmtDate, fmtMonth, monthOf, monthRange, weekday } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { CashDay, CashKind } from '@/lib/types'

/** Which book is open: cash in hand ('') or a bank account / wallet */
interface Book { id: string; account: MoneyAccount | null; name: string }

/** Labels for the book: "Opening cash" for cash in hand, "Opening balance" for an account */
function useBookLabels(book: Book) {
  const { t } = useI18n()
  return book.id
    ? { open: t('bankRzOpening'), in: t('bankRzIn'), out: t('bankRzOut'), close: t('bankRzClosing') }
    : { open: t('openingCash'), in: t('cashIn'), out: t('cashOut'), close: t('closingCash') }
}

export default function Roznamcha() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { refresh, today } = useOrg()
  const { toast } = useFeedback()
  const [view, setView] = useState<'day' | 'month'>('day')
  const [day, setDay] = useState(today)
  const [adding, setAdding] = useState<CashKind | null>(null)
  const params = useLocalSearchParams<{ account?: string }>()
  const [bookId, setBookId] = useState(params.account ?? '')
  const { data: accounts } = useAccounts()
  const hasAccounts = (accounts ?? []).length > 0
  const account = accounts?.find((a) => a.id === bookId) ?? null
  const book: Book = { id: bookId, account, name: bookId ? account?.name ?? '' : t('cashInHandOpt') }

  return (
    <Screen
      back
      title={t('roznamchaTitle')}
      subtitle={view === 'day' ? `${fmtDate(day, lang)} · ${weekday(day, lang)}` : undefined}
    >
      {(hasAccounts || !!bookId) && (
        <View style={{ marginBottom: 12 }}>
          <AccountPicker value={bookId} onChange={setBookId} always title={t('accountLabel')} />
        </View>
      )}
      <Segmented value={view} onChange={setView} items={[{ value: 'day', label: t('dayView') }, { value: 'month', label: t('monthView') }]} />
      <Row gap={8} style={{ marginTop: 12 }}>
        <Button size="sm" variant="secondary" color={c.red} title={t('addExpense')} icon={<ReceiptText size={15} color={c.red} />} onPress={() => setAdding('expense')} style={{ flex: 1 }} />
        <Button size="sm" variant="secondary" title={t('addCashIn')} icon={<ArrowDownCircle size={15} color={c.green} />} onPress={() => setAdding('cash_in')} style={{ flex: 1 }} />
        <Button size="sm" variant="secondary" title={t('addCashOut')} icon={<ArrowUpCircle size={15} color={c.orange} />} onPress={() => setAdding('cash_out')} style={{ flex: 1 }} />
      </Row>
      {view === 'day' ? <DayView book={book} day={day} setDay={setDay} /> : <MonthView book={book} onOpenDay={(d) => { setDay(d); setView('day') }} />}
      <CashEntrySheet kind={adding} book={book} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); toast(t('saved')); refresh() }} />
    </Screen>
  )
}

function DayView({ book, day, setDay }: { book: Book; day: string; setDay: (d: string) => void }) {
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const L = useBookLabels(book)
  const { data: accounts } = useAccounts()
  const accountName = (id: string | null) => (id ? accounts?.find((a) => a.id === id)?.name ?? '' : t('cashInHandOpt'))
  const { org, today, version, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const [cal, setCal] = useState(false)

  const { data, error, loading, reload } = useLoad(async () => {
    const [sum, entries] = await Promise.all([
      supabase.rpc('cash_days', { p_org: org.id, p_from: day, p_to: day, ...(book.id ? { p_account: book.id } : {}) }),
      fetchAll<CashEntryFull>((a, b) => {
        const q = supabase.from('cash_entries').select(CASH_SELECT).eq('org_id', org.id).eq('entry_date', day)
        return (book.id ? q.eq('account_id', book.id) : q.is('account_id', null)).order('created_at').range(a, b)
      }),
    ])
    if (sum.error) throw sum.error
    const [items, peers] = await Promise.all([loadCashItems(entries), loadTransferPeers(entries)])
    return { sum: (sum.data as CashDay[])[0], entries, items, peers }
  }, [org.id, day, version, book.id])

  const ctx = { peers: data?.peers ?? new Map<string, string | null>(), accountName }
  const del = async (e: CashEntryFull) => {
    const text = e.transfer_id
      ? t('bankRzDeleteTransfer', {
          from: e.amount < 0 ? accountName(e.account_id ?? null) : accountName(ctx.peers.get(e.id) ?? null),
          to: e.amount < 0 ? accountName(ctx.peers.get(e.id) ?? null) : accountName(e.account_id ?? null),
        })
      : `${t('delete')}?`
    if (!(await confirm(text))) return
    const { error } = await supabase.from('cash_entries').delete().eq('id', e.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('deleted'))
    refresh()
  }
  const m = (n: number) => fmtMoney(n, lang)

  return (
    <View style={{ marginTop: 14 }}>
      <Row gap={8}>
        <PressScale onPress={() => setDay(addDays(day, -1))} style={{ padding: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}><ChevronLeft size={20} color={c.text} /></PressScale>
        <PressScale onPress={() => setCal(true)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, height: 46 }}>
          <Txt weight="bold">{day === today ? t('today') : fmtDate(day, lang)}</Txt>
        </PressScale>
        <PressScale onPress={() => setDay(addDays(day, 1))} disabled={day >= today} style={{ padding: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}><ChevronRight size={20} color={c.text} /></PressScale>
      </Row>
      {loading && !data ? <View style={{ marginTop: 12 }}><Loading rows={3} /></View> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : data && (
        <>
          {Number(data.sum?.closing ?? 0) < 0 && (
            <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, backgroundColor: c.amberSoft, marginTop: 12 }}>
              <Wallet size={16} color={c.amber} />
              <Txt v="tiny" style={{ flex: 1 }}>{t('negativeCashHint')}</Txt>
            </View>
          )}
          <Row gap={10} style={{ marginTop: 12 }}>
            <StatTile icon={<Wallet size={17} color={c.muted} />} tone="stone" label={L.open} value={Number(data.sum?.opening ?? 0)} format={m} />
            <StatTile icon={<Wallet size={17} color={c.primary} />} label={L.close} value={Number(data.sum?.closing ?? 0)} format={m} />
          </Row>
          <Row gap={10} style={{ marginTop: 10 }}>
            <StatTile icon={<ArrowDownCircle size={17} color={c.green} />} tone="green" label={L.in} value={Number(data.sum?.cash_in ?? 0)} format={m} />
            <StatTile icon={<ArrowUpCircle size={17} color={c.red} />} tone="red" label={L.out} value={Number(data.sum?.cash_out ?? 0)} format={m} />
          </Row>
          <Card padded={false} style={{ marginTop: 14, paddingHorizontal: 14 }}>
            {data.entries.length === 0 ? <Empty>{t('noCashEntries')}</Empty> : data.entries.map((e, i) => {
              const d = describeCash(e, data.items, t, lang, pick, ctx)
              const type = cashType(e, t)
              // method badge only when it differs from the book (e.g. a cheque in a bank account)
              const usual: PayMethod = book.account?.kind ?? 'cash'
              const go: Href | null = e.sale_id ? `/receipt/${e.sale_id}`
                : e.cheque_id ? ('/bank?tab=cheques' as Href)
                  : e.facility_id ? ('/bank?tab=finance' as Href)
                    : e.investor_id && isAdmin ? (`/investors/${e.investor_id}` as Href)
                      : e.party_id ? `/party/${e.party_id}` : null
              return (
                <Pressable
                  key={e.id}
                  onPress={go ? () => router.push(go) : undefined}
                  style={{ flexDirection: 'row', gap: 12, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, alignItems: 'center' }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Row gap={6}>
                      <Badge tone={type.tone}>{type.label}</Badge>
                      {!!e.method && e.method !== usual && <Badge tone="stone">{t(`bankM_${e.method}`)}</Badge>}
                      {!!d.party && <Txt v="small" weight="bold" numberOfLines={1} style={{ flex: 1 }}>{d.party}</Txt>}
                    </Row>
                    {!!d.detail && <Txt v="tiny" muted numberOfLines={2}>{d.detail}</Txt>}
                    {!!e.created_by_name && <Txt v="tiny" muted>{t('by')} {e.created_by_name}</Txt>}
                  </View>
                  <Txt weight="extrabold" color={e.amount > 0 ? c.green : c.red}>{e.amount > 0 ? '+' : '−'}{fmtMoney(Math.abs(e.amount), lang)}</Txt>
                  {isAdmin && canDeleteCash(e) && (
                    <PressScale onPress={() => del(e)} style={{ padding: 6 }}><Trash2 size={16} color={c.red} /></PressScale>
                  )}
                </Pressable>
              )
            })}
          </Card>
        </>
      )}
      <CalendarSheet open={cal} onClose={() => setCal(false)} value={day} onPick={setDay} max={today} />
    </View>
  )
}

function MonthView({ book, onOpenDay }: { book: Book; onOpenDay: (d: string) => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const L = useBookLabels(book)
  const { org, today, version } = useOrg()
  const [month, setMonth] = useState(monthOf(today))
  const [from, last] = monthRange(month)
  const to = last > today ? today : last
  const { data, error, loading, reload } = useLoad(async () => {
    if (from > today) return [] as CashDay[]
    const { data, error } = await supabase.rpc('cash_days', { p_org: org.id, p_from: from, p_to: to, ...(book.id ? { p_account: book.id } : {}) })
    if (error) throw error
    return data as CashDay[]
  }, [org.id, from, to, version, book.id])
  const rows = (data ?? []).filter((r) => Number(r.cash_in) || Number(r.cash_out))
  const tin = rows.reduce((s, r) => s + Number(r.cash_in), 0)
  const tout = rows.reduce((s, r) => s + Number(r.cash_out), 0)
  const shift = (d: number) => {
    const [y, mo] = month.split('-').map(Number)
    const dt = new Date(Date.UTC(y, mo - 1 + d, 1))
    setMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <View style={{ marginTop: 14 }}>
      <Row gap={8}>
        <PressScale onPress={() => shift(-1)} style={{ padding: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}><ChevronLeft size={20} color={c.text} /></PressScale>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Txt v="h3">{fmtMonth(month, lang)}</Txt></View>
        <PressScale onPress={() => shift(1)} disabled={month >= monthOf(today)} style={{ padding: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}><ChevronRight size={20} color={c.text} /></PressScale>
      </Row>
      <Row gap={10} style={{ marginTop: 12 }}>
        <StatTile icon={<ArrowDownCircle size={17} color={c.green} />} tone="green" label={L.in} value={tin} format={(n) => fmtMoney(n, lang)} />
        <StatTile icon={<ArrowUpCircle size={17} color={c.red} />} tone="red" label={L.out} value={tout} format={(n) => fmtMoney(n, lang)} />
      </Row>
      {loading && !data ? <View style={{ marginTop: 12 }}><Loading rows={4} /></View> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : (
        <Card padded={false} style={{ marginTop: 14, paddingHorizontal: 14 }}>
          {rows.length === 0 ? <Empty>{t('noData')}</Empty> : rows.map((r, i) => (
            <Pressable key={r.day} onPress={() => onOpenDay(String(r.day).slice(0, 10))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
              <View style={{ width: 44, alignItems: 'center' }}>
                <Txt v="h3">{String(r.day).slice(8, 10)}</Txt>
                <Txt v="tiny" muted>{weekday(String(r.day), lang)}</Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="small" weight="bold" color={c.green}>+ {fmtMoney(r.cash_in, lang)}</Txt>
                <Txt v="small" weight="bold" color={c.red}>− {fmtMoney(r.cash_out, lang)}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt v="tiny" muted>{L.close}</Txt>
                <Txt weight="extrabold">{fmtMoney(r.closing, lang)}</Txt>
              </View>
              <ChevronRight size={16} color={c.muted} />
            </Pressable>
          ))}
        </Card>
      )}
    </View>
  )
}

function CashEntrySheet({ kind, book, onClose, onSaved }: { kind: CashKind | null; book: Book; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const { org, today } = useOrg()
  const { data: accounts } = useAccounts()
  const hasAccounts = useHasAccounts()
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [last, setLast] = useState<CashKind | null>(null)
  if (kind !== last) {
    setLast(kind)
    if (kind) {
      setAmount('')
      setDate(today)
      setNote('')
      setError('')
      // the open book, unless it is a closed (inactive) account
      setAccount(book.account?.is_active ? book.id : '')
    }
  }
  const save = async () => {
    if (!kind) return
    setError('')
    const n = Number(amount)
    if (!(n > 0)) return setError(t('errInvalidAmount'))
    if (date > today) return setError(t('errInvalidDate'))
    setBusy(true)
    const acc = account ? accounts?.find((a) => a.id === account) : null
    let { error } = await supabase.rpc('add_cash_entry', { p_org: org.id, p_date: date, p_kind: kind, p_amount: n, p_note: note.trim() || null, p_account: acc?.id ?? null })
    // before migration 019 there is no add_cash_entry: save the line directly
    if (error && /add_cash_entry|schema cache|PGRST202/.test(String(error.message ?? ''))) {
      ;({ error } = await supabase.from('cash_entries').insert({
        org_id: org.id, entry_date: date, kind, amount: kind === 'cash_in' ? n : -n, note: note.trim() || null,
        ...(acc ? { account_id: acc.id, method: acc.kind } : {}),
      }))
    }
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved()
  }
  const hint = kind === 'expense' ? t('expenseHint') : kind === 'cash_in' ? t('cashInHint') : t('cashOutHint')
  return (
    <Sheet open={!!kind} onClose={onClose} title={kind ? t(`ck_${kind}`) : ''} footer={<Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" />}>
      <View style={{ gap: 14 }}>
        <Field label={t('amount')}>
          <NumInput value={amount} onChangeText={setAmount} big autoFocus />
        </Field>
        <Field label={t('detail')} hint={hint}>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {hasAccounts && (
          <Field label={t('accountLabel')}>
            <AccountPicker value={account} onChange={setAccount} />
          </Field>
        )}
        <Field label={t('date')}>
          <DateField value={date} onChange={setDate} max={today} />
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </View>
    </Sheet>
  )
}
