/** Extra mobile-only strings for the audit screens (the shared ones come from ./audit.ts and i18n.tsx) */
export const mAuditEn = {
  mAuditTaxYear: 'Tax year',
  mAuditFbrYear: 'FBR tax year: 1 July to 30 June',
  mAuditPrevYear: 'Previous tax year',
  mAuditNextYear: 'Next tax year',
  mAuditReturns: '{n} returns',
  mAuditFieldsChanged: '{n} fields changed',
  mAuditValueOpenClose: 'Value: opening → closing',
}

export const mAuditUr: Record<keyof typeof mAuditEn, string> = {
  mAuditTaxYear: 'ٹیکس سال',
  mAuditFbrYear: 'ایف بی آر ٹیکس سال: یکم جولائی تا 30 جون',
  mAuditPrevYear: 'پچھلا ٹیکس سال',
  mAuditNextYear: 'اگلا ٹیکس سال',
  mAuditReturns: '{n} واپسیاں',
  mAuditFieldsChanged: '{n} چیزیں تبدیل ہوئیں',
  mAuditValueOpenClose: 'مالیت: ابتدائی ← اختتامی',
}
