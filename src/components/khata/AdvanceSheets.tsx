import { ArrowDownToLine, ArrowRightLeft, Sprout, Undo2 } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { FormFooter, Pair, type Ask } from '@/components/bank/shared'
import { PartyAvatar, PartyPickerSheet } from '@/components/domain'
import { PartyFormSheet } from '@/components/forms'
import { AccountPicker, useHasAccounts } from '@/components/money'
import { Button, Chip, DateField, ErrorBox, Field, Input, NumInput, Row, SelectButton, Sheet, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { advanceTitle, CROPS, cropToStore, type CropAdvance } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { radius, useTheme } from '@/lib/theme'
import type { PartyBalance } from '@/lib/types'

function Chips({ items, value, onPick }: { items: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((x) => <Chip key={x} label={x} active={x === value} onPress={() => onPick(x)} />)}
    </View>
  )
}

/** Open a crop advance: a farmer pays in advance for a crop / season */
export function NewAdvanceSheet({
  open, onClose, onSaved, party, parties, onPartyCreated,
}: {
  open: boolean
  onClose: () => void
  onSaved: (partyId: string) => void
  /** fixed customer (party detail screen) */
  party?: { id: string; name: string } | null
  /** customers to choose from (khata list) */
  parties?: PartyBalance[]
  onPartyCreated?: () => void
}) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const [partyId, setPartyId] = useState('')
  const [crop, setCrop] = useState('')
  const [season, setSeason] = useState('')
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(false)
  const [newParty, setNewParty] = useState(false)
  const [last, setLast] = useState(false)
  if (open !== last) {
    setLast(open)
    if (open) {
      setPartyId(party?.id ?? '')
      setCrop('')
      setSeason('')
      setAmount('')
      setAccount('')
      setDate(today)
      setNote('')
      setError('')
    }
  }
  const y = Number(today.slice(0, 4))
  const yy = (n: number) => String(n % 100).padStart(2, '0')
  const seasons = [String(y), `${t('khRabi')} ${y}-${yy(y + 1)}`, `${t('khKharif')} ${y}`, String(y + 1)]
  const chosen = (parties ?? []).find((p) => p.id === partyId)

  const save = async () => {
    setError('')
    const pid = party?.id ?? partyId
    if (!pid) return setError(t('khChooseCustomer'))
    if (!crop.trim()) return setError(t('khEnterCrop'))
    if (!(Number(amount) > 0)) return setError(t('errInvalidAmount'))
    setBusy(true)
    const { error } = await supabase.rpc('open_crop_advance', {
      p_org: org.id, p_party: pid, p_crop: cropToStore(crop, t), p_season: season.trim() || null,
      p_date: date, p_amount: Number(amount), p_account: account || null, p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setError(errText(error, t))
    onSaved(pid)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('khNewAdvance')}
      full
      footer={
        <>
          <Button variant="secondary" title={t('cancel')} onPress={onClose} style={{ flex: 1 }} />
          <Button title={t('save')} icon={<Sprout size={17} color={c.primaryText} />} onPress={save} loading={busy} style={{ flex: 1.4 }} />
        </>
      }
    >
      <View collapsable={false} style={{ gap: 14 }}>
        <Txt v="small" muted>{t('khAdvanceExplain')}</Txt>
        {party ? (
          <Row gap={10} style={{ padding: 12, borderRadius: radius.md, backgroundColor: c.surface2 }}>
            <PartyAvatar name={party.name} kind="customer" size={34} />
            <Txt weight="bold" numberOfLines={1} style={{ flex: 1 }}>{party.name}</Txt>
          </Row>
        ) : (
          <Field label={`${t('customer')} *`}>
            <SelectButton
              label={chosen?.name}
              sub={chosen ? `${t('balance')}: ${fmtMoney(chosen.balance, lang)}` : undefined}
              placeholder={t('khChooseCustomer')}
              icon={chosen ? <PartyAvatar name={chosen.name} kind="customer" size={32} /> : undefined}
              onPress={() => setPicking(true)}
            />
          </Field>
        )}
        <Field label={`${t('khCrop')} *`}>
          <Input value={crop} onChangeText={setCrop} placeholder={t('khCropPotato')} />
          <Chips items={CROPS.map((x) => t(x.key))} value={crop} onPick={setCrop} />
        </Field>
        <Field label={t('khSeason')} optional>
          <Input value={season} onChangeText={setSeason} placeholder={`${y} / ${t('khRabi')} ${y}-${yy(y + 1)}`} />
          <Chips items={seasons} value={season} onPick={setSeason} />
        </Field>
        <Pair>
          <Field label={`${t('amount')} *`}>
            <NumInput value={amount} onChangeText={setAmount} placeholder="0" />
          </Field>
          <Field label={t('date')}>
            <DateField value={date} onChange={setDate} max={today} label={t('date')} />
          </Field>
        </Pair>
        <AccountField label={t('khReceivedIn')} value={account} onChange={setAccount} />
        <Field label={t('note')} optional>
          <Input value={note} onChangeText={setNote} />
        </Field>
        {!!error && <ErrorBox>{error}</ErrorBox>}
      </View>

      {/* nested inside this sheet so they open on top of it */}
      {!party && (
        <>
          <PartyPickerSheet
            open={picking}
            onClose={() => setPicking(false)}
            kind="customer"
            parties={parties ?? []}
            value={partyId}
            onPick={setPartyId}
            noneLabel={t('khChooseCustomer')}
            onNew={() => setNewParty(true)}
          />
          <PartyFormSheet
            open={newParty}
            onClose={() => setNewParty(false)}
            kind="customer"
            onSaved={(id) => {
              setNewParty(false)
              setPartyId(id)
              onPartyCreated?.()
            }}
          />
        </>
      )}
    </Sheet>
  )
}

/** Account picker inside a Field; nothing at all for a cash-only shop */
export function AccountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const has = useHasAccounts()
  if (!has && !value) return null
  return (
    <Field label={label}>
      <AccountPicker value={value} onChange={onChange} title={label} />
    </Field>
  )
}

export type MoveKind = 'deposit' | 'refund' | 'to_khata'

/** Add money to / refund from / move to khata a crop advance */
export function AdvanceMoveSheet({
  advance, kind, partyName, onClose, onSaved,
}: {
  advance: CropAdvance | null
  kind: MoveKind
  partyName: string
  onClose: () => void
  onSaved: () => void
}) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org, today } = useOrg()
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ask, setAsk] = useState<Ask | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const key = advance ? `${advance.id}:${kind}` : null
  if (key !== last) {
    setLast(key)
    if (advance) {
      setAmount(kind !== 'deposit' && advance.balance > 0 ? String(advance.balance) : '')
      setAccount('')
      setDate(today)
      setNote('')
      setError('')
      setAsk(null)
    }
  }
  const title = kind === 'deposit' ? t('khAddMoney') : kind === 'refund' ? t('khRefund') : t('khMoveToKhata')
  const Icon = kind === 'deposit' ? ArrowDownToLine : kind === 'refund' ? Undo2 : ArrowRightLeft
  const n = Number(amount)

  const run = async () => {
    if (!advance) return
    setBusy(true)
    const { error } = await supabase.rpc('advance_move', {
      p_org: org.id, p_advance: advance.id, p_kind: kind, p_date: date, p_amount: n,
      p_account: kind === 'to_khata' ? null : account || null, p_note: note.trim() || null,
    })
    setBusy(false)
    setAsk(null)
    if (error) return setError(errText(error, t))
    onSaved()
  }

  const save = () => {
    if (!advance) return
    setError('')
    if (!(n > 0)) return setError(t('errInvalidAmount'))
    if (kind !== 'deposit' && n > advance.balance + 0.005) return setError(t('errAdvanceTooMuch'))
    const money = fmtMoney(n, lang)
    if (kind === 'to_khata') return setAsk({ msg: t('khMoveConfirm', { amount: money, name: partyName }), run })
    if (kind === 'refund') return setAsk({ msg: t('khRefundConfirm', { amount: money, name: partyName }), run })
    void run()
  }
  // any change after the question was asked asks again
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setAsk(null)
  }

  return (
    <Sheet
      open={!!advance}
      onClose={onClose}
      title={title}
      footer={<FormFooter ask={ask} setAsk={setAsk} busy={busy} onCancel={onClose} onSave={save} saveIcon={<Icon size={17} color={c.primaryText} />} />}
    >
      {advance && (
        <View collapsable={false} style={{ gap: 14 }}>
          <View style={{ padding: 16, borderRadius: radius.lg, backgroundColor: c.blueSoft, gap: 4 }}>
            <Txt weight="bold" numberOfLines={2}>{partyName} · {advanceTitle(advance, t)}</Txt>
            <Txt v="tiny" muted>{t('khLeft')}</Txt>
            <Txt v="h1" color={c.blue} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(advance.balance, lang)}</Txt>
          </View>
          {kind === 'to_khata' && <Txt v="small" muted>{t('khMoveExplain')}</Txt>}
          {kind === 'refund' && <Txt v="small" muted>{t('khRefundExplain')}</Txt>}
          <Pair>
            <Field label={`${t('amount')} *`}>
              <NumInput value={amount} onChangeText={edit(setAmount)} placeholder="0" />
            </Field>
            <Field label={t('date')}>
              <DateField value={date} onChange={edit(setDate)} max={today} label={t('date')} />
            </Field>
          </Pair>
          {kind !== 'to_khata' && (
            <AccountField label={kind === 'deposit' ? t('khReceivedIn') : t('khPaidFrom')} value={account} onChange={edit(setAccount)} />
          )}
          <Field label={t('note')} optional>
            <Input value={note} onChangeText={edit(setNote)} />
          </Field>
          {n > 0 && (
            <Txt v="small" muted>
              {t('khLeftAfter')}: <Txt v="small" weight="extrabold">{fmtMoney(kind === 'deposit' ? advance.balance + n : advance.balance - n, lang)}</Txt>
            </Txt>
          )}
          {!!error && <ErrorBox>{error}</ErrorBox>}
        </View>
      )}
    </Sheet>
  )
}
