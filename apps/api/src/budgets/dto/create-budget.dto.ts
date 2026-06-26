import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsUUID } from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  name: string;

  @IsString()
  amount: string;

  @IsOptional()
  @IsIn(['monthly', 'weekly', 'yearly'])
  period?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateBudgetDto extends PartialType(CreateBudgetDto) {}
