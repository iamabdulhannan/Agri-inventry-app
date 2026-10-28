import { Bell, Building2, FileBadge, KeyRound, MapPin, Phone, Store, User } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Button, Card, ErrorBox, Field, IconTile, Input, NumInput, PasswordInput, Row, Screen, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { DEFAULT_RECEIPT_NOTE } from '@/lib/receiptNote'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

export default function Settings() {
  const { t } = useI18n()
  return (
    <Screen back title={t('settings')}>
      <View style={{ gap: 14 }}>
        <OrgCard />
        <ProfileCard />
        <PasswordCard />
      </View>
    </Screen>
  )
}

function OrgCard() {
  const { t } = useI18n()
  const { c } = useTheme()
  const { org, isAdmin, reloadOrgs, refresh } = useOrg()
  const { toast } = useFeedback()
  const [name, setName] = useState(org.name)
  const [address, setAddress] = useState(org.address ?? '')
  const [phone, setPhone] = useState(org.phone ?? '')
  const [days, setDays] = useState(String(org.expiry_alert_days))
  const [ntn, setNtn] = useState(org.ntn ?? '')
  const [strn, setStrn] = useState(org.strn ?? '')
  const [note, setNote] = useState(org.receipt_note ?? '')
  const [busy, setBusy] = useState(false)
  // the columns only exist after migrations 013 / 018
  const hasTax = 'ntn' in org
  const hasNote = 'receipt_note' in org
  useEffect(() => {
    setName(org.name)
    setAddress(org.address ?? '')
    setPhone(org.phone ?? '')
    setDays(String(org.expiry_alert_days))
    setNtn(org.ntn ?? '')
    setStrn(org.strn ?? '')
    setNote(org.receipt_note ?? '')
  }, [org])

  const save = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('organizations')
      .update({
        name: name.trim(), address: address.trim() || null, phone: phone.trim() || null,
        ...(hasTax ? { ntn: ntn.trim() || null, strn: strn.trim() || null } : {}),
        ...(hasNote ? { receipt_note: note.trim() || null } : {}),
        expiry_alert_days: Math.min(365, Math.max(1, Number(days) || 60)),
      })
      .eq('id', org.id)
    setBusy(false)
    if (error) return toast(errText(error, t), 'err')
    await reloadOrgs()
    refresh()
    toast(t('saved'))
  }

  return (
    <Card style={{ gap: 14 }}>
      <Row gap={12}>
        <IconTile icon={<Building2 size={20} color={c.primary} />} />
        <Txt v="h3">{t('organization')}</Txt>
      </Row>
      <Field label={t('orgName')}>
        <Input value={name} onChangeText={setName} editable={isAdmin} icon={<Store size={18} color={c.muted} />} />
      </Field>
      <Field label={t('address')} optional>
        <Input value={address} onChangeText={setAddress} editable={isAdmin} icon={<MapPin size={18} color={c.muted} />} />
      </Field>
      <Field label={t('phone')} optional>
        <Input value={phone} onChangeText={setPhone} editable={isAdmin} keyboardType="phone-pad" icon={<Phone size={18} color={c.muted} />} />
      </Field>
      {hasTax && (
        <Row gap={10} center={false}>
          <Field label={t('ntn')} optional hint={t('ntnHint')} style={{ flex: 1 }}>
            <Input value={ntn} onChangeText={setNtn} editable={isAdmin} autoCapitalize="characters" icon={<FileBadge size={18} color={c.muted} />} />
          </Field>
          <Field label={t('strn')} optional style={{ flex: 1 }}>
            <Input value={strn} onChangeText={setStrn} editable={isAdmin} autoCapitalize="characters" />
          </Field>
        </Row>
      )}
      {hasNote && (
        <Field label={t('receiptNote')} optional hint={t('receiptNoteHint')}>
          <Input
            value={note}
            onChangeText={setNote}
            editable={isAdmin}
            multiline
            placeholder={DEFAULT_RECEIPT_NOTE}
            style={{ direction: 'rtl' }}
            textAlign="right"
          />
        </Field>
      )}
      <Field label={t('alertDays')} hint={t('alertDaysHint')}>
        <NumInput value={days} onChangeText={setDays} editable={isAdmin} keyboardType="number-pad" icon={<Bell size={18} color={c.muted} />} />
      </Field>
      {isAdmin && <Button title={t('save')} onPress={save} loading={busy} />}
    </Card>
  )
}

function ProfileCard() {
  const { t } = useI18n()
  const { c } = useTheme()
  const { profile, session, setProfile } = useOrg()
  const { toast } = useFeedback()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!session || !name.trim()) return
    setBusy(true)
    const { data, error } = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', session.user.id).select('id, full_name, email').single()
    setBusy(false)
    if (error) return toast(errText(error, t), 'err')
    setProfile(data)
    toast(t('saved'))
  }
  return (
    <Card style={{ gap: 14 }}>
      <Row gap={12}>
        <IconTile icon={<User size={20} color={c.blue} />} tone="blue" />
        <View style={{ flex: 1 }}>
          <Txt v="h3">{t('profile')}</Txt>
          <Txt v="tiny" muted>{session?.user.email}</Txt>
        </View>
      </Row>
      <Field label={t('fullName')}>
        <Input value={name} onChangeText={setName} />
      </Field>
      <Button variant="secondary" title={t('save')} onPress={save} loading={busy} />
    </Card>
  )
}

function PasswordCard() {
  const { t } = useI18n()
  const { c } = useTheme()
  const { toast } = useFeedback()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    setError('')
    if (pw.length < 6) return setError(t('passwordMin'))
    if (pw !== pw2) return setError(t('passwordsDontMatch'))
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setError(errText(error, t))
    setPw('')
    setPw2('')
    toast(t('passwordUpdated'))
  }
  return (
    <Card style={{ gap: 14 }}>
      <Row gap={12}>
        <IconTile icon={<KeyRound size={20} color={c.amber} />} tone="amber" />
        <Txt v="h3">{t('changePassword')}</Txt>
      </Row>
      <Field label={t('newPassword')} hint={t('passwordMin')}>
        <PasswordInput value={pw} onChangeText={setPw} autoComplete="new-password" />
      </Field>
      <Field label={t('confirmPassword')} error={pw2 && pw !== pw2 ? t('passwordsDontMatch') : undefined}>
        <PasswordInput value={pw2} onChangeText={setPw2} autoComplete="new-password" />
      </Field>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      <Button variant="secondary" title={t('updatePassword')} onPress={save} loading={busy} disabled={!pw} />
    </Card>
  )
}
