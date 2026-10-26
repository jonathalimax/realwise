import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn, IsBoolean, IsInt, Min, Max, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['checking', 'savings', 'credit', 'investment', 'wallet'])
  type?: 'checking' | 'savings' | 'credit' | 'investment' | 'wallet';

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  balance?: string;

  @IsOptional()
  @IsString()
  bankId?: string;

  @IsOptional()
  @IsString()
  cardName?: string;

  @IsOptional()
  @IsString()
  customBankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  holderName?: string;

  @IsOptional()
  @IsBoolean()
  hasCredit?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}
