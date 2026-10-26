import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CreatePartialLeadDto } from './dto/create-partial-lead.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Public()
  @Post('partial-lead')
  savePartialLead(@Body() dto: CreatePartialLeadDto) {
    return this.service.savePartialLead(dto);
  }
}
