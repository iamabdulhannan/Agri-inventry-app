/** Extra mobile-only strings for the khata screens (the shared ones come from ./khata.ts and i18n.tsx) */
export const mKhataEn = {
  /** shown when neither the WhatsApp app nor wa.me could be opened */
  mKhWaFailed: 'Could not open WhatsApp',
  /** sheet to set the due date of one bill */
  mKhSetDueHint: 'The date this bill should be paid by. Leave it empty if there is no fixed date.',
  /** "{n} open" crop advances */
  mKhOpenN: '{n} open',
  /** the history list of a crop advance: hide / show */
  mKhHide: 'Hide',
  mKhShow: 'Show',
}

export const mKhataUr: Record<keyof typeof mKhataEn, string> = {
  mKhWaFailed: 'واٹس ایپ نہیں کھل سکا',
  mKhSetDueHint: 'یہ بل کس تاریخ تک ادا ہونا ہے۔ اگر کوئی مقررہ تاریخ نہیں تو خالی چھوڑ دیں۔',
  mKhOpenN: '{n} کھلے',
  mKhHide: 'چھپائیں',
  mKhShow: 'دکھائیں',
}
