import { IsArray, IsString, IsIn, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

function normalizeAmountInput(value: unknown) {
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

class ConfirmTransactionDto {
  @IsString() date: string;
  @Transform(({ value }) => normalizeAmountInput(value))
  @IsString() amount: string;
  @IsIn(['income', 'expense']) type: 'income' | 'expense';
  @IsString() description: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() accountId?: string;
}

export class ConfirmImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmTransactionDto)
  transactions: ConfirmTransactionDto[];
}
