# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Limas Finance is a personal finance tracker PWA built with React 19, Vite, and Tailwind CSS v4. It uses Firebase for authentication (email/password and Google) and Firestore as the database. The app supports Portuguese and English languages and includes features like transaction tracking, budgets, goals, bill reminders with WhatsApp notifications, credit card management, and bank statement imports.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build to dist/
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Firebase Functions (in `/functions`)

```bash
cd functions && npm install
firebase deploy --only functions    # Deploy cloud functions
firebase functions:config:set ...   # Set config values
```

## Architecture

### Frontend Structure

- **Routing**: React Router v7 in `src/App.jsx`. Landing page at `/`, main app at `/home` (requires auth)
- **State Management**: React Context providers nested in `App.jsx`:
  - `AccessContext` - User access/permissions, shared account support via `ownerId`
  - `SettingsContext` - Currency, language, categories, dark mode, tutorial state
  - `BillsContext`, `BudgetContext`, `CardsContext`, `GoalsContext`, `InvestmentContext`
- **Localization**: Custom i18n in `src/locales/` using dot-notation paths (`t('auth.welcomeBack')`)
- **Path Aliases**: `@` → `src/`, `@landing` → `landing_page/` (configured in vite.config.js)

### Key Data Patterns

- All user data is scoped by `userId` field in Firestore collections
- Shared accounts use `ownerId` from `AccessContext` instead of `auth.currentUser.uid`
- Transactions support credit card payment date logic via `getPaymentMonthKey()` from `CardsContext`
- Bank statement imports auto-detect bank format (Nubank, Itaú, Bradesco) in `src/services/importers/`

### Firebase Functions (`/functions`)

- `createPayment` / `mercadoPagoWebhook` - Mercado Pago PIX payment processing
- `whatsappWebhook` - WhatsApp Cloud API for bill reminder responses
- `scheduledBillReminders` - Daily 9 AM (Brazil time) bill notifications
- `sendWhatsAppReminder` / `testWhatsApp` - Manual testing endpoints

### Firestore Collections

- `transactions` - Income/expenses with `userId`, `date`, `amount`, `type`, `category`, `bankId`
- `bills` - Recurring bills with `status` (pending/paid), `dueDate`
- `settings` - Per-user preferences (currency, language, categories, whatsappNumber)
- `purchases` / `pending_payments` / `coupons` - Payment system data

## Styling

- Tailwind CSS v4 with dark mode via `dark:` prefix
- Dark mode toggles `dark` class on `document.documentElement`
- UI components in `src/components/ui/` (button, input, badge, tabs, shimmer)

## Environment Variables

Frontend (`.env`):
- `VITE_FIREBASE_*` - Firebase configuration

Functions (Firebase config):
- `mercadopago.access_token` - Mercado Pago API
- `email.user` / `email.password` - Gmail for notifications
- `whatsapp.access_token` / `whatsapp.phone_number_id` / `whatsapp.verify_token` - WhatsApp Cloud API
