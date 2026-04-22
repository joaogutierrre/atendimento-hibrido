import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
