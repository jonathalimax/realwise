import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { CreatePartialLeadDto } from './dto/create-partial-lead.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Public()
  @Post('session')
  createSession(@Body() dto: CreatePaymentSessionDto) {
    return this.service.createSession(dto);
  }

  @Public()
  @Post('process')
  processPayment(@Body() dto: ProcessPaymentDto) {
    return this.service.processPayment(dto);
  }

  @Public()
  @Post('webhooks/mercadopago')
  webhook(@Body() dto: PaymentWebhookDto) {
    return this.service.handleWebhook(dto);
  }

  @Public()
  @Post('partial-lead')
  savePartialLead(@Body() dto: CreatePartialLeadDto) {
    return this.service.savePartialLead(dto);
  }
}
