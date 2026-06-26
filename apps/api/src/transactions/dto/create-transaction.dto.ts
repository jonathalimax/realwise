import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsDateString, IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @IsString()
  amount: string;

  @IsIn(['income', 'expense'])
  type: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {}
