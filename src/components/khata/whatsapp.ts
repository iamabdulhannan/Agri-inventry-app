import { Linking } from 'react-native'
import { waNumber } from '@/lib/khataMoney'

/** True when the phone number can get a WhatsApp message */
export const canWhatsApp = (phone: string | null | undefined) => !!waNumber(phone)

/**
 * Open a WhatsApp chat with a ready message: the WhatsApp app first, then https://wa.me
 * (browser) when the app is not installed. Resolves false when neither could be opened.
 */
export async function openWhatsApp(phone: string | null | undefined, text: string): Promise<boolean> {
  const n = waNumber(phone)
  if (!n) return false
  const msg = encodeURIComponent(text)
  try {
    await Linking.openURL(`whatsapp://send?phone=${n}&text=${msg}`)
    return true
  } catch {
    try {
      await Linking.openURL(`https://wa.me/${n}?text=${msg}`)
      return true
    } catch {
      return false
    }
  }
}
