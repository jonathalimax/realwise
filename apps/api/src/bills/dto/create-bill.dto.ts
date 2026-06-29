import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsDateString, IsUUID, IsBoolean, IsInt, Min } from 'class-validator';

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

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string | null;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  notificationDaysBefore?: number;

  @IsOptional()
  @IsString()
  linkedBankId?: string | null;

  @IsOptional()
  @IsDateString()
  paidDate?: string | null;

  @IsOptional()
  @IsDateString()
  paidAt?: string | null;

  @IsOptional()
  @IsString()
  paidAmount?: string | null;

  @IsOptional()
  @IsString()
  seriesId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  postponeCount?: number;

  @IsOptional()
  @IsDateString()
  nextReminderAt?: string | null;
}

export class UpdateBillDto extends PartialType(CreateBillDto) {}

export class MarkBillPaidDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsDateString()
  targetDueDate?: string;

  @IsOptional()
  @IsDateString()
  virtualDueDate?: string;

  @IsOptional()
  @IsString()
  paidAmount?: string;
}
