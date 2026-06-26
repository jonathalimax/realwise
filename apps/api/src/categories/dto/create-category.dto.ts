import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: 'income' | 'expense';

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
