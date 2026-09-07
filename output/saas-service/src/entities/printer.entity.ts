import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 打印机配置
 * 每个店铺可注册多台打印机，支持蓝牙 / WiFi 两种连接方式。
 * 「默认打印机」用于结账后自动打印，其余打印机可手动选择。
 */
@Entity('printers')
@Index(['shop_id'])
export class Printer {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属店铺（多租户隔离键） */
  @Column({ type: 'integer' })
  shop_id: number;

  /** 打印机显示名，如「前台小票机」「厨房打印机」 */
  @Column({ type: 'varchar', length: 64 })
  name: string;

  /** 连接方式：bluetooth / wifi */
  @Column({ type: 'varchar', length: 16 })
  type: string;

  /** 蓝牙 MAC 地址（AA:BB:CC:DD:EE:FF）或 WiFi IP（192.168.1.123） */
  @Column({ type: 'varchar', length: 64 })
  address: string;

  /** WiFi 端口，默认 9100（JET Direct / ESC-POS 常见端口） */
  @Column({ type: 'integer', default: 9100 })
  port: number;

  /** 打印机厂商，如 芯烨 / 飞鹅 / 佳博（可选，帮助选择指令集） */
  @Column({ type: 'varchar', length: 32, default: '' })
  brand: string;

  /** 小票宽度（mm）：58 / 80 / 110 */
  @Column({ type: 'integer', default: 80 })
  width_mm: number;

  /** 是否为默认打印机（结账后自动打印用） */
  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  /** 备注 / 位置，如「前台右侧」「荤菜档」 */
  @Column({ type: 'varchar', length: 64, default: '' })
  remark: string;

  /** 是否启用（可临时停用而不删除） */
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
