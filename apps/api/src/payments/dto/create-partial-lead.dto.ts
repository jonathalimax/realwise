import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreatePartialLeadDto {
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
  utmSource?: string;
}
