import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StripeClient } from './stripe-client';

/** Events the webhook handler acts on (see StripeWebhookService.handleEvent). */
export const REQUIRED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;

export interface WebhookHealth {
  ok: boolean;
  /** Where Stripe must send events for this API. */
  expectedUrl: string;
  /** What is wrong, in plain Portuguese for the admin. Empty when ok. */
  problems: string[];
  /** URLs of the endpoints registered in Stripe (for context when something is off). */
  endpoints: string[];
  checkedAt: string;
}

const normalize = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase();

/**
 * Compares what Stripe is configured to call with the route this API really serves. A wrong URL or secret is silent
 * (Stripe just gets a 404/400 and the app never learns about payments), so this surfaces it in the admin and logs it
 * daily, which also lands in the error log.
 */
@Injectable()
export class WebhookHealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WebhookHealthService.name);

  constructor(private readonly stripe: StripeClient) {}

  /** Once shortly after every deploy, so a wrong setup shows up right away instead of at the next 08:00 run. */
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.checkDaily(), 30_000).unref();
  }

  expectedUrl(): string {
    return `${(process.env.API_BASE_URL ?? 'https://api.realwise.com.br').replace(/\/+$/, '')}/webhooks/stripe`;
  }

  async check(): Promise<WebhookHealth> {
    const expectedUrl = this.expectedUrl();
    const problems: string[] = [];
    let endpoints: string[] = [];

    if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
      problems.push('STRIPE_WEBHOOK_SECRET não está configurado na API: toda chamada do Stripe é recusada.');
    }

    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      problems.push('STRIPE_SECRET_KEY não está configurado na API.');
    } else {
      try {
        const list = await this.stripe.get().webhookEndpoints.list({ limit: 100 });
        endpoints = list.data.map((e) => e.url);
        const mine = list.data.find((e) => normalize(e.url) === normalize(expectedUrl));
        if (!mine) {
          problems.push(
            `Nenhum endpoint do Stripe aponta para ${expectedUrl}.${endpoints.length ? ` Hoje o Stripe chama: ${endpoints.join(', ')}.` : ' O Stripe não tem nenhum endpoint cadastrado.'}`,
          );
        } else {
          if (mine.status !== 'enabled') problems.push('O endpoint do Stripe está desativado.');
          const events = new Set(mine.enabled_events as string[]);
          if (!events.has('*')) {
            const missing = REQUIRED_WEBHOOK_EVENTS.filter((e) => !events.has(e));
            if (missing.length) problems.push(`O endpoint não escuta estes eventos: ${missing.join(', ')}.`);
          }
        }
      } catch (error) {
        problems.push(`Não consegui consultar os endpoints no Stripe (${(error as Error).message}). A chave pode não ter permissão de leitura de webhooks.`);
      }
    }

    return { ok: problems.length === 0, expectedUrl, problems, endpoints, checkedAt: new Date().toISOString() };
  }

  /** Daily: a broken webhook must not stay unnoticed. The error log picks this up through the logger. */
  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async checkDaily(): Promise<void> {
    try {
      const health = await this.check();
      if (!health.ok) this.logger.error(`Stripe webhook is not set up correctly: ${health.problems.join(' | ')}`);
    } catch (error) {
      this.logger.error(`Stripe webhook check failed: ${String(error)}`);
    }
  }
}
