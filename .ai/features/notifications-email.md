# Feature: Notifications and Email

## Purpose

Deliver reminders and operational emails such as bill reminders, purchase/admin notifications, and import emails.

## Boundaries

- API owns scheduled jobs, SMTP integration, templates, and delivery side effects.
- Web/admin only trigger or display notification-related states when backed by API contracts.

## Runtime

SMTP configuration uses API runtime secrets such as `EMAIL_*` variables.

## Agent notes

- Do not hardcode production recipient/sender values.
- Keep email sending idempotent where scheduled reminders can retry.
- Document new templates/jobs and their runtime variables.

## Admin v2: runtime settings and marketing (Area C)

- `AppSettingsService` (`apps/api/src/app-settings`, global) reads `app_settings` with a 60s cache; precedence DB > env > default. Keys: `ai`, `emails`, `announcement`. `LlmService`/`OpenRouterProvider` read `ai`; `users.llm_budget_override_usd` wins for both trial cap and monthly budget (0 = no cap).
- Engagement (default 10h) and bill-reminder (default 9h) schedulers run an hourly cron and fire only at the configured America/Sao_Paulo hour while enabled; engagement kinds have per-kind toggles.
- `apps/api/src/admin-comms`: support inbox, campaigns (batched ~10/s, idempotent per user via `email_campaign_sends`, resumed by a 15-minute check), public `GET /marketing/unsubscribe`, public `GET /announcement`. Support replies go from `SUPPORT_EMAIL`.

## E-mail layout rules (redesign, 2026-10-31)

- One layout: `getBaseTemplate` in `notifications.service.ts`. No card, no background colors of its own (a white card inverts to a visible box in Gmail dark mode); the summary e-mail follows the same rule. Headline 30px, body 17px, full-width button (`#059669`, 17px bold), one small footer line.
- Copy: a headline of a few words, one or two short lines, then `rows([...])` (big emoji + one bold line) instead of boxed lists. Avoid boxes inside the e-mail; the only highlights are the win-back/coupon code (big letters) and the install GIFs.
- Banner: `hero: '<name>'` renders `https://realwise.com.br/email/hero-<name>.jpg` (1200x440, served from `apps/web/public/email`, generated with PIL: gradient + Apple Color Emoji). Existing names: welcome, activation, insights, hourglass, locked, bills, payment, gift, heart, import, idea, check, cart, coupon, alarm.
- Keep button labels to 23 characters or fewer (the button is capped at 360px).
