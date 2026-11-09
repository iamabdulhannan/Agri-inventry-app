import { File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Share } from 'react-native'
import { openWhatsApp } from '@/components/khata/whatsapp'
import { fmtDate } from './format'
import type { Lang, TFn } from './i18n'
import { fmtMoney } from './money'
import { receiptHtml, saleDueOf, type ReceiptData } from './receipt'
import { receiptNoteOf } from './receiptNote'
import type { Organization } from './types'
import { fmtNum, fmtPack, unitLabel } from './units'

type Pick = (en: string, ur?: string | null) => string
export type Paper = '80mm' | 'a4'

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()

/**
 * The bill as a PDF with a readable file name ("Invoice 1042 - Shop name.pdf"),
 * so it shows up properly in WhatsApp, Gmail, Drive...
 */
export async function invoicePdf(d: ReceiptData, org: Organization, t: TFn, lang: Lang, pick: Pick, paper: Paper): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: receiptHtml(d, org, t, lang, pick, paper), width: paper === '80mm' ? 227 : 595 })
  // English file name in both languages: some phones and apps garble non-Latin file names
  const name = safeName(`Invoice ${d.sale.invoice_no} - ${org.name}`) + '.pdf'
  try {
    const dest = new File(Paths.cache, name)
    if (dest.exists) dest.delete()
    await new File(uri).move(dest)
    return dest.uri
  } catch {
    // keep the printer's temporary name rather than failing the share
    return uri
  }
}

export async function shareInvoicePdf(d: ReceiptData, org: Organization, t: TFn, lang: Lang, pick: Pick, paper: Paper) {
  const uri = await invoicePdf(d, org, t, lang, pick, paper)
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('shareReceipt'), UTI: 'com.adobe.pdf' })
}

/** The bill as a chat message (WhatsApp shows *text* in bold) */
export function invoiceText(d: ReceiptData, org: Organization, t: TFn, lang: Lang, pick: Pick): string {
  const m = (n: number) => fmtMoney(n, lang)
  const s = d.sale
  const due = saleDueOf(s)
  const out: string[] = []
  out.push(`*${org.name}*`)
  if (org.phone) out.push(org.phone)
  out.push('')
  out.push(`🧾 *${t('invoiceNum')} ${s.invoice_no}* · ${fmtDate(s.sale_date, lang)}`)
  out.push(`${t('customer')}: ${d.party?.name ?? s.customer_name ?? t('walkIn')}`)
  out.push('')
  for (const l of d.lines) {
    const qty = `${fmtNum(l.qty, 3)}${l.loose ? ` ${unitLabel('kg', lang)}` : ''}`
    out.push(`• ${pick(l.name, l.name_ur)} (${fmtPack(l.pack.pack_size, l.pack.pack_unit, lang)})`)
    out.push(`   ${qty} × ${fmtNum(l.rate)} = ${m(l.amount)}`)
  }
  out.push('')
  if (Number(s.discount) > 0 || Number(s.markup ?? 0) > 0) out.push(`${t('subtotal')}: ${m(Number(s.subtotal))}`)
  if (Number(s.discount) > 0) out.push(`${t('discount')}: -${m(Number(s.discount))}`)
  if (Number(s.markup ?? 0) > 0) out.push(`${t('saleMarkup')}: +${m(Number(s.markup))}`)
  out.push(`*${t('grandTotal')}: ${m(Number(s.total))}*`)
  if (Number(s.advance_used ?? 0) > 0) out.push(`${t('salePaidFromAdvance')}: ${m(Number(s.advance_used))}`)
  out.push(`${t('received')}: ${m(Number(s.paid))}`)
  if (due > 0) {
    out.push(`*${t('balanceDue')}: ${m(due)}*`)
    if (s.due_date) out.push(`${t('salePayBy')}: ${fmtDate(s.due_date, lang)}`)
  }
  if (d.party) out.push(`${t('khataAccount')} ${t('balance')}: ${m(d.party.balance)}`)
  out.push('')
  out.push(t('thankYou'))
  out.push(`نوٹ: ${receiptNoteOf(org)}`)
  return out.join('\n')
}

export async function shareInvoiceText(d: ReceiptData, org: Organization, t: TFn, lang: Lang, pick: Pick) {
  await Share.share({ message: invoiceText(d, org, t, lang, pick), title: t('mShareFileName', { n: d.sale.invoice_no }) })
}

/** Straight into the customer's WhatsApp chat with the bill; false when the number can't be used */
export const whatsappInvoice = (d: ReceiptData, org: Organization, t: TFn, lang: Lang, pick: Pick) =>
  openWhatsApp(d.party?.phone, invoiceText(d, org, t, lang, pick))
