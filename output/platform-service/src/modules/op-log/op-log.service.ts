import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpLog } from '../../entities/op-log.entity';

/** 操作来源信息（IP / UA），用于审计 */
export interface OpLogMeta {
  ip?: string;
  userAgent?: string;
}

/** 敏感操作日志服务（仅落库，本期无查询接口） */
@Injectable()
export class OpLogService {
  constructor(
    @InjectRepository(OpLog)
    private readonly opLogRepo: Repository<OpLog>,
  ) {}

  async log(
    operatorId: number,
    action: string,
    target: string,
    detail = '',
    meta: OpLogMeta = {},
  ): Promise<void> {
    await this.opLogRepo.save(
      this.opLogRepo.create({
        operator_id: operatorId,
        action,
        target,
        detail,
        ip: meta.ip || '',
        user_agent: meta.userAgent ? meta.userAgent.slice(0, 255) : '',
      }),
    );
  }
}
