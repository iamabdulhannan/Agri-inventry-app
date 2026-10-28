import { router } from 'expo-router'
import { ArrowDownLeft, ArrowUpRight, Ban, CheckCircle2, ChevronRight, Plus, ReceiptText, RotateCcw, Trash2, Undo2, XCircle } from 'lucide-react-native'
import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { PartyAvatar, PartyPickerSheet } from '@/components/domain'
import { PartyFormSheet } from '@/components/forms'
import { AccountPicker, accountIcon } from '@/components/money'
import {
  Badge, Button, Card, Chip, DateField, Empty, ErrorBox, Field, HScroll, IconBtn, IconTile, Input, Loading, NumInput, PressScale, Row, Segmented, SelectButton, Select, Sheet, Txt, useFeedback,
} from '@/components/ui'
import { useAccounts } from '@/lib/accounts'
import { useOrg } from '@/lib/app'
import { amountOf, loadCheques, type Cheque, type ChequeStatus } from '@/lib/bankMoney'
import { loadParties } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney, r2 } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { radius, toneColors, useTheme, type Tone } from '@/lib/theme'
import type { PartyKind } from '@/lib/types'
import { ChequeDueBadge, Explain, FormFooter, MoreButton, Note, Pair, usePaged, type Ask } from './shared'

type Dir = 'received' | 'issued'
type StatusFilter = ChequeStatus | 'all'
const STATUS_TONE: Record<ChequeStatus, Tone> = { pending: 'amber', cleared: 'green', bounced: 'red', cancelled: 'stone' }
const PAGE = 25

export function ChequesTab() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, version, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const { data: accounts } = useAccounts()
  const [dir, setDir] = useState<Dir>('received')
  const [status, setStatus] = useState<StatusFilter>('pending')
  const [adding, setAdding] = useState(false)
  const [clearing, setClearing] = useState<Cheque | null>(null)
  const { data, error, loading, reload } = useLoad(() => loadCheques(org.id), [org.id, version])

  const accName = (id: string | null) => (id ? accounts?.find((a) => a.id === id)?.name ?? '' : '')
  const all = useMemo(() => data ?? [], [data])
  const pendingIn = all.filter((x) => x.direction === 'received' && x.status === 'pending')
  const pendingOut = all.filter((x) => x.direction === 'issued' && x.status === 'pending')
  const sum = (l: Cheque[]) => l.reduce((s, x) => s + x.amount, 0)
  const countOf = (s: StatusFilter) => all.filter((x) => x.direction === dir && (s === 'all' || x.status === s)).length

  const list = useMemo(() => {
    const l = all.filter((x) => x.direction === dir && (status === 'all' || x.status === status))
    // pending: soonest cheque date first; others: latest first
    return l.sort((a, b) =>
      a.status === 'pending' && b.status === 'pending'
        ? a.cheque_date.localeCompare(b.cheque_date)
        : a.status === 'pending' ? -1 : b.status === 'pending' ? 1
          : (b.cleared_on ?? b.cheque_date).localeCompare(a.cleared_on ?? a.cheque_date) || b.created_at.localeCompare(a.created_at),
    )
  }, [all, dir, status])
  const listTotal = sum(list)
  const pg = usePaged(list, PAGE, `${dir}|${status}`)

  const setStatusOf = async (x: Cheque, s: ChequeStatus) => {
    const msg =
      s === 'bounced' ? t('bankBounceConfirm', { amount: fmtMoney(x.amount, lang), name: x.parties?.name ?? '' })
        : s === 'cancelled' ? t('bankCancelConfirm', { amount: fmtMoney(x.amount, lang) })
          : x.status === 'cleared' ? t('bankUndoClearConfirm', { amount: fmtMoney(x.amount, lang) })
            : t('bankReopenConfirm')
    if (!(await confirm(msg, { danger: s !== 'pending' || x.status === 'cleared' }))) return
    const { error } = await supabase.rpc('set_cheque_status', { p_org: org.id, p_cheque: x.id, p_status: s, p_date: null, p_account: null })
    if (error) return toast(errText(error, t), 'err')
    toast(t('saved'))
    refresh()
  }

  const remove = async (x: Cheque) => {
    if (!(await confirm(t('bankDeleteChequeConfirm', { amount: fmtMoney(x.amount, lang) }), { okLabel: t('delete') }))) return
    const { error } = await supabase.from('cheques').delete().eq('id', x.id).eq('org_id', org.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('deleted'))
    refresh()
  }

  const pickDir = (d: Dir) => {
    setDir(d)
    setStatus('pending')
  }

  return (
    <View style={{ gap: 14 }}>
      <Explain>{t('bankChequesExplain')}</Explain>

      <Row gap={10} center={false}>
        <SummaryTile
          active={dir === 'received'}
          tone="green"
          icon={<ArrowDownLeft size={18} color={c.green} />}
          label={t('bankChequesInHand')}
          amount={sum(pendingIn)}
          count={pendingIn.length}
          onPress={() => pickDir('received')}
        />
        <SummaryTile
          active={dir === 'issued'}
          tone="red"
          icon={<ArrowUpRight size={18} color={c.red} />}
          label={t('bankChequesGiven')}
          amount={sum(pendingOut)}
          count={pendingOut.length}
          onPress={() => pickDir('issued')}
        />
      </Row>

      <Button title={t('bankAddCheque')} icon={<Plus size={18} color={c.primaryText} />} onPress={() => setAdding(true)} />

      <Segmented
        value={dir}
        onChange={pickDir}
        items={[
          { value: 'received', label: t('bankReceived'), icon: <ArrowDownLeft size={15} color={dir === 'received' ? c.green : c.muted} /> },
          { value: 'issued', label: t('bankIssued'), icon: <ArrowUpRight size={15} color={dir === 'issued' ? c.red : c.muted} /> },
        ]}
      />
      <HScroll>
        {([
          ['pending', t('bankPending')],
          ['cleared', t('bankCleared')],
          ['bounced', t('bankBounced')],
          ['all', t('all')],
        ] as [StatusFilter, string][]).map(([v, label]) => (
          <Chip key={v} label={label} active={status === v} count={countOf(v)} onPress={() => setStatus(v)} />
        ))}
      </HScroll>

      {loading && !data ? <Loading rows={3} /> : error && !data ? <ErrorBox error={error} onRetry={reload} /> : list.length === 0 ? (
        <Card><Empty icon={<ReceiptText size={30} color={c.muted} />}>{t('bankNoCheques')}</Empty></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {pg.items.map((x) => (
            <ChequeCard
              key={x.id}
              x={x}
              accountName={accName(x.account_id)}
              isAdmin={isAdmin}
              onClear={() => setClearing(x)}
              onStatus={(s) => setStatusOf(x, s)}
              onDelete={() => remove(x)}
            />
          ))}
          {pg.more && <MoreButton onPress={pg.showMore} left={list.length - pg.items.length} />}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
            <Txt weight="bold">{t('total')} ({list.length})</Txt>
            <Txt v="h3" weight="extrabold" color={dir === 'received' ? c.green : c.red} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{fmtMoney(listTotal, lang)}</Txt>
          </View>
        </View>
      )}

      <ChequeFormSheet open={adding} direction={dir} onClose={() => setAdding(false)} onSaved={(d) => { setAdding(false); setDir(d); setStatus('pending'); toast(t('saved')); refresh() }} />
      <ClearSheet cheque={clearing} onClose={() => setClearing(null)} onSaved={() => { setClearing(null); toast(t('saved')); refresh() }} />
    </View>
  )
}

function SummaryTile({ active, tone, icon, label, amount, count, onPress }: { active: boolean; tone: Tone; icon: ReactNode; label: string; amount: number; count: number; onPress: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const tc = toneColors(c, tone)
  return (
    <PressScale
      onPress={onPress}
      style={{ flex: 1, padding: 14, borderRadius: 22, backgroundColor: active ? tc.bg : c.surface, borderWidth: active ? 1.5 : 1, borderColor: active ? tc.fg + '66' : c.border, overflow: 'hidden', gap: 8 }}
    >
      <IconTile icon={icon} tone={tone} size={36} />
      <Txt v="tiny" muted numberOfLines={2} style={{ minHeight: 30 }}>{label}</Txt>
      <Txt v="h2" weight="extrabold" color={tc.fg} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(amount, lang)}</Txt>
      <Txt v="tiny" muted numberOfLines={1}>{t('bankChequeCount', { n: count })}</Txt>
    </PressScale>
  )
}

function ChequeCard({
  x, accountName, isAdmin, onClear, onStatus, onDelete,
}: {
  x: Cheque
  accountName: string
  isAdmin: boolean
  onClear: () => void
  onStatus: (s: ChequeStatus) => void
  onDelete: () => void
}) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const received = x.direction === 'received'
  const dead = x.status === 'bounced' || x.status === 'cancelled'
  const ref = [x.cheque_no ? `#${x.cheque_no}` : null, x.bank_name].filter(Boolean).join(' · ') || t('bankNoChequeNo')
  const meta = [
    `${t('bankChequeDate')}: ${fmtDate(x.cheque_date, lang)}`,
    `${received ? t('bankReceivedOn') : t('bankIssuedOn')}: ${fmtDate(x.received_on, lang)}`,
    x.status === 'cleared' && x.cleared_on ? `${t('bankClearedOn')}: ${fmtDate(x.cleared_on, lang)}` : null,
    dead && x.cleared_on ? fmtDate(x.cleared_on, lang) : null,
    x.account_id && accountName ? `${received ? t('bankDepositIn') : t('bankDrawnOn')}: ${accountName}` : null,
    x.created_by_name ? `${t('by')} ${x.created_by_name}` : null,
  ].filter(Boolean) as string[]
  const showActions = x.status === 'pending' || isAdmin

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', width: '100%' }}>
        <View style={{ width: 4, backgroundColor: toneColors(c, STATUS_TONE[x.status]).fg }} />
        <View style={{ flex: 1, padding: 14, gap: 10 }}>
          <Pressable onPress={() => router.push(`/party/${x.party_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <PartyAvatar name={x.parties?.name ?? '?'} kind={received ? 'customer' : 'supplier'} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Row gap={4}>
                <Txt weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>{x.parties?.name ?? '?'}</Txt>
                <ChevronRight size={14} color={c.muted} />
              </Row>
              <Txt v="tiny" muted numberOfLines={1}>{ref}</Txt>
            </View>
            <View style={{ alignItems: 'flex-end', maxWidth: '45%' }}>
              <Txt
                weight="extrabold"
                color={dead ? c.muted : received ? c.green : c.red}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[{ fontSize: 18, fontVariant: ['tabular-nums'] }, dead && { textDecorationLine: 'line-through' }]}
              >
                {fmtMoney(x.amount, lang)}
              </Txt>
            </View>
          </Pressable>

          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Badge tone={STATUS_TONE[x.status]}>{t(`bankSt_${x.status}`)}</Badge>
            {x.status === 'pending' && <ChequeDueBadge date={x.cheque_date} />}
          </Row>
          <Txt v="tiny" muted>{meta.join('  ·  ')}</Txt>
          {!!x.note && <Txt v="small" soft>{x.note}</Txt>}

          {showActions && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
              {x.status === 'pending' && (
                <>
                  <Button size="sm" title={t('bankMarkCleared')} icon={<CheckCircle2 size={15} color={c.primaryText} />} onPress={onClear} />
                  <Button size="sm" variant="secondary" title={t('bankMarkBounced')} color={c.red} icon={<XCircle size={15} color={c.red} />} onPress={() => onStatus('bounced')} />
                  <Button size="sm" variant="ghost" title={t('bankMarkCancelled')} color={c.muted} icon={<Ban size={15} color={c.muted} />} onPress={() => onStatus('cancelled')} />
                </>
              )}
              {x.status === 'cleared' && isAdmin && (
                <Button size="sm" variant="ghost" title={t('bankUndoClear')} icon={<Undo2 size={15} color={c.primary} />} onPress={() => onStatus('pending')} />
              )}
              {dead && isAdmin && (
                <Button size="sm" variant="ghost" title={t('bankBackToPending')} icon={<RotateCcw size={15} color={c.primary} />} onPress={() => onStatus('pending')} />
              )}
              {x.status !== 'cleared' && isAdmin && (
                <IconBtn size={38} tone="red" icon={<Trash2 size={16} color={c.red} />} onPress={onDelete} label={t('delete')} style={{ marginStart: 'auto' }} />
              )}
            </View>
          )}
        </View>
      </View>
    </Card>
  )
}

function ChequeFormSheet({ open, direction, onClose, onSaved }: { open: boolean; direction: Dir; onClose: () => void; onSaved: (d: Dir) => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today, version } = useOrg()
  const { data: accounts } = useAccounts()
  const [dir, setDir] = useState<Dir>(direction)
  const [party, setParty] = useState('')
  const [amount, setAmount] = useState('')
  const [no, setNo] = useState('')
  const [bank, setBank] = useState('')
  const [chequeDate, setChequeDate] = useState(today)
  const [on, setOn] = useState(today)
  const [account, setAccount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wasOpen, setWasOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [newParty, setNewParty] = useState(false)
  const kind: PartyKind = dir === 'received' ? 'customer' : 'supplier'
  const parties = useLoad(() => (open ? loadParties(org.id, kind) : Promise.resolve([])), [org.id, kind, open, version])
  const activeAccounts = (accounts ?? []).filter((a) => a.is_active)
  const chosen = (parties.data ?? []).find((p) => p.id === party)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDir(direction)
      setParty('')
      setAmount('')
      setNo('')
      setBank('')
      setChequeDate(today)
      setOn(today)
      setAccount(direction === 'issued' ? activeAccounts[0]?.id ?? '' : '')
      setNote('')
      setError('')
    }
  }

  const changeDir = (d: Dir) => {
    setDir(d)
    setParty('')
    setAccount(d === 'issued' ? activeAccounts[0]?.id ?? '' : '')
  }

  const save = async () => {
    setError('')
    const n = amountOf(amount)
    if (!party) return setError(dir === 'received' ? t('bankPickCustomer') : t('bankPickCompany'))
    if (!(n > 0)) return setError(t('errInvalidAmount'))
    if (!chequeDate) return setError(t('errInvalidDate'))
    if (on > today) return setError(t('errInvalidDate'))
    if (dir === 'issued' && !account) return setError(t('bankPickAccount'))
    setBusy(true)
    const { error } = await supabase.rpc('record_cheque', {
      p_org: org.id, p_direction: dir, p_party: party, p_amount: r2(n), p_cheque_date: chequeDate,
      p_cheque_no: no.trim() || null, p_bank_name: bank.trim() || null, p_received_on: on || today,
      p_account: account || null, p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved(dir)
  }

  const optionalAccounts = [
    { value: '', label: t('bankNotDecided') },
    ...(accounts ?? []).filter((a) => a.is_active || a.id === account).map((a) => {
      const Icon = accountIcon(a.kind)
      return { value: a.id, label: a.name, sub: a.account_no ?? undefined, icon: <Icon size={18} color={c.blue} /> }
    }),
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('bankAddCheque')}
      footer={
        <>
          <Button variant="secondary" title={t('cancel')} onPress={onClose} style={{ flex: 1 }} />
          <Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1.4 }} />
        </>
      }
    >
      <View style={{ gap: 14 }}>
        <Segmented
          value={dir}
          onChange={changeDir}
          items={[
            { value: 'received', label: t('bankChequeFromCustomer'), icon: <ArrowDownLeft size={15} color={dir === 'received' ? c.green : c.muted} /> },
            { value: 'issued', label: t('bankChequeToCompany'), icon: <ArrowUpRight size={15} color={dir === 'issued' ? c.red : c.muted} /> },
          ]}
        />
        <Txt v="small" muted>{dir === 'received' ? t('bankChequeReceivedHint') : t('bankChequeIssuedHint')}</Txt>
        <Field label={`${dir === 'received' ? t('customer') : t('supplier')} *`}>
          <SelectButton
            label={chosen?.name}
            sub={chosen ? `${t('balance')}: ${fmtMoney(chosen.balance, lang)}` : undefined}
            placeholder={t('bankChoose')}
            icon={chosen ? <PartyAvatar name={chosen.name} kind={chosen.kind} size={32} /> : undefined}
            onPress={() => setPicking(true)}
          />
        </Field>
        <Field label={`${t('amount')} *`}>
          <NumInput value={amount} onChangeText={setAmount} big placeholder="0" />
        </Field>
        <Pair>
          <Field label={t('bankChequeNo')} optional>
            <Input value={no} onChangeText={setNo} keyboardType="number-pad" />
          </Field>
          <Field label={t('bankChequeBank')} optional>
            <Input value={bank} onChangeText={setBank} placeholder="HBL, MCB, UBL" />
          </Field>
        </Pair>
        <Pair>
          <Field label={`${t('bankChequeDate')} *`} hint={t('bankChequeDateHint')}>
            <DateField value={chequeDate} onChange={setChequeDate} label={t('bankChequeDate')} />
          </Field>
          <Field label={dir === 'received' ? t('bankReceivedOn') : t('bankIssuedOn')}>
            <DateField value={on} onChange={setOn} max={today} label={dir === 'received' ? t('bankReceivedOn') : t('bankIssuedOn')} />
          </Field>
        </Pair>
        {dir === 'issued' ? (
          activeAccounts.length === 0 ? (
            <ErrorBox>{t('bankNeedAccount')}</ErrorBox>
          ) : (
            <Field label={`${t('bankDrawnOn')} *`}>
              <AccountPicker value={account} onChange={setAccount} cash={false} title={t('bankDrawnOn')} />
            </Field>
          )
        ) : activeAccounts.length > 0 && (
          <Field label={t('bankWillDepositIn')} optional>
            <Select value={account} onChange={setAccount} options={optionalAccounts} title={t('bankWillDepositIn')} />
          </Field>
        )}
        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {!!error && <ErrorBox>{error}</ErrorBox>}
      </View>

      {/* nested inside this sheet so they open on top of it */}
      <PartyPickerSheet
        open={picking}
        onClose={() => setPicking(false)}
        kind={kind}
        parties={parties.data ?? []}
        value={party}
        onPick={setParty}
        noneLabel={t('bankChoose')}
        onNew={() => setNewParty(true)}
      />
      <PartyFormSheet open={newParty} onClose={() => setNewParty(false)} kind={kind} onSaved={(id) => { setNewParty(false); parties.reload(); setParty(id) }} />
    </Sheet>
  )
}

function ClearSheet({ cheque, onClose, onSaved }: { cheque: Cheque | null; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const { data: accounts } = useAccounts()
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const active = (accounts ?? []).filter((a) => a.is_active)
  if ((cheque?.id ?? null) !== last) {
    setLast(cheque?.id ?? null)
    if (cheque) {
      setAccount(cheque.account_id ?? active[0]?.id ?? '')
      setDate(today)
      setError('')
      setAsk(null)
    }
  }
  const save = () => {
    if (!cheque) return
    setError('')
    if (!account) return setError(t('bankPickAccount'))
    if (date > today) return setError(t('errInvalidDate'))
    const name = accounts?.find((a) => a.id === account)?.name ?? ''
    const p = { p_org: org.id, p_cheque: cheque.id, p_status: 'cleared', p_date: date, p_account: account }
    setAsk({
      msg: t('bankClearConfirm', { amount: fmtMoney(cheque.amount, lang), account: name }),
      run: async () => {
        setBusy(true)
        const { error } = await supabase.rpc('set_cheque_status', p)
        setBusy(false)
        setAsk(null)
        if (error) return setError(errText(error, t))
        onSaved()
      },
    })
  }
  const received = cheque?.direction === 'received'
  return (
    <Sheet
      open={!!cheque}
      onClose={onClose}
      title={t('bankMarkCleared')}
      footer={
        <FormFooter
          ask={ask}
          setAsk={setAsk}
          busy={busy}
          onCancel={onClose}
          onSave={save}
          saveTitle={t('bankMarkCleared')}
          saveIcon={<CheckCircle2 size={17} color={c.primaryText} />}
          disabled={active.length === 0}
        />
      }
    >
      {cheque && (
        <View style={{ gap: 14 }}>
          <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: received ? c.greenSoft : c.redSoft, gap: 4 }}>
            <Txt weight="bold" numberOfLines={1}>{cheque.parties?.name}</Txt>
            <Txt v="h1" color={received ? c.green : c.red} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(cheque.amount, lang)}</Txt>
            <Txt v="tiny" muted>{[cheque.cheque_no ? `#${cheque.cheque_no}` : null, cheque.bank_name, fmtDate(cheque.cheque_date, lang)].filter(Boolean).join(' · ')}</Txt>
          </View>
          <Txt v="small" muted>{received ? t('bankClearReceivedHint') : t('bankClearIssuedHint')}</Txt>
          {active.length === 0 ? (
            <Note tone="red">{t('bankNeedAccount')}</Note>
          ) : (
            <Field label={`${received ? t('bankDepositIn') : t('bankDrawnOn')} *`}>
              <AccountPicker value={account} onChange={(v) => { setAccount(v); setAsk(null) }} cash={false} title={received ? t('bankDepositIn') : t('bankDrawnOn')} />
            </Field>
          )}
          <Field label={t('bankClearedOn')}>
            <DateField value={date} onChange={(d) => { setDate(d); setAsk(null) }} max={today} label={t('bankClearedOn')} />
          </Field>
          {!!error && <ErrorBox>{error}</ErrorBox>}
        </View>
      )}
    </Sheet>
  )
}
