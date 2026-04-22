import { ConversationMode } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateModeDto {
  @IsEnum(ConversationMode)
  mode!: ConversationMode;
}
