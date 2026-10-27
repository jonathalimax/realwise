import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BillingPlan } from './access';
import { AllowWithoutSubscription } from './allow-without-subscription.decorator';
import { BillingService, BillingStatus, PlanOption } from './billing.service';

class CheckoutDto {
  @IsIn(['monthly', 'annual'])
  plan: BillingPlan;
}

@AllowWithoutSubscription()
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('status')
  status(@CurrentUser() user: JwtPayload): Promise<BillingStatus> {
    return this.service.getStatus(user.sub);
  }

  @Get('plans')
  plans(): Promise<PlanOption[]> {
    return this.service.getPlans();
  }

  /** Same prices for the anonymous landing page. Read-only and cached for 10 minutes, so it cannot load Stripe. */
  @Public()
  @Get('public-plans')
  publicPlans(): Promise<PlanOption[]> {
    return this.service.getPlans();
  }

  @Post('checkout')
  checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto): Promise<{ url: string }> {
    return this.service.createCheckout(user.sub, dto.plan);
  }

  @Post('change-plan')
  changePlan(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto): Promise<BillingStatus> {
    return this.service.changePlan(user.sub, dto.plan);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: JwtPayload): Promise<BillingStatus> {
    return this.service.cancelSubscription(user.sub);
  }

  @Post('resume')
  resume(@CurrentUser() user: JwtPayload): Promise<BillingStatus> {
    return this.service.resumeSubscription(user.sub);
  }

  @Post('portal')
  portal(@CurrentUser() user: JwtPayload): Promise<{ url: string }> {
    return this.service.createPortal(user.sub);
  }
}
