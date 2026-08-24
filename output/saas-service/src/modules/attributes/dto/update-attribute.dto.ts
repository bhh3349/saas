import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAttributeDto {
  @IsOptional()
  @IsIn(['spec', 'method', 'unit'])
  kind?: 'spec' | 'method' | 'unit';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsBoolean()
  preset?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
