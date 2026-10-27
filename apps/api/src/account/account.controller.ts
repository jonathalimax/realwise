import { Body, Controller, Delete, Res } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { AccountDeletionService } from './account-deletion.service';

class DeleteAccountDto {
  @IsIn(['EXCLUIR'])
  confirm: 'EXCLUIR';
}

@AllowWithoutSubscription()
@Controller('account')
export class AccountController {
  constructor(private readonly deletion: AccountDeletionService) {}

  /** Irreversible: cancels the subscription and erases the user and all their data. */
  @Delete()
  async remove(
    @CurrentUser() user: JwtPayload,
    @Body() _dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    await this.deletion.deleteUser(user.sub);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { ok: true };
  }
}
