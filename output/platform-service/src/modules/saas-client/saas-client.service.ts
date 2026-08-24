import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { getConfig } from '../../config/env';

const INTERNAL_KEY = 'internal';

/** 与 saas-service InternalSignatureGuard 一致的规范序列化：key 排序 */
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
 * 商家端内部接口客户端（内网签名）。
 * 店铺停用 / 启用时同步状态到 saas-service（push），
 * 使「停用后该店登录与业务接口不可用」立即生效。
 */
@Injectable()
export class SaasClientService {
  private readonly logger = new Logger(SaasClientService.name);

  /** 同步店铺状态到 saas-service；失败仅记日志，不阻断停用操作（saas 登录时另有 pull 兜底） */
  async pushShopStatus(shopId: number, status: string, name?: string): Promise<void> {
    const config = getConfig();
    const path = '/internal/shop-status';
    const timestamp = Date.now();
    const body = canonicalJson({ shop_id: shopId, status, ...(name ? { name } : {}) });
    const text = `${timestamp}.POST.${path}.${body}`;
    const signature = createHmac('sha256', config.saasInternalSecret)
      .update(text)
      .digest('hex');

    try {
      const res = await fetch(`${config.saasInternalBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-key': INTERNAL_KEY,
          'x-internal-timestamp': String(timestamp),
          'x-internal-signature': signature,
        },
        body,
      });
      if (!res.ok) {
        const textBody = await res.text().catch(() => '');
        this.logger.error(
          `同步店铺状态到 saas-service 失败：HTTP ${res.status} ${textBody}，shopId=${shopId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `同步店铺状态到 saas-service 失败：${(err as Error).message}，shopId=${shopId}`,
      );
    }
  }
}
