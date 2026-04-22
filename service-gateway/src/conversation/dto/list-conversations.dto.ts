import { ConvStatus, ConversationMode } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListConversationsDto {
  @IsOptional()
  @IsEnum(ConvStatus)
  status?: ConvStatus;

  @IsOptional()
  @IsEnum(ConversationMode)
  mode?: ConversationMode;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;
}
