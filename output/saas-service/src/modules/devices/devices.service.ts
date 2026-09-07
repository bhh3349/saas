import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Device } from '../../entities/device.entity';
import { HeartbeatDeviceDto } from './dto/heartbeat-device.dto';

/** 心跳超时阈值：超过该时长未上报视为离线（毫秒） */
const OFFLINE_MS = 5 * 60 * 1000;

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  /**
   * 收银端心跳上报：按 (shop_id, device_id) upsert。
   * 已存在则更新心跳时间与上报信息，不存在则自动登记为新设备。
   */
  async heartbeat(user: AuthUser, dto: HeartbeatDeviceDto) {
    const deviceId = dto.device_id.trim();
    if (!deviceId) {
      throw new BusinessException('缺少设备标识 device_id');
    }
    const now = new Date();
    let dev = await this.deviceRepo.findOne({
      where: { shop_id: user.shopId, device_id: deviceId },
    });
    if (dev) {
      if (dto.name) dev.name = dto.name;
      if (dto.type) dev.type = dto.type;
      if (dto.location) dev.location = dto.location;
      if (dto.ip) dev.ip = dto.ip;
      if (dto.mac) dev.mac = dto.mac;
      if (dto.os) dev.os = dto.os;
      if (dto.app_version) dev.app_version = dto.app_version;
      dev.last_seen_at = now;
      await this.deviceRepo.save(dev);
    } else {
      dev = await this.deviceRepo.save(
        this.deviceRepo.create({
          shop_id: user.shopId,
          device_id: deviceId,
          name: dto.name ?? '',
          type: dto.type ?? 'POS',
          location: dto.location ?? '',
          ip: dto.ip ?? '',
          mac: dto.mac ?? '',
          os: dto.os ?? '',
          app_version: dto.app_version ?? '',
          last_seen_at: now,
        }),
      );
    }
    return { device_id: dev.device_id, last_seen_at: now.toISOString() };
  }

  /** 商家后台设备列表（只读），附加 is_online 在线状态 */
  async list(user: AuthUser) {
    const rows = await this.deviceRepo.find({
      where: { shop_id: user.shopId },
      order: { last_seen_at: 'DESC' },
    });
    const now = Date.now();
    return rows.map((d) => ({
      ...d,
      is_online: now - new Date(d.last_seen_at).getTime() < OFFLINE_MS,
    }));
  }
}
