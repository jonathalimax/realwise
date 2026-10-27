import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { SupportConfig, SupportService } from './support.service';

class CreateSupportMessageDto {
  @IsString()
  @MinLength(5)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;
}

@Public()
@AllowWithoutSubscription()
@Controller('support')
export class SupportController {
  constructor(
    private readonly service: SupportService,
    private readonly jwt: JwtService,
  ) {}

  @Get('config')
  config(): SupportConfig {
    return this.service.getConfig();
  }

  /** Public (the login screen uses it), but a valid session cookie attaches the message to that user. */
  @Post('messages')
  async create(@Req() req: Request, @Body() dto: CreateSupportMessageDto): Promise<{ ok: true }> {
    await this.service.createMessage({
      userId: this.sessionUserId(req),
      ipKey: this.clientIp(req),
      message: dto.message,
      name: dto.name,
      email: dto.email,
      subject: dto.subject,
    });
    return { ok: true };
  }

  private sessionUserId(req: Request): string | null {
    const token = (req.cookies as Record<string, string> | undefined)?.access_token;
    if (!token) return null;
    try {
      return this.jwt.verify<JwtPayload>(token).sub ?? null;
    } catch {
      return null;
    }
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    return first || req.ip || 'unknown';
  }
}
