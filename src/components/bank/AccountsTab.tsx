import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeftRight, ArrowUpDown, BookOpen, Landmark, Pencil, Plus, Power, ReceiptText, Smartphone, Wallet } from 'lucide-react-native'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { AccountPicker, MoneyValue } from '@/components/money'
import { AnimatedNumber, Badge, Button, Card, Chip, DateField, ErrorBox, Field, Grid, IconBtn, IconTile, Input, Loading, NumInput, Row, SectionTitle, Segmented, Sheet, StatTile, Txt, useFeedback } from '@/components/ui'
import { useAccounts } from '@/lib/accounts'
import { useOrg } from '@/lib/app'
import { amountOf, loadPosition, type MoneyPosition, type PositionAccount } from '@/lib/bankMoney'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { fmtMoney, r2 } from '@/lib/money'
import { useLayout } from '@/lib/responsive'
import { supabase } from '@/lib/supabase'
import { useTheme, type Tone } from '@/lib/theme'
import { Explain, FormFooter, GlassButton, Note, Pair, type Ask } from './shared'

type Kind = 'cash' | 'bank' | 'wallet'
const KIND_TONE: Record<Kind, Tone> = { cash: 'primary', bank: 'amber', wallet: 'blue' }

export function AccountsTab({ onTab }: { onTab: (tab: 'cheques' | 'finance') => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { contentWidth } = useLayout()
  const { org, version, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const { data, error, loading, reload } = useLoad(() => loadPosition(org.id), [org.id, version])
  const [form, setForm] = useState<PositionAccount | 'new' | null>(null)
  const [transfer, setTransfer] = useState(false)

  if (loading && !data) return <Loading rows={3} />
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return null

  const active = data.accounts.filter((a) => a.is_active)
  const inactive = data.accounts.filter((a) => !a.is_active)
  const inBanks = active.reduce((s, a) => s + a.balance, 0)
  const total = data.cash + inBanks
  const cols = contentWidth >= 520 ? 2 : 1
  const m = (n: number) => fmtMoney(n, lang)
  const sub = (a: PositionAccount) => [a.bank_name !== a.name ? a.bank_name : null, a.account_no].filter(Boolean).join(' · ')

  const toggle = async (a: PositionAccount) => {
    const text = a.is_active
      ? t('bankDeactivateConfirm', { name: a.name }) + (Math.abs(a.balance) > 0.005 ? ' ' + t('bankStillHas', { amount: fmtMoney(a.balance, lang) }) : '')
      : t('bankActivateConfirm', { name: a.name })
    if (!(await confirm(text, { danger: a.is_active, okLabel: a.is_active ? t('deactivate') : t('activate') }))) return
    const { error } = await supabase.from('money_accounts').update({ is_active: !a.is_active }).eq('id', a.id).eq('org_id', org.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('saved'))
    refresh()
  }

  // share of cash vs banks for the bar on the hero (only when both are positive)
  const cashPart = Math.max(data.cash, 0)
  const bankPart = Math.max(inBanks, 0)
  const showSplit = active.length > 0 && cashPart + bankPart > 0

  return (
    <View style={{ gap: 14 }}>
      {/* hero: all the money */}
      <View style={{ borderRadius: 28, overflow: 'hidden' }}>
        <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
          <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
          <View style={[styles.blob2, { backgroundColor: '#fff' }]} />
          <Row gap={10}>
            <View style={styles.heroIcon}><Landmark size={20} color="#fff" /></View>
            <Txt v="label" color="rgba(255,255,255,0.75)" style={{ flex: 1 }} numberOfLines={1}>{t('bankAllMoney')}</Txt>
          </Row>
          <AnimatedNumber value={total} format={m} size={34} color={total < 0 ? '#FECACA' : '#fff'} style={{ marginTop: 10 }} />
          {showSplit && (
            <View style={{ marginTop: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <View style={{ flex: cashPart, backgroundColor: c.heroGlow }} />
                <View style={{ flex: bankPart, backgroundColor: 'rgba(255,255,255,0.55)' }} />
              </View>
              <Row gap={14} style={{ flexWrap: 'wrap' }}>
                <Legend color={c.heroGlow} label={t('cashInHandOpt')} value={m(data.cash)} />
                <Legend color="rgba(255,255,255,0.55)" label={t('bankInBanks')} value={m(inBanks)} />
              </Row>
            </View>
          )}
          <Row gap={10} style={{ marginTop: 18, flexWrap: 'wrap' }}>
            <GlassButton title={t('bankTransfer')} icon={<ArrowLeftRight size={17} color="#fff" />} onPress={() => setTransfer(true)} disabled={active.length === 0} style={{ flexGrow: 1 }} />
            {isAdmin && <GlassButton title={t('bankAddAccount')} icon={<Plus size={17} color="#fff" />} onPress={() => setForm('new')} style={{ flexGrow: 1 }} />}
          </Row>
        </LinearGradient>
      </View>

      {/* quick look at the other tabs */}
      {(data.cheques_in_hand > 0 || data.bank_owed > 0) && (
        <Row gap={10}>
          <StatTile icon={<ReceiptText size={17} color={c.green} />} tone="green" label={t('bankChequesInHand')} value={data.cheques_in_hand} format={m} sub={t('bankChequeCount', { n: data.cheques_in_count })} onPress={() => onTab('cheques')} />
          <StatTile icon={<Landmark size={17} color={c.red} />} tone="red" label={t('bankYouOweBanks')} value={data.bank_owed} format={m} onPress={() => onTab('finance')} />
        </Row>
      )}

      <Explain>{t('bankAccountsExplain')}</Explain>

      <Grid cols={cols} min={1} gap={12}>
        <AccountCard kind="cash" name={t('cashInHandOpt')} sub={t('bankCashSub')} balance={data.cash} onOpen={() => router.push('/roznamcha')} />
        {active.map((a) => (
          <AccountCard
            key={a.id}
            kind={a.kind}
            name={a.name}
            sub={sub(a)}
            balance={a.balance}
            onOpen={() => router.push({ pathname: '/roznamcha', params: { account: a.id } })}
            onEdit={isAdmin ? () => setForm(a) : undefined}
            onToggle={isAdmin ? () => toggle(a) : undefined}
          />
        ))}
        {active.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.borderStrong }}>
            <IconTile icon={<Landmark size={20} color={c.muted} />} tone="stone" size={44} />
            <Txt v="small" muted align="center">{t('bankNoAccounts')}</Txt>
            {isAdmin ? (
              <Button size="sm" variant="secondary" title={t('bankAddAccount')} icon={<Plus size={16} color={c.text} />} onPress={() => setForm('new')} />
            ) : (
              <Txt v="tiny" muted align="center">{t('bankAskOwner')}</Txt>
            )}
          </View>
        )}
      </Grid>

      {inactive.length > 0 && (
        <View>
          <SectionTitle>{t('bankInactiveAccounts')}</SectionTitle>
          <Grid cols={cols} min={1} gap={12}>
            {inactive.map((a) => (
              <AccountCard
                key={a.id}
                kind={a.kind}
                name={a.name}
                sub={sub(a)}
                balance={a.balance}
                inactive
                onOpen={() => router.push({ pathname: '/roznamcha', params: { account: a.id } })}
                onEdit={isAdmin ? () => setForm(a) : undefined}
                onToggle={isAdmin ? () => toggle(a) : undefined}
              />
            ))}
          </Grid>
        </View>
      )}

      <AccountFormSheet open={!!form} account={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); toast(t('saved')); refresh() }} />
      <TransferSheet open={transfer} position={data} onClose={() => setTransfer(false)} onSaved={() => { setTransfer(false); toast(t('saved')); refresh() }} />
    </View>
  )
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Txt v="tiny" color="rgba(255,255,255,0.75)" numberOfLines={1}>{label}</Txt>
      <Txt v="tiny" weight="extrabold" color="#fff" numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>{value}</Txt>
    </Row>
  )
}

function AccountCard({
  kind, name, sub, balance, inactive, onOpen, onEdit, onToggle,
}: {
  kind: Kind
  name: string
  sub?: string | null
  balance: number
  inactive?: boolean
  onOpen: () => void
  onEdit?: () => void
  onToggle?: () => void
}) {
  const { t } = useI18n()
  const { c } = useTheme()
  const tone: Tone = inactive ? 'stone' : KIND_TONE[kind]
  const fg = inactive ? c.muted : tone === 'primary' ? c.primary : tone === 'blue' ? c.blue : c.amber
  return (
    <Card style={[{ flex: 1, gap: 14 }, inactive && { backgroundColor: c.surface2, borderStyle: 'dashed', borderColor: c.borderStrong }]}>
      <Row gap={12}>
        <IconTile icon={<KindIcon kind={kind} size={22} color={fg} />} tone={tone} size={48} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Txt v="h3" numberOfLines={1}>{name}</Txt>
          {!!sub && <Txt v="tiny" muted numberOfLines={1}>{sub}</Txt>}
          {(inactive || kind === 'wallet') && (
            <Row gap={6}>
              {inactive && <Badge>{t('inactive')}</Badge>}
              {kind === 'wallet' && <Badge tone="blue">{t('bankWallet')}</Badge>}
            </Row>
          )}
        </View>
      </Row>
      <MoneyValue amount={balance} size={26} color={balance < 0 ? c.red : inactive ? c.muted : c.text} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }}>
        <Button size="sm" variant="secondary" title={kind === 'cash' ? t('navRoznamcha') : t('bankStatement')} icon={<BookOpen size={15} color={c.text} />} onPress={onOpen} style={{ flexShrink: 1 }} />
        <View style={{ flex: 1 }} />
        {onEdit && <IconBtn size={38} icon={<Pencil size={16} color={c.text} />} onPress={onEdit} label={t('edit')} />}
        {onToggle && (
          <IconBtn size={38} tone={inactive ? 'green' : 'red'} icon={<Power size={16} color={inactive ? c.green : c.red} />} onPress={onToggle} label={inactive ? t('activate') : t('deactivate')} />
        )}
      </View>
    </Card>
  )
}

/** Same icons as accountIcon() in components/money, as a component (no component created during render) */
function KindIcon({ kind, size, color }: { kind: Kind; size: number; color: string }) {
  if (kind === 'bank') return <Landmark size={size} color={color} />
  if (kind === 'wallet') return <Smartphone size={size} color={color} />
  return <Wallet size={size} color={color} />
}

const WALLETS = ['Easypaisa', 'JazzCash', 'SadaPay', 'NayaPay']

function AccountFormSheet({ open, account, onClose, onSaved }: { open: boolean; account: PositionAccount | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const { c } = useTheme()
  const { org } = useOrg()
  const { data: accounts } = useAccounts()
  const [kind, setKind] = useState<'bank' | 'wallet'>('bank')
  const [name, setName] = useState('')
  const [bank, setBank] = useState('')
  const [no, setNo] = useState('')
  const [opening, setOpening] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [last, setLast] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })

  if (last.open !== open || last.id !== (account?.id ?? null)) {
    setLast({ open, id: account?.id ?? null })
    if (open) {
      setError('')
      setKind(account?.kind ?? 'bank')
      setName(account?.name ?? '')
      setBank(account?.bank_name ?? '')
      setNo(account?.account_no ?? '')
      // opening balance is not in money_position: take it from the accounts table
      const ob = Number(accounts?.find((x) => x.id === account?.id)?.opening_balance ?? 0)
      setOpening(account && ob ? String(ob) : '')
    }
  }

  const save = async () => {
    setError('')
    if (!name.trim()) return setError(t('bankNameRequired'))
    const ob = opening.trim() === '' ? 0 : Number(opening)
    if (!Number.isFinite(ob)) return setError(t('errInvalidAmount'))
    const row = { kind, name: name.trim(), bank_name: bank.trim() || null, account_no: no.trim() || null, opening_balance: r2(ob) }
    setBusy(true)
    const { error } = account
      ? await supabase.from('money_accounts').update(row).eq('id', account.id).eq('org_id', org.id)
      : await supabase.from('money_accounts').insert({ ...row, org_id: org.id })
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={account ? t('bankEditAccount') : t('bankAddAccount')}
      footer={
        <>
          <Button variant="secondary" title={t('cancel')} onPress={onClose} style={{ flex: 1 }} />
          <Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1.4 }} />
        </>
      }
    >
      <View style={{ gap: 14 }}>
        <Field label={t('type')}>
          <Segmented
            value={kind}
            onChange={setKind}
            items={[
              { value: 'bank', label: t('bankBankAccount'), icon: <Landmark size={15} color={kind === 'bank' ? c.amber : c.muted} /> },
              { value: 'wallet', label: t('bankMobileWallet'), icon: <Smartphone size={15} color={kind === 'wallet' ? c.blue : c.muted} /> },
            ]}
          />
        </Field>
        {kind === 'wallet' && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WALLETS.map((w) => (
              <Chip
                key={w}
                label={w}
                active={bank === w}
                onPress={() => {
                  setBank(w)
                  if (!name.trim() || WALLETS.includes(name.trim())) setName(w)
                }}
              />
            ))}
          </View>
        )}
        <Field label={`${t('bankAccountName')} *`} hint={t('bankAccountNameHint')}>
          <Input value={name} onChangeText={setName} placeholder={kind === 'wallet' ? 'Easypaisa' : 'HBL'} invalid={!!error && !name.trim()} />
        </Field>
        <Pair>
          <Field label={kind === 'wallet' ? t('bankService') : t('bankBankName')} optional>
            <Input value={bank} onChangeText={setBank} placeholder={kind === 'wallet' ? 'Easypaisa, JazzCash' : 'Habib Bank'} />
          </Field>
          <Field label={kind === 'wallet' ? t('bankWalletNo') : t('bankAccountNo')} optional>
            <Input value={no} onChangeText={setNo} keyboardType={kind === 'wallet' ? 'phone-pad' : 'default'} autoCapitalize="characters" autoCorrect={false} />
          </Field>
        </Pair>
        <Field label={t('bankOpeningBalance')} optional hint={t('bankOpeningHint')}>
          <NumInput value={opening} onChangeText={setOpening} keyboardType="numbers-and-punctuation" />
        </Field>
        {!!error && <ErrorBox>{error}</ErrorBox>}
      </View>
    </Sheet>
  )
}

/** Move money between cash in hand and accounts (bank deposit / withdrawal / wallet top-up) */
export function TransferSheet({
  open, position, onClose, onSaved,
}: { open: boolean; position: MoneyPosition | null; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [wasOpen, setWasOpen] = useState(false)
  const active = (position?.accounts ?? []).filter((a) => a.is_active)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setFrom('')
      setTo(active[0]?.id ?? '')
      setAmount('')
      setDate(today)
      setNote('')
      setError('')
      setAsk(null)
    }
  }
  const nameOf = (id: string) => (id ? position?.accounts.find((a) => a.id === id)?.name ?? '' : t('cashInHandOpt'))
  const balanceOf = (id: string) => (id ? position?.accounts.find((a) => a.id === id)?.balance ?? 0 : position?.cash ?? 0)
  const n = amountOf(amount)
  const short = !!position && n > 0 && n > balanceOf(from) + 0.005

  const save = () => {
    setError('')
    if (from === to) return setError(t('bankSameAccount'))
    if (!(n > 0)) return setError(t('errInvalidAmount'))
    if (date > today) return setError(t('errInvalidDate'))
    const p = { p_org: org.id, p_date: date, p_from: from || null, p_to: to || null, p_amount: r2(n), p_note: note.trim() || null }
    setAsk({
      msg: t('bankTransferConfirm', { amount: fmtMoney(n, lang), from: nameOf(from), to: nameOf(to) }),
      run: async () => {
        setBusy(true)
        const { error } = await supabase.rpc('record_transfer', p)
        setBusy(false)
        setAsk(null)
        if (error) return setError(errText(error, t))
        onSaved()
      },
    })
  }

  const swap = () => {
    setFrom(to)
    setTo(from)
    setAsk(null)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('bankTransfer')}
      subtitle={t('bankTransferHint')}
      footer={<FormFooter ask={ask} setAsk={setAsk} busy={busy} onCancel={onClose} onSave={save} saveTitle={t('bankTransferBtn')} saveIcon={<ArrowLeftRight size={17} color={c.primaryText} />} />}
    >
      <View style={{ gap: 14 }}>
        <View>
          <Field label={t('bankFrom')} hint={position ? `${t('bankAvailable')}: ${fmtMoney(balanceOf(from), lang)}` : undefined}>
            <AccountPicker value={from} onChange={(v) => { setFrom(v); setAsk(null) }} always title={t('bankFrom')} />
          </Field>
          <View style={{ alignItems: 'center', marginVertical: -4, zIndex: 1 }}>
            <IconBtn size={38} tone="primary" icon={<ArrowUpDown size={17} color={c.primary} />} onPress={swap} label="swap" />
          </View>
          <Field label={t('bankTo')}>
            <AccountPicker value={to} onChange={(v) => { setTo(v); setAsk(null) }} always title={t('bankTo')} />
          </Field>
        </View>
        <Field label={`${t('amount')} *`}>
          <NumInput value={amount} onChangeText={(v) => { setAmount(v); setAsk(null) }} big placeholder="0" />
        </Field>
        {short && <Note>{t('bankMoreThanAvailable')}</Note>}
        <Pair>
          <Field label={t('date')}>
            <DateField value={date} onChange={(d) => { setDate(d); setAsk(null) }} max={today} label={t('date')} />
          </Field>
          <Field label={t('note')} optional>
            <Input value={note} onChangeText={setNote} />
          </Field>
        </Pair>
        {!!error && <ErrorBox>{error}</ErrorBox>}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -110, right: -70, opacity: 0.12 },
  blob2: { position: 'absolute', width: 160, height: 160, borderRadius: 80, bottom: -90, left: -50, opacity: 0.06 },
  heroIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
})
