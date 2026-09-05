# Payment VPS Env Contract

These variables are required for the Firebase payment and import-issue cutover to run fully on the VPS-hosted API.

## Required API env vars

- `MP_PUBLIC_KEY`: Mercado Pago public key returned by `POST /payments/session`
- `MP_ACCESS_TOKEN`: Mercado Pago access token used by `MercadoPagoClient`
- `EMAIL_FROM`: default sender used by the Nest mailer
- `IMPORT_ISSUES_EMAIL_TO`: recipient for import issue notifications; falls back to `EMAIL_FROM` if omitted
- `API_BASE_URL`: public API origin, used in API-generated links
- `FRONTEND_BASE_URL`: public web origin, used in email/login links

## Current code consumers

- `apps/api/src/payments/payments.service.ts`
- `apps/api/src/payments/mercadopago.client.ts`
- `apps/api/src/notifications/notifications.service.ts`
- `apps/api/src/app.module.ts`

## Deploy checklist

- Set the four payment/import env vars on the API service in Coolify before enabling the new checkout flow
- Confirm Mercado Pago webhooks target the VPS endpoint `/payments/webhooks/mercadopago`
- Send one sandbox checkout and one import issue report after deploy
