import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsUrl()
  sourceUrl?: string;
}
