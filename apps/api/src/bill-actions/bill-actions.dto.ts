import { IsOptional, IsString } from 'class-validator';

export class ConfirmBillActionDto {
  @IsOptional()
  @IsString()
  paidAmount?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;
}
