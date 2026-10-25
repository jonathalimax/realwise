import { Body, Controller, Get, Param, Query, ParseUUIDPipe, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ChatService, MAX_FILES_PER_MESSAGE } from './chat.service';
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

class ReviewDecisionDto {
  @IsString()
  @MaxLength(200)
  key: string;

  @IsUUID()
  categoryId: string;

  @IsBoolean()
  remember: boolean;
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

  @Post('messages')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_MESSAGE, { limits: { fileSize: 15 * 1024 * 1024 } }))
  send(
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.send({ clientId: user.clientId, userId: user.sub }, dto.message ?? '', files ?? []);
  }

  @Post('messages/:id/answers')
  answer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnswersDto, @CurrentUser() user: JwtPayload) {
    return this.service.answerQuestions({ clientId: user.clientId, userId: user.sub }, id, dto.answers);
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
