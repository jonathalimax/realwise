import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePaymentSessionDto {
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
  @IsString()
  utmSource?: string;
}
