import * as Print from 'expo-print'
import { router, useLocalSearchParams } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { CheckCircle2, Plus, Printer, Share2, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, ErrorBox, IconBtn, Loading, Row, Segmented, Txt, haptic, useFeedback } from '@/components/ui'
import { useOrg } from '@/lib/app'
import { useLoad } from '@/lib/data'
import { errText } from '@/lib/errors'
import { fmtDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { fmtMoney } from '@/lib/money'
import { prefs } from '@/lib/prefs'
import { loadReceipt, receiptHtml } from '@/lib/receipt'
import { useTheme } from '@/lib/theme'
import { fmtNum, fmtPack, unitLabel } from '@/lib/units'

type Paper = '80mm' | 'a4'
const PAPER_KEY = 'agri.receiptPaper'
const INK = '#111511'

export default function Receipt() {
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>()
  const { t, lang, pick } = useI18n()
  const { c } = useTheme()
  const { org } = useOrg()
  const { toast } = useFeedback()
  const insets = useSafeAreaInsets()
  const [paper, setPaper] = useState<Paper>(() => (prefs.get(PAPER_KEY) === 'a4' ? 'a4' : '80mm'))
  const [busy, setBusy] = useState<'print' | 'share' | null>(null)
  const { data, error, loading, reload } = useLoad(() => loadReceipt(id), [id])

  useEffect(() => {
    if (fresh && data) haptic.success()
  }, [fresh, data])

  const choosePaper = (p: Paper) => {
    setPaper(p)
    prefs.set(PAPER_KEY, p)
  }
  const html = () => receiptHtml(data!, org, t, lang, pick, paper)
  const print = async () => {
    setBusy('print')
    try {
      await Print.printAsync({ html: html() })
    } catch (e) {
      if (!/cancel/i.test(String(e))) toast(errText(e, t), 'err')
    }
    setBusy(null)
  }
  const share = async () => {
    setBusy('share')
    try {
      const { uri } = await Print.printToFileAsync({ html: html(), width: paper === '80mm' ? 227 : 595 })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('shareReceipt'), UTI: 'com.adobe.pdf' })
    } catch (e) {
      toast(errText(e, t), 'err')
    }
    setBusy(null)
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'))

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Row between>
          <IconBtn icon={<X size={20} color={c.text} />} onPress={close} label={t('close')} />
          <Txt v="h3">{data ? t('receiptReady', { n: data.sale.invoice_no }) : t('receipt')}</Txt>
          <View style={{ width: 42 }} />
        </Row>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {loading && !data ? <Loading rows={3} /> : error ? <ErrorBox error={error} onRetry={reload} /> : data && (
          <>
            {fresh && (
              <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignItems: 'center', marginBottom: 16 }}>
                <View style={[styles.okRing, { borderColor: c.primary + '55', backgroundColor: c.primarySoft }]}>
                  <CheckCircle2 size={42} color={c.primary} />
                </View>
                <Txt v="h2" style={{ marginTop: 10 }}>{fmtMoney(data.sale.total, lang)}</Txt>
                <Txt v="small" muted>{t('saleSaved', { n: data.sale.invoice_no })}</Txt>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(fresh ? 250 : 0).springify().damping(16)}>
              <Zigzag top />
              <View style={styles.paper}>
                <Txt v="h2" color={INK} align="center">{org.name}</Txt>
                {!!org.address && <Txt v="small" color="#3B463E" align="center">{org.address}</Txt>}
                {!!org.phone && <Txt v="small" color="#3B463E" align="center">{org.phone}</Txt>}
                <Dash />
                <Row between>
                  <Txt v="small" color={INK}>{t('invoiceNum')} <Txt v="small" weight="extrabold" color={INK}>{data.sale.invoice_no}</Txt></Txt>
                  <Txt v="small" color={INK}>{fmtDate(data.sale.sale_date, lang)}</Txt>
                </Row>
                <Txt v="small" color={INK}>{t('customer')}: <Txt v="small" weight="bold" color={INK}>{data.party?.name ?? data.sale.customer_name ?? t('walkIn')}</Txt></Txt>
                <Dash />
                {data.lines.map((l) => (
                  <View key={l.key} style={{ paddingVertical: 5 }}>
                    <Row between style={{ alignItems: 'flex-start' }}>
                      <Txt v="small" weight="bold" color={INK} style={{ flex: 1 }}>{pick(l.name, l.name_ur)}</Txt>
                      <Txt v="small" weight="bold" color={INK}>{fmtNum(l.amount)}</Txt>
                    </Row>
                    <Txt v="tiny" color="#556158">
                      {fmtPack(l.pack.pack_size, l.pack.pack_unit, lang)} · {fmtNum(l.qty, 3)}{l.loose ? ` ${unitLabel('kg', lang)}` : ''} × {fmtNum(l.rate)}
                    </Txt>
                  </View>
                ))}
                <Dash />
                <Line k={t('subtotal')} v={fmtMoney(data.sale.subtotal, lang)} />
                {Number(data.sale.discount) > 0 && <Line k={t('discount')} v={`- ${fmtMoney(data.sale.discount, lang)}`} />}
                <Line k={t('grandTotal')} v={fmtMoney(data.sale.total, lang)} big />
                <Line k={t('received')} v={fmtMoney(data.sale.paid, lang)} />
                {Number(data.sale.total) - Number(data.sale.paid) > 0 && <Line k={t('balanceDue')} v={fmtMoney(Number(data.sale.total) - Number(data.sale.paid), lang)} bold />}
                {data.party && (
                  <>
                    <Dash />
                    <Line k={`${t('khataAccount')} ${t('balance')}`} v={fmtMoney(data.party.balance, lang)} bold />
                  </>
                )}
                <Dash />
                {!!data.sale.created_by_name && <Txt v="tiny" color="#556158" align="center">{t('servedBy')}: {data.sale.created_by_name}</Txt>}
                <Txt v="small" weight="extrabold" color={INK} align="center" style={{ marginTop: 4 }}>{t('thankYou')}</Txt>
              </View>
              <Zigzag />
            </Animated.View>

            <Segmented
              value={paper}
              onChange={choosePaper}
              items={[{ value: '80mm', label: t('thermal') }, { value: 'a4', label: t('a4') }]}
              style={{ marginTop: 20 }}
            />
            <Row gap={10} style={{ marginTop: 12 }}>
              <Button variant="secondary" title={t('printReceipt')} icon={<Printer size={18} color={c.text} />} onPress={print} loading={busy === 'print'} style={{ flex: 1 }} />
              <Button variant="secondary" title={t('share')} icon={<Share2 size={18} color={c.text} />} onPress={share} loading={busy === 'share'} style={{ flex: 1 }} />
            </Row>
            <Button size="lg" title={t('sellAgain')} icon={<Plus size={20} color={c.primaryText} />} onPress={() => router.replace('/sale')} style={{ marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </View>
  )
}

function Line({ k, v, big, bold }: { k: string; v: string; big?: boolean; bold?: boolean }) {
  return (
    <Row between style={{ paddingVertical: 2 }}>
      <Txt v={big ? 'body' : 'small'} weight={big || bold ? 'extrabold' : 'medium'} color={INK}>{k}</Txt>
      <Txt v={big ? 'h3' : 'small'} weight={big || bold ? 'extrabold' : 'semibold'} color={INK}>{v}</Txt>
    </Row>
  )
}

function Dash() {
  return <View style={{ borderTopWidth: 1.2, borderStyle: 'dashed', borderColor: '#9AA59D', marginVertical: 10 }} />
}

/** torn-paper edge */
function Zigzag({ top }: { top?: boolean }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', height: 10, overflow: 'hidden', backgroundColor: '#FBFCF8' }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <View key={i} style={{ width: 14, height: 14, backgroundColor: c.bg, transform: [{ rotate: '45deg' }], marginTop: top ? -9 : 5, marginLeft: i ? -2 : -5 }} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FBFCF8', paddingHorizontal: 20, paddingVertical: 14 },
  okRing: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
})
