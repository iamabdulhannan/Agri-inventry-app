import { Building2, LogOut, Store, Ticket } from 'lucide-react-native'
import { useState } from 'react'
import { View } from 'react-native'
import { LogoBadge } from '@/components/Logo'
import { Button, Card, ErrorBox, IconBtn, IconTile, Input, Row, Screen, Txt } from '@/components/ui'
import { useApp } from '@/lib/app'
import { errText } from '@/lib/errors'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

/** Signed in, but the account has no organization yet */
export default function NoOrg() {
  const { t } = useI18n()
  const { c } = useTheme()
  const { signOut, session, reloadOrgs, switchOrg } = useApp()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState('')

  const run = async (kind: 'create' | 'join') => {
    setError('')
    setBusy(kind)
    const { data, error } =
      kind === 'create'
        ? await supabase.rpc('create_organization', { p_name: name.trim() })
        : await supabase.rpc('accept_invite', { p_code: code.trim() })
    setBusy(null)
    if (error) return setError(errText(error, t))
    switchOrg(data as string)
    await reloadOrgs()
  }

  return (
    <Screen right={<IconBtn icon={<LogOut size={18} color={c.red} />} onPress={signOut} label={t('signOut')} />} title=" ">
      <View style={{ gap: 6, marginBottom: 22 }}>
        <LogoBadge size={60} />
        <Txt v="h1" style={{ marginTop: 14 }}>{t('noOrgTitle')}</Txt>
        <Txt muted>{t('noOrgText')}</Txt>
        <Txt v="small" muted>{session?.user.email}</Txt>
      </View>
      <View style={{ gap: 14 }}>
        <Card>
          <Row gap={12} style={{ marginBottom: 14 }}>
            <IconTile icon={<Building2 size={20} color={c.primary} />} />
            <Txt v="h3">{t('createOrg')}</Txt>
          </Row>
          <Input value={name} onChangeText={setName} placeholder={t('orgNamePh')} icon={<Store size={18} color={c.muted} />} />
          <Button title={t('create')} onPress={() => run('create')} loading={busy === 'create'} disabled={name.trim().length < 2} style={{ marginTop: 12 }} />
        </Card>
        <Card>
          <Row gap={12} style={{ marginBottom: 14 }}>
            <IconTile icon={<Ticket size={20} color={c.blue} />} tone="blue" />
            <Txt v="h3">{t('joinOrg')}</Txt>
          </Row>
          <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="A1B2C3D4" icon={<Ticket size={18} color={c.muted} />} />
          <Button variant="secondary" title={t('joinOrg')} onPress={() => run('join')} loading={busy === 'join'} disabled={!code.trim()} style={{ marginTop: 12 }} />
        </Card>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
      </View>
    </Screen>
  )
}
