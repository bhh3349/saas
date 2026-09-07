import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole, UserStatus } from '../../common/enums';
import { User } from '../../entities/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { ResetPasswordDto, UpdateStaffDto } from './dto/update-staff.dto';

/** 默认临时密码；生产建议改为随机密码 + 首次登录强制改密 */
const DEFAULT_RESET_PASSWORD = '123456';

export interface StaffItem {
  id: number;
  phone: string;
  name: string;
  role: string;
  /** 是否店主（激活码激活的主管理员，拥有最高权限，UI 中显示店主徽标） */
  is_primary: boolean;
  status: string;
  created_at: Date;
}

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 创建账号：老板 / 收银员 / 财务。
   * 店主创建的 boss 账号是合伙人（is_primary=false）；激活码注册的店主才是 is_primary=true。
   */
  async create(user: AuthUser, dto: CreateStaffDto): Promise<StaffItem> {
    const exists = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (exists) {
      throw new BusinessException('该手机号已注册');
    }
    const passwordHash = await hash(dto.password, 10);
    const staff = await this.userRepo.save(
      this.userRepo.create({
        shop_id: user.shopId,
        phone: dto.phone,
        password_hash: passwordHash,
        name: dto.name,
        role: dto.role,
        is_primary: false,
        status: UserStatus.Active,
      }),
    );
    return this.toItem(staff);
  }

  /** 账号列表（本店；店主优先） */
  async list(
    user: AuthUser,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: StaffItem[] }> {
    const [items, total] = await this.userRepo.findAndCount({
      where: { shop_id: user.shopId },
      order: {
        is_primary: 'DESC',
        id: 'ASC',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { total, items: items.map((item) => this.toItem(item)) };
  }

  /** 更新账号基本信息（姓名 / 角色）。不允许操作当前登录人自己；店主账号角色不可修改。 */
  async update(
    user: AuthUser,
    id: number,
    dto: UpdateStaffDto,
  ): Promise<StaffItem> {
    const target = await this.userRepo.findOne({ where: { id } });
    if (!target || target.shop_id !== user.shopId) {
      throw new BusinessException('账号不存在');
    }
    if (target.id === user.userId) {
      throw new BusinessException('不能修改自己的账号，请在个人中心操作');
    }
    if (dto.name !== undefined) {
      target.name = dto.name.trim();
    }
    if (dto.role !== undefined) {
      if (target.is_primary && dto.role !== UserRole.Boss) {
        throw new BusinessException('店主账号角色不可修改');
      }
      target.role = dto.role;
    }
    await this.userRepo.save(target);
    return this.toItem(target);
  }

  /** 重置密码。不允许重置自己；生产建议使用随机临时密码并强制首次登录改密。 */
  async resetPassword(
    user: AuthUser,
    id: number,
    dto: ResetPasswordDto,
  ): Promise<StaffItem> {
    const target = await this.userRepo.findOne({ where: { id } });
    if (!target || target.shop_id !== user.shopId) {
      throw new BusinessException('账号不存在');
    }
    if (target.id === user.userId) {
      throw new BusinessException('不能重置自己的密码，请在个人中心修改');
    }
    const raw = dto.new_password ?? DEFAULT_RESET_PASSWORD;
    const passwordHash = await hash(raw, 10);
    target.password_hash = passwordHash;
    await this.userRepo.save(target);
    return this.toItem(target);
  }

  /** 删除账号（不可删除店主，不可删除自己） */
  async remove(user: AuthUser, id: number): Promise<{ message: string }> {
    const target = await this.userRepo.findOne({ where: { id } });
    if (!target || target.shop_id !== user.shopId) {
      throw new BusinessException('账号不存在');
    }
    if (target.is_primary) {
      throw new BusinessException('店主账号不可删除');
    }
    if (target.id === user.userId) {
      throw new BusinessException('不能删除自己');
    }
    await this.userRepo.remove(target);
    return { message: '删除成功' };
  }

  /** 停用 / 启用（不可停用店主，不可操作自己） */
  async updateStatus(
    user: AuthUser,
    id: number,
    status: string,
  ): Promise<StaffItem> {
    const target = await this.userRepo.findOne({ where: { id } });
    if (!target || target.shop_id !== user.shopId) {
      throw new BusinessException('账号不存在');
    }
    if (target.is_primary) {
      throw new BusinessException('店主账号不可停用');
    }
    if (target.id === user.userId) {
      throw new BusinessException('不能操作自己的账号');
    }
    target.status = status;
    await this.userRepo.save(target);
    return this.toItem(target);
  }

  private toItem(u: User): StaffItem {
    return {
      id: u.id,
      phone: u.phone,
      name: u.name,
      role: u.role,
      is_primary: u.is_primary,
      status: u.status,
      created_at: u.created_at,
    };
  }
}
