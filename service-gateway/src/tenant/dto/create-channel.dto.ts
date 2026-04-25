import { ChannelType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  branchId!: string;

  @IsEnum(ChannelType)
  type!: ChannelType;

  @IsString()
  identifier!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
