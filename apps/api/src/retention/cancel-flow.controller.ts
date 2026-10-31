import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AllowWithoutSubscription } from '../billing/allow-without-subscription.decorator';
import { BillingStatus } from '../billing/billing.service';
import { CancelFlowService } from './cancel-flow.service';
import { Offer } from './retention.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOf = (v: unknown): string => {
  const id = String(v ?? '');
  if (!UUID.test(id)) throw new BadRequestException('Pedido inválido.');
  return id;
};

@AllowWithoutSubscription()
@Controller('billing/cancel-flow')
export class CancelFlowController {
  constructor(private readonly flow: CancelFlowService) {}

  @Post('start')
  start(@CurrentUser() user: JwtPayload, @Body() body: { reason?: string; comment?: string }): Promise<{ feedbackId: string; offer: Offer | null }> {
    return this.flow.start(user.sub, { reason: String(body?.reason ?? ''), comment: body?.comment === undefined ? undefined : String(body.comment) });
  }

  @Post('accept')
  accept(@CurrentUser() user: JwtPayload, @Body() body: { feedbackId?: string }): Promise<BillingStatus> {
    return this.flow.accept(user.sub, idOf(body?.feedbackId));
  }

  @Post('confirm')
  confirm(@CurrentUser() user: JwtPayload, @Body() body: { feedbackId?: string }): Promise<BillingStatus> {
    return this.flow.confirm(user.sub, body?.feedbackId ? idOf(body.feedbackId) : undefined);
  }
}
