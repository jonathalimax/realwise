import { IsString, IsOptional, IsIn, IsNumber, IsDateString } from 'class-validator';

export class CreateCouponDto {
  @IsString() code: string;
  @IsOptional() @IsIn(['percent', 'fixed']) discountType?: string;
  @IsOptional() @IsString() discountValue?: string;
  @IsOptional() @IsNumber() maxUses?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
}
