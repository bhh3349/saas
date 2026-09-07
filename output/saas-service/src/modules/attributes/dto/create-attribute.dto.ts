import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAttributeDto {
  @IsIn(['spec', 'method', 'unit', 'topping', 'box', 'tag'])
  kind: 'spec' | 'method' | 'unit' | 'topping' | 'box' | 'tag';

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name: string;

  @IsOptional()
  @IsBoolean()
  preset?: boolean;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
