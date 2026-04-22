import { IsOptional, IsString } from 'class-validator';

export class AssignDto {
  /** userId do atendedor; null/omitido desatribui. */
  @IsOptional()
  @IsString()
  userId?: string | null;
}
