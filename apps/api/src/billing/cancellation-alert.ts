import { Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import type { NotificationsService } from '../notifications/notifications.service';

const REASONS: Record<string, string> = {
  too_expensive: 'Caro demais',
  missing_features: 'Faltam recursos',
  switched_service: 'Foi para outro serviço',
  unused: 'Não usa o suficiente',
  customer_service: 'Atendimento',
  too_complex: 'Difícil de usar',
  low_quality: 'Qualidade abaixo do esperado',
  other: 'Outro motivo',
};
const AUTO_REASONS: Record<string, string> = {
  payment_failed: 'Falha no pagamento (cancelada automaticamente)',
  payment_disputed: 'Pagamento contestado',
};

const logger = new Logger('CancellationAlert');

/** Test-mode keys open the test-mode dashboard. */
function stripeDashboardUrl(subscriptionId: string): string {
  const test = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test');
  return `https://dashboard.stripe.com/${test ? 'test/' : ''}subscriptions/${subscriptionId}`;
}

function priceLabel(subscription: Stripe.Subscription): string | null {
  const price = subscription.items.data[0]?.price;
  if (!price?.unit_amount) return null;
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: price.currency.toUpperCase() }).format(price.unit_amount / 100);
  return `${money}/${price.recurring?.interval === 'year' ? 'ano' : 'mês'}`;
}

/**
 * Tells the team inbox that a subscriber cancelled (`requested`: they will keep access until the period ends) or that a
 * subscription ended (`ended`: cancelled immediately, or stopped by Stripe, e.g. after failed payments). Never throws:
 * a failed e-mail must not break the billing flow that triggered it.
 */
export async function notifyCancellation(
  notifications: Pick<NotificationsService, 'sendCancellationAlertEmail'> | undefined,
  user: { id: string; email: string; name: string | null },
  subscription: Stripe.Subscription,
  kind: 'requested' | 'ended',
  plan: string | null,
): Promise<void> {
  if (!notifications) return;
  try {
    const details = subscription.cancellation_details;
    const periodEnds = subscription.items.data.map((item) => item.current_period_end);
    const accessUntil =
      kind === 'ended'
        ? subscription.ended_at
          ? new Date(subscription.ended_at * 1000)
          : new Date()
        : subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : periodEnds.length > 0
            ? new Date(Math.max(...periodEnds) * 1000)
            : null;
    await notifications.sendCancellationAlertEmail({
      kind,
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: plan === 'annual' ? 'Anual' : plan === 'monthly' ? 'Mensal' : null,
      price: priceLabel(subscription),
      accessUntil,
      reason: (details?.feedback && REASONS[details.feedback]) || (details?.reason && AUTO_REASONS[details.reason]) || null,
      comment: details?.comment ?? null,
      stripeUrl: stripeDashboardUrl(subscription.id),
    });
  } catch (error) {
    logger.error(`Could not send cancellation alert for ${user.email}: ${String(error)}`);
  }
}
