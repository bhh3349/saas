import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 收银端设备：由收银端通过心跳接口自动上报，商家后台只读监控 */
@Entity('devices')
@Index(['shop_id', 'device_id'])
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 收银端生成的设备唯一标识（如 UUID），同一台设备保持不变 */
  @Column({ type: 'varchar', length: 64 })
  device_id: string;

  /** 设备名称（收银端上报，如「前台收银机1号」） */
  @Column({ type: 'varchar', length: 64, default: '' })
  name: string;

  /** 设备类型：POS 收银机 / Printer 打印机 / Tablet 平板 / Scanner 扫码枪 */
  @Column({ type: 'varchar', length: 16, default: 'POS' })
  type: string;

  /** 设备位置，如「前台」 */
  @Column({ type: 'varchar', length: 64, default: '' })
  location: string;

  /** IP 地址 */
  @Column({ type: 'varchar', length: 45, default: '' })
  ip: string;

  /** MAC 地址 */
  @Column({ type: 'varchar', length: 32, default: '' })
  mac: string;

  /** 操作系统，如 Windows 10 / Android 13 */
  @Column({ type: 'varchar', length: 64, default: '' })
  os: string;

  /** 收银端应用版本 */
  @Column({ type: 'varchar', length: 32, default: '' })
  app_version: string;

  /** 最后心跳时间（用于判断在线 / 离线） */
  @Column({ type: 'datetime' })
  last_seen_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
