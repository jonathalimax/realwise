import { IsOptional, IsString, IsBoolean } from 'class-validator';

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
}
