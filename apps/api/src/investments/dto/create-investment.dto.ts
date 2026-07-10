import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

function normalizeNumericInput(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return trimmed;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed.toFixed(2);
    }
  }

  return value;
}

export class CreateInvestmentDto {
  @IsString()
  name: string;

  @IsIn(['stock', 'fii', 'etf', 'fixed', 'crypto', 'other', 'fixed_income', 'stocks', 'funds', 'real_estate'])
  type: 'stock' | 'fii' | 'etf' | 'fixed' | 'crypto' | 'other' | 'fixed_income' | 'stocks' | 'funds' | 'real_estate';

  @IsOptional()
  @IsString()
  bank?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNumericInput(value))
  @IsString()
  initialAmount?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNumericInput(value))
  @IsString()
  currentAmount?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNumericInput(value))
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
  @Transform(({ value }) => normalizeNumericInput(value))
  @IsString()
  quantity?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNumericInput(value))
  @IsString()
  avgPrice?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeNumericInput(value))
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
  @Transform(({ value }) => normalizeNumericInput(value))
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
