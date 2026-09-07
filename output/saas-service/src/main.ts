import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { getConfig } from './config/env';
import { ResponseInterceptor } from './common/response.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // 全局：API 响应禁用缓存，避免浏览器复用旧响应（如门店档案 /auth/me 等）
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // SQLite 开启 WAL：读不阻塞写，提升多请求下的小事务写并发（持久化在库文件头）
  const dataSource = app.get(DataSource);
  await dataSource.query('PRAGMA journal_mode = WAL');
  const port = getConfig().port;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[saas-service] listening on http://127.0.0.1:${port}`);
}

void bootstrap();
