import { router } from 'expo-router'
import { AlertTriangle, CalendarClock, Check, MessageCircle, Pencil } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Badge, Button, Card, DateField, Field, IconTile, PressScale, Row, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { DUE_TONE, dueGroupOf, dueText, reminderText, type CustomerDue, type PartyWithRule } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { radius, useTheme } from '@/lib/theme'
import { DueRuleChips, useDueRuleLabel } from './DueRuleChips'
import { canWhatsApp, openWhatsApp } from './whatsapp'

/** WhatsApp payment reminder for a customer: total owed and the earliest due date */
export function useRemind() {
  const { t, lang } = useI18n()
  const { org, today } = useOrg()
  const { toast } = useFeedback()
  return async (party: { name: string; phone: string | null }, amount: number, due: string | null) => {
    const text = reminderText(t, {
      name: party.name, shop: org.name, shopPhone: org.phone, amount: fmtMoney(amount, lang),
      due, dueLabel: due ? fmtDate(due, lang) : null, today,
    })
    if (!(await openWhatsApp(party.phone, text))) toast(t('mKhWaFailed'), 'err')
  }
}

/** A customer's unpaid bills with their due dates, and the default "usually pays by" rule */
export function DuesCard({ party, dues, onChanged }: { party: PartyWithRule; dues: CustomerDue[]; onChanged: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { today } = useOrg()
  const { toast } = useFeedback()
  const ruleLabel = useDueRuleLabel()
  const remind = useRemind()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dueEdit, setDueEdit] = useState<CustomerDue | null>(null)
  const rule = party.due_rule ?? ''
  const total = dues.reduce((s, d) => s + d.outstanding, 0)
  const overdue = dues.filter((d) => d.due_date && d.due_date < today).reduce((s, d) => s + d.outstanding, 0)
  const earliest = dues.map((d) => d.due_date).filter((d): d is string => !!d).sort()[0] ?? null

  const saveRule = async (r: string) => {
    if (r === rule) return setEditing(false)
    setBusy(true)
    const { error } = await supabase.from('parties').update({ due_rule: r || null }).eq('id', party.id)
    setBusy(false)
    if (error) return toast(errText(error, t), 'err')
    setEditing(false)
    toast(t('saved'))
    onChanged()
  }

  return (
    <Card style={{ marginTop: 14 }} padded={false}>
      <View style={{ padding: 16, gap: 12 }}>
        <Row between>
          <Row gap={10} style={{ flex: 1 }}>
            <IconTile icon={<CalendarClock size={18} color={c.amber} />} tone="amber" size={36} />
            <Txt v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{t('khDues')}</Txt>
          </Row>
          {total > 0 && canWhatsApp(party.phone) && (
            <Button size="sm" title={t('khRemind')} icon={<MessageCircle size={15} color={c.primaryText} />} onPress={() => remind(party, total, earliest)} />
          )}
        </Row>

        <View collapsable={false} style={{ padding: 12, borderRadius: radius.md, backgroundColor: c.surface2, gap: 10 }}>
          <Row between>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="tiny" muted>{t('khUsuallyPays')}</Txt>
              <Txt weight="bold" numberOfLines={2}>{ruleLabel(rule) ?? t('khNoDefault')}</Txt>
            </View>
            <Pressable onPress={() => setEditing((e) => !e)} hitSlop={10}>
              <Txt v="small" weight="bold" color={c.primary}>{editing ? t('cancel') : t('khChange')}</Txt>
            </Pressable>
          </Row>
          {editing && (
            <>
              <DueRuleChips value={rule} onChange={saveRule} disabled={busy} />
              <Txt v="tiny" muted>{t('khUsuallyPaysHint')}</Txt>
            </>
          )}
        </View>
      </View>

      {dues.length === 0 ? (
        <Txt v="small" muted align="center" style={{ paddingHorizontal: 16, paddingBottom: 20 }}>{t('khNothingDue')}</Txt>
      ) : (
        <>
          {overdue > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: c.redSoft }}>
              <AlertTriangle size={16} color={c.red} />
              <Txt v="small" weight="bold" color={c.red} style={{ flex: 1 }}>{t('khOverdueAmount', { amount: fmtMoney(overdue, lang) })}</Txt>
            </View>
          )}
          {dues.map((d) => {
            const g = dueGroupOf(d.due_date, today)
            const saleId = d.sale_id
            return (
              <Pressable
                key={saleId ?? 'opening'}
                disabled={!saleId}
                onPress={() => saleId && router.push(`/receipt/${saleId}`)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: pressed ? c.surface2 : 'transparent' })}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Txt weight="bold" numberOfLines={1}>{saleId ? t('khInvNo', { n: d.invoice_no ?? '' }) : t('lk_opening')}</Txt>
                  <Txt v="tiny" muted>{fmtDate(d.sale_date, lang)}</Txt>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    {d.due_date ? (
                      <>
                        <Txt v="tiny" weight="bold" soft>{t('khDueDate')}: {fmtDate(d.due_date, lang)}</Txt>
                        {g !== 'later' && <Badge tone={DUE_TONE[g]}>{dueText(d.due_date, today, t)}</Badge>}
                      </>
                    ) : (
                      <Txt v="tiny" muted>{t('khNoDate')}</Txt>
                    )}
                  </Row>
                </View>
                <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
                  <Txt weight="extrabold" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{fmtMoney(d.outstanding, lang)}</Txt>
                  {d.outstanding < d.amount - 0.005 && (
                    <Txt v="tiny" muted numberOfLines={1} adjustsFontSizeToFit>{t('khOfAmount', { amount: fmtMoney(d.amount, lang) })}</Txt>
                  )}
                </View>
                {!!saleId && (
                  <PressScale onPress={() => setDueEdit(d)} style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
                    <Pencil size={15} color={c.textSoft} />
                  </PressScale>
                )}
              </Pressable>
            )
          })}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface2, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg }}>
            <Txt weight="bold">{t('total')}</Txt>
            <Txt v="h3" weight="extrabold" color={c.amber} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}>{fmtMoney(total, lang)}</Txt>
          </View>
        </>
      )}

      <DueDateSheet due={dueEdit} onClose={() => setDueEdit(null)} onSaved={() => { setDueEdit(null); toast(t('saved')); onChanged() }} />
    </Card>
  )
}

/** Set / clear the due date of one bill (rpc set_sale_due_date) */
function DueDateSheet({ due, onClose, onSaved }: { due: CustomerDue | null; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org } = useOrg()
  const { toast } = useFeedback()
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState<'save' | 'clear' | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const key = due?.sale_id ?? null
  if (key !== last) {
    setLast(key)
    if (due) setDate(due.due_date ?? '')
  }

  const save = async (value: string | null) => {
    if (!due?.sale_id) return
    setBusy(value ? 'save' : 'clear')
    const { error } = await supabase.rpc('set_sale_due_date', { p_org: org.id, p_sale: due.sale_id, p_due: value })
    setBusy(null)
    if (error) {
      const msg = String(error.message ?? '')
      return toast(/set_sale_due_date|schema cache|PGRST20/.test(msg) ? t('errRunMigration', { n: '014' }) : errText(error, t), 'err')
    }
    onSaved()
  }

  return (
    <Sheet
      open={!!due}
      onClose={onClose}
      title={t('khSetDue')}
      subtitle={due ? `${t('khInvNo', { n: due.invoice_no ?? '' })} · ${fmtMoney(due.outstanding, lang)}` : undefined}
      footer={
        <>
          {!!due?.due_date && (
            <Button variant="secondary" title={t('khClearDue')} color={c.red} onPress={() => save(null)} loading={busy === 'clear'} disabled={!!busy} style={{ flex: 1 }} />
          )}
          <Button title={t('save')} icon={<Check size={17} color={c.primaryText} />} onPress={() => save(date)} loading={busy === 'save'} disabled={!date || !!busy} style={{ flex: 1.4 }} />
        </>
      }
    >
      {due && (
        <View style={{ gap: 14 }}>
          <Txt v="small" muted>{t('mKhSetDueHint')}</Txt>
          <Field label={t('khDueDate')}>
            <DateField value={date} onChange={setDate} min={due.sale_date} label={t('khDueDate')} />
          </Field>
        </View>
      )}
    </Sheet>
  )
}
