import 'dotenv/config';
import 'reflect-metadata';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppModule } from './app.module';
import { assertSecret, getConfig } from './config/env';
import { ResponseInterceptor } from './common/response.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  const config = getConfig();
  // 生产环境安全校验（密钥/弱口令兜底）
  assertSecret(config);
  // 确保数据库目录存在
  mkdirSync(dirname(config.dbPath), { recursive: true });

  const app = await NestFactory.create(AppModule);

  // 安全响应头（helmet）；纯 JSON API 无需 CSP
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS 白名单（来自环境变量 CORS_ORIGINS）
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(`[platform-service] listening on http://localhost:${config.port}`);
}

void bootstrap();
