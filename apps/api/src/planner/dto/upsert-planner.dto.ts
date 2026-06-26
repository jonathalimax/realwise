import { IsOptional, IsString } from 'class-validator';

export class UpsertPlannerDto {
  @IsOptional()
  @IsString()
  salaryGross?: string;

  @IsOptional()
  deductions?: Record<string, unknown>;

  @IsOptional()
  allocations?: Record<string, unknown>;
}
