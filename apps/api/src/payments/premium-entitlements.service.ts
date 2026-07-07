import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { purchases, users } from '../db/schema';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';

type PremiumPaymentProvider = 'stripe' | 'mercadopago';

function resolveClientId(clientId: string | null | undefined, email: string): string {
  if (clientId?.trim()) {
    return clientId.trim();
  }

  const localPart = email.split('@')[0]?.trim();
  if (localPart) {
    return localPart;
  }

  throw new BadRequestException('Unable to resolve clientId for payment');
}

@Injectable()
export class PremiumEntitlementsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly authService: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  async unlockPremiumAccess(input: {
    clientId?: string | null;
    email: string;
    name?: string | null;
    amount?: number | null;
    paymentProvider: PremiumPaymentProvider;
    providerPaymentId: string;
    metadata?: Record<string, unknown>;
  }) {
    const clientId = resolveClientId(input.clientId, input.email);
    const user = await this.authService.findOrCreateUser({
      clientId,
      email: input.email,
      name: input.name ?? null,
    });

    const existingPurchase = await this.db
      .select()
      .from(purchases)
      .where(and(
        eq(purchases.paymentProvider, input.paymentProvider),
        eq(purchases.providerPaymentId, input.providerPaymentId),
      ));

    await this.db
      .update(users)
      .set({
        premiumStatus: 'active',
        premiumAccessEndsAt: null,
        premiumPurchasedAt: user.premiumPurchasedAt ?? new Date(),
        premiumPaymentProvider: input.paymentProvider,
        premiumProviderPaymentId: input.providerPaymentId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    if (existingPurchase.length > 0) {
      return { userId: user.id, clientId, alreadyProcessed: true };
    }

    await this.db
      .insert(purchases)
      .values({
        clientId,
        email: input.email,
        plan: 'premium',
        amount: input.amount != null ? String(input.amount) : null,
        status: 'approved',
        paymentProvider: input.paymentProvider,
        providerPaymentId: input.providerPaymentId,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      })
      .returning();

    await this.notifications.sendAdminEmail(input.email, 'access_granted', {
      name: input.name ?? user.name ?? 'Cliente',
      loginUrl: 'https://realwise.com.br/login',
    });

    return { userId: user.id, clientId, alreadyProcessed: false };
  }
}
