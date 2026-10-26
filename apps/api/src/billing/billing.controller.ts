import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AccessInfo, BillingPlan } from './access';
import { AllowWithoutSubscription } from './allow-without-subscription.decorator';
import { BillingService, PlanOption } from './billing.service';

class CheckoutDto {
  @IsIn(['monthly', 'annual'])
  plan: BillingPlan;
}

@AllowWithoutSubscription()
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('status')
  status(@CurrentUser() user: JwtPayload): Promise<AccessInfo> {
    return this.service.getStatus(user.sub);
  }

  @Get('plans')
  plans(): Promise<PlanOption[]> {
    return this.service.getPlans();
  }

  @Post('checkout')
  checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto): Promise<{ url: string }> {
    return this.service.createCheckout(user.sub, dto.plan);
  }

  @Post('portal')
  portal(@CurrentUser() user: JwtPayload): Promise<{ url: string }> {
    return this.service.createPortal(user.sub);
  }
}
