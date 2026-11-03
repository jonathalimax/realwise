import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmBillActionDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'number' ? value.toFixed(2) : value))
  @IsString()
  paidAmount?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;
}
