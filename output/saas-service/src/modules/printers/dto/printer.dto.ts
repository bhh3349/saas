import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export const PRINTER_TYPES = ['bluetooth', 'wifi'] as const;
export type PrinterType = (typeof PRINTER_TYPES)[number];

export class CreatePrinterDto {
  /** 打印机显示名 */
  @IsString()
  @Length(1, 64)
  name: string;

  /** 连接方式 */
  @IsIn(PRINTER_TYPES)
  type: PrinterType;

  /** 蓝牙 MAC 地址或 WiFi IP */
  @IsString()
  @Length(1, 64)
  address: string;

  /** WiFi 端口 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  /** 打印机厂商 */
  @IsOptional()
  @IsString()
  @Length(0, 32)
  brand?: string;

  /** 小票宽度（mm） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([58, 80, 110])
  width_mm?: number;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 64)
  remark?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  name?: string;

  @IsOptional()
  @IsIn(PRINTER_TYPES)
  type?: PrinterType;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @Length(0, 32)
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([58, 80, 110])
  width_mm?: number;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 64)
  remark?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
