import { IsArray, IsString, IsIn, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ConfirmTransactionDto {
  @IsString() date: string;
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
