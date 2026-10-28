import { router } from 'expo-router'
import { ArrowDownToLine, ArrowRightLeft, ChevronDown, ChevronUp, Lock, LockOpen, Plus, Sprout, Trash2, Undo2 } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Badge, Button, Card, Empty, IconBtn, IconTile, Row, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { advanceTitle, type AdvanceEntry, type AdvanceKind, type CropAdvance } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { radius, useTheme, type Tone } from '@/lib/theme'
import { AdvanceMoveSheet, NewAdvanceSheet, type MoveKind } from './AdvanceSheets'

const KIND_TONE: Record<AdvanceKind, Tone> = { deposit: 'green', use: 'amber', refund: 'red', to_khata: 'blue' }

/** A customer's crop advances (kept apart from the khata) */
export function PartyAdvances({
  party, advances, entries, onChanged,
}: {
  party: { id: string; name: string }
  advances: CropAdvance[]
  entries: AdvanceEntry[]
  onChanged: () => void
}) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { isAdmin } = useOrg()
  const { toast, confirm } = useFeedback()
  const [adding, setAdding] = useState(false)
  const [move, setMove] = useState<{ advance: CropAdvance; kind: MoveKind } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const done = (msg: string) => {
    toast(msg)
    onChanged()
  }

  const toggleClosed = async (a: CropAdvance) => {
    if (!a.is_closed && a.balance > 0.005 && !(await confirm(t('khCloseWithMoney', { amount: fmtMoney(a.balance, lang) }), { danger: false }))) return
    setBusy(a.id)
    const { error } = await supabase.from('crop_advances').update({ is_closed: !a.is_closed }).eq('id', a.id)
    setBusy(null)
    if (error) return toast(errText(error, t), 'err')
    done(a.is_closed ? t('khReopened') : t('khClosed'))
  }

  const removeAdvance = async (a: CropAdvance) => {
    if (!(await confirm(t('khDeleteAdvanceConfirm'), { okLabel: t('delete') }))) return
    const { error } = await supabase.from('crop_advances').delete().eq('id', a.id)
    if (error) return toast(errText(error, t), 'err')
    done(t('deleted'))
  }

  const removeEntry = async (e: AdvanceEntry) => {
    if (!(await confirm(t('khDeleteEntryConfirm', { amount: fmtMoney(e.amount, lang) }), { okLabel: t('delete') }))) return
    const res = e.kind === 'to_khata' || !e.cash_entry_id
      ? await supabase.from('advance_entries').delete().eq('id', e.id)
      : await supabase.from('cash_entries').delete().eq('id', e.cash_entry_id)
    if (res.error) return toast(errText(res.error, t), 'err')
    done(t('deleted'))
  }

  return (
    <View style={{ marginTop: 14 }}>
      <Row between style={{ marginTop: 8, marginBottom: 10 }}>
        <Row gap={10} style={{ flex: 1 }}>
          <IconTile icon={<Sprout size={18} color={c.green} />} tone="green" size={36} />
          <Txt v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{t('khCropAdvances')}</Txt>
        </Row>
        <Button size="sm" variant="secondary" title={t('khNewAdvance')} icon={<Plus size={15} color={c.text} />} onPress={() => setAdding(true)} />
      </Row>

      {advances.length === 0 ? (
        <Card><Empty icon={<Sprout size={30} color={c.muted} />}>{t('khNoAdvancesParty')}</Empty></Card>
      ) : (
        <View style={{ gap: 10 }}>
          {advances.map((a) => (
            <AdvanceCard
              key={a.id}
              a={a}
              entries={entries.filter((e) => e.advance_id === a.id)}
              isAdmin={isAdmin}
              busy={busy === a.id}
              onMove={(kind) => setMove({ advance: a, kind })}
              onToggle={() => toggleClosed(a)}
              onDelete={() => removeAdvance(a)}
              onDeleteEntry={removeEntry}
            />
          ))}
        </View>
      )}

      <NewAdvanceSheet open={adding} onClose={() => setAdding(false)} party={party} onSaved={() => { setAdding(false); done(t('khAdvanceSaved')) }} />
      <AdvanceMoveSheet
        advance={move?.advance ?? null}
        kind={move?.kind ?? 'deposit'}
        partyName={party.name}
        onClose={() => setMove(null)}
        onSaved={() => {
          const k = move?.kind
          setMove(null)
          done(k === 'to_khata' ? t('khMovedToast') : k === 'refund' ? t('khRefundToast') : t('khAdvanceSaved'))
        }}
      />
    </View>
  )
}

function AdvanceCard({
  a, entries, isAdmin, busy, onMove, onToggle, onDelete, onDeleteEntry,
}: {
  a: CropAdvance
  entries: AdvanceEntry[]
  isAdmin: boolean
  busy: boolean
  onMove: (k: MoveKind) => void
  onToggle: () => void
  onDelete: () => void
  onDeleteEntry: (e: AdvanceEntry) => void
}) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const [open, setOpen] = useState(!a.is_closed)
  const hasMoney = a.balance > 0.005
  const kindLabel = (k: AdvanceKind) => t(k === 'deposit' ? 'khKindDeposit' : k === 'use' ? 'khKindUse' : k === 'refund' ? 'khKindRefund' : 'khKindToKhata')
  const stats = [
    [t('khDeposited'), a.deposited],
    [t('khUsed'), a.used],
    ...(a.refunded > 0 ? [[t('khRefunded'), a.refunded]] : []),
    ...(a.moved_to_khata > 0 ? [[t('khMovedToKhata'), a.moved_to_khata]] : []),
  ] as [string, number][]

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', width: '100%' }}>
        <View style={{ width: 4, backgroundColor: a.is_closed ? c.borderStrong : hasMoney ? c.blue : c.green }} />
        <View style={{ flex: 1, padding: 14, gap: 12 }}>
          <Row gap={12} center={false}>
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Txt v="h3" numberOfLines={2}>{advanceTitle(a, t)}</Txt>
              {a.is_closed ? <Badge>{t('khClosedBadge')}</Badge> : <Badge tone="green">{t('khOpenBadge')}</Badge>}
              {!!a.note && <Txt v="small" muted>{a.note}</Txt>}
            </View>
            <View style={{ alignItems: 'flex-end', maxWidth: '50%' }}>
              <Txt v="tiny" muted>{t('khLeft')}</Txt>
              <Txt v="h2" weight="extrabold" color={hasMoney ? c.blue : c.muted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontVariant: ['tabular-nums'] }}>
                {fmtMoney(a.balance, lang)}
              </Txt>
            </View>
          </Row>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stats.map(([label, v]) => (
              <View key={label} style={{ flexGrow: 1, minWidth: '40%', paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: c.surface2 }}>
                <Txt v="tiny" muted numberOfLines={1}>{label}</Txt>
                <Txt v="small" weight="extrabold" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(v, lang)}</Txt>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {!a.is_closed && (
              <Button size="sm" title={t('khAddMoney')} icon={<ArrowDownToLine size={15} color={c.primaryText} />} onPress={() => onMove('deposit')} />
            )}
            {hasMoney && (
              <>
                <Button size="sm" variant="secondary" title={t('khRefund')} icon={<Undo2 size={15} color={c.text} />} onPress={() => onMove('refund')} />
                <Button size="sm" variant="secondary" title={t('khMoveToKhata')} icon={<ArrowRightLeft size={15} color={c.text} />} onPress={() => onMove('to_khata')} />
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              loading={busy}
              title={a.is_closed ? t('khReopen') : t('khClose')}
              icon={a.is_closed ? <LockOpen size={15} color={c.primary} /> : <Lock size={15} color={c.primary} />}
              onPress={onToggle}
            />
            {isAdmin && entries.length === 0 && (
              <IconBtn size={38} tone="red" icon={<Trash2 size={16} color={c.red} />} onPress={onDelete} label={t('delete')} style={{ marginStart: 'auto' }} />
            )}
          </View>

          {entries.length > 0 && (
            <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}>
              <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.surface2 }}>
                <Txt v="small" weight="bold">{t('khHistory')} ({entries.length})</Txt>
                <Row gap={4}>
                  <Txt v="tiny" muted>{open ? t('mKhHide') : t('mKhShow')}</Txt>
                  {open ? <ChevronUp size={16} color={c.muted} /> : <ChevronDown size={16} color={c.muted} />}
                </Row>
              </Pressable>
              {open && entries.map((e) => (
                <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Row gap={6} style={{ flexWrap: 'wrap' }}>
                      <Txt v="tiny" muted>{fmtDate(e.entry_date, lang)}</Txt>
                      <Badge tone={KIND_TONE[e.kind]}>{kindLabel(e.kind)}</Badge>
                      {e.kind === 'use' && !!e.sale_id && (
                        <Pressable onPress={() => router.push(`/receipt/${e.sale_id}`)} hitSlop={8}>
                          <Txt v="tiny" weight="bold" color={c.primary}>{t('khInvNo', { n: e.sales?.invoice_no ?? '' })}</Txt>
                        </Pressable>
                      )}
                    </Row>
                    {(!!e.note || !!e.created_by_name) && (
                      <Txt v="tiny" muted numberOfLines={2}>{[e.note, e.created_by_name && `${t('by')} ${e.created_by_name}`].filter(Boolean).join(' · ')}</Txt>
                    )}
                  </View>
                  <Txt v="small" weight="extrabold" color={e.kind === 'deposit' ? c.green : c.text} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
                    {e.kind === 'deposit' ? '+' : '−'}{fmtMoney(e.amount, lang)}
                  </Txt>
                  {isAdmin && e.kind !== 'use' && (
                    <Pressable onPress={() => onDeleteEntry(e)} hitSlop={8} style={{ padding: 4 }} accessibilityLabel={t('delete')}>
                      <Trash2 size={16} color={c.red} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Card>
  )
}
