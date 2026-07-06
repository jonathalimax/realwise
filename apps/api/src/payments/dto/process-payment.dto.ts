import { IsEmail, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @IsNumber()
  transaction_amount: number;

  @IsOptional()
  @IsNumber()
  installments?: number;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  issuer_id?: string;

  @IsOptional()
  @IsString()
  payment_method_id?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsObject()
  payer?: Record<string, unknown>;
}
