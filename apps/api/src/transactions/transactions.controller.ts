import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Get()
  findAll(@Query() filters: ListTransactionsDto, @CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.clientId, user.sub, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user.clientId, user.sub);
  }

  @Post()
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.clientId, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransactionDto, @CurrentUser() user: JwtPayload) {
    return this.service.update(id, dto, user.clientId, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.clientId, user.sub);
  }
}
