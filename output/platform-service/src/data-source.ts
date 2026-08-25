import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getConfig } from './config/env';
import { ActivationCode } from './entities/activation-code.entity';
import { OpLog } from './entities/op-log.entity';
import { Operator } from './entities/operator.entity';
import { Shop } from './entities/shop.entity';

/**
 * TypeORM CLI DataSource（migration 专用）。
 * 运行时使用 app.module.ts 的 TypeOrmModule 配置；此处 synchronize 恒为 false，
 * schema 变更统一走 migration，保证生产环境可控。
 */
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: getConfig().dbPath,
  entities: [Operator, ActivationCode, Shop, OpLog],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
