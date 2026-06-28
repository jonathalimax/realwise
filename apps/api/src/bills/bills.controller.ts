import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { BillsService } from './bills.service';
import { CreateBillDto, UpdateBillDto, MarkBillPaidDto } from './dto/create-bill.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('bills')
export class BillsController {
  constructor(private readonly service: BillsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.clientId, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.clientId, user.sub);
  }

  @Post()
  create(@Body() dto: CreateBillDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.clientId, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBillDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.clientId, user.sub);
  }

  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string, @Body() dto: MarkBillPaidDto, @CurrentUser() user: JwtPayload) {
    return this.service.markPaid(id, dto, user.clientId, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.clientId, user.sub);
  }
}
