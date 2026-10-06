import { router, useLocalSearchParams } from 'expo-router'
import { Building2, CheckCircle2, Lock, Mail, MailCheck, Store, Ticket, User } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Button, ErrorBox, Field, Input, PasswordInput, Row, Screen, Segmented, Txt } from '@/components/ui'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import type { Role } from '@/lib/types'

type Mode = 'create' | 'join'

export default function SignUp() {
  const { t } = useI18n()
  const { c } = useTheme()
  const params = useLocalSearchParams<{ mode?: string; code?: string }>()
  const [mode, setMode] = useState<Mode>(params.mode === 'join' || params.code ? 'join' : 'create')
  const [orgName, setOrgName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [code, setCode] = useState(params.code ?? '')
  const [invite, setInvite] = useState<{ org_name: string; role: Role; email: string | null } | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState(false)

  const checkCode = async () => {
    setError('')
    setInvite(null)
    if (!code.trim()) return
    if (!supabaseConfigured) return setError(t('errNotConfigured'))
    setChecking(true)
    const { data, error } = await supabase.rpc('check_invite', { p_code: code.trim() })
    setChecking(false)
    if (error) return setError(errText(error, t))
    const row = (data as (typeof invite)[])?.[0]
    if (!row) return setError(t('errInvalidInvite'))
    setInvite(row)
    if (row.email) setEmail(row.email)
  }

  const submit = async () => {
    setError('')
    if (!supabaseConfigured) return setError(t('errNotConfigured'))
    try {
      if (mode === 'create' && orgName.trim().length < 2) throw new Error(t('orgName'))
      if (!fullName.trim()) throw new Error(t('fullName'))
      if (password.length < 6) throw new Error(t('passwordMin'))
      if (password !== password2) throw new Error(t('passwordsDontMatch'))
      const meta: Record<string, string> = { full_name: fullName.trim() }
      if (mode === 'create') meta.org_name = orgName.trim()
      else {
        if (!invite) throw new Error(t('errInvalidInvite'))
        meta.invite_code = code.trim().toUpperCase()
      }
      setBusy(true)
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: meta } })
      if (error) throw error
      // Supabase hides existing accounts by returning a user without identities
      if (data.user && data.user.identities?.length === 0) throw new Error(t('errUserExists'))
      if (!data.session) setCheckEmail(true)
      // with a session the root layout opens the app by itself
    } catch (e) {
      setError(errText(e, t))
    } finally {
      setBusy(false)
    }
  }

  if (checkEmail) {
    return (
      <Screen back>
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: 14, marginTop: 60 }}>
          <View style={{ width: 96, height: 96, borderRadius: 32, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <MailCheck size={44} color={c.primary} />
          </View>
          <Txt v="h1" align="center">{t('checkEmailTitle')}</Txt>
          <Txt muted align="center">{t('confirmStillOn')}</Txt>
          <Button title={t('signIn')} onPress={() => router.replace('/sign-in')} style={{ marginTop: 10, alignSelf: 'stretch' }} size="lg" />
        </Animated.View>
      </Screen>
    )
  }

  return (
    <Screen back>
      <Animated.View entering={FadeInDown.duration(500)} style={{ marginBottom: 22, marginTop: 4 }}>
        <Txt v="display">{mode === 'create' ? t('createOrg') : t('joinOrg')}</Txt>
        <Txt muted style={{ marginTop: 6 }}>{mode === 'create' ? t('createOrgHint') : t('joinOrgHint')}</Txt>
      </Animated.View>

      <Segmented
        value={mode}
        onChange={(m) => { setMode(m); setError('') }}
        items={[
          { value: 'create', label: t('createOrg'), icon: <Building2 size={15} color={mode === 'create' ? c.text : c.muted} /> },
          { value: 'join', label: t('joinOrg'), icon: <Ticket size={15} color={mode === 'join' ? c.text : c.muted} /> },
        ]}
        style={{ marginBottom: 22 }}
      />

      <View style={{ gap: 16 }}>
        {mode === 'join' ? (
          <Field label={t('inviteCode')}>
            <Row gap={10}>
              <Input
                value={code}
                onChangeText={(v) => { setCode(v.toUpperCase()); setInvite(null) }}
                onBlur={() => code && !invite && checkCode()}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="A1B2C3D4"
                maxLength={12}
                style={{ flex: 1 }}
                icon={<Ticket size={18} color={c.muted} />}
              />
              <Button variant="secondary" title={t('checkCode')} loading={checking} onPress={checkCode} />
            </Row>
            {invite && (
              <Animated.View entering={FadeInDown} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.primarySoft, padding: 12, borderRadius: 14, marginTop: 4 }}>
                <CheckCircle2 size={18} color={c.primary} />
                <Txt v="small" weight="semibold" style={{ flex: 1 }}>{t('joiningAs', { org: invite.org_name, role: t(`role_${invite.role}`) })}</Txt>
              </Animated.View>
            )}
          </Field>
        ) : (
          <Field label={t('orgName')}>
            <Input value={orgName} onChangeText={setOrgName} placeholder={t('orgNamePh')} icon={<Store size={18} color={c.muted} />} maxLength={120} />
          </Field>
        )}
        <Field label={t('fullName')}>
          <Input value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" icon={<User size={18} color={c.muted} />} />
        </Field>
        <Field label={t('email')}>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!(mode === 'join' && invite?.email)}
            placeholder="you@shop.com"
            icon={<Mail size={18} color={c.muted} />}
          />
        </Field>
        <Field label={t('password')} hint={t('passwordMin')}>
          <PasswordInput value={password} onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword" icon={<Lock size={18} color={c.muted} />} />
        </Field>
        <Field label={t('confirmPassword')} error={password2 && password !== password2 ? t('passwordsDontMatch') : undefined}>
          <PasswordInput value={password2} onChangeText={setPassword2} autoComplete="new-password" icon={<Lock size={18} color={c.muted} />} />
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <Button
          size="lg"
          title={mode === 'create' ? t('createOrgBtn') : t('joinOrg')}
          loading={busy}
          disabled={mode === 'join' && !invite}
          onPress={submit}
          style={{ marginTop: 6 }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 }}>
          <Txt muted>{t('haveAccount')}</Txt>
          <Pressable onPress={() => router.replace('/sign-in')}>
            <Txt weight="bold" color={c.primary}>{t('signIn')}</Txt>
          </Pressable>
        </View>
      </View>
    </Screen>
  )
}
