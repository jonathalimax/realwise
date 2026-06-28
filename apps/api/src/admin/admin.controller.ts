import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdatePricingConfigDto } from './dto/update-pricing-config.dto';
import { IsInt, IsOptional, IsString, Min, Max, IsIn, IsObject } from 'class-validator';

class CreateTestimonialDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

class SendAdminEmailDto {
  @IsString()
  to: string;

  @IsIn(['welcome', 'access_granted', 'accept_migration'])
  template: 'welcome' | 'access_granted' | 'accept_migration';

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;
}

class SendAbandonedCheckoutEmailDto {
  @IsString()
  email: string;

  @IsInt()
  @Min(1)
  @Max(3)
  stage: 1 | 2 | 3;

  @IsOptional()
  @IsString()
  name?: string;
}

class StartOnboardingRunDto {
  @IsString()
  email: string;

  @IsString()
  runId: string;
}

class TransferClientDto {
  @IsString()
  clientId: string;

  @IsString()
  clientEmail: string;

  @IsOptional()
  @IsString()
  billingAccount?: string | null;

  @IsOptional()
  removeSelf?: boolean;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('leads')
  listLeads() { return this.service.listLeads(); }

  @Patch('leads/:id')
  updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.service.updateLead(id, dto);
  }

  @Get('purchases')
  listPurchases() { return this.service.listPurchases(); }

  @Get('coupons')
  listCoupons() { return this.service.listCoupons(); }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) { return this.service.createCoupon(dto); }

  @Patch('coupons/:id')
  updateCoupon(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    return this.service.updateCoupon(id, dto);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string) { return this.service.deleteCoupon(id); }

  @Get('testimonials')
  listTestimonials() { return this.service.listTestimonials(); }

  @Post('testimonials')
  createTestimonial(@Body() dto: CreateTestimonialDto) { return this.service.createTestimonial(dto); }

  @Delete('testimonials/:id')
  deleteTestimonial(@Param('id') id: string) { return this.service.deleteTestimonial(id); }

  @Post('emails/send')
  sendAdminEmail(@Body() dto: SendAdminEmailDto) { return this.service.sendAdminEmail(dto); }

  @Post('emails/send-abandoned-checkout')
  sendAbandonedCheckoutEmail(@Body() dto: SendAbandonedCheckoutEmailDto) {
    return this.service.sendAbandonedCheckoutEmail(dto);
  }

  @Post('onboarding-runs')
  startOnboardingRun(@Body() dto: StartOnboardingRunDto) {
    return this.service.startOnboardingRun(dto);
  }

  @Get('onboarding-runs/:runId')
  getOnboardingRun(@Param('runId') runId: string) {
    return this.service.getOnboardingRun(runId);
  }

  @Get('onboarding-runs/:runId/logs')
  listOnboardingRunLogs(@Param('runId') runId: string) {
    return this.service.listOnboardingRunLogs(runId);
  }

  @Post('transfer-client')
  transferClient(@Body() dto: TransferClientDto, @CurrentUser() user: JwtPayload) {
    return this.service.transferClient(dto, user.sub);
  }

  @Get('pricing-config')
  getPricingConfig() { return this.service.getPricingConfig(); }

  @Patch('pricing-config')
  updatePricingConfig(@Body() dto: UpdatePricingConfigDto) {
    return this.service.updatePricingConfig(dto);
  }

  @Get('import-issues')
  listImportIssues() { return this.service.listImportIssues(); }

  @Get('import-issues/:id')
  getImportIssue(@Param('id') id: string) { return this.service.getImportIssue(id); }

  @Patch('import-issues/:id')
  updateImportIssue(@Param('id') id: string, @Body() dto: { status?: string; note?: string }) {
    return this.service.updateImportIssue(id, dto);
  }
}
