import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  name: string;

  @IsString()
  targetAmount: string;

  @IsOptional()
  @IsString()
  currentAmount?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateGoalDto extends PartialType(CreateGoalDto) {}
