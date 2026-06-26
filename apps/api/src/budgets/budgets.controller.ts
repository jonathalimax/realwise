import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/create-budget.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) { return this.service.findAll(user.clientId, user.sub); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.findOne(id, user.clientId, user.sub); }

  @Post()
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: JwtPayload) { return this.service.create(dto, user.clientId, user.sub); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @CurrentUser() user: JwtPayload) { return this.service.update(id, dto, user.clientId, user.sub); }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) { return this.service.remove(id, user.clientId, user.sub); }
}
