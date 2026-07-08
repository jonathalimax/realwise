import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePaymentSessionDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
