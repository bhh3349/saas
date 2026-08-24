import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ShopStatus } from '../common/enums';

/** 店铺主数据（shopId 源头） */
@Entity('shop')
export class Shop {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  address: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  phone: string;

  /** 绑定激活码（唯一约束，配合事务内原子抢占，杜绝一码多店） */
  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  activation_code: string | null;

  @Column({ type: 'varchar', length: 16, default: ShopStatus.Active })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
