import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Banknote, Building2, ChevronDown, Landmark, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react-native'
import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Meter } from '@/components/charts'
import { PartyAvatar } from '@/components/domain'
import { AccountPicker, accountIcon, useHasAccounts } from '@/components/money'
import {
  AnimatedNumber, Badge, Button, Card, DateField, Empty, ErrorBox, Field, Grid, IconBtn, IconTile, Input, Loading, NumInput, Row, Segmented, Select, Sheet, Txt, useFeedback,
} from '@/components/ui'
import { useAccounts } from '@/lib/accounts'
import { useOrg } from '@/lib/app'
import { amountOf, loadFacilities, type Facility, type FacilityEntry, type FacilitySummary } from '@/lib/bankMoney'
import { loadParties } from '@/lib/catalog'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney, r2 } from '@/lib/money'
import { useLayout } from '@/lib/responsive'
import { supabase } from '@/lib/supabase'
import { radius, useTheme, type Tone } from '@/lib/theme'
import { Explain, ExpiryDays, Figure, FormFooter, GlassButton, MoreButton, Note, OptionalDate, Pair, usePaged, type Ask } from './shared'

const EMPTY_SUM = (id: string): FacilitySummary => ({ facility_id: id, drawn: 0, repaid: 0, markup_paid: 0, owed: 0, guarantee_used: null })

export function FacilitiesTab() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { contentWidth } = useLayout()
  const { org, version, isAdmin, refresh } = useOrg()
  const { toast } = useFeedback()
  const { data, error, loading, reload } = useLoad(() => loadFacilities(org.id), [org.id, version])
  const [form, setForm] = useState<Facility | 'new' | null>(null)
  const [drawdown, setDrawdown] = useState<Facility | null>(null)
  const [repay, setRepay] = useState<Facility | null>(null)

  if (loading && !data) return <Loading rows={3} />
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return null

  const totalOwed = data.facilities.reduce((s, f) => s + (data.summary.get(f.id)?.owed ?? 0), 0)
  const saved = (close: () => void) => () => { close(); toast(t('saved')); refresh() }
  const owes = totalOwed > 0.005
  const grad: readonly [string, string, ...string[]] = owes ? ['#7F1D1D', '#991B1B', '#B91C1C'] : c.hero
  const finances = data.facilities.filter((f) => f.kind === 'finance' && f.is_active).length
  const guarantees = data.facilities.filter((f) => f.kind === 'guarantee' && f.is_active).length

  return (
    <View style={{ gap: 14 }}>
      {/* hero: what you owe the banks */}
      <View style={{ borderRadius: 28, overflow: 'hidden' }}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
          <View style={[styles.blob, { backgroundColor: '#fff' }]} />
          <Row gap={10}>
            <View style={styles.heroIcon}><Landmark size={20} color="#fff" /></View>
            <Txt v="label" color="rgba(255,255,255,0.75)" style={{ flex: 1 }} numberOfLines={1}>{t('bankYouOweBanks')}</Txt>
          </Row>
          <AnimatedNumber value={totalOwed} format={(n) => fmtMoney(n, lang)} size={34} color="#fff" style={{ marginTop: 10 }} />
          {(finances > 0 || guarantees > 0) && (
            <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
              {finances > 0 && <HeroPill icon={<Banknote size={13} color="#fff" />} label={`${t('bankFinance')} · ${finances}`} />}
              {guarantees > 0 && <HeroPill icon={<ShieldCheck size={13} color="#fff" />} label={`${t('bankGuarantee')} · ${guarantees}`} />}
            </Row>
          )}
          {isAdmin && (
            <GlassButton title={t('bankAddFacility')} icon={<Plus size={17} color="#fff" />} onPress={() => setForm('new')} style={{ marginTop: 18 }} />
          )}
        </LinearGradient>
      </View>

      <Explain title={t('bankFinance')}>{t('bankFinanceExplain')}</Explain>
      <Explain title={t('bankGuarantee')}>{t('bankGuaranteeExplain')}</Explain>

      {data.facilities.length === 0 ? (
        <Card>
          <Empty icon={<Landmark size={30} color={c.muted} />}>
            {t('bankNoFacilities')}{!isAdmin ? ` ${t('bankAskOwner')}` : ''}
          </Empty>
        </Card>
      ) : (
        <Grid cols={contentWidth >= 680 ? 2 : 1} min={1} gap={14}>
          {data.facilities.map((f) => (
            <FacilityCard
              key={f.id}
              f={f}
              sum={data.summary.get(f.id) ?? EMPTY_SUM(f.id)}
              entries={data.byFacility.get(f.id) ?? []}
              onEdit={() => setForm(f)}
              onDrawdown={() => setDrawdown(f)}
              onRepay={() => setRepay(f)}
            />
          ))}
        </Grid>
      )}

      <FacilityFormSheet
        open={!!form}
        facility={form === 'new' ? null : form}
        hasEntries={form && form !== 'new' ? (data.byFacility.get(form.id)?.length ?? 0) > 0 : false}
        onClose={() => setForm(null)}
        onSaved={saved(() => setForm(null))}
      />
      <DrawdownSheet facility={drawdown} onClose={() => setDrawdown(null)} onSaved={saved(() => setDrawdown(null))} />
      <RepaySheet facility={repay} owed={repay ? data.summary.get(repay.id)?.owed ?? 0 : 0} onClose={() => setRepay(null)} onSaved={saved(() => setRepay(null))} />
    </View>
  )
}

function HeroPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)' }}>
      {icon}
      <Txt v="tiny" color="#fff" numberOfLines={1}>{label}</Txt>
    </View>
  )
}

function FacilityCard({
  f, sum, entries, onEdit, onDrawdown, onRepay,
}: { f: Facility; sum: FacilitySummary; entries: FacilityEntry[]; onEdit: () => void; onDrawdown: () => void; onRepay: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, isAdmin, refresh } = useOrg()
  const { toast, confirm } = useFeedback()
  const { data: accounts } = useAccounts()
  const [open, setOpen] = useState(false)
  const pg = usePaged(entries, 10, f.id)
  const finance = f.kind === 'finance'
  const used = finance ? sum.owed : Math.max(sum.guarantee_used ?? 0, 0)
  const ratio = f.limit_amount > 0 ? used / f.limit_amount : 0
  const linked = f.account_id ? accounts?.find((a) => a.id === f.account_id)?.name : null
  const meterColor = ratio > 1 ? c.red : ratio > 0.8 ? c.amber : c.primary
  const m = (n: number) => fmtMoney(n, lang)

  const removeEntry = async (e: FacilityEntry) => {
    if (!(await confirm(t('bankDeleteEntryConfirm', { amount: m(e.amount) }), { okLabel: t('delete') }))) return
    // repayment / markup: delete the money entry, the facility entry goes with it
    const { error } = e.cash_entry_id
      ? await supabase.from('cash_entries').delete().eq('id', e.cash_entry_id).eq('org_id', org.id)
      : await supabase.from('facility_entries').delete().eq('id', e.id).eq('org_id', org.id)
    if (error) return toast(errText(error, t), 'err')
    toast(t('deleted'))
    refresh()
  }

  return (
    <Card padded={false} style={[{ flex: 1, overflow: 'hidden' }, !f.is_active && { backgroundColor: c.surface2, borderStyle: 'dashed', borderColor: c.borderStrong }]}>
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <IconTile icon={finance ? <Banknote size={22} color={c.amber} /> : <ShieldCheck size={22} color={c.blue} />} tone={finance ? 'amber' : 'blue'} size={48} />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Txt v="h3" numberOfLines={1}>{f.bank_name}</Txt>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Badge tone={finance ? 'amber' : 'blue'}>{finance ? t('bankFinance') : t('bankGuarantee')}</Badge>
            {!f.is_active && <Badge>{t('inactive')}</Badge>}
          </Row>
          {!!f.title && <Txt v="small" soft numberOfLines={1}>{f.title}</Txt>}
          {!finance && !!f.party_id && (
            <Pressable onPress={() => router.push(`/party/${f.party_id}`)} hitSlop={6}>
              <Txt v="small" soft numberOfLines={1}>
                {t('bankForCompany')}: <Txt v="small" weight="bold" color={c.primary}>{f.parties?.name ?? ''}</Txt>
              </Txt>
            </Pressable>
          )}
        </View>
        {isAdmin && <IconBtn size={38} icon={<Pencil size={16} color={c.text} />} onPress={onEdit} label={t('edit')} />}
      </View>

      <View style={{ padding: 16, gap: 14 }}>
        {/* limit, dates, account */}
        <View style={{ gap: 6 }}>
          <Row between>
            <Txt v="small" muted>{t('bankLimit')}</Txt>
            <Txt v="small" weight="extrabold" style={{ fontVariant: ['tabular-nums'] }}>{m(f.limit_amount)}</Txt>
          </Row>
          {!!f.expiry_date && (
            <Row between style={{ flexWrap: 'wrap' }}>
              <Txt v="small" muted>{finance ? t('bankRepayBy') : t('bankValidUntil')}</Txt>
              <Row gap={6}>
                <Txt v="small" weight="bold">{fmtDate(f.expiry_date, lang)}</Txt>
                {(finance ? sum.owed > 0 : f.is_active) && <ExpiryDays date={f.expiry_date} />}
              </Row>
            </Row>
          )}
          {!!linked && (
            <Row between>
              <Txt v="small" muted>{t('accountLabel')}</Txt>
              <Txt v="small" weight="bold" numberOfLines={1} style={{ flexShrink: 1 }}>{linked}</Txt>
            </Row>
          )}
        </View>

        {/* figures */}
        {finance ? (
          <View style={{ gap: 12 }}>
            <Figure label={t('bankOwedNow')} value={m(sum.owed)} color={sum.owed > 0 ? c.red : undefined} />
            <Row gap={12}>
              <Figure label={t('bankRepaid')} value={m(sum.repaid)} color={c.green} />
              <Figure label={t('bankMarkupPaid')} value={m(sum.markup_paid)} />
            </Row>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Row gap={12}>
              <Figure label={t('bankGuaranteeUsed')} value={m(used)} color={ratio > 1 ? c.red : ratio > 0.8 ? c.amber : undefined} />
              <Figure label={t('bankGuaranteeLeft')} value={m(Math.max(f.limit_amount - used, 0))} />
            </Row>
            {sum.owed > 0 && <Figure label={t('bankOwedNow')} value={m(sum.owed)} color={c.red} />}
          </View>
        )}

        {f.limit_amount > 0 && (
          <View style={{ gap: 6 }}>
            <Meter value={ratio} color={meterColor} track={c.surface3} height={10} />
            <Txt v="tiny" muted>
              {finance ? t('bankUsedOfLimit', { pct: Math.round(ratio * 100) }) : t('bankCoveredOfLimit', { pct: Math.round(ratio * 100) })}
            </Txt>
          </View>
        )}
        {!finance && ratio > 1 && <Note tone="red">{t('bankOverGuarantee')}</Note>}
        {!!f.note && <Txt v="small" muted>{f.note}</Txt>}

        {isAdmin && (
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant={sum.owed > 0 ? 'secondary' : 'primary'}
              title={finance ? t('bankPaidCompany') : t('bankGuaranteeCashed')}
              icon={<Landmark size={15} color={sum.owed > 0 ? c.text : c.primaryText} />}
              onPress={onDrawdown}
              style={{ flexGrow: 1 }}
            />
            {/* markup can still be due after the loan itself is paid back */}
            {(sum.owed > 0 || sum.drawn > 0) && (
              <Button
                size="sm"
                variant={sum.owed > 0 ? 'primary' : 'secondary'}
                title={t('bankRepay')}
                icon={<Banknote size={15} color={sum.owed > 0 ? c.primaryText : c.text} />}
                onPress={onRepay}
                style={{ flexGrow: 1 }}
              />
            )}
          </Row>
        )}
      </View>

      {/* history */}
      <View style={{ marginTop: 'auto', borderTopWidth: 1, borderTopColor: c.border }}>
        <Pressable onPress={() => setOpen((v) => !v)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
          <Txt v="small" weight="bold" soft style={{ flex: 1 }}>{t('bankHistory')} ({entries.length})</Txt>
          <ChevronDown size={18} color={c.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </Pressable>
        {open && (entries.length === 0 ? (
          <Txt v="small" muted style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{t('bankNoHistory')}</Txt>
        ) : (
          <View style={{ paddingBottom: 8 }}>
            {pg.items.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.border }}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Row gap={6}>
                    <Badge tone={entryTone(e.kind)}>{t(`bankFe_${e.kind}`)}</Badge>
                    <Txt v="tiny" muted>{fmtDate(e.entry_date, lang)}</Txt>
                  </Row>
                  {(!!e.parties?.name || !!e.note || !!e.created_by_name) && (
                    <Txt v="tiny" soft>
                      {!!e.parties?.name && (
                        <Txt v="tiny" weight="bold" color={c.primary} onPress={() => router.push(`/party/${e.party_id}`)}>{e.parties.name}</Txt>
                      )}
                      {e.parties?.name && e.note ? ' · ' : ''}
                      {e.note ?? ''}
                      {e.created_by_name ? `${e.parties?.name || e.note ? ' · ' : ''}${t('by')} ${e.created_by_name}` : ''}
                    </Txt>
                  )}
                </View>
                <Txt v="small" weight="extrabold" color={e.kind === 'drawdown' ? c.red : c.text} style={{ fontVariant: ['tabular-nums'] }}>{m(e.amount)}</Txt>
                {isAdmin && (
                  <IconBtn size={32} tone="red" icon={<Trash2 size={14} color={c.red} />} onPress={() => removeEntry(e)} label={t('delete')} />
                )}
              </View>
            ))}
            {pg.more && <MoreButton onPress={pg.showMore} left={entries.length - pg.items.length} />}
          </View>
        ))}
      </View>
    </Card>
  )
}

const entryTone = (k: FacilityEntry['kind']): Tone => (k === 'drawdown' ? 'red' : k === 'repayment' ? 'green' : 'orange')

function FacilityFormSheet({
  open, facility, hasEntries, onClose, onSaved,
}: { open: boolean; facility: Facility | null; hasEntries: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const { c } = useTheme()
  const { org } = useOrg()
  const { toast } = useFeedback()
  const { data: accounts } = useAccounts()
  const [kind, setKind] = useState<'finance' | 'guarantee'>('finance')
  const [bank, setBank] = useState('')
  const [title, setTitle] = useState('')
  const [limit, setLimit] = useState('')
  const [start, setStart] = useState('')
  const [expiry, setExpiry] = useState('')
  const [party, setParty] = useState('')
  const [account, setAccount] = useState('')
  const [active, setActive] = useState(true)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [last, setLast] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const choices = useCompanyChoices(open)

  if (last.open !== open || last.id !== (facility?.id ?? null)) {
    setLast({ open, id: facility?.id ?? null })
    if (open) {
      setKind(facility?.kind ?? 'finance')
      setBank(facility?.bank_name ?? '')
      setTitle(facility?.title ?? '')
      setLimit(facility?.limit_amount ? String(facility.limit_amount) : '')
      setStart(facility?.start_date ?? '')
      setExpiry(facility?.expiry_date ?? '')
      setParty(facility?.party_id ?? '')
      setAccount(facility?.account_id ?? '')
      setActive(facility?.is_active ?? true)
      setNote(facility?.note ?? '')
      setError('')
      setAsk(null)
    }
  }

  const save = async () => {
    setError('')
    setAsk(null)
    if (!bank.trim()) return setError(t('bankBankRequired'))
    const lim = limit.trim() === '' ? 0 : Number(limit)
    if (!(lim >= 0)) return setError(t('errInvalidAmount'))
    if (kind === 'guarantee' && !party) return setError(t('bankPickCompany'))
    if (start && expiry && expiry < start) return setError(t('errInvalidDate'))
    const row = {
      kind, bank_name: bank.trim(), title: title.trim() || null, limit_amount: r2(lim),
      start_date: start || null, expiry_date: expiry || null,
      party_id: kind === 'guarantee' ? party || null : null, account_id: account || null,
      is_active: active, note: note.trim() || null,
    }
    setBusy(true)
    if (kind === 'guarantee' && party.startsWith('co:')) {
      try {
        row.party_id = await choices.resolve(party)
      } catch (e) {
        setBusy(false)
        return setError(errText(e, t))
      }
    }
    const { error } = facility
      ? await supabase.from('bank_facilities').update(row).eq('id', facility.id).eq('org_id', org.id)
      : await supabase.from('bank_facilities').insert({ ...row, org_id: org.id })
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved()
  }

  const remove = () => {
    if (!facility) return
    setAsk({
      msg: t('bankDeleteFacilityConfirm'),
      run: async () => {
        setBusy(true)
        const { error } = await supabase.from('bank_facilities').delete().eq('id', facility.id).eq('org_id', org.id)
        setBusy(false)
        setAsk(null)
        if (error) return setError(errText(error, t))
        toast(t('deleted'))
        onSaved()
      },
    })
  }

  const companyOptions = [
    ...(choices.data?.suppliers ?? []).filter((p) => p.is_active || p.id === party).map((p) => ({
      value: p.id, label: p.name, icon: <PartyAvatar name={p.name} kind="supplier" size={32} />,
    })),
    ...(choices.data?.companies ?? []).map((co) => ({
      value: `co:${co.id}`, label: co.name, sub: t('mBankNewKhata'), icon: <IconTile icon={<Building2 size={16} color={c.blue} />} tone="blue" size={32} />,
    })),
  ]
  const accountOptions = [
    { value: '', label: t('bankNone') },
    ...(accounts ?? []).filter((a) => a.is_active || a.id === account).map((a) => {
      const Icon = accountIcon(a.kind)
      return { value: a.id, label: a.name, sub: a.account_no ?? undefined, icon: <Icon size={18} color={c.blue} /> }
    }),
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={facility ? t('bankEditFacility') : t('bankAddFacility')}
      footer={
        <FormFooter
          ask={ask}
          setAsk={setAsk}
          busy={busy}
          danger
          onCancel={onClose}
          onSave={() => { void save() }}
          left={facility && !hasEntries ? (
            <IconBtn size={48} tone="red" icon={<Trash2 size={18} color={c.red} />} onPress={remove} label={t('delete')} />
          ) : undefined}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <Segmented
          value={kind}
          onChange={setKind}
          items={[
            { value: 'finance', label: t('bankFinance'), icon: <Banknote size={15} color={kind === 'finance' ? c.amber : c.muted} /> },
            { value: 'guarantee', label: t('bankGuarantee'), icon: <ShieldCheck size={15} color={kind === 'guarantee' ? c.blue : c.muted} /> },
          ]}
        />
        <Txt v="small" muted>{kind === 'finance' ? t('bankFinanceExplain') : t('bankGuaranteeExplain')}</Txt>
        <Pair>
          <Field label={`${t('bankBankName')} *`}>
            <Input value={bank} onChangeText={setBank} placeholder="HBL, MCB, Bank Alfalah" invalid={!!error && !bank.trim()} />
          </Field>
          <Field label={t('bankFacilityTitle')} optional>
            <Input value={title} onChangeText={setTitle} placeholder={kind === 'finance' ? t('bankTitleFinanceEg') : t('bankTitleGuaranteeEg')} />
          </Field>
        </Pair>
        {kind === 'guarantee' && (
          <Field label={`${t('bankGuaranteeFor')} *`}>
            <Select value={party} onChange={setParty} options={companyOptions} title={t('bankGuaranteeFor')} placeholder={t('bankChoose')} />
          </Field>
        )}
        <Field label={t('bankLimit')} hint={kind === 'finance' ? t('bankLimitFinanceHint') : t('bankLimitGuaranteeHint')}>
          <NumInput value={limit} onChangeText={setLimit} big placeholder="0" />
        </Field>
        <Pair>
          <Field label={t('bankStartDate')} optional>
            <OptionalDate value={start} onChange={setStart} label={t('bankStartDate')} />
          </Field>
          <Field label={kind === 'finance' ? t('bankRepayBy') : t('bankValidUntil')} optional>
            <OptionalDate value={expiry} onChange={setExpiry} label={kind === 'finance' ? t('bankRepayBy') : t('bankValidUntil')} min={start || undefined} />
          </Field>
        </Pair>
        {(accounts ?? []).length > 0 && (
          <Field label={t('bankLinkedAccount')} optional>
            <Select value={account} onChange={setAccount} options={accountOptions} title={t('bankLinkedAccount')} />
          </Field>
        )}
        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {!!facility && (
          <Field label={t('status')}>
            <Segmented
              value={active ? 'on' : 'off'}
              onChange={(v) => setActive(v === 'on')}
              items={[{ value: 'on', label: t('active') }, { value: 'off', label: t('inactive') }]}
            />
          </Field>
        )}
        {!!error && <ErrorBox>{error}</ErrorBox>}
      </View>
    </Sheet>
  )
}

/** The bank paid a company for you (finance), or the company encashed the guarantee */
function DrawdownSheet({ facility, onClose, onSaved }: { facility: Facility | null; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const [party, setParty] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const [filled, setFilled] = useState(false)
  const open = !!facility
  const choices = useCompanyChoices(open)
  const suppliers = { data: choices.data?.suppliers, loading: choices.loading }
  const list = (suppliers.data ?? []).filter((p) => p.is_active || p.id === party).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
  const payable = (id: string) => Math.max(suppliers.data?.find((p) => p.id === id)?.balance ?? 0, 0)

  const pickParty = (id: string) => {
    setParty(id)
    setAsk(null)
    const p = payable(id)
    setAmount(p > 0 ? String(p) : '')
  }

  if ((facility?.id ?? null) !== last) {
    setLast(facility?.id ?? null)
    if (facility) {
      setParty(facility.party_id ?? '')
      setAmount('')
      setFilled(false)
      setDate(today)
      setNote('')
      setError('')
      setAsk(null)
    }
  }
  // the guarantee's company is pre-selected: fill its payable once the list has loaded
  if (facility && !filled && !suppliers.loading && (suppliers.data?.length ?? 0) > 0) {
    setFilled(true)
    if (party && payable(party) > 0) setAmount(String(payable(party)))
  }

  const save = () => {
    if (!facility) return
    setError('')
    const n = amountOf(amount)
    if (!party) return setError(t('bankPickCompany'))
    if (!(n > 0)) return setError(t('errInvalidAmount'))
    if (date > today) return setError(t('errInvalidDate'))
    const name = choices.nameOf(party)
    const chosen = party
    const p = { p_org: org.id, p_facility: facility.id, p_date: date, p_amount: r2(n), p_note: note.trim() || null }
    setAsk({
      msg: t('bankDrawdownConfirm', { bank: facility.bank_name, amount: fmtMoney(n, lang), name }),
      run: async () => {
        setBusy(true)
        let partyId = chosen
        try {
          partyId = await choices.resolve(chosen)
        } catch (e) {
          setBusy(false)
          setAsk(null)
          return setError(errText(e, t))
        }
        const { error } = await supabase.rpc('facility_drawdown', { ...p, p_party: partyId })
        setBusy(false)
        setAsk(null)
        if (error) return setError(errText(error, t))
        onSaved()
      },
    })
  }

  const options = [
    ...list.map((p) => ({
      value: p.id,
      label: p.name,
      sub: p.balance > 0 ? `${t('youOwe')} ${fmtMoney(p.balance, lang)}` : undefined,
      icon: <PartyAvatar name={p.name} kind="supplier" size={32} />,
    })),
    ...(choices.data?.companies ?? []).map((co) => ({
      value: `co:${co.id}`, label: co.name, sub: t('mBankNewKhata'), icon: <IconTile icon={<Building2 size={16} color={c.blue} />} tone="blue" size={32} />,
    })),
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={facility?.kind === 'guarantee' ? t('bankGuaranteeCashed') : t('bankPaidCompany')}
      subtitle={facility ? (facility.kind === 'guarantee' ? t('bankGuaranteeCashedHint', { bank: facility.bank_name }) : t('bankPaidCompanyHint', { bank: facility.bank_name })) : undefined}
      footer={<FormFooter ask={ask} setAsk={setAsk} busy={busy} onCancel={onClose} onSave={save} />}
    >
      {facility && (
        <View style={{ gap: 14 }}>
          <Field label={`${t('bankCompany')} *`}>
            <Select value={party} onChange={pickParty} options={options} title={t('bankCompany')} placeholder={t('bankChoose')} />
          </Field>
          {party.startsWith('co:') && <Note tone="blue">{t('bankNewKhataHint', { name: choices.nameOf(party) })}</Note>}
          {!!party && !party.startsWith('co:') && (
            <Row between style={{ padding: 14, borderRadius: radius.md, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
              <Txt v="small" muted style={{ flexShrink: 1 }}>{t('bankYouOweCompany')}</Txt>
              <Txt weight="extrabold" style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(payable(party), lang)}</Txt>
            </Row>
          )}
          <Field label={`${t('bankAmountBankPaid')} *`}>
            <NumInput value={amount} onChangeText={(v) => { setAmount(v); setAsk(null) }} big placeholder="0" />
          </Field>
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
      )}
    </Sheet>
  )
}

/** You pay the bank back: principal lowers what you owe; markup / charges is an expense */
function RepaySheet({ facility, owed, onClose, onSaved }: { facility: Facility | null; owed: number; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const [principal, setPrincipal] = useState('')
  const [markup, setMarkup] = useState('')
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const { data: accounts } = useAccounts()
  const hasAccounts = useHasAccounts()
  if ((facility?.id ?? null) !== last) {
    setLast(facility?.id ?? null)
    if (facility) {
      setPrincipal(owed > 0 ? String(owed) : '')
      setMarkup('')
      const linked = facility.account_id && accounts?.find((a) => a.id === facility.account_id && a.is_active)
      setAccount(linked ? facility.account_id ?? '' : '')
      setDate(today)
      setNote('')
      setError('')
      setAsk(null)
    }
  }
  const p = principal.trim() === '' ? 0 : Number(principal)
  const mk = markup.trim() === '' ? 0 : Number(markup)
  const total = (p > 0 ? p : 0) + (mk > 0 ? mk : 0)
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setAsk(null) }

  const save = () => {
    if (!facility) return
    setError('')
    if (!(p >= 0) || !(mk >= 0) || total <= 0) return setError(t('errInvalidAmount'))
    if (p > owed + 0.005) return setError(t('errRepayTooMuch'))
    if (date > today) return setError(t('errInvalidDate'))
    const from = account ? accounts?.find((a) => a.id === account)?.name ?? '' : t('cashInHandOpt')
    const args = {
      p_org: org.id, p_facility: facility.id, p_date: date, p_principal: r2(p), p_markup: r2(mk),
      p_account: account || null, p_note: note.trim() || null,
    }
    setAsk({
      msg: t('bankRepayConfirm', { amount: fmtMoney(total, lang), bank: facility.bank_name, from }),
      run: async () => {
        setBusy(true)
        const { error } = await supabase.rpc('facility_repay', args)
        setBusy(false)
        setAsk(null)
        if (error) return setError(errText(error, t))
        onSaved()
      },
    })
  }

  return (
    <Sheet open={!!facility} onClose={onClose} title={t('bankRepay')} footer={<FormFooter ask={ask} setAsk={setAsk} busy={busy} onCancel={onClose} onSave={save} />}>
      {facility && (
        <View style={{ gap: 14 }}>
          <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: c.redSoft, gap: 2 }}>
            <Txt v="small" weight="semibold" color={c.red} numberOfLines={1}>{t('bankYouOweBank', { bank: facility.bank_name })}</Txt>
            <Txt v="h1" color={c.red} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(owed, lang)}</Txt>
          </View>
          <Pair>
            <Field label={t('bankPrincipal')} hint={t('bankPrincipalHint')}>
              <NumInput value={principal} onChangeText={edit(setPrincipal)} big placeholder="0" />
            </Field>
            <Field label={t('bankMarkupCharges')} optional hint={t('bankMarkupHint')}>
              <NumInput value={markup} onChangeText={edit(setMarkup)} big placeholder="0" />
            </Field>
          </Pair>
          {(hasAccounts || !!account) && (
            <Field label={t('bankPaidFrom')}>
              <AccountPicker value={account} onChange={edit(setAccount)} title={t('bankPaidFrom')} />
            </Field>
          )}
          <Pair>
            <Field label={t('date')}>
              <DateField value={date} onChange={edit(setDate)} max={today} label={t('date')} />
            </Field>
            <Field label={t('note')} optional>
              <Input value={note} onChangeText={setNote} />
            </Field>
          </Pair>
          <Row between style={{ padding: 14, borderRadius: radius.md, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
            <Txt weight="bold">{t('bankTotalPaying')}</Txt>
            <Txt v="h3" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{fmtMoney(total, lang)}</Txt>
          </Row>
          {!!error && <ErrorBox>{error}</ErrorBox>}
        </View>
      )}
    </Sheet>
  )
}

/**
 * Companies to choose from: the supplier khata accounts, plus the product companies
 * (DJC, Bayer, Starco...) that have no khata account yet (value 'co:<company id>').
 */
function useCompanyChoices(open: boolean) {
  const { org, version } = useOrg()
  const res = useLoad(async () => {
    if (!open) return { suppliers: [] as Awaited<ReturnType<typeof loadParties>>, companies: [] as { id: string; name: string }[] }
    const [suppliers, co] = await Promise.all([
      loadParties(org.id, 'supplier'),
      supabase.from('companies').select('id, name').eq('org_id', org.id).order('name'),
    ])
    const have = new Set(suppliers.map((x) => x.name.trim().toLowerCase()))
    const companies = ((co.data ?? []) as { id: string; name: string }[]).filter((x) => !have.has(x.name.trim().toLowerCase()))
    return { suppliers, companies }
  }, [org.id, open, version])
  const nameOf = (value: string) =>
    value.startsWith('co:')
      ? res.data?.companies.find((x) => `co:${x.id}` === value)?.name ?? ''
      : res.data?.suppliers.find((x) => x.id === value)?.name ?? ''
  /** the khata account for a choice (a company gets one the first time it is used) */
  const resolve = async (value: string): Promise<string> => {
    if (!value.startsWith('co:')) return value
    const { data, error } = await supabase.from('parties').insert({ org_id: org.id, kind: 'supplier', name: nameOf(value) }).select('id').single()
    if (error) throw error
    return data.id as string
  }
  return { ...res, nameOf, resolve }
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -110, right: -70, opacity: 0.1 },
  heroIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
})
