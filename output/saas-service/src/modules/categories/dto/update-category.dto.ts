import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsInt()
  parent_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsBoolean()
  show_on_mobile?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  belong?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
