import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { getConfig } from '../../config/env';
import { BusinessException } from '../../common/business.exception';
import { ShopStatus, UserRole, UserStatus } from '../../common/enums';
import { User } from '../../entities/user.entity';
import { Shop } from '../../entities/shop.entity';
import { Table } from '../../entities/table.entity';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PlatformClientService } from './platform-client.service';

export interface LoginResult {
  token: string;
  user: {
    id: number;
    shop_id: number;
    phone: string;
    name: string;
    role: string;
    status: string;
    /** 店铺名称（登录时随响应下发，供后台 TopBar 展示） */
    shopName?: string;
  };
}

/** 注册时默认创建的结账方式 */
const DEFAULT_PAYMENT_METHODS = ['现金', '微信', '支付宝'];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Shop)
    private readonly shopRepo: Repository<Shop>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly platformClient: PlatformClientService,
  ) {}

  /**
   * 注册新店铺：
   * 1. 校验手机号全局唯一
   * 2. 调平台端 /internal/activation/claim（内网签名），返回 shopId
   * 3. 建老板账号 + 初始配置（默认桌台 / 默认结账方式）
   */
  async register(dto: RegisterDto): Promise<{ message: string }> {
    const exists = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (exists) {
      throw new BusinessException('该手机号已注册');
    }

    // 跨服务：激活码校验 + 建店铺主数据 + 绑码
    const claim = await this.platformClient.claim({
      code: dto.code,
      shop_name: dto.shop_name,
      shop_address: dto.shop_address,
      phone: dto.phone,
    });

    try {
      await this.dataSource.transaction(async (manager) => {
        const userRepo = manager.getRepository(User);
        const passwordHash = await hash(dto.password, 10);
        await userRepo.save(
          userRepo.create({
            shop_id: claim.shopId,
            phone: dto.phone,
            password_hash: passwordHash,
            name: dto.name || '老板',
            role: UserRole.Boss,
            status: UserStatus.Active,
          }),
        );

        // 本地店铺状态快照（权威在平台端；供停用后业务接口即时拦截）
        await manager.getRepository(Shop).save(
          manager.getRepository(Shop).create({
            shop_id: claim.shopId,
            name: dto.shop_name,
            status: ShopStatus.Active,
          }),
        );

        // 初始配置：默认桌台
        const tableRepo = manager.getRepository(Table);
        const tableCount = getConfig().defaultTableCount;
        for (let i = 1; i <= tableCount; i += 1) {
          await tableRepo.save(
            tableRepo.create({
              shop_id: claim.shopId,
              name: `${i}号桌`,
              area: '默认区',
              capacity: 4,
              status: 'idle',
            }),
          );
        }

        // 初始配置：默认结账方式
        const pmRepo = manager.getRepository(PaymentMethod);
        for (let i = 0; i < DEFAULT_PAYMENT_METHODS.length; i += 1) {
          await pmRepo.save(
            pmRepo.create({
              shop_id: claim.shopId,
              name: DEFAULT_PAYMENT_METHODS[i],
              sort: i,
              enabled: true,
            }),
          );
        }
      });
    } catch (err) {
      // 本地建号失败：激活码已在平台端置 used，需运营手工处理该码
      this.logger.error(
        `注册店铺本地初始化失败，shopId=${claim.shopId}, phone=${dto.phone}，激活码=${dto.code} 需人工核对`,
        err instanceof Error ? err.stack : String(err),
      );
      throw new BusinessException('注册失败，请联系客服处理');
    }

    this.logger.log(
      `店铺注册成功：shopId=${claim.shopId}, shopName=${dto.shop_name}, phone=${dto.phone}`,
    );
    return { message: '注册成功，请登录' };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user || !(await compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    if (user.status === UserStatus.Disabled) {
      throw new UnauthorizedException('账号已被停用');
    }

    // 店铺状态校验：优先拉平台端权威状态（停用立即生效），失败回退本地快照
    let shopDisabled = false;
    try {
      const shopStatus = await this.platformClient.getShopStatus(user.shop_id);
      shopDisabled = shopStatus.status === ShopStatus.Disabled;
      await this.shopRepo.update(
        { shop_id: user.shop_id },
        { status: shopStatus.status },
      );
    } catch (err) {
      if (err instanceof BusinessException && err.message.includes('店铺不存在')) {
        throw new UnauthorizedException('店铺不存在，请联系平台');
      }
      this.logger.warn(
        `登录时拉取店铺状态失败，回退本地快照：${err instanceof Error ? err.message : String(err)}`,
      );
      const local = await this.shopRepo.findOne({ where: { shop_id: user.shop_id } });
      shopDisabled = !!local && local.status === ShopStatus.Disabled;
    }
    if (shopDisabled) {
      throw new UnauthorizedException('店铺已停用，请联系平台');
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      shopId: user.shop_id,
      role: user.role,
      phone: user.phone,
    });

    // 下发店铺名称，供后台 TopBar 展示真实店名
    const shop = await this.shopRepo.findOne({ where: { shop_id: user.shop_id } });

    return {
      token,
      user: {
        id: user.id,
        shop_id: user.shop_id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        status: user.status,
        shopName: shop?.name ?? '',
      },
    };
  }

  /** 忘记密码：统一提示，不暴露账号是否存在（本期不做短信） */
  async forgotPassword(_dto: ForgotPasswordDto): Promise<{ message: string }> {
    return { message: '如该手机号已注册，请联系客服重置密码' };
  }

  async me(userId: number): Promise<LoginResult['user']> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('账号不存在');
    }
    // 下发店铺名称，供后台 TopBar 展示真实店名
    const shop = await this.shopRepo.findOne({ where: { shop_id: user.shop_id } });
    return {
      id: user.id,
      shop_id: user.shop_id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      status: user.status,
      shopName: shop?.name ?? '',
    };
  }
}
