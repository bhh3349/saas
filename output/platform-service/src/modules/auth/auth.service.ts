import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { getConfig } from '../../config/env';
import { Operator } from '../../entities/operator.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** bcrypt cost：12（安全审计 H3/L3） */
const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,
    private readonly jwtService: JwtService,
  ) {}

  /** 首次启动时创建种子运营账号 */
  async onModuleInit(): Promise<void> {
    const config = getConfig();
    const exists = await this.operatorRepo.findOne({
      where: { username: config.seedOperatorUsername },
    });
    if (!exists) {
      // 未显式配置密码时自动生成随机密码（仅打印一次），避免默认弱口令
      const auto = !config.seedOperatorPassword;
      const password = config.seedOperatorPassword || randomBytes(12).toString('base64url');
      const passwordHash = await hash(password, BCRYPT_ROUNDS);
      await this.operatorRepo.save(
        this.operatorRepo.create({
          username: config.seedOperatorUsername,
          password_hash: passwordHash,
          role: 'admin',
          token_version: 0,
        }),
      );
      if (auto) {
        this.logger.warn(
          `已创建种子运营账号：${config.seedOperatorUsername}，初始密码（仅本次打印，请立即修改）：${password}`,
        );
      } else {
        this.logger.log(`已创建种子运营账号：${config.seedOperatorUsername}（密码来自环境变量）`);
      }
    }
  }

  /** 登录：返回 JWT 与运营信息 */
  async login(dto: LoginDto): Promise<{ token: string; operator: OperatorProfile }> {
    const operator = await this.operatorRepo.findOne({ where: { username: dto.username } });
    if (!operator || !(await compare(dto.password, operator.password_hash))) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const token = await this.jwtService.signAsync(
      {
        sub: operator.id,
        userId: operator.id,
        username: operator.username,
        role: operator.role,
        ver: operator.token_version,
      },
      {
        secret: getConfig().jwtSecret,
        // jwtExpiresIn 为可读字符串（如 '8h'），断言为 jsonwebtoken 的 StringValue 类型
        expiresIn: getConfig().jwtExpiresIn as `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y'}`,
      },
    );
    return { token, operator: this.toProfile(operator) };
  }

  /** 获取当前运营账号资料 */
  async getProfile(userId: number): Promise<OperatorProfile> {
    const operator = await this.operatorRepo.findOne({ where: { id: userId } });
    if (!operator) {
      throw new NotFoundException('运营账号不存在');
    }
    return this.toProfile(operator);
  }

  /** 修改用户名 / 头像（用户名变更后使旧 token 失效） */
  async updateProfile(userId: number, dto: UpdateProfileDto): Promise<OperatorProfile> {
    const operator = await this.operatorRepo.findOne({ where: { id: userId } });
    if (!operator) {
      throw new NotFoundException('运营账号不存在');
    }
    if (dto.username !== undefined && dto.username !== operator.username) {
      const dup = await this.operatorRepo.findOne({ where: { username: dto.username } });
      if (dup) {
        throw new ConflictException('该用户名已被占用');
      }
      operator.username = dto.username.trim();
      operator.token_version += 1;
    }
    if (dto.avatar !== undefined) {
      operator.avatar = dto.avatar === '' ? null : dto.avatar;
    }
    await this.operatorRepo.save(operator);
    this.logger.log(`运营账号 ${operator.username}(id=${userId}) 更新了个人资料`);
    return this.toProfile(operator);
  }

  /** 修改密码（需校验原密码；改密后使旧 token 失效） */
  async changePassword(userId: number, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const operator = await this.operatorRepo.findOne({ where: { id: userId } });
    if (!operator) {
      throw new NotFoundException('运营账号不存在');
    }
    if (!(await compare(dto.old_password, operator.password_hash))) {
      throw new BadRequestException('原密码不正确');
    }
    operator.password_hash = await hash(dto.new_password, BCRYPT_ROUNDS);
    operator.token_version += 1;
    await this.operatorRepo.save(operator);
    this.logger.log(`运营账号 ${operator.username}(id=${userId}) 修改了登录密码`);
    return { success: true };
  }

  private toProfile(operator: Operator): OperatorProfile {
    return {
      id: operator.id,
      username: operator.username,
      role: operator.role,
      avatar: operator.avatar ?? null,
    };
  }
}

export interface OperatorProfile {
  id: number;
  username: string;
  role: string;
  avatar: string | null;
}
