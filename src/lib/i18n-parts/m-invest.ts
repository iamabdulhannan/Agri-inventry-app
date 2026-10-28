/** Extra mobile-only strings for the invest screens (the shared ones come from ./invest.ts and i18n.tsx) */
export const mInvestEn = {
  mInvAdminOnly: 'Only the owner or an admin can open Investors.',
  mInvCount: '{n} investors',
  mInvSplit: 'Where the money is',
  mInvActions: 'Actions',
  mInvSoldOf: '{sold} of {qty} sold',
  mInvPerDay: 'Profit per day on his stock',
  mInvLotTotals: 'All his stock',
  mInvAfterCapital: 'Capital after this: {amount}',
  mInvPaysNow: 'Pays now: {amount}',
  mInvNothingPaid: 'Nothing is paid out',
  mInvLeftAfter: 'Left to buy after this: {amount}',
  mInvInStockNow: '{n} in stock',
  mInvChooseProduct: 'Choose a product',
  mInvHowItWorks: 'He gets {n}% of the profit on his stock. A loss comes out of his capital.',
}

export const mInvestUr: Record<keyof typeof mInvestEn, string> = {
  mInvAdminOnly: 'سرمایہ کار صرف مالک یا ایڈمن کھول سکتا ہے۔',
  mInvCount: '{n} سرمایہ کار',
  mInvSplit: 'رقم کہاں لگی ہے',
  mInvActions: 'کام',
  mInvSoldOf: '{qty} میں سے {sold} بکا',
  mInvPerDay: 'اس کے مال پر روزانہ منافع',
  mInvLotTotals: 'اس کا سارا مال',
  mInvAfterCapital: 'اس کے بعد سرمایہ: {amount}',
  mInvPaysNow: 'ابھی ادائیگی: {amount}',
  mInvNothingPaid: 'کوئی ادائیگی نہیں',
  mInvLeftAfter: 'اس کے بعد خریدنے کے لیے باقی: {amount}',
  mInvInStockNow: 'اسٹاک میں {n}',
  mInvChooseProduct: 'پروڈکٹ منتخب کریں',
  mInvHowItWorks: 'اس کے مال کے منافع میں اس کا {n}% حصہ ہے۔ نقصان اس کے سرمائے سے کٹے گا۔',
}
