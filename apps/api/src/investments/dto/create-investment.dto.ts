import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateInvestmentDto {
  @IsString()
  name: string;

  @IsIn(['stock', 'fii', 'etf', 'fixed', 'crypto', 'other'])
  type: string;

  @IsOptional()
  @IsString()
  ticker?: string;

  @IsOptional()
  @IsString()
  quantity?: string;

  @IsOptional()
  @IsString()
  avgPrice?: string;

  @IsOptional()
  @IsString()
  currentPrice?: string;
}

export class UpdateInvestmentDto extends PartialType(CreateInvestmentDto) {}
