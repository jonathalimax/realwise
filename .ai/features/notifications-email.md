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

## E-mail layout rules (design system, 2026-10-31)

Every e-mail is built with `buildEmail` in `apps/api/src/notifications/email-layout.ts` (the monthly summary uses its `emailDocument`/`emailHeader` shell). Look: tinted page, white card, tinted panel, dotted hairlines, one violet brand, the Realwise tokens (`Realwise` design system).

- Two variants. `panel` (data e-mails: bills, payments, support, alerts): logo + status `chip`, then a tinted panel with the title, lead and a full-width button. `centered` (warm e-mails: welcome, engagement, win-back, checkout): emoji tile, 36px headline, pill button. `body` goes below the button.
- Content helpers in the same file: `para`, `rows` (emoji tile + bold line + optional description), `detailRows` (label left, bold value right, dotted lines), `chat` (the Elio chat preview), `sectionLabel`.
- Dark mode: light colors are inline, dark colors are `rw-*` classes re-colored by a `prefers-color-scheme: dark` block (`!important`). A new element needs both: inline light color and a class (`rw-ink`, `rw-muted`, `rw-subtle`, `rw-brand`, `rw-pos`/`rw-neg`/`rw-warn`, `rw-line`, `rw-panel`, `rw-tile`). Clients that skip the block still show a readable light e-mail.
- No inline SVG and no `data:` images (Gmail strips them): icons are emoji in tinted tiles; the only hosted files are the logo and the install GIFs in `apps/web/public/email`.
- Copy: a headline of a few words, one or two short lines, then rows. Keep button labels to 23 characters or fewer. Paragraph colors come from the block they sit in, never inline.
- Check by rendering to HTML and opening it with the browser pane in light and dark (`colorScheme` emulation), then send one from Admin → E-mails.

## Statement import e-mails

- `statement_ready`: sent right when Elio finishes reading a statement **and the client had already disconnected** (`ChatController.respond` -> `ChatService.notifyTurnFinishedAway`). Says how many saved rows still need a category. One per import (period key = reply message id).
- `categorize_pending`: daily job. 24h after the newest import, if open review sheets still hold rows and the person has not chatted in 24h. One per import. Both link to `/chat?intent=categorize`, which opens the newest pending sheet.
- While a statement is being read, the chat shows "Pode levar alguns minutos... avisamos por e-mail quando terminar".
- Both kinds have admin toggles (Admin > E-mails) and honor the unsubscribe flag.

## E-mail guide (admin)

`GET /admin/settings/emails/previews` renders every e-mail with sample data through the real templates (`notifications/email-previews.ts`; `NotificationsService.capture` collects mails instead of sending). Shown in Admin > Guia > E-mails. When you add an e-mail, add an entry (with its "when") to `ENTRIES` there.
