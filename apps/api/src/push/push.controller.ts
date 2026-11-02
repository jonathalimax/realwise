import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { PushService } from './push.service';

class SubscribeDto {
  @IsString() @MaxLength(2048) endpoint!: string;
  @IsString() @MaxLength(256) p256dh!: string;
  @IsString() @MaxLength(256) auth!: string;
}

class UnsubscribeDto {
  @IsOptional() @IsString() @MaxLength(2048) endpoint?: string;
}

@Controller('push')
@AllowWithoutSubscription()
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('config')
  async config(@CurrentUser() user: JwtPayload) {
    const [publicKey, status] = await Promise.all([this.push.publicKey(), this.push.status(user.sub)]);
    return { publicKey, ...status };
  }

  @Post('subscribe')
  async subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: JwtPayload, @Headers('user-agent') ua?: string) {
    await this.push.subscribe(user.sub, user.clientId, { ...dto, userAgent: ua });
    return { ok: true };
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeDto, @CurrentUser() user: JwtPayload) {
    await this.push.unsubscribe(user.sub, dto.endpoint);
    return { ok: true };
  }

  /** Sends a test notification to the caller's own devices. */
  @Post('test')
  async test(@CurrentUser() user: JwtPayload) {
    const sent = await this.push.sendToUser(user.sub, { title: 'Realwise', body: 'Tudo certo! As notificações estão ativas.', url: '/dashboard', tag: 'test' });
    return { sent };
  }
}
