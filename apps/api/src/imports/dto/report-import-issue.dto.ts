import { IsArray, IsOptional, IsString } from 'class-validator';

export class ReportImportIssueDto {
  @IsString()
  fileName: string;

  @IsOptional()
  @IsString()
  fileMime?: string;

  @IsString()
  fileBase64: string;

  @IsString()
  bankType: string;

  @IsOptional()
  @IsString()
  parserUsed?: string;

  @IsOptional()
  @IsArray()
  detectedHeaders?: string[];

  @IsOptional()
  @IsString()
  errorMessage?: string | null;

  @IsOptional()
  @IsString()
  userNote?: string | null;

  @IsOptional()
  @IsString()
  userName?: string;

  @IsOptional()
  @IsString()
  userEmail?: string;
}
