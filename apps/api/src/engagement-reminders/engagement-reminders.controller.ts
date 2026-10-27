import { Controller, Get, Header, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { EngagementRemindersService } from './engagement-reminders.service';
import { isValidSuggestionToken, isValidUnsubscribeToken } from './unsubscribe-token';
import { BillSuggestionsService } from '../bill-suggestions/bill-suggestions.service';

const page = (msg: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Realwise</title><body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 16px;text-align:center;color:#1e293b"><h2>${msg}</h2><p><a href="https://realwise.com.br" style="color:#10b981">Voltar ao Realwise</a></p></body>`;

@Public()
@AllowWithoutSubscription()
@Controller('reminders')
export class EngagementRemindersController {
  constructor(
    private readonly service: EngagementRemindersService,
    private readonly suggestions: BillSuggestionsService,
  ) {}

  /** "Agora não" in the suggestion email: never ask about this payment again. */
  @Get('suggestion/dismiss')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async dismissSuggestion(@Query('u') userId: string, @Query('s') suggestionId: string, @Query('t') token: string): Promise<string> {
    if (!userId || !suggestionId || !isValidSuggestionToken(userId, suggestionId, token)) return page('Link inválido ou expirado.');
    await this.suggestions.dismiss(userId, suggestionId);
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
