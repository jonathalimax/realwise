import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCategorizationRuleDto {
  @IsString()
  keyword: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: 'income' | 'expense';

  @IsOptional()
  @IsString()
  originalDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategorizationRuleDto extends PartialType(CreateCategorizationRuleDto) {}
