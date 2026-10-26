import { Body, Controller, Get, Headers, Param, Query, Res, ParseUUIDPipe, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
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

@Controller('chat')
export class ChatController {
  constructor(
    private readonly service: ChatService,
    private readonly insights: InsightsService,
  ) {}

  @Get('messages')
  messages(@CurrentUser() user: JwtPayload) {
    return this.service.history({ clientId: user.clientId, userId: user.sub });
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
        const status = (e as { getStatus?: () => number }).getStatus?.() ?? 500;
        res.status(status).json({ message: e instanceof Error ? e.message : 'Request failed' });
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
      write({ type: 'done', result: await run(write) });
      console.log(`[chat] turn finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (client gone before the end: ${clientGone})`);
    } catch (e) {
      console.error(`[chat] turn failed after ${((Date.now() - startedAt) / 1000).toFixed(1)}s (client gone: ${clientGone}):`, e);
      write({ type: 'error', message: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      clearInterval(ping);
      res.end();
    }
  }

  @Get('onboarding')
  onboardingStatus(@CurrentUser() user: JwtPayload) {
    return this.service.onboardingStatus({ clientId: user.clientId, userId: user.sub });
  }

  /** First chat open for a user with no accounts: seeds categories and posts John's welcome + account form (idempotent). */
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

  @Post('imports/:id/undo')
  undo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.undoImport({ clientId: user.clientId, userId: user.sub }, id);
  }
}
