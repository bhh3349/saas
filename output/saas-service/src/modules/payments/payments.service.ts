import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

export interface PaymentItem {
  id: number;
  name: string;
  sort: number;
  enabled: boolean;
  created_at: Date;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly paymentRepo: Repository<PaymentMethod>,
  ) {}

  async create(user: AuthUser, dto: CreatePaymentDto): Promise<PaymentItem> {
    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        shop_id: user.shopId,
        name: dto.name,
        sort: dto.sort ?? 0,
        enabled: dto.enabled ?? true,
      }),
    );
    return this.toItem(payment);
  }

  /** 后台管理列表（本店，分页） */
  async list(
    user: AuthUser,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: PaymentItem[] }> {
    const [items, total] = await this.paymentRepo.findAndCount({
      where: { shop_id: user.shopId },
      order: { sort: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { total, items: items.map((i) => this.toItem(i)) };
  }

  /** 结账可选方式（仅启用） */
  async enabledList(user: AuthUser): Promise<PaymentItem[]> {
    const items = await this.paymentRepo.find({
      where: { shop_id: user.shopId, enabled: true },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return items.map((i) => this.toItem(i));
  }

  async update(user: AuthUser, id: number, dto: UpdatePaymentDto): Promise<PaymentItem> {
    const payment = await this.findInShop(user, id);
    if (dto.name !== undefined) payment.name = dto.name;
    if (dto.sort !== undefined) payment.sort = dto.sort;
    if (dto.enabled !== undefined) payment.enabled = dto.enabled;
    await this.paymentRepo.save(payment);
    return this.toItem(payment);
  }

  async remove(user: AuthUser, id: number): Promise<void> {
    const payment = await this.findInShop(user, id);
    await this.paymentRepo.remove(payment);
  }

  private async findInShop(user: AuthUser, id: number): Promise<PaymentMethod> {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment || payment.shop_id !== user.shopId) {
      throw new BusinessException('结账方式不存在');
    }
    return payment;
  }

  private toItem(p: PaymentMethod): PaymentItem {
    return {
      id: p.id,
      name: p.name,
      sort: p.sort,
      enabled: p.enabled,
      created_at: p.created_at,
    };
  }
}
