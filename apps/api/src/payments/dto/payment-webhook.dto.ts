import { IsOptional, IsString } from 'class-validator';

export class PaymentWebhookDto {
  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  dataId?: string;

  @IsOptional()
  @IsString()
  type?: string;
}
