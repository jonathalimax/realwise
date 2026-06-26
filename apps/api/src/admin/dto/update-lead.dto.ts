import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdateLeadDto {
  @IsOptional()
  @IsIn(['new', 'contacted', 'converted', 'lost'])
  status?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
