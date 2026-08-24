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
/** nonce 去重缓存窗口：10 分钟（防止重放） */
const NONCE_WINDOW_MS = 10 * 60 * 1000;
/** nonce 缓存上限，超出后清理过期项 */
const NONCE_CACHE_MAX = 2000;

/** 已使用的 nonce 缓存：nonce -> 时间戳 */
const nonceCache = new Map<string, number>();

/** 按 key 递归排序后序列化，保证调用方与接收方签名一致（嵌套对象同样稳定） */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) {
    return '{}';
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** 记录并判断 nonce 是否已被使用过 */
function isNonceReplayed(nonce: string, ts: number): boolean {
  if (nonceCache.has(nonce)) {
    return true;
  }
  nonceCache.set(nonce, ts);
  if (nonceCache.size > NONCE_CACHE_MAX) {
    const cutoff = Date.now() - NONCE_WINDOW_MS;
    for (const [k, v] of nonceCache) {
      if (v < cutoff) {
        nonceCache.delete(k);
      }
    }
  }
  return false;
}

/**
 * 内部接口签名守卫：
 * 请求头 X-Internal-Key / X-Internal-Timestamp / X-Internal-Signature
 * 可选头 X-Internal-Nonce：携带时进行重放去重（10 分钟窗口）
 * 签名串 = timestamp.METHOD.path.canonicalBody，HMAC-SHA256(INTERNAL_SHARED_SECRET)
 */
@Injectable()
export class InternalSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['x-internal-key'] as string;
    const timestamp = req.headers['x-internal-timestamp'] as string;
    const signature = req.headers['x-internal-signature'] as string;
    const nonce = req.headers['x-internal-nonce'] as string;

    if (key !== INTERNAL_KEY || !timestamp || !signature) {
      throw new ForbiddenException('内部接口签名缺失');
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > WINDOW_MS) {
      throw new ForbiddenException('签名已过期');
    }

    // 重放防护：同一 nonce 在 10 分钟内只能使用一次（可选头，兼容老调用方）
    if (nonce && isNonceReplayed(nonce, ts)) {
      throw new ForbiddenException('签名已使用');
    }

    const body = canonicalJson(req.body);
    const text = `${timestamp}.${req.method.toUpperCase()}.${req.path}.${body}`;
    const expected = createHmac('sha256', getConfig().internalSecret)
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
