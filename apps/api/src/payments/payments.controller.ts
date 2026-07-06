import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CreatePartialLeadDto } from './dto/create-partial-lead.dto';
import { CreatePaymentSessionDto } from './dto/create-payment-session.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'ok',
      providers: ['stripe', 'mercadopago'],
    };
  }

  @Public()
  @Post('stripe/checkout')
  createStripeCheckout(@Body() body: {
    email: string;
    name?: string;
    whatsapp?: string;
    couponCode?: string;
    clientId?: string;
    feature?: string;
    utmSource?: string;
  }) {
    return this.service.createStripeCheckout(body);
  }

  @Public()
  @Post('mercadopago/quote')
  createMercadoPagoQuote(@Body() body: {
    email: string;
    name?: string;
    whatsapp?: string;
    couponCode?: string;
    clientId?: string;
    feature?: string;
    utmSource?: string;
  }) {
    return this.service.createMercadoPagoQuote(body);
  }

  @Public()
  @Post('mercadopago/process')
  processMercadoPagoPayment(@Body() body: {
    token?: string;
    issuer_id?: string;
    payment_method_id?: string;
    transaction_amount?: number;
    installments?: number;
    payer?: Record<string, unknown>;
    email: string;
    name?: string;
    whatsapp?: string;
    couponCode?: string;
    clientId?: string;
    feature?: string;
  }) {
    return this.service.processMercadoPagoPayment(body);
  }

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
