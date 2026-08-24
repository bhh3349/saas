import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BusinessException } from '../../common/business.exception';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  DishStatus,
  OrderMode,
  OrderStatus,
  TableStatus,
} from '../../common/enums';
import { Dish } from '../../entities/dish.entity';
import { Order } from '../../entities/order.entity';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { Table } from '../../entities/table.entity';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { SettleOrderDto } from './dto/settle-order.dto';

export interface OrderItemSnapshot {
  dish_id: number;
  name: string;
  spec_name: string | null;
  unit_price: number;
  qty: number;
  amount: number;
}

export interface OrderItem {
  id: number;
  order_no: string;
  mode: string;
  table_id: number | null;
  ticket_no: number | null;
  status: string;
  items: OrderItemSnapshot[];
  /** 应付（元） */
  total_amount: number;
  /** 实收（元） */
  paid_amount: number;
  /** 找零（元） */
  change_amount: number;
  payment_method_id: number | null;
  payment_method_name: string | null;
  remark: string;
  created_at: Date;
  settled_at: Date | null;
}

/** 元 → 分 */
function yuanToCents(v: number): number {
  return Math.round(v * 100);
}

/** 分 → 元 */
function centsToYuan(v: number): number {
  return v / 100;
}

/** 当前日期 YYYYMMDD（本地时区） */
function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** 解析菜品规格 JSON */
function parseSpecs(raw: string): { name: string; price_delta: number }[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 下单（开台 + 点餐合并）：
   * - 桌台模式：桌台必须空闲，置为占用
   * - 金额由服务端按菜品 + 规格计算（分），客户端只传菜品与数量
   * - 生成当日订单号 / 取餐号
   */
  async create(user: AuthUser, dto: CreateOrderDto): Promise<OrderItem> {
    if (dto.mode === OrderMode.Table && !dto.table_id) {
      throw new BusinessException('桌台模式下必须选择桌台');
    }
    if (dto.mode === OrderMode.Ticket && dto.table_id) {
      throw new BusinessException('叫号模式无需选择桌台');
    }

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const dishRepo = manager.getRepository(Dish);
      const tableRepo = manager.getRepository(Table);

      // 1. 占用桌台
      let tableId: number | null = null;
      if (dto.mode === OrderMode.Table) {
        const table = await tableRepo.findOne({ where: { id: dto.table_id } });
        if (!table || table.shop_id !== user.shopId) {
          throw new BusinessException('桌台不存在');
        }
        if (table.status !== TableStatus.Idle) {
          throw new BusinessException('桌台已被占用');
        }
        table.status = TableStatus.Occupied;
        await tableRepo.save(table);
        tableId = table.id;
      }

      // 2. 按菜品快照计算金额（元分校验在服务端，防客户端篡改）
      const items: OrderItemSnapshot[] = [];
      let total = 0;
      for (const it of dto.items) {
        const dish = await dishRepo.findOne({ where: { id: it.dish_id } });
        if (!dish || dish.shop_id !== user.shopId) {
          throw new BusinessException('菜品不存在');
        }
        if (dish.status !== DishStatus.OnSale || dish.sold_out) {
          throw new BusinessException(`菜品「${dish.name}」已下架或沽清`);
        }
        let specName: string | null = null;
        let specDelta = 0;
        if (it.spec_index !== undefined) {
          const spec = parseSpecs(dish.specs)[it.spec_index];
          if (!spec) {
            throw new BusinessException(`菜品「${dish.name}」规格不存在`);
          }
          specName = spec.name;
          specDelta = Number(spec.price_delta) || 0;
        }
        const unitPrice = dish.price + specDelta;
        const amount = unitPrice * it.qty;
        total += amount;
        items.push({
          dish_id: dish.id,
          name: dish.name,
          spec_name: specName,
          unit_price: unitPrice,
          qty: it.qty,
          amount,
        });
      }

      // 3. 生成订单号 / 取餐号
      const orderNo = await this.nextOrderNo(orderRepo, user.shopId);
      const ticketNo =
        dto.mode === OrderMode.Ticket
          ? await this.nextTicketNo(orderRepo, user.shopId)
          : null;

      // 4. 落单
      const order = await orderRepo.save(
        orderRepo.create({
          shop_id: user.shopId,
          order_no: orderNo,
          mode: dto.mode,
          table_id: tableId,
          ticket_no: ticketNo,
          status: OrderStatus.Pending,
          items: JSON.stringify(items),
          total_amount: total,
          paid_amount: 0,
          change_amount: 0,
          payment_method_id: null,
          payment_method_name: null,
          remark: dto.remark || '',
        }),
      );
      return this.toItem(order);
    });
  }

  /** 订单流（本店，按状态筛选） */
  async list(
    user: AuthUser,
    page: number,
    pageSize: number,
    status?: string,
  ): Promise<{ total: number; items: OrderItem[] }> {
    const where: Record<string, unknown> = { shop_id: user.shopId };
    if (status) where.status = status;
    const [items, total] = await this.orderRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { total, items: items.map((i) => this.toItem(i)) };
  }

  /** 接单（pending → confirmed） */
  async confirm(user: AuthUser, id: number): Promise<OrderItem> {
    return this.dataSource.transaction(async (manager) => {
      const order = await this.findInShop(manager.getRepository(Order), user, id);
      if (order.status !== OrderStatus.Pending) {
        throw new BusinessException('仅待接单订单可接单');
      }
      order.status = OrderStatus.Confirmed;
      await manager.getRepository(Order).save(order);
      return this.toItem(order);
    });
  }

  /** 拒单（pending → void，释放桌台） */
  async reject(user: AuthUser, id: number): Promise<OrderItem> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await this.findInShop(orderRepo, user, id);
      if (order.status !== OrderStatus.Pending) {
        throw new BusinessException('仅待接单订单可拒单');
      }
      order.status = OrderStatus.Void;
      await orderRepo.save(order);
      await this.releaseTable(manager, order);
      return this.toItem(order);
    });
  }

  /**
   * 结账记账（pending / confirmed / on_account → completed）
   * - 校验结账方式（本店启用中）
   * - 实收缺省 = 应付；大于应付自动记找零；小于应付按实收记账
   * - 释放桌台
   */
  async settle(user: AuthUser, id: number, dto: SettleOrderDto): Promise<OrderItem> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await this.findInShop(orderRepo, user, id);
      if (
        ![
          OrderStatus.Pending,
          OrderStatus.Confirmed,
          OrderStatus.OnAccount,
        ].includes(order.status as OrderStatus)
      ) {
        throw new BusinessException('当前订单状态不可结账');
      }
      const pay = await manager.getRepository(PaymentMethod).findOne({
        where: { id: dto.payment_method_id },
      });
      if (!pay || pay.shop_id !== user.shopId) {
        throw new BusinessException('结账方式不存在');
      }
      if (!pay.enabled) {
        throw new BusinessException('该结账方式已停用');
      }
      const paid =
        dto.paid_amount !== undefined
          ? yuanToCents(dto.paid_amount)
          : order.total_amount;
      order.status = OrderStatus.Completed;
      order.paid_amount = paid;
      order.change_amount = Math.max(0, paid - order.total_amount);
      order.payment_method_id = pay.id;
      order.payment_method_name = pay.name;
      if (dto.remark !== undefined) order.remark = dto.remark;
      order.settled_at = new Date();
      await orderRepo.save(order);
      await this.releaseTable(manager, order);
      return this.toItem(order);
    });
  }

  /** 免单（整单免费，金额记 0，独立动作；释放桌台） */
  async free(user: AuthUser, id: number): Promise<OrderItem> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await this.findInShop(orderRepo, user, id);
      if (
        ![
          OrderStatus.Pending,
          OrderStatus.Confirmed,
          OrderStatus.OnAccount,
        ].includes(order.status as OrderStatus)
      ) {
        throw new BusinessException('当前订单状态不可免单');
      }
      order.status = OrderStatus.Completed;
      order.paid_amount = 0;
      order.change_amount = 0;
      order.payment_method_id = null;
      order.payment_method_name = '免单';
      order.settled_at = new Date();
      await orderRepo.save(order);
      await this.releaseTable(manager, order);
      return this.toItem(order);
    });
  }

  /** 挂账（未收钱，释放桌台；之后可经 settle 补收） */
  async onAccount(user: AuthUser, id: number): Promise<OrderItem> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await this.findInShop(orderRepo, user, id);
      if (
        ![OrderStatus.Pending, OrderStatus.Confirmed].includes(
          order.status as OrderStatus,
        )
      ) {
        throw new BusinessException('当前订单状态不可挂账');
      }
      order.status = OrderStatus.OnAccount;
      order.settled_at = new Date();
      await orderRepo.save(order);
      await this.releaseTable(manager, order);
      return this.toItem(order);
    });
  }

  // ---------- 私有 ----------

  /** 查本店订单（多租户强校验） */
  private async findInShop(
    orderRepo: Repository<Order>,
    user: AuthUser,
    id: number,
  ): Promise<Order> {
    const order = await orderRepo.findOne({ where: { id } });
    if (!order || order.shop_id !== user.shopId) {
      throw new BusinessException('订单不存在');
    }
    return order;
  }

  /** 当日订单号：YYYYMMDD-0001 递增 */
  private async nextOrderNo(
    orderRepo: Repository<Order>,
    shopId: number,
  ): Promise<string> {
    const prefix = `${todayKey()}-`;
    const last = await orderRepo
      .createQueryBuilder('o')
      .where('o.shop_id = :shopId', { shopId })
      .andWhere('o.order_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.order_no', 'DESC')
      .getOne();
    const seq = last ? parseInt(last.order_no.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /** 当日取餐号：从 1 递增 */
  private async nextTicketNo(
    orderRepo: Repository<Order>,
    shopId: number,
  ): Promise<number> {
    const date = todayKey();
    const last = await orderRepo
      .createQueryBuilder('o')
      .where('o.shop_id = :shopId', { shopId })
      .andWhere("strftime('%Y%m%d', o.created_at) = :date", { date })
      .orderBy('o.ticket_no', 'DESC')
      .getOne();
    return last ? (last.ticket_no || 0) + 1 : 1;
  }

  /** 结账 / 拒单 / 挂账后释放桌台 */
  private async releaseTable(manager: EntityManager, order: Order): Promise<void> {
    if (order.mode !== OrderMode.Table || !order.table_id) return;
    const tableRepo = manager.getRepository(Table);
    const table = await tableRepo.findOne({ where: { id: order.table_id } });
    if (table && table.shop_id === order.shop_id && table.status === TableStatus.Occupied) {
      table.status = TableStatus.Idle;
      await tableRepo.save(table);
    }
  }

  /** 订单转出参（reports 复用） */
  toItem(o: Order): OrderItem {
    let items: OrderItemSnapshot[] = [];
    try {
      const parsed = JSON.parse(o.items || '[]');
      if (Array.isArray(parsed)) {
        items = parsed.map((s) => ({
          dish_id: Number(s.dish_id) || 0,
          name: s.name ?? '',
          spec_name: s.spec_name ?? null,
          unit_price: centsToYuan(Number(s.unit_price) || 0),
          qty: Number(s.qty) || 0,
          amount: centsToYuan(Number(s.amount) || 0),
        }));
      }
    } catch {
      // 数据异常按空处理
    }
    return {
      id: o.id,
      order_no: o.order_no,
      mode: o.mode,
      table_id: o.table_id,
      ticket_no: o.ticket_no,
      status: o.status,
      items,
      total_amount: centsToYuan(o.total_amount),
      paid_amount: centsToYuan(o.paid_amount),
      change_amount: centsToYuan(o.change_amount),
      payment_method_id: o.payment_method_id,
      payment_method_name: o.payment_method_name,
      remark: o.remark,
      created_at: o.created_at,
      settled_at: o.settled_at,
    };
  }
}
