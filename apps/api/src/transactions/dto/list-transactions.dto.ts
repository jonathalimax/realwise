import { IsOptional, IsString, IsIn, IsUUID, IsNumberString } from 'class-validator';

export class ListTransactionsDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: 'income' | 'expense';

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsNumberString()
  offset?: string;
}
