import { ChannelType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
  isActive?: boolean;
}
