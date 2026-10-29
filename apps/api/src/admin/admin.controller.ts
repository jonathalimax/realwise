import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateLeadDto } from './dto/update-lead.dto';
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
}
