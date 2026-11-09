# Google Play listing — ZaraiBook

Copy these into Play Console → **Grow → Store presence → Main store listing**.

| Field | Value |
|---|---|
| App name (max 30) | **ZaraiBook: Agri Shop & Khata** |
| Package | `com.zaraibook.app` |
| Category | Business |
| Tags | Inventory, Billing, Accounting |
| Contact email | iamabdalhannan@gmail.com |
| Privacy policy URL | https://github.com/iamabdulhannan/Agri-inventry-app/blob/main/docs/privacy-policy.md |
| Account deletion URL | https://github.com/iamabdulhannan/Agri-inventry-app/blob/main/docs/delete-account.md |

## Short description (max 80)

Stock, invoices, khata & roznamcha for seed, fertilizer and pesticide shops.

## Full description

ZaraiBook is the complete digital register for agricultural input dealers — seed, fertilizer (khaad) and pesticide (spray) shops. Replace paper registers with one simple app in English and Urdu.

**Sell in seconds**
• Fast invoices with product search, loose (per kg) sales and discounts
• Cash and credit (udhaar) rates, markup, pay-by dates
• Share invoices on WhatsApp, as PDF or text — or print on thermal / A4 printers

**Stock that is always right**
• Purchases, opening stock and customer returns
• Batch and expiry tracking with alerts before stock expires
• Low-stock warnings and stock value

**Khata (customer & supplier accounts)**
• Who owes you and whom you owe, with full ledger
• Due dates, overdue list and one-tap WhatsApp reminders
• Crop advances (fasal advance) and party advances

**Roznamcha & bank**
• Daily cash book with expenses, cash in and cash out
• Bank accounts and mobile wallets (JazzCash, Easypaisa), transfers
• Cheques received and given, bank finance and guarantees

**Reports & audit**
• Daily and monthly sales, profit and loss per product
• Tax-year (FBR) report, sales and purchase registers, Excel export
• Audit trail of every change and year lock

**Made for your team**
• Owner, admin and staff roles; invite staff with a code
• Works on phones and tablets, light and dark mode

ZaraiBook — آپ کی زرعی دکان کا مکمل حساب کتاب: اسٹاک، بل، کھاتہ، روزنامچہ اور رپورٹس، اردو اور انگریزی میں۔

## Data safety form (answers)

- Does the app collect or share user data? **Yes, collects** (not shared with third parties for their own use).
- Is all data encrypted in transit? **Yes**.
- Can users request deletion? **Yes** (in app + the deletion URL above).
- Data types collected (all: *collected, not shared, required for app functionality, not optional*):
  - Personal info → **Name**, **Email address**, **Phone number** (customer/supplier numbers the user enters)
  - Financial info → **Purchase history** / **Other financial info** (sales, payments, bank records the user enters)
  - App activity → **Other user-generated content** (business records)
- Purpose for all: **App functionality**, **Account management**.
- No location, contacts, photos, device IDs or advertising data.

## Content rating

Questionnaire category: **Utility, productivity, communication or other** → no violence, no gambling, no user-to-public content → rated **Everyone**.

## Ads / target audience

- Contains ads: **No**
- Target age: **18 and over**

## Graphics you still need to upload

- App icon 512×512 PNG (use `assets/images/icon.png`, exported at 512×512)
- Feature graphic 1024×500
- At least 2 phone screenshots (Home, Sale, Khata, Invoice share look best)

## Upload steps

1. Build the Play bundle: `npx eas-cli build -p android --profile production`
2. Play Console → Create app → **ZaraiBook: Agri Shop & Khata**
3. Testing → Internal testing → Create release → upload the `.aab`
4. Complete the store listing, Data safety, content rating, privacy policy and app access (give reviewers a demo login)
5. Promote to Production when internal testing looks good
