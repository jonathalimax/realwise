import {
  Controller, Post, Param, Body,
  UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { ReportImportIssueDto } from './dto/report-import-issue.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('imports')
export class ImportsController {
  constructor(private readonly service: ImportsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(
      new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })] }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.processUpload(file.buffer, file.originalname, user.clientId, user.sub);
  }

  @Post(':id/confirm')
  confirm(
    @Param('id') importId: string,
    @Body() dto: ConfirmImportDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.confirm(importId, dto.transactions, user.clientId, user.sub);
  }

  @Post('report-issue')
  reportIssue(
    @Body() dto: ReportImportIssueDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.reportIssue(dto, user.clientId, user.sub);
  }
}
