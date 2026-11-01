import { Body, Controller, Delete, Get, Headers, Patch, Param, Query, Res, ParseUUIDPipe, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ACCOUNT_TYPES, BANK_IDS } from './onboarding';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ChatService, MAX_FILES_PER_MESSAGE } from './chat.service';
import type { ChatStreamEvent } from './chat.types';
import { InsightsService } from './insights.service';
import { ChatBillsService, type BillDecision } from './chat-bills.service';
import { ChatMemoryService } from './chat-memory.service';

class MemoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  content?: string;

  @IsOptional()
  @IsIn(['goal', 'preference', 'context'])
  kind?: string;
}

class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}

class AnswerDto {
  @IsString()
  @MaxLength(20)
  questionId: string;

  @IsString()
  @MaxLength(120)
  value: string;

  @IsString()
  @MaxLength(120)
  label: string;
}

class AnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}

class AccountFormDto {
  @IsIn(BANK_IDS)
  bankId: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  customBankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cardName?: string;

  @IsIn([...ACCOUNT_TYPES])
  type: string;

  @IsString()
  @MaxLength(120)
  holderName: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;
}

class ReviewDecisionDto {
  @IsString()
  @MaxLength(200)
  key: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsBoolean()
  remember: boolean;

  /** true = these are transfers between the user's own accounts (no category needed). */
  @IsOptional()
  @IsBoolean()
  transfer?: boolean;
}

class ReviewDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewDecisionDto)
  decisions: ReviewDecisionDto[];
}

class BillDecisionDto {
  @IsUUID()
  billId: string;

  @IsBoolean()
  paid: boolean;

  @IsOptional()
  @Min(0)
  @Max(1_000_000_000)
  amount?: number;
}

class BillsPanelDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillDecisionDto)
  items: BillDecisionDto[];
}

class SuggestionIntentDto {
  @IsUUID()
  id: string;
}

/** Turns any failure into a friendly pt-BR message (never a stack trace or English technical text) plus status/code. */
function describeChatError(e: unknown): { status: number; code?: string; message: string } {
  const status = (e as { getStatus?: () => number }).getStatus?.() ?? 500;
  const body = (e as { getResponse?: () => unknown }).getResponse?.();
  const code = body && typeof body === 'object' ? (body as { code?: string }).code : undefined;
  const own = body && typeof body === 'object' && code ? (body as { message?: string }).message : undefined;
  if (own) return { status, code, message: own };
  if (status === 402) return { status, code: 'SUBSCRIPTION_REQUIRED', message: 'Seu teste terminou. Assine um plano para continuar conversando com o Elio.' };
  if (status === 429) return { status, message: 'Estou recebendo muitos pedidos agora. Espere um pouquinho e tente de novo.' };
  if (status === 413) return { status, message: 'Esse arquivo é grande demais. Envie arquivos de até 15 MB.' };
  if (status >= 400 && status < 500) return { status, message: 'Não consegui entender esse pedido. Pode tentar de novo?' };
  return { status: status >= 500 ? status : 500, message: 'Tive um tropeço aqui e não consegui terminar. Pode tentar de novo em instantes?' };
}

@Controller('chat')
export class ChatController {
  constructor(
    private readonly service: ChatService,
    private readonly insights: InsightsService,
    private readonly bills: ChatBillsService,
    private readonly memory: ChatMemoryService,
  ) {}

  @Get('messages')
  messages(@CurrentUser() user: JwtPayload) {
    return this.service.history({ clientId: user.clientId, userId: user.sub });
  }

  @Get('memory')
  memoryList(@CurrentUser() user: JwtPayload) {
    return this.memory.list({ clientId: user.clientId, userId: user.sub });
  }

  @Post('memory')
  memoryAdd(@Body() dto: MemoryDto, @CurrentUser() user: JwtPayload) {
    return this.memory.add({ clientId: user.clientId, userId: user.sub }, dto.content ?? '', dto.kind ?? 'context', 'user');
  }

  @Patch('memory/:id')
  memoryUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MemoryDto, @CurrentUser() user: JwtPayload) {
    return this.memory.update({ clientId: user.clientId, userId: user.sub }, id, dto);
  }

  @Delete('memory/:id')
  async memoryRemove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.memory.remove({ clientId: user.clientId, userId: user.sub }, id);
    return { ok: true };
  }

  @Get('insights')
  insightsForMonth(@Query('month') month: string, @CurrentUser() user: JwtPayload) {
    return this.insights.forMonth({ clientId: user.clientId, userId: user.sub }, month);
  }

  /**
   * Sends a message. With `Accept: text/event-stream` the reply streams as Server-Sent Events
   * (`user`, `delta`, `reset`, `status`, `done`, `error`); otherwise it returns the final JSON.
   */
  @Post('messages')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_MESSAGE, { limits: { fileSize: 15 * 1024 * 1024 } }))
  send(
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: JwtPayload,
    @Headers('accept') accept: string | undefined,
    @Res() res: Response,
  ) {
    const scope = { clientId: user.clientId, userId: user.sub };
    return this.respond(res, accept, (emit) => this.service.send(scope, dto.message ?? '', files ?? [], emit));
  }

  @Post('messages/:id/answers')
  answer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswersDto,
    @CurrentUser() user: JwtPayload,
    @Headers('accept') accept: string | undefined,
    @Res() res: Response,
  ) {
    const scope = { clientId: user.clientId, userId: user.sub };
    return this.respond(res, accept, (emit) => this.service.answerQuestions(scope, id, dto.answers, emit));
  }

  private async respond(
    res: Response,
    accept: string | undefined,
    run: (emit?: (event: ChatStreamEvent) => void) => Promise<unknown>,
  ) {
    if (!accept?.includes('text/event-stream')) {
      try {
        res.json(await run());
      } catch (e) {
        const { status, code, message } = describeChatError(e);
        res.status(status).json({ message, code });
      }
      return;
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // tell proxies (nginx/Traefik) not to buffer the stream
    });
    res.flushHeaders();
    const write = (event: ChatStreamEvent) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    // Keep-alive comment so idle proxies do not close the connection during long tool runs.
    const ping = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15000);
    // The turn keeps running on the server even if the phone drops the connection (the reply is saved either way).
    const startedAt = Date.now();
    let clientGone = false;
    res.on('close', () => {
      if (!res.writableEnded) clientGone = true;
    });
    try {
      const result = await run(write);
      write({ type: 'done', result });
      if (clientGone) this.service.notifyTurnFinishedAway(result);
      console.log(`[chat] turn finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (client gone before the end: ${clientGone})`);
    } catch (e) {
      console.error(`[chat] turn failed after ${((Date.now() - startedAt) / 1000).toFixed(1)}s (client gone: ${clientGone}):`, e);
      write({ type: 'error', ...describeChatError(e) });
    } finally {
      clearInterval(ping);
      res.end();
    }
  }

  @Get('onboarding')
  onboardingStatus(@CurrentUser() user: JwtPayload) {
    return this.service.onboardingStatus({ clientId: user.clientId, userId: user.sub });
  }

  /** First chat open for a user with no accounts: seeds categories and posts Elio's welcome + account form (idempotent). */
  @Post('onboarding/start')
  startOnboarding(@CurrentUser() user: JwtPayload) {
    return this.service.startOnboarding({ clientId: user.clientId, userId: user.sub });
  }

  @Post('messages/:id/account-form')
  accountForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccountFormDto,
    @CurrentUser() user: JwtPayload,
    @Headers('accept') accept: string | undefined,
    @Res() res: Response,
  ) {
    const scope = { clientId: user.clientId, userId: user.sub };
    return this.respond(res, accept, (emit) => this.service.submitAccountForm(scope, id, dto, emit));
  }

  @Post('messages/:id/review')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDto, @CurrentUser() user: JwtPayload) {
    return this.service.applyReview({ clientId: user.clientId, userId: user.sub }, id, dto.decisions);
  }

  /** Opened from the bills email (?intent=bills): Elio posts the checklist of pending bills. */
  @Post('intents/bills')
  billsIntent(@CurrentUser() user: JwtPayload) {
    return this.bills.startBillsIntent({ clientId: user.clientId, userId: user.sub });
  }

  /** Opened from the suggestion email (?suggestion=id): the user said yes, so Elio creates the reminder. */
  @Post('intents/suggestion')
  suggestionIntent(@Body() dto: SuggestionIntentDto, @CurrentUser() user: JwtPayload) {
    return this.bills.startSuggestionIntent({ clientId: user.clientId, userId: user.sub }, dto.id);
  }

  @Post('messages/:id/bills')
  settleBills(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BillsPanelDto, @CurrentUser() user: JwtPayload) {
    return this.bills.submitPanel({ clientId: user.clientId, userId: user.sub }, id, dto.items as BillDecision[]);
  }

  @Post('imports/:id/undo')
  undo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.undoImport({ clientId: user.clientId, userId: user.sub }, id);
  }
}
