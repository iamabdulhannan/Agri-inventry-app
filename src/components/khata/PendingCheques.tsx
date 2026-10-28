import { router, type Href } from 'expo-router'
import { ArrowDownLeft, ArrowUpRight, Banknote, ChevronRight } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { Badge, Card, IconTile, Row, Txt } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { Cheque } from '@/lib/khataMoney'
import { fmtMoney } from '@/lib/money'
import { useTheme } from '@/lib/theme'

/** Cheques of this party that have not cleared yet ("Cheque #445566 MCB · Rs 600 · dated 20 Dec") */
export function PendingCheques({ cheques, balance }: { cheques: Cheque[]; balance: number }) {
  const { t, lang } = useI18n()
  const { c } = useTheme()
  const { today } = useOrg()
  if (!cheques.length) return null
  const total = cheques.reduce((s, x) => s + x.amount, 0)
  const foot = [
    t('khChequesNote'),
    cheques.length > 1 ? `${t('total')}: ${fmtMoney(total, lang)}` : null,
    balance > 0 ? `${t('khAfterClear')}: ${fmtMoney(balance - total, lang)}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <Card style={{ marginTop: 14, gap: 4 }}>
      <Row between>
        <Row gap={10} style={{ flex: 1 }}>
          <IconTile icon={<Banknote size={18} color={c.orange} />} tone="orange" size={36} />
          <Txt v="h3" numberOfLines={1} style={{ flexShrink: 1 }}>{t('khPendingCheques')}</Txt>
        </Row>
        <Pressable onPress={() => router.push('/bank' as Href)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Txt v="small" weight="bold" color={c.primary}>{t('khOpenBank')}</Txt>
          <ChevronRight size={16} color={c.primary} />
        </Pressable>
      </Row>
      {cheques.map((x, i) => {
        const inbound = x.direction === 'received'
        return (
          <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.border, marginTop: i ? 0 : 8 }}>
            {inbound ? <ArrowDownLeft size={16} color={c.green} /> : <ArrowUpRight size={16} color={c.red} />}
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Txt v="small" weight="bold" numberOfLines={1}>
                {[t('khCheque'), x.cheque_no ? `#${x.cheque_no}` : null, x.bank_name].filter(Boolean).join(' ')}
              </Txt>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                <Txt v="tiny" muted>{t('khDated', { date: fmtDate(x.cheque_date, lang) })}</Txt>
                {x.cheque_date > today && <Badge tone="blue">{t('khPostDated')}</Badge>}
              </Row>
            </View>
            <Txt weight="extrabold" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: '45%', fontVariant: ['tabular-nums'] }}>{fmtMoney(x.amount, lang)}</Txt>
          </View>
        )
      })}
      <Txt v="tiny" muted style={{ marginTop: 2 }}>{foot}</Txt>
    </Card>
  )
}
