import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsUUID, IsObject } from 'class-validator';

export class CreateBudgetDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  amount: string;

  @IsOptional()
  @IsIn(['monthly', 'weekly', 'yearly'])
  period?: 'monthly' | 'weekly' | 'yearly';

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  totalBudget?: string;

  @IsOptional()
  @IsObject()
  categoryBudgets?: Record<string, number | string>;
}

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}
