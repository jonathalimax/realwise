import { IsString, IsOptional, IsIn, IsNumber, IsDateString, IsBoolean } from 'class-validator';

export class CreateCouponDto {
  @IsString() code: string;
  @IsOptional() @IsIn(['percent', 'fixed', 'percentage', 'fixed_amount']) discountType?: string;
  @IsOptional() discountValue?: string | number;
  @IsOptional() @IsNumber() maxUses?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
