import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

export class CreateInvestmentDto {
  @IsString()
  name: string;

  @IsIn(['stock', 'fii', 'etf', 'fixed', 'crypto', 'other', 'fixed_income', 'stocks', 'funds', 'real_estate'])
  type: 'stock' | 'fii' | 'etf' | 'fixed' | 'crypto' | 'other' | 'fixed_income' | 'stocks' | 'funds' | 'real_estate';

  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @IsString()
  initialAmount?: string;

  @IsOptional()
  @IsString()
  currentAmount?: string;

  @IsOptional()
  @IsString()
  expectedReturn?: string;

  @IsOptional()
  @IsString()
  returnType?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsDateString()
  maturityDate?: string | null;

  @IsOptional()
  @IsString()
  goalId?: string | null;

  @IsOptional()
  @IsString()
  plannerGoalId?: string | null;

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

  @IsOptional()
  @IsString()
  platform?: string | null;

  @IsOptional()
  @IsString()
  coinName?: string | null;

  @IsOptional()
  @IsString()
  fundName?: string | null;

  @IsOptional()
  @IsString()
  propertyDescription?: string | null;

  @IsOptional()
  @IsString()
  transactionId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  totalWithdrawn?: string;

  @IsOptional()
  @IsDateString()
  lastWithdrawDate?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateInvestmentDto extends PartialType(CreateInvestmentDto) {}
