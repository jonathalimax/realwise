import { Controller, Get, Header, Post, Query, Res } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Response } from 'express';
import { Inject } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { Public } from '../auth/decorators/public.decorator';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { DRIZZLE } from '../db/drizzle.module';
import * as schema from '../db/schema';
import { users } from '../db/schema';
import { isValidMarketingUnsubscribeToken } from './marketing-token';

const page = (msg: string, detail = '') =>
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Realwise</title><body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;color:#1e293b"><h2>${msg}</h2>${detail ? `<p style="color:#6b7280">${detail}</p>` : ''}<p><a href="https://realwise.com.br" style="color:#10b981">Voltar ao Realwise</a></p></body></html>`;

@Public()
@AllowWithoutSubscription()
@Controller()
export class PublicCommsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly settings: AppSettingsService,
  ) {}

  private async optOut(userId: string, token: string): Promise<boolean> {
    if (!userId || !isValidMarketingUnsubscribeToken(userId, token)) return false;
    await this.db.update(users).set({ marketingEmailsOptOut: true }).where(eq(users.id, userId));
    return true;
  }

  @Get('marketing/unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(@Query('u') userId: string, @Query('t') token: string): Promise<string> {
    try {
      if (!(await this.optOut(userId, token))) return page('Link inválido ou expirado.');
    } catch {
      return page('Não foi possível concluir agora.', 'Tente novamente em instantes.');
    }
    return page('Pronto! Você não receberá mais e-mails de novidades.', 'Lembretes essenciais da sua conta continuam como estão nas suas configurações.');
  }

  /** RFC 8058 one-click: mail clients POST to the List-Unsubscribe URL. */
  @Post('marketing/unsubscribe')
  async unsubscribeOneClick(@Query('u') userId: string, @Query('t') token: string): Promise<{ ok: boolean }> {
    return { ok: await this.optOut(userId, token) };
  }

  /** The current banner, or JSON null when there is none (sent with res.json so the body is a literal `null`). */
  @Get('announcement')
  async announcement(@Res() res: Response): Promise<void> {
    const a = await this.settings.getAnnouncement();
    const live = a && a.enabled && a.text?.trim() && (!a.until || new Date(a.until).getTime() > Date.now());
    res.json(
      live
        ? { enabled: true, text: a.text, level: a.level ?? 'info', linkLabel: a.linkLabel ?? null, linkUrl: a.linkUrl ?? null, until: a.until ?? null }
        : null,
    );
  }
}
