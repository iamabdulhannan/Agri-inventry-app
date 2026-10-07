import { router } from 'expo-router'
import { Lock, Mail } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { LogoBadge } from '@/components/Logo'
import { Button, ErrorBox, Field, Input, PasswordInput, Screen, Txt, Rise } from '@/components/ui'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

export default function SignIn() {
  const { t } = useI18n()
  const { c } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async () => {
    setError('')
    setInfo('')
    if (!supabaseConfigured) return setError(t('errNotConfigured'))
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(/not confirmed/i.test(error.message) ? `${errText(error, t)} ${t('confirmStillOn')}` : errText(error, t))
    }
    // on success the root layout switches to the app automatically
  }

  return (
    <Screen back>
      <Rise style={{ gap: 6, marginBottom: 28, marginTop: 8 }}>
        <LogoBadge size={64} />
        <Txt v="display" style={{ marginTop: 18 }}>{t('signIn')}</Txt>
        <Txt muted>{t('tagline')}</Txt>
      </Rise>
      <Rise i={2} style={{ gap: 16 }}>
        <Field label={t('email')}>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@shop.com"
            icon={<Mail size={18} color={c.muted} />}
          />
        </Field>
        <Field label={t('password')}>
          <PasswordInput value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" icon={<Lock size={18} color={c.muted} />} onSubmitEditing={submit} />
        </Field>
        <Pressable onPress={() => { setError(''); setInfo(t('forgotNoEmail')) }} style={{ alignSelf: 'flex-end' }} hitSlop={8}>
          <Txt v="small" weight="bold" color={c.primary}>{t('forgotPassword')}</Txt>
        </Pressable>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        {info ? (
          <View style={{ backgroundColor: c.primarySoft, padding: 14, borderRadius: 14 }}>
            <Txt v="small" soft>{info}</Txt>
          </View>
        ) : null}
        <Button size="lg" title={t('signIn')} loading={busy} disabled={!email || !password} onPress={submit} style={{ marginTop: 6 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          <Txt muted>{t('noAccount')}</Txt>
          <Pressable onPress={() => router.replace({ pathname: '/sign-up', params: { mode: 'create' } })}>
            <Txt weight="bold" color={c.primary}>{t('signUp')}</Txt>
          </Pressable>
        </View>
      </Rise>
    </Screen>
  )
}
