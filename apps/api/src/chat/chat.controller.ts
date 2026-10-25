import { Body, Controller, Get, Param, Query, ParseUUIDPipe, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
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

  @Post('imports/:id/undo')
  undo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.service.undoImport({ clientId: user.clientId, userId: user.sub }, id);
  }
}
