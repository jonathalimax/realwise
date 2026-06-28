import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  name: string;

  @IsString()
  targetAmount: string;

  @IsOptional()
  @IsString()
  currentAmount?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class UpdateGoalDto extends PartialType(CreateGoalDto) {}
