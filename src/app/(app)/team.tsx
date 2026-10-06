import * as Clipboard from 'expo-clipboard'
import * as Linking from 'expo-linking'
import { Copy, Info, KeyRound, LockKeyhole, Plus, Share2, Trash2, Users } from 'lucide-react-native'
import { useState } from 'react'
import { Share, View } from 'react-native'
import { PartyAvatar } from '@/components/domain'
import { Badge, Button, Card, Empty, ErrorBox, Field, IconTile, Input, Loading, PasswordInput, PressScale, Row, Screen, Segmented, Sheet, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { Role } from '@/lib/types'

interface Invite { id: string; code: string; role: Role; email: string | null; expires_at: string }
interface MemberRow { user_id: string; role: Role; created_at: string; profiles: { full_name: string; email: string | null } | null }

export default function Team() {
  const { t } = useI18n()
  const { isAdmin } = useOrg()
  return (
    <Screen back title={t('team')}>
      <View style={{ gap: 14 }}>
        {isAdmin && <Invites />}
        <Members />
      </View>
    </Screen>
  )
}

function Invites() {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { org } = useOrg()
  const { toast, confirm } = useFeedback()
  const [role, setRole] = useState<Role>('staff')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const { data, reload } = useLoad(async () => {
    const { data, error } = await supabase.from('invites').select('*').eq('org_id', org.id).is('used_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
    if (error) throw error
    return data as Invite[]
  }, [org.id])

  const create = async () => {
    setBusy(true)
    const { error } = await supabase.from('invites').insert({ org_id: org.id, role, email: email.trim() || null })
    setBusy(false)
    if (error) return toast(errText(error, t), 'err')
    setEmail('')
    toast(t('inviteCreated'))
    reload()
  }
  const share = (code: string) => {
    const url = Linking.createURL('/sign-up', { queryParams: { mode: 'join', code } })
    Share.share({ message: t('shareInvite', { org: org.name, url, code }), title: t('inviteShareTitle') }).catch(() => {})
  }
  const remove = async (id: string) => {
    if (!(await confirm(`${t('delete')}?`))) return
    const { error } = await supabase.from('invites').delete().eq('id', id)
    if (error) return toast(errText(error, t), 'err')
    reload()
  }

  return (
    <Card style={{ gap: 14 }}>
      <Row gap={12}>
        <IconTile icon={<KeyRound size={20} color={c.primary} />} />
        <Txt v="h3">{t('invites')}</Txt>
      </Row>
      <Txt v="small" muted>{t('inviteHint')}</Txt>
      <Segmented value={role} onChange={setRole} items={[{ value: 'staff', label: t('role_staff') }, { value: 'admin', label: t('role_admin') }]} />
      <Row gap={6} style={{ alignItems: 'flex-start' }}>
        <Info size={14} color={c.muted} style={{ marginTop: 2 }} />
        <Txt v="tiny" muted style={{ flex: 1 }}>{role === 'admin' ? t('roleAdminHint') : t('roleStaffHint')}</Txt>
      </Row>
      <Field label={t('inviteEmail')} optional>
        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="staff@example.com" />
      </Field>
      <Button title={t('createInvite')} icon={<Plus size={18} color={c.primaryText} />} onPress={create} loading={busy} />
      {!data?.length ? <Txt v="small" muted>{t('noInvites')}</Txt> : data.map((i) => (
        <View key={i.id} style={{ padding: 14, borderRadius: 18, backgroundColor: c.surface2, gap: 10 }}>
          <Row between>
            <Txt v="h2" color={c.primary} style={{ letterSpacing: 4 }}>{i.code}</Txt>
            <Badge tone={i.role === 'admin' ? 'blue' : 'green'}>{t(`role_${i.role}`)}</Badge>
          </Row>
          <Txt v="tiny" muted>{i.email ? `${i.email} · ` : ''}{t('expires')}: {fmtDate(i.expires_at.slice(0, 10), lang)}</Txt>
          <Row gap={8}>
            <Button size="sm" variant="secondary" title={t('copy')} icon={<Copy size={15} color={c.text} />} onPress={async () => { await Clipboard.setStringAsync(i.code); toast(t('copied')) }} style={{ flex: 1 }} />
            <Button size="sm" title={t('share')} icon={<Share2 size={15} color={c.primaryText} />} onPress={() => share(i.code)} style={{ flex: 1 }} />
            <PressScale onPress={() => remove(i.id)} style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.redSoft }}>
              <Trash2 size={16} color={c.red} />
            </PressScale>
          </Row>
        </View>
      ))}
    </Card>
  )
}

function Members() {
  const { t } = useI18n()
  const { c } = useTheme()
  const { org, isAdmin, session, role: myRole } = useOrg()
  const { toast, confirm } = useFeedback()
  const [resetFor, setResetFor] = useState<MemberRow | null>(null)
  const { data, error, loading, reload } = useLoad(async () => {
    const { data, error } = await supabase.from('memberships').select('user_id, role, created_at, profiles(full_name, email)').eq('org_id', org.id).order('created_at')
    if (error) throw error
    return data as unknown as MemberRow[]
  }, [org.id])

  const setRole = async (m: MemberRow, role: Role) => {
    const { error } = await supabase.from('memberships').update({ role }).eq('org_id', org.id).eq('user_id', m.user_id)
    if (error) return toast(errText(error, t), 'err')
    reload()
  }
  const remove = async (m: MemberRow) => {
    const name = m.profiles?.full_name || m.profiles?.email || ''
    if (!(await confirm(t('removeMemberConfirm', { name })))) return
    const { error } = await supabase.rpc('remove_member', { p_org: org.id, p_user: m.user_id })
    if (error) return toast(errText(error, t), 'err')
    toast(t('memberRemoved', { name }))
    reload()
  }

  return (
    <Card style={{ gap: 12 }}>
      <Row gap={12}>
        <IconTile icon={<Users size={20} color={c.blue} />} tone="blue" />
        <Txt v="h3">{t('members')}</Txt>
      </Row>
      {loading && !data ? <Loading rows={2} /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data?.length ? <Empty>{t('noData')}</Empty> : data.map((m) => {
        const me = m.user_id === session?.user.id
        const editable = isAdmin && !me && m.role !== 'owner'
        // owner can reset/remove anyone; admin only staff (same rule as the database)
        const canManage = !me && m.role !== 'owner' && (myRole === 'owner' || (myRole === 'admin' && m.role === 'staff'))
        const name = m.profiles?.full_name || m.profiles?.email || '?'
        return (
          <View key={m.user_id} style={{ padding: 12, borderRadius: 18, backgroundColor: c.surface2, gap: 10 }}>
            <Row gap={12}>
              <PartyAvatar name={name} kind="customer" size={42} />
              <View style={{ flex: 1 }}>
                <Txt weight="bold" numberOfLines={1}>{m.profiles?.full_name || '—'} {me && <Txt v="tiny" muted>({t('you')})</Txt>}</Txt>
                <Txt v="tiny" muted numberOfLines={1}>{m.profiles?.email}</Txt>
              </View>
              {!editable && <Badge tone={m.role === 'owner' ? 'green' : m.role === 'admin' ? 'blue' : 'stone'}>{t(`role_${m.role}`)}</Badge>}
            </Row>
            {editable && (
              <Segmented value={m.role} onChange={(r) => setRole(m, r)} items={[{ value: 'staff', label: t('role_staff') }, { value: 'admin', label: t('role_admin') }]} />
            )}
            {canManage && (
              <Row gap={8}>
                <Button size="sm" variant="secondary" title={t('resetPassword')} icon={<LockKeyhole size={15} color={c.text} />} onPress={() => setResetFor(m)} style={{ flex: 1 }} />
                <Button size="sm" variant="secondary" color={c.red} title={t('removeMember')} icon={<Trash2 size={15} color={c.red} />} onPress={() => remove(m)} style={{ flex: 1 }} />
              </Row>
            )}
          </View>
        )
      })}
      <ResetPasswordSheet member={resetFor} onClose={() => setResetFor(null)} />
    </Card>
  )
}

function ResetPasswordSheet({ member, onClose }: { member: MemberRow | null; onClose: () => void }) {
  const { t } = useI18n()
  const { org } = useOrg()
  const { toast } = useFeedback()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [last, setLast] = useState<string | null>(null)
  if ((member?.user_id ?? null) !== last) {
    setLast(member?.user_id ?? null)
    setPw('')
    setPw2('')
    setError('')
  }
  const name = member?.profiles?.full_name || member?.profiles?.email || ''
  const save = async () => {
    if (!member) return
    setError('')
    if (pw.length < 6) return setError(t('passwordMin'))
    if (pw !== pw2) return setError(t('passwordsDontMatch'))
    setBusy(true)
    const { error } = await supabase.rpc('admin_reset_password', { p_org: org.id, p_user: member.user_id, p_password: pw })
    setBusy(false)
    if (error) return setError(errText(error, t))
    toast(t('passwordResetDone', { name }))
    onClose()
  }
  return (
    <Sheet open={!!member} onClose={onClose} title={t('resetPassword')} subtitle={`${name}${member?.profiles?.email ? ` · ${member.profiles.email}` : ''}`} footer={<Button title={t('save')} onPress={save} loading={busy} style={{ flex: 1 }} size="lg" />}>
      <View style={{ gap: 14 }}>
        <Field label={t('newPassword')} hint={t('passwordMin')}>
          <PasswordInput value={pw} onChangeText={setPw} autoComplete="new-password" />
        </Field>
        <Field label={t('confirmPassword')} error={pw2 && pw !== pw2 ? t('passwordsDontMatch') : undefined}>
          <PasswordInput value={pw2} onChangeText={setPw2} autoComplete="new-password" />
        </Field>
        <Txt v="tiny" muted>{t('resetPasswordHint')}</Txt>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </View>
    </Sheet>
  )
}
