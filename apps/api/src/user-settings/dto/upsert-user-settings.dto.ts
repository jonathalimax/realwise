import { IsOptional, IsString, IsBoolean, IsArray, IsObject } from 'class-validator';

export class UpsertUserSettingsDto {
  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsBoolean()
  billReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  monthlyRollover?: boolean;

  @IsOptional()
  @IsBoolean()
  tutorialCompleted?: boolean;

  @IsOptional()
  @IsString()
  geminiApiKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expenseCategories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  incomeCategories?: string[];

  @IsOptional()
  @IsObject()
  categoryRuleMapping?: Record<string, string>;

  @IsOptional()
  @IsObject()
  rulePercentages?: Record<string, number>;
}
