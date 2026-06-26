import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsIn } from 'class-validator';

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
}

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}
