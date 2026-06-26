import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { StorageService } from './storage.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';

class RequestUploadDto {
  @IsString() fileName: string;
  @IsString() mimeType: string;
  @IsOptional() @IsNumber() sizeBytes?: number;
  @IsOptional() @IsString() importId?: string;
}

class ConfirmUploadDto {
  @IsOptional() @IsUUID() importId?: string;
  @IsString() fileName: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsNumber() sizeBytes?: number;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly service: StorageService) {}

  @Post('upload')
  async requestUpload(@Body() dto: RequestUploadDto, @CurrentUser() user: JwtPayload) {
    const importId = dto.importId ?? uuidv4();
    const key = this.service.buildKey(user.clientId, user.sub, importId, dto.fileName);
    const uploadUrl = await this.service.getPresignedUploadUrl(key, dto.mimeType);
    return { uploadUrl, key, importId };
  }

  @Post('confirm')
  async confirmUpload(@Body() dto: ConfirmUploadDto, @CurrentUser() user: JwtPayload) {
    const importId = dto.importId ?? uuidv4();
    const key = this.service.buildKey(user.clientId, user.sub, importId, dto.fileName);
    return this.service.recordAttachment({
      clientId: user.clientId,
      userId: user.sub,
      importId: dto.importId ?? null,
      objectKey: key,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
  }

  @Get('download/:id')
  async download(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const url = await this.service.getDownloadUrl(id, user.clientId, user.sub);
    return { url };
  }
}
