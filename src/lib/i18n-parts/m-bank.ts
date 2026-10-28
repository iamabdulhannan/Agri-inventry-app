/** Extra mobile-only strings for the bank screens (the shared ones come from ./bank.ts and i18n.tsx) */
export const mBankEn = {
  /** short tab label (the full "Bank finance & guarantees" does not fit a phone tab) */
  mBankTabFinance: 'Finance',
  /** sub line for a product company that has no khata account yet */
  mBankNewKhata: 'No khata yet',
}

export const mBankUr: Record<keyof typeof mBankEn, string> = {
  mBankTabFinance: 'بینک فنانس',
  mBankNewKhata: 'ابھی کھاتہ نہیں',
}
