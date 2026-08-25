import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 平台系统设置（单行：id 固定为 1） */
@Entity('system_setting')
export class SystemSetting {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ type: 'varchar', length: 64, default: '收银云' })
  system_name: string;

  /** 页面 logo（data URL，为空表示使用默认图标） */
  @Column({ type: 'text', nullable: true })
  logo: string | null;

  /** 浏览器 favicon（data URL，为空表示使用默认 favicon.svg） */
  @Column({ type: 'text', nullable: true })
  favicon: string | null;

  @UpdateDateColumn()
  updated_at: Date;
}
