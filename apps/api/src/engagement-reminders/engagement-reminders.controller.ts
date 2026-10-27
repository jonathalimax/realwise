import { Body, Controller, Get, Header, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { EngagementRemindersService } from './engagement-reminders.service';
import { isValidSuggestionToken, isValidUnsubscribeToken } from './unsubscribe-token';
import { BillSuggestionsService } from '../bill-suggestions/bill-suggestions.service';

const page = (msg: string, extra = '') =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Realwise</title><body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;color:#1e293b"><h2>${msg}</h2>${extra}<p><a href="https://realwise.com.br" style="color:#10b981">Voltar ao Realwise</a></p></body>`;

@Public()
@AllowWithoutSubscription()
@Controller('reminders')
export class EngagementRemindersController {
  constructor(
    private readonly service: EngagementRemindersService,
    private readonly suggestions: BillSuggestionsService,
  ) {}

  /**
   * "Agora não" in the suggestion email. A GET only shows a confirmation button: mail scanners and link previews
   * follow GET links, so the dismissal itself happens on the POST.
   */
  @Get('suggestion/dismiss')
  @Header('Content-Type', 'text/html; charset=utf-8')
  dismissPage(@Query('u') userId: string, @Query('s') suggestionId: string, @Query('t') token: string): string {
    if (!userId || !suggestionId || !isValidSuggestionToken(userId, suggestionId, token)) return page('Link inválido ou expirado.');
    const field = (name: string, value: string) => `<input type="hidden" name="${name}" value="${value.replace(/[^a-zA-Z0-9-]/g, '')}">`;
    return page(
      'Não sugerir mais esse lembrete?',
      `<form method="post" action="/reminders/suggestion/dismiss">${field('u', userId)}${field('s', suggestionId)}${field('t', token)}<button type="submit" style="margin-top:12px;padding:12px 28px;border:0;border-radius:8px;background:#10b981;color:#fff;font-weight:700;font-size:15px;cursor:pointer">Sim, não sugerir</button></form>`,
    );
  }

  @Post('suggestion/dismiss')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async dismissSuggestion(@Body() body: { u?: string; s?: string; t?: string }): Promise<string> {
    const { u, s, t } = body ?? {};
    if (!u || !s || !t || !isValidSuggestionToken(u, s, t)) return page('Link inválido ou expirado.');
    await this.suggestions.dismiss(u, s);
    return page('Tudo bem! Não vou mais sugerir esse lembrete.');
  }

  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async unsubscribe(@Query('u') userId: string, @Query('t') token: string): Promise<string> {
    if (!userId || !isValidUnsubscribeToken(userId, token)) return page('Link inválido ou expirado.');
    await this.service.optOut(userId);
    return page('Pronto! Você não receberá mais lembretes por e-mail.');
  }
}
