# Agri Inventory — Mobile (iOS & Android)

The phone app for **Agri Inventory**, built with **React Native + Expo (SDK 57)**.
It talks to the **same Supabase project, tables, views and RPC functions** as the web app
(`../agri-inventory`), so the same login, shop data and rules (no negative stock, FEFO,
no selling expired stock, khata, roznamcha…) apply everywhere.

## What's inside

- **Animated splash**: pulse rings, rotating comet ring, a sprout that draws itself and grows leaves, rising pollen, letter-by-letter wordmark with a light sweep, then a zoom-through into the app.
- **Auth**: sign in, create a shop, join with an invite code, plus a "no shop yet" screen.
- **Home**: today's sales hero with count-up numbers and a 7-day bar chart, quick actions, expiry carousel, money tiles (cash in hand, receivable, payable, stock value…), stock overview, low stock and recent activity.
- **Sell (center button)**: walk-in or khata customer, product picker, quantity stepper, earliest-expiry-first batch preview, loose-by-kg selling for bags, discount, received / on credit. Also handles return to supplier, damaged and expired write-offs.
- **Receipt**: paper-style receipt you can **print** (80 mm thermal or A4) or **share as a PDF** (WhatsApp etc.).
- **Stock In**: purchase / opening stock / manual return, supplier khata, batches, expiry dates (custom calendar), paid now / on credit, create products inline, edit purchases (admin).
- **Customer returns** against an invoice, with refund or khata credit.
- **Products**: search, stock filters, categories, sorting, add products in several pack sizes at once, product detail with batches, history, stock count adjustment (admin).
- **Khata**: customers & suppliers, ledger, receive / pay, call and WhatsApp reminder.
- **Roznamcha**: daily cash book (day & month), expenses, cash in / out.
- **Invoices & purchases**, **Expiry**, **Reports** (sales & profit, stock movement), **Stock history**.
- **Settings**, **Team & invites** (share codes, roles, reset passwords, remove members), **Categories & companies**.
- **English / اردو**, **dark / light / auto** theme, haptics throughout.

## Setup

```bash
cd agri-inventory-mobile
npm install
cp .env.example .env   # already filled in on this machine with the web app's Supabase URL + anon key
```

The database must have migrations `001`–`010` from `../agri-inventory/supabase/migrations` applied (same as the web app).

## Run on your phone (fastest)

```bash
npx expo start
```

Install **Expo Go** from the App Store / Play Store and scan the QR code. Every library used here ships inside Expo Go, so no native build is needed for development.

## Build installable apps (iOS + Android) with EAS

```bash
npm install -g eas-cli      # or use npx eas-cli@latest
eas login
eas init                    # links the project to your Expo account (adds the projectId)

# Android APK you can send on WhatsApp and install directly
eas build -p android --profile preview

# Store builds
eas build -p android --profile production   # .aab for Google Play
eas build -p ios --profile production       # needs an Apple Developer account
eas submit -p ios                           # / -p android, to upload to the stores
```

`.env` is kept out of git (`.gitignore`) but **is** uploaded to EAS builds (`.easignore`), so builds get the Supabase keys automatically.

Before publishing, change the app identifiers in `app.json` if you want your own:
`ios.bundleIdentifier` and `android.package` (currently `com.agriinventory.app`).

## Project structure

```
src/app/                 screens (Expo Router, file-based)
  _layout.tsx            fonts, providers, auth guards, animated splash
  (auth)/                welcome, sign in, sign up / join
  no-org.tsx             signed in but no shop yet
  (app)/(tabs)/          Home, Products, Khata, More (+ floating tab bar with Sell button)
  (app)/*.tsx            sale, stock-in, return, receipt, product, party, invoices,
                         roznamcha, expiry, reports, history, settings, team, lists
src/components/ui/       design system: Txt, Button, Card, Sheet, inputs, calendar, toasts…
src/components/          Splash, Logo, domain rows/pickers, forms, charts
src/lib/                 Supabase client, app/auth state, theme, i18n (shared with web),
                         money/units/dates/loose-sale helpers (copied from the web app)
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```
