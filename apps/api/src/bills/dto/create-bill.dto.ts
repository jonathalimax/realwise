import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsDateString, IsUUID } from 'class-validator';

export class CreateBillDto {
  @IsString()
  name: string;

  @IsString()
  amount: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsIn(['pending', 'paid', 'overdue'])
  status?: 'pending' | 'paid' | 'overdue';

  @IsOptional()
  @IsIn(['monthly', 'weekly', 'yearly'])
  recurrence?: 'monthly' | 'weekly' | 'yearly';

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateBillDto extends PartialType(CreateBillDto) {}
