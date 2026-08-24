import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../../config/env';

const INTERNAL_KEY = 'internal';
/** 签名时间窗口：5 分钟 */
const WINDOW_MS = 5 * 60 * 1000;

/** 按 key 排序后序列化，保证调用方与接收方签名一致（与 platform-service 一致） */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '{}';
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = obj[key];
    }
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

/**
 * 内部接口签名守卫（商家端）：供 platform-service 调用（内网签名鉴权）。
 * 使用与平台端共享的密钥（platformInternalSecret，默认 dev-internal-secret）。
 */
@Injectable()
export class InternalSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['x-internal-key'] as string;
    const timestamp = req.headers['x-internal-timestamp'] as string;
    const signature = req.headers['x-internal-signature'] as string;

    if (key !== INTERNAL_KEY || !timestamp || !signature) {
      throw new ForbiddenException('内部接口签名缺失');
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > WINDOW_MS) {
      throw new ForbiddenException('签名已过期');
    }

    const body = canonicalJson(req.body);
    const text = `${timestamp}.${req.method.toUpperCase()}.${req.path}.${body}`;
    const expected = createHmac('sha256', getConfig().platformInternalSecret)
      .update(text)
      .digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('签名无效');
    }
    return true;
  }
}
