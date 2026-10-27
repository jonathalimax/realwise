import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminNote?: string | null;

  @IsOptional()
  @IsBoolean()
  reminderEmailsOptOut?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmailsOptOut?: boolean;

  /** Monthly AI budget override in US$; `null` clears it. */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 4 })
  @Min(0)
  @Max(10000)
  llmBudgetOverrideUsd?: number | null;
}

export const PLAN_ACTIONS = ['extend_trial', 'start_trial', 'grant_lifetime', 'revoke'] as const;
export type PlanAction = (typeof PLAN_ACTIONS)[number];

export class PlanActionDto {
  @IsIn(PLAN_ACTIONS as unknown as string[])
  action: PlanAction;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
