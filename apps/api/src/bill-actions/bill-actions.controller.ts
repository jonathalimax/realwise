import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { BillActionsService } from './bill-actions.service';
import { ConfirmBillActionDto } from './bill-actions.dto';

@Controller('bill-actions')
export class BillActionsController {
  constructor(private readonly service: BillActionsService) {}

  @Public()
  @Get(':token')
  getSession(@Param('token') token: string) {
    return this.service.getSession(token);
  }

  @Public()
  @Post(':token/confirm')
  confirmPayment(@Param('token') token: string, @Body() dto: ConfirmBillActionDto) {
    return this.service.confirmPayment(token, dto);
  }
}
