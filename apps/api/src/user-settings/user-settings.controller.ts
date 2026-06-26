import { Controller, Get, Patch, Body } from '@nestjs/common';
import { UserSettingsService } from './user-settings.service';
import { UpsertUserSettingsDto } from './dto/upsert-user-settings.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('user-settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.service.get(user.clientId, user.sub);
  }

  @Patch()
  upsert(@Body() dto: UpsertUserSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.service.upsert(dto, user.clientId, user.sub);
  }
}
