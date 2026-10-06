import { fmtDate } from './format'
import type { Lang, TFn } from './i18n'
import { fmtMoney } from './money'
import { supabase } from './supabase'
import type { Organization, PackType, PackUnit, Sale } from './types'
import { fmtNum, fmtPack, unitLabel } from './units'

export interface ReceiptLine {
  key: string
  name: string
  name_ur: string | null
  pack: { pack_size: number; pack_unit: PackUnit; pack_type: PackType }
  qty: number
  rate: number
  amount: number
  /** bag sold loose: qty in kg, rate per kg */
  loose: boolean
}
export interface ReceiptData {
  sale: Sale
  lines: ReceiptLine[]
  party: { name: string; phone: string | null; balance: number } | null
}

export async function loadReceipt(saleId: string): Promise<ReceiptData> {
  const [{ data: sale, error: e1 }, { data: moves, error: e2 }] = await Promise.all([
    supabase.from('sales').select('*').eq('id', saleId).single(),
    supabase.from('stock_movements').select('qty, unit_price, loose, batches(products(id, name, name_ur, pack_size, pack_unit, pack_type))').eq('sale_id', saleId).order('created_at'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  // FEFO may split one item over several batches: merge them back per product + rate
  const map = new Map<string, ReceiptLine>()
  type Row = { qty: number; unit_price: number; loose?: boolean; batches: { products: { id: string; name: string; name_ur: string | null; pack_size: number; pack_unit: PackUnit; pack_type: PackType } } }
  for (const m of (moves ?? []) as unknown as Row[]) {
    const p = m.batches?.products
    if (!p) continue
    const loose = !!m.loose
    const key = `${p.id}|${m.unit_price}|${loose}`
    const packs = -Number(m.qty)
    const amount = packs * Number(m.unit_price)
    const size = Number(p.pack_size) || 1
    const qty = loose ? packs * size : packs
    const cur = map.get(key)
    if (cur) {
      cur.qty += qty
      cur.amount += amount
    } else {
      map.set(key, { key, name: p.name, name_ur: p.name_ur, pack: { pack_size: size, pack_unit: p.pack_unit, pack_type: p.pack_type }, qty, rate: loose ? Number(m.unit_price) / size : Number(m.unit_price), amount, loose })
    }
  }
  let party: ReceiptData['party'] = null
  if (sale.party_id) {
    const { data } = await supabase.from('party_balances').select('name, phone, balance').eq('id', sale.party_id).single()
    if (data) party = { ...data, balance: Number(data.balance) }
  }
  return { sale: sale as Sale, lines: [...map.values()], party }
}

const esc = (s: string | null | undefined) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)

/** HTML for printing / PDF sharing: 80 mm thermal or A4 */
export function receiptHtml(d: ReceiptData, org: Organization, t: TFn, lang: Lang, pick: (en: string, ur?: string | null) => string, paper: '80mm' | 'a4') {
  const { sale, lines, party } = d
  const due = Number(sale.total) - Number(sale.paid)
  const time = new Date(sale.created_at).toLocaleTimeString(lang === 'ur' ? 'ur-PK' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  const m = (n: number) => esc(fmtMoney(n, lang))
  const row = (a: string, b: string, cls = '') => `<div class="row ${cls}"><span>${a}</span><span>${b}</span></div>`
  const items = lines
    .map((l) => `<tr><td>${esc(pick(l.name, l.name_ur))}<div class="sub">${esc(fmtPack(l.pack.pack_size, l.pack.pack_unit, lang))} ${esc(t(`pt_${l.pack.pack_type}`))}</div></td>
      <td class="r">${fmtNum(l.qty, 3)}${l.loose ? ` ${esc(unitLabel('kg', lang))}` : ''}</td><td class="r">${fmtNum(l.rate)}</td><td class="r">${fmtNum(l.amount)}</td></tr>`)
    .join('')
  const width = paper === '80mm' ? '72mm' : '180mm'
  return `<!doctype html><html dir="${lang === 'ur' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: ${paper === '80mm' ? '80mm auto' : 'A4'}; margin: ${paper === '80mm' ? '3mm' : '12mm'}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Roboto, "Noto Nastaliq Urdu", sans-serif; color: #000; font-size: ${paper === '80mm' ? '11.5px' : '13px'}; }
  .wrap { width: ${width}; margin: 0 auto; }
  .c { text-align: center; } .b { font-weight: 700; } .big { font-size: 1.35em; }
  .hr { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 10px; }
  .tot { font-size: 1.15em; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: start; border-bottom: 1px solid #000; font-weight: 700; padding: 2px 0; }
  td { vertical-align: top; padding: 2px 0; } .r { text-align: end; white-space: nowrap; padding-inline-start: 4px; }
  .sub { font-size: .85em; color: #333; }
</style></head><body><div class="wrap">
  <div class="c b big">${esc(org.name)}</div>
  ${org.address ? `<div class="c">${esc(org.address)}</div>` : ''}
  ${org.phone ? `<div class="c" dir="ltr">${esc(org.phone)}</div>` : ''}
  <div class="hr"></div>
  ${row(`${esc(t('invoiceNum'))} <b>${sale.invoice_no}</b>`, `${esc(fmtDate(sale.sale_date, lang))} ${esc(time)}`)}
  <div>${esc(t('customer'))}: <b>${esc(party?.name ?? sale.customer_name ?? t('walkIn'))}</b>${party?.phone ? ` · ${esc(party.phone)}` : ''}</div>
  <div class="hr"></div>
  <table><thead><tr><th>${esc(t('item'))}</th><th class="r">${esc(t('qty'))}</th><th class="r">${esc(t('rate'))}</th><th class="r">${esc(t('amount'))}</th></tr></thead><tbody>${items}</tbody></table>
  <div class="hr"></div>
  ${row(esc(t('subtotal')), m(sale.subtotal))}
  ${Number(sale.discount) > 0 ? row(esc(t('discount')), `- ${m(sale.discount)}`) : ''}
  ${row(esc(t('grandTotal')), m(sale.total), 'tot')}
  ${row(esc(t('received')), m(sale.paid))}
  ${due > 0 ? row(`<b>${esc(t('balanceDue'))}</b>`, `<b>${m(due)}</b>`) : ''}
  ${party ? `<div class="hr"></div>${row(`<b>${esc(t('khataAccount'))} ${esc(t('balance'))}</b>`, `<b>${m(party.balance)}</b>`)}` : ''}
  <div class="hr"></div>
  ${sale.created_by_name ? `<div class="c">${esc(t('servedBy'))}: ${esc(sale.created_by_name)}</div>` : ''}
  <div class="c b" style="margin-top:4px">${esc(t('thankYou'))}</div>
</div></body></html>`
}
