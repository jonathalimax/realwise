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
