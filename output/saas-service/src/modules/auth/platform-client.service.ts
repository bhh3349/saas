import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { getConfig } from '../../config/env';
import { BusinessException } from '../../common/business.exception';

export interface ClaimRequest {
  code: string;
  shop_name: string;
  shop_address?: string;
  phone?: string;
}

export interface ClaimResult {
  success: boolean;
  shopId: number;
}

const INTERNAL_KEY = 'internal';

/** 与 platform-service InternalSignatureGuard 完全一致的规范序列化：key 排序 */
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
 * 平台端内部接口客户端（内网签名）。
 * 注册链路：POST /internal/activation/claim
 */
@Injectable()
export class PlatformClientService {
  private readonly logger = new Logger(PlatformClientService.name);

  async claim(dto: ClaimRequest): Promise<ClaimResult> {
    const config = getConfig();
    const path = '/internal/activation/claim';
    const timestamp = Date.now();
    const body = canonicalJson({
      code: dto.code,
      shop_name: dto.shop_name,
      shop_address: dto.shop_address || '',
      phone: dto.phone || '',
    });
    const text = `${timestamp}.POST.${path}.${body}`;
    const signature = createHmac('sha256', config.platformInternalSecret)
      .update(text)
      .digest('hex');

    let res: Response;
    try {
      res = await fetch(`${config.platformInternalBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-key': INTERNAL_KEY,
          'x-internal-timestamp': String(timestamp),
          'x-internal-signature': signature,
        },
        body,
      });
    } catch (err) {
      this.logger.error(`调用平台端 claim 失败：${(err as Error).message}`);
      throw new BusinessException('平台服务暂不可用，请稍后重试');
    }

    const data = (await res.json().catch(() => null)) as {
      code?: number;
      message?: string;
      data?: ClaimResult;
    } | null;

    if (!data || typeof data.code !== 'number' || data.code !== 0) {
      const msg = data?.message || '激活码校验失败';
      throw new BusinessException(msg);
    }
    if (!data.data || !data.data.success) {
      throw new BusinessException('激活码校验失败');
    }
    return data.data;
  }

  /** 查询店铺状态（登录时 pull，确保平台端停用立即生效） */
  async getShopStatus(shopId: number): Promise<{ shop_id: number; status: string }> {
    const config = getConfig();
    const path = `/internal/shops/${shopId}/status`;
    const timestamp = Date.now();
    const body = '{}';
    const text = `${timestamp}.GET.${path}.${body}`;
    const signature = createHmac('sha256', config.platformInternalSecret)
      .update(text)
      .digest('hex');

    let res: Response;
    try {
      res = await fetch(`${config.platformInternalBaseUrl}${path}`, {
        method: 'GET',
        headers: {
          'x-internal-key': INTERNAL_KEY,
          'x-internal-timestamp': String(timestamp),
          'x-internal-signature': signature,
        },
      });
    } catch (err) {
      this.logger.error(`调用平台端查询店铺状态失败：${(err as Error).message}`);
      throw new BusinessException('平台服务暂不可用，请稍后重试');
    }

    const data = (await res.json().catch(() => null)) as {
      code?: number;
      message?: string;
      data?: { shop_id: number; status: string };
    } | null;

    if (!data || typeof data.code !== 'number' || data.code !== 0) {
      throw new BusinessException(data?.message || '店铺状态查询失败');
    }
    if (!data.data) {
      throw new BusinessException('店铺状态查询失败');
    }
    return data.data;
  }
}
