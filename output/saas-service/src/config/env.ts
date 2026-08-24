export interface AppConfig {
  /** 服务端口 */
  port: number;
  /** SQLite 数据库路径 */
  dbPath: string;
  /** JWT 签名密钥 */
  jwtSecret: string;
  /** JWT 有效期 */
  jwtExpiresIn: string;
  /** 平台端内部接口 base url */
  platformInternalBaseUrl: string;
  /** 与 platform-service 共享的内网签名密钥（必须一致） */
  platformInternalSecret: string;
  /** 注册时默认创建的桌台数量 */
  defaultTableCount: number;
}

export function getConfig(): AppConfig {
  return {
    port: Number(process.env.PORT || 3200),
    dbPath: process.env.DB_PATH || 'data/saas.db',
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    platformInternalBaseUrl:
      process.env.PLATFORM_INTERNAL_BASE_URL || 'http://127.0.0.1:3100',
    platformInternalSecret:
      process.env.PLATFORM_INTERNAL_SECRET || 'dev-internal-secret',
    defaultTableCount: Number(process.env.DEFAULT_TABLE_COUNT || 10),
  };
}
