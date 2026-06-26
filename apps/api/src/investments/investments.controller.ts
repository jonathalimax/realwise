import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto, UpdateInvestmentDto } from './dto/create-investment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { B3SyncService } from '../b3-sync/b3-sync.service';

@Controller('investments')
export class InvestmentsController {
  constructor(
    private readonly service: InvestmentsService,
    private readonly b3Sync: B3SyncService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.clientId, user.sub); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.clientId, user.sub); }

  @Post()
  create(@Body() dto: CreateInvestmentDto, @CurrentUser() user: JwtPayload) { return this.service.create(dto, user.clientId, user.sub); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvestmentDto, @CurrentUser() user: JwtPayload) { return this.service.update(id, dto, user.clientId, user.sub); }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.remove(id, user.clientId, user.sub); }

  @Post('b3-sync')
  syncB3(@CurrentUser() user: JwtPayload) {
    return this.b3Sync.syncUser(user.sub, user.clientId);
  }
}
