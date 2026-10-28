import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { StyleSheet, View } from 'react-native'
import { Badge, Card, DateField, Field, PressScale, Row, Segmented, Txt } from '@/components/ui'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'

export type PeriodMode = 'year' | 'custom'

/** Tax year (with previous / next) or a custom from-to range */
export function PeriodBar({
  mode, setMode, ty, setTy, currentTy, firstTy, from, to, customFrom, customTo, setCustomFrom, setCustomTo, today,
}: {
  mode: PeriodMode
  setMode: (m: PeriodMode) => void
  ty: number
  setTy: (y: number) => void
  currentTy: number
  firstTy: number
  from: string
  to: string
  customFrom: string
  customTo: string
  setCustomFrom: (d: string) => void
  setCustomTo: (d: string) => void
  today: string
}) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  return (
    <Card style={{ gap: 12 }}>
      <Segmented
        value={mode}
        onChange={setMode}
        items={[{ value: 'year', label: t('mAuditTaxYear') }, { value: 'custom', label: t('customRange') }]}
      />
      {mode === 'year' ? (
        <Row gap={10}>
          <PressScale
            onPress={() => setTy(ty - 1)}
            disabled={ty <= firstTy}
            style={[styles.nav, { backgroundColor: c.surface2, borderColor: c.border }]}
          >
            <View accessibilityLabel={t('mAuditPrevYear')}><ChevronLeft size={20} color={c.text} /></View>
          </PressScale>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 2 }}>
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <Txt v="h3" numberOfLines={1}>{t('taxYear', { n: ty })}</Txt>
              {ty === currentTy && <Badge tone="primary">{t('current')}</Badge>}
            </Row>
            <Txt v="tiny" muted numberOfLines={1} adjustsFontSizeToFit>{fmtDate(from, lang)} – {fmtDate(to, lang)}</Txt>
          </View>
          <PressScale
            onPress={() => setTy(ty + 1)}
            disabled={ty >= currentTy}
            style={[styles.nav, { backgroundColor: c.surface2, borderColor: c.border }]}
          >
            <View accessibilityLabel={t('mAuditNextYear')}><ChevronRight size={20} color={c.text} /></View>
          </PressScale>
        </Row>
      ) : (
        <Row gap={10} center={false}>
          <Field label={t('from')} style={{ flex: 1, minWidth: 0 }}>
            <DateField value={customFrom} onChange={setCustomFrom} max={customTo} label={t('from')} />
          </Field>
          <Field label={t('to')} style={{ flex: 1, minWidth: 0 }}>
            <DateField value={customTo} onChange={setCustomTo} min={customFrom} max={today} label={t('to')} />
          </Field>
        </Row>
      )}
      {mode === 'year' && (
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <CalendarRange size={13} color={c.muted} />
          <Txt v="tiny" muted>{t('mAuditFbrYear')}</Txt>
        </Row>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  nav: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
})
