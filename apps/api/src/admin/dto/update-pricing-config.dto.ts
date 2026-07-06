import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePricingConfigDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  basePriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  @IsOptional()
  @IsBoolean()
  stripeWalletEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  mercadopagoEnabled?: boolean;
}
