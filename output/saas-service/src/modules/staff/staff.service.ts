import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { UserRole, UserStatus } from '../../common/enums';
import { User } from '../../entities/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';

export interface StaffItem {
  id: number;
  phone: string;
  name: string;
  role: string;
  status: string;
  created_at: Date;
}

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** 创建员工（仅老板；员工角色限收银员 / 财务） */
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
        status: UserStatus.Active,
      }),
    );
    return this.toItem(staff);
  }

  /** 员工列表（按租户隔离，只能看本店） */
  async list(
    user: AuthUser,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: StaffItem[] }> {
    const [items, total] = await this.userRepo.findAndCount({
      where: { shop_id: user.shopId },
      order: { id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { total, items: items.map((item) => this.toItem(item)) };
  }

  /** 停用 / 启用员工（仅老板；本店；不可操作老板账号 / 自身） */
  async updateStatus(
    user: AuthUser,
    id: number,
    status: string,
  ): Promise<StaffItem> {
    const target = await this.userRepo.findOne({ where: { id } });
    if (!target || target.shop_id !== user.shopId) {
      throw new BusinessException('员工不存在');
    }
    if (target.role === UserRole.Boss) {
      throw new BusinessException('不能停用老板账号');
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
      status: u.status,
      created_at: u.created_at,
    };
  }
}
