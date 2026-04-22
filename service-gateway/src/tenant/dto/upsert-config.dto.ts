import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertAgentConfigDto {
  @IsString()
  systemPrompt!: string;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  escalateOnWords?: string[];

  @IsOptional()
  @IsString()
  offHoursMessage?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  workingHoursStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  workingHoursEnd?: number;
}
