import Constants from 'expo-constants'
import { router, type Href } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowDownToLine, BarChart3, CalendarClock, ChevronRight, FileText, History, Languages, LogOut, Moon, NotebookPen, PackageMinus,
  Settings, Shapes, Smartphone, Sun, Undo2, Users,
} from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { LogoBadge } from '@/components/Logo'
import { Card, Grid, PressScale, Rise, Row, Screen, SectionTitle, Segmented, Txt, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useI18n } from '@/lib/i18n'
import { toneColors, useTheme, type ThemeMode, type Tone } from '@/lib/theme'

export default function More() {
  const { t, lang, setLang } = useI18n()
  const { c, mode, setMode } = useTheme()
  const { profile, org, role, isAdmin, signOut, session } = useOrg()
  const { confirm } = useFeedback()

  const tiles: { icon: typeof FileText; label: string; sub?: string; tone: Tone; href: Href }[] = [
    { icon: ArrowDownToLine, label: t('navStockIn'), sub: t('stockInMore'), tone: 'green', href: '/stock-in' },
    { icon: FileText, label: t('invoices'), sub: `${t('invoices')} · ${t('purchases')}`, tone: 'blue', href: '/invoices' },
    { icon: NotebookPen, label: t('navRoznamcha'), sub: t('cashBook'), tone: 'violet', href: '/roznamcha' },
    { icon: CalendarClock, label: t('navExpiry'), sub: t('expiryReport'), tone: 'amber', href: '/expiry' },
    { icon: BarChart3, label: t('navReports'), sub: t('salesProfit'), tone: 'primary', href: '/reports' },
    { icon: History, label: t('navLedger'), sub: t('entries'), tone: 'stone', href: '/history' },
    { icon: Undo2, label: t('mv_return_in'), sub: t('loadInvoice'), tone: 'orange', href: '/return' },
    { icon: PackageMinus, label: t('otherOut'), sub: `${t('mv_damaged')} · ${t('mv_expired')}`, tone: 'red', href: { pathname: '/sale', params: { type: 'damaged' } } },
  ]
  const settings: { icon: typeof FileText; label: string; href: Href; show: boolean }[] = [
    { icon: Settings, label: t('settings'), href: '/settings', show: true },
    { icon: Users, label: t('team'), href: '/team', show: true },
    { icon: Shapes, label: t('lists'), href: '/lists', show: true },
  ]

  return (
    <Screen title={t('tabMore')} tabInset>
      <Rise>
        <View style={{ borderRadius: 26, overflow: 'hidden' }}>
          <LinearGradient colors={c.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
            <View style={[styles.blob, { backgroundColor: c.heroGlow }]} />
            <Row gap={14}>
              <LogoBadge size={54} />
              <View style={{ flex: 1 }}>
                <Txt v="h2" color="#F4FFF6" numberOfLines={1}>{org.name}</Txt>
                <Txt v="small" color="rgba(236,255,240,0.75)" numberOfLines={1}>{profile?.full_name ?? session?.user.email}</Txt>
                <View style={styles.role}><Txt v="tiny" color="#C8FF4D">{role ? t(`role_${role}`) : ''}</Txt></View>
              </View>
            </Row>
          </LinearGradient>
        </View>
      </Rise>

      <Rise i={1}>
        <SectionTitle>{t('yourBusiness')}</SectionTitle>
        <Grid>
          {tiles.map(({ icon: Icon, label, sub, tone, href }) => {
            const tc = toneColors(c, tone)
            return (
              <PressScale key={label} onPress={() => router.push(href)} style={[styles.tile, { flex: 1, backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={[styles.tileIcon, { backgroundColor: tc.bg }]}><Icon size={21} color={tc.fg} /></View>
                <Txt weight="bold" numberOfLines={1} style={{ marginTop: 12 }}>{label}</Txt>
                {!!sub && <Txt v="tiny" muted numberOfLines={1}>{sub}</Txt>}
              </PressScale>
            )
          })}
        </Grid>
      </Rise>

      <Rise i={2}>
        <SectionTitle>{t('account')}</SectionTitle>
        <Card padded={false}>
          {settings.filter((s) => s.show).map(({ icon: Icon, label, href }, i) => (
            <PressScale key={label} onPress={() => router.push(href)} scaleTo={0.99} style={[styles.rowItem, { borderTopWidth: i ? 1 : 0, borderTopColor: c.border }]}>
              <Icon size={20} color={c.textSoft} />
              <Txt weight="semibold" style={{ flex: 1 }}>{label}</Txt>
              {label === t('team') && !isAdmin ? null : <ChevronRight size={18} color={c.muted} />}
            </PressScale>
          ))}
        </Card>
      </Rise>

      <Rise i={3}>
        <SectionTitle>{t('appearance')}</SectionTitle>
        <Segmented<ThemeMode>
          value={mode}
          onChange={setMode}
          items={[
            { value: 'light', label: t('themeL'), icon: <Sun size={15} color={mode === 'light' ? c.text : c.muted} /> },
            { value: 'dark', label: t('themeD'), icon: <Moon size={15} color={mode === 'dark' ? c.text : c.muted} /> },
            { value: 'system', label: t('themeA'), icon: <Smartphone size={15} color={mode === 'system' ? c.text : c.muted} /> },
          ]}
        />
        <Segmented
          value={lang}
          onChange={setLang}
          items={[
            { value: 'en', label: t('langEnglish'), icon: <Languages size={15} color={lang === 'en' ? c.text : c.muted} /> },
            { value: 'ur', label: t('langUrdu') },
          ]}
          style={{ marginTop: 10 }}
        />
      </Rise>

      <PressScale
        onPress={async () => { if (await confirm(t('signOutConfirm'), { okLabel: t('signOut') })) signOut() }}
        style={[styles.signOut, { backgroundColor: c.redSoft, borderColor: c.red + '30' }]}
      >
        <LogOut size={19} color={c.red} />
        <Txt weight="bold" color={c.red}>{t('signOut')}</Txt>
      </PressScale>
      <Txt v="tiny" muted align="center" style={{ marginTop: 14 }}>{t('appName')} · {t('version', { v: Constants.expoConfig?.version ?? '1.0.0' })}</Txt>
      <Txt v="tiny" muted align="center">{t('madeFor')}</Txt>
    </Screen>
  )
}

const styles = StyleSheet.create({
  blob: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -90, right: -60, opacity: 0.16 },
  role: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { padding: 14, borderRadius: 22, borderWidth: 1 },
  tileIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 18, borderWidth: 1, marginTop: 22 },
})
