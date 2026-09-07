import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const DEVICE_TYPES = ['POS', 'Printer', 'Tablet', 'Scanner'] as const;

/** 收银端心跳上报：POST /devices/heartbeat */
export class HeartbeatDeviceDto {
  /** 设备唯一标识（收银端生成，同一台设备保持不变） */
  @IsString()
  @Length(1, 64)
  device_id: string;

  /** 设备名称 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  name?: string;

  /** 设备类型 */
  @IsOptional()
  @IsIn(DEVICE_TYPES)
  type?: string;

  /** 设备位置 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  location?: string;

  /** IP 地址 */
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ip?: string;

  /** MAC 地址 */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mac?: string;

  /** 操作系统 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  os?: string;

  /** 收银端应用版本 */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  app_version?: string;
}
