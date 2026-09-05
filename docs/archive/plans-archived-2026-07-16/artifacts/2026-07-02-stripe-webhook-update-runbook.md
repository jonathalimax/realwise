# Stripe Webhook Update Runbook

Use this runbook when moving Stripe webhook delivery from the legacy function path to the Nest API.

## Current target to replace

Replace whichever legacy Stripe webhook URL is still configured in the Stripe dashboard. In prior repo flows this was the legacy `stripeWebhook` cloud function endpoint.

## New target

`https://api.realwise.com.br/webhooks/stripe`

## Required secrets before switching

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

These must exist in the API runtime environment before Stripe traffic is pointed at the new endpoint.

## Dashboard steps

1. Open the Stripe dashboard for the Realwise account.
2. Go to Developers -> Webhooks.
3. Open the webhook endpoint currently receiving checkout events.
4. Update the destination URL to `https://api.realwise.com.br/webhooks/stripe`, or create a new endpoint with that URL if you want a safer cutover.
5. Ensure `checkout.session.completed` is enabled.
6. Copy the signing secret for the new or updated endpoint.
7. Save that value as `STRIPE_WEBHOOK_SECRET` in Coolify for the API service.
8. Confirm `STRIPE_SECRET_KEY` is also present in the same API service.
9. Redeploy the API service.
10. Use Stripe's "Send test webhook" action for `checkout.session.completed`.

## Expected success signal

- API responds `200` to the Stripe test event.
- The event reaches `apps/api/src/payments/stripe.webhook.controller.ts`.
- The matching user ends with `premium_status = active`.
- The matching purchase row stores `payment_provider = stripe`.

## Rollback

If delivery fails after the switch:

1. Restore the previous webhook URL in Stripe.
2. Redeploy the previous API image if needed.
3. Re-send the failed Stripe event after the endpoint is healthy again.
