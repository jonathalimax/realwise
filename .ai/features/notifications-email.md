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
