export interface AppConfig {
  port: number;
  dbPath: string;
  isProduction: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  internalSecret: string;
  saasInternalBaseUrl: string;
  saasInternalSecret: string;
  seedOperatorUsername: string;
  seedOperatorPassword: string;
  corsOrigins: string[];
  dbSync: boolean;
}

/** 开发/演示环境默认弱密钥集合，生产环境禁止使用（assertSecret 兜底） */
const WEAK_SECRETS = new Set([
  'dev-secret-change-me',
  'dev-internal-secret',
  'internal-shared-secret-change-me',
  'secret',
  'change-me',
  '',
]);

export function getConfig(): AppConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    port: Number(process.env.PORT || 3100),
    dbPath: process.env.DB_PATH || 'data/platform.db',
    isProduction,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    internalSecret: process.env.INTERNAL_SHARED_SECRET || 'dev-internal-secret',
    saasInternalBaseUrl: process.env.SAAS_INTERNAL_BASE_URL || 'http://127.0.0.1:3200',
    saasInternalSecret: process.env.SAAS_INTERNAL_SECRET || 'dev-internal-secret',
    seedOperatorUsername: process.env.SEED_OPERATOR_USERNAME || 'admin',
    seedOperatorPassword: process.env.SEED_OPERATOR_PASSWORD || '',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    dbSync: process.env.DB_SYNC ? process.env.DB_SYNC === 'true' : !isProduction,
  };
}

/**
 * 生产环境安全校验（启动时调用）：
 * 拒绝使用默认/弱密钥启动，防止上线后遗漏配置。
 */
export function assertSecret(config: AppConfig): void {
  if (!config.isProduction) {
    return;
  }
  const weakJwt = WEAK_SECRETS.has(config.jwtSecret);
  const weakInternal = WEAK_SECRETS.has(config.internalSecret);
  const weakSaas = WEAK_SECRETS.has(config.saasInternalSecret);
  if (weakJwt || weakInternal || weakSaas) {
    throw new Error(
      '[platform-service] 生产环境禁止使用默认密钥：请在 .env 中配置 JWT_SECRET / INTERNAL_SHARED_SECRET / SAAS_INTERNAL_SECRET',
    );
  }
  if (config.jwtSecret.length < 32 || config.internalSecret.length < 32 || config.saasInternalSecret.length < 32) {
    throw new Error('[platform-service] 生产环境密钥长度至少 32 位');
  }
}
