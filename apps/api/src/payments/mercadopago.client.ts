import axios, { AxiosInstance } from 'axios';
import { Injectable } from '@nestjs/common';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Injectable()
export class MercadoPagoClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: 'https://api.mercadopago.com',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN ?? ''}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createPayment(dto: ProcessPaymentDto): Promise<Record<string, unknown>> {
    const payload = {
      transaction_amount: dto.transaction_amount / 100,
      installments: dto.installments ?? 1,
      token: dto.token,
      issuer_id: dto.issuer_id,
      payment_method_id: dto.payment_method_id,
      payer: {
        email: dto.email,
        ...(dto.payer ?? {}),
      },
      description: 'Realwise acesso vitalicio',
    };

    const { data } = await this.http.post('/v1/payments', payload);
    return data;
  }

  async getPayment(paymentId: string): Promise<Record<string, unknown>> {
    const { data } = await this.http.get(`/v1/payments/${paymentId}`);
    return data;
  }
}
