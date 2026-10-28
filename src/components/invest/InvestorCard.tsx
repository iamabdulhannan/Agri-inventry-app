import { ChevronRight, Phone } from 'lucide-react-native'
import { View } from 'react-native'
import { Badge, Card, Row, Txt } from '@/components/ui'
import { useI18n } from '@/lib/i18n'
import { investorStatus, type InvestorRow } from '@/lib/investors'
import { fmtMoney } from '@/lib/money'
import { useTheme } from '@/lib/theme'
import { fmtNum } from '@/lib/units'
import { Fig, InvestorAvatar, STATUS, statusText } from './common'

/** One investor in the list: name, share, status and his four money figures */
export function InvestorCard({ r, onPress }: { r: InvestorRow; onPress: () => void }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const st = investorStatus(r)
  const m = (v: number) => fmtMoney(v, lang)
  const cells = [
    { label: t('invCapital'), value: m(r.capital) },
    { label: t('invInStock'), value: m(r.stock_cost) },
    { label: t('invProfitSoFar'), value: m(r.profit_now), color: r.profit_now < 0 ? c.red : c.green },
    { label: t('invAvailable'), value: m(r.available), color: c.blue },
  ]
  return (
    <Card onPress={onPress} style={[{ gap: 12, padding: 14 }, !r.is_active && { opacity: 0.6 }]}>
      <Row gap={12}>
        <InvestorAvatar name={r.name} tone={STATUS[st].tone === 'stone' ? 'violet' : STATUS[st].tone} />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt weight="bold" numberOfLines={1}>{r.name}</Txt>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Txt v="tiny" color={c.primary}>{t('invShareShort', { n: fmtNum(r.profit_share) })}</Txt>
            {!!r.phone && (
              <Row gap={3}>
                <Phone size={11} color={c.muted} />
                <Txt v="tiny" muted>{r.phone}</Txt>
              </Row>
            )}
          </Row>
        </View>
        <ChevronRight size={18} color={c.muted} />
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Badge tone={STATUS[st].tone}>{statusText(r, t)}</Badge>
        {!r.is_active && <Badge>{t('inactive')}</Badge>}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, padding: 12, borderRadius: 16, backgroundColor: c.surface2 }}>
        {cells.map((x) => (
          <View key={x.label} style={{ width: '50%', paddingEnd: 8 }}>
            <Fig label={x.label} value={x.value} color={x.color} />
          </View>
        ))}
      </View>
    </Card>
  )
}
