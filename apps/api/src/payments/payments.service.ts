import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { leads } from '../db/schema';
import { CreatePartialLeadDto } from './dto/create-partial-lead.dto';

function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

/** Landing-page lead capture. Payments themselves live in the `billing` module (Stripe subscriptions). */
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  private async recordLead(input: {
    email: string;
    name?: string | null;
    whatsapp?: string | null;
    utmSource?: string | null;
    status?: string | null;
  }) {
    const rows = await this.db
      .select()
      .from(leads)
      .where(eq(leads.email, input.email));

    const existing = rows[0];
    const existingMetadata = asMetadataRecord(existing?.metadata);
    const metadata = {
      source: 'payments-api',
      whatsapp: input.whatsapp ?? null,
      utmSource: input.utmSource ?? null,
      ...existingMetadata,
    };

    if (existing?.id) {
      await this.db
        .update(leads)
        .set({
          name: input.name ?? existing.name ?? null,
          status: input.status ?? 'checkout_started',
          updatedAt: new Date(),
          metadata,
        })
        .where(eq(leads.id, existing.id));
      return;
    }

    await this.db.insert(leads).values({
      email: input.email,
      name: input.name ?? null,
      plan: 'premium',
      status: input.status ?? 'checkout_started',
      updatedAt: new Date(),
      metadata,
    });
  }

  async savePartialLead(dto: CreatePartialLeadDto) {
    const email = dto.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('email e obrigatorio.');
    }

    await this.recordLead({
      email,
      name: dto.name?.trim() || null,
      whatsapp: dto.whatsapp?.trim() || null,
      utmSource: dto.utmSource?.trim() || null,
      status: 'partial_checkout',
    });

    return { ok: true };
  }
}
