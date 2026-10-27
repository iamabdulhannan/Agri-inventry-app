import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

type Cell = string | number | null | undefined

/**
 * Mobile version of the web "Excel" button: writes a CSV that opens correctly in Excel
 * (UTF-8 BOM so Urdu shows) and opens the share sheet (WhatsApp, Drive, Excel, email...).
 */
export async function shareCsv(filename: string, header: string[], rows: Cell[][]) {
  const esc = (v: Cell) => {
    const s = v == null ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const name = (filename.endsWith('.csv') ? filename : `${filename}.csv`).replace(/[\\/:*?"<>|]+/g, '-')
  const file = new File(Paths.cache, name)
  if (file.exists) file.delete()
  file.create()
  file.write('﻿' + body)
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: name })
}
