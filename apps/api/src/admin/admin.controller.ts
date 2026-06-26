import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';

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

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string) { return this.service.deleteCoupon(id); }

  @Get('import-issues')
  listImportIssues() { return this.service.listImportIssues(); }

  @Patch('import-issues/:id/resolve')
  resolveImportIssue(@Param('id') id: string) { return this.service.resolveImportIssue(id); }
}
