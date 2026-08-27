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
import { OperationLog, SensitiveAction } from '../../entities/operation-log.entity';
import { Order } from '../../entities/order.entity';
import { OrderRefund } from '../../entities/order-refund.entity';
import { PaymentMethod } from '../../entities/payment-method.entity';
import { Table } from '../../entities/table.entity';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
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
  /** 优惠金额（元） */
  discount_amount: number;
  /** 优惠类型：discount / voucher / price_change */
  discount_type: string | null;
  /** 优惠名称 */
  discount_name: string | null;
  /** 关联优惠券 id */
  voucher_id: number | null;
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
      await this.writeLog(
        manager,
        user,
        SensitiveAction.VoidOrder,
        order.id,
        order.total_amount,
        `拒单作废 ¥${centsToYuan(order.total_amount)}`,
      );
      return this.toItem(order);
    });
  }

  /**
   * 结账记账（pending / confirmed / on_account → completed）
   * - 校验结账方式（本店启用中）
   * - 实收缺省 = 应付 - 优惠；大于应收自动记找零；小于应收按实收记账
   * - 优惠：传 discount_amount 时记录优惠（折扣 / 券）；未传但少收视为改价
   * - 优惠 / 改价记敏感操作日志
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

      const total = order.total_amount;
      let paid =
        dto.paid_amount !== undefined
          ? yuanToCents(dto.paid_amount)
          : total;
      let discount = 0;
      let discountType: string | null = null;
      let discountName: string | null = null;
      let voucherId: number | null = null;

      if (dto.discount_amount !== undefined) {
        discount = Math.min(Math.max(0, Math.round(dto.discount_amount * 100)), total);
        discountType = dto.discount_type || 'discount';
        discountName = dto.discount_name || null;
        voucherId = dto.voucher_id ?? null;
        if (dto.paid_amount === undefined) paid = Math.max(0, total - discount);
      } else if (dto.paid_amount !== undefined && paid < total) {
        // 未声明优惠但少收 → 视为改价
        discount = total - paid;
        discountType = 'price_change';
        discountName = '改价';
      }

      order.status = OrderStatus.Completed;
      order.paid_amount = paid;
      order.discount_amount = discount;
      order.discount_type = discountType;
      order.discount_name = discountName;
      order.voucher_id = voucherId;
      order.change_amount = Math.max(0, paid - (total - discount));
      order.payment_method_id = pay.id;
      order.payment_method_name = pay.name;
      if (dto.remark !== undefined) order.remark = dto.remark;
      order.settled_at = new Date();
      await orderRepo.save(order);
      await this.releaseTable(manager, order);

      // 敏感操作日志：优惠券核销 / 改价优惠
      if (discount > 0) {
        if (discountType === 'voucher') {
          await this.writeLog(
            manager,
            user,
            SensitiveAction.Voucher,
            order.id,
            discount,
            `优惠券核销${discountName ? `-${discountName}` : ''}，优惠 ¥${centsToYuan(discount)}`,
          );
        } else {
          await this.writeLog(
            manager,
            user,
            SensitiveAction.PriceChange,
            order.id,
            discount,
            `${discountName || '改价'}，优惠 ¥${centsToYuan(discount)}`,
          );
        }
      }
      return this.toItem(order);
    });
  }

  /**
   * 退菜（订单内菜品退款）
   * - 扣减订单菜品快照数量 / 金额，同步扣减应付与实收
   * - 记录退菜明细 + 敏感操作日志
   * - void 订单不可退菜；其余状态均可
   */
  async refund(user: AuthUser, id: number, dto: RefundOrderDto): Promise<OrderItem> {
    if (!dto.items || dto.items.length === 0) {
      throw new BusinessException('请选择要退的菜品');
    }
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const refundRepo = manager.getRepository(OrderRefund);
      const order = await this.findInShop(orderRepo, user, id);
      if (order.status === OrderStatus.Void) {
        throw new BusinessException('已作废订单不可退菜');
      }

      const snap: OrderItemSnapshot[] = JSON.parse(order.items || '[]');
      const refundRows: OrderRefund[] = [];
      let refundTotal = 0;

      for (const it of dto.items) {
        const line = snap.find(
          (s) =>
            s.dish_id === it.dish_id &&
            ((it.spec_name && s.spec_name === it.spec_name) ||
              (!it.spec_name && !s.spec_name)),
        );
        if (!line) {
          throw new BusinessException('退菜项不存在于订单中');
        }
        if (it.qty > line.qty) {
          throw new BusinessException(`「${line.name}」可退数量不足`);
        }
        line.qty -= it.qty;
        line.amount -= line.unit_price * it.qty;
        const amount = line.unit_price * it.qty;
        refundTotal += amount;
        refundRows.push(
          refundRepo.create({
            shop_id: user.shopId,
            order_id: order.id,
            order_no: order.order_no,
            dish_id: it.dish_id,
            name: line.name,
            spec_name: line.spec_name,
            unit_price: line.unit_price,
            qty: it.qty,
            amount,
            reason: it.reason || dto.reason || '',
            operator_id: user.userId,
            operator_name: user.phone,
          }),
        );
      }

      order.items = JSON.stringify(snap.filter((s) => s.qty > 0));
      order.total_amount = Math.max(0, order.total_amount - refundTotal);
      order.paid_amount = Math.max(0, order.paid_amount - refundTotal);
      await orderRepo.save(order);
      await refundRepo.save(refundRows);

      await this.writeLog(
        manager,
        user,
        SensitiveAction.Refund,
        order.id,
        refundTotal,
        `退菜 ${refundRows.length} 项，退款 ¥${centsToYuan(refundTotal)}`,
      );
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
      order.discount_amount = order.total_amount;
      order.discount_type = 'free';
      order.discount_name = '免单';
      order.change_amount = 0;
      order.payment_method_id = null;
      order.payment_method_name = '免单';
      order.settled_at = new Date();
      await orderRepo.save(order);
      await this.releaseTable(manager, order);
      await this.writeLog(
        manager,
        user,
        SensitiveAction.FreeOrder,
        order.id,
        order.total_amount,
        `整单免单 ¥${centsToYuan(order.total_amount)}`,
      );
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
      discount_amount: centsToYuan(o.discount_amount || 0),
      discount_type: o.discount_type,
      discount_name: o.discount_name,
      voucher_id: o.voucher_id,
      payment_method_id: o.payment_method_id,
      payment_method_name: o.payment_method_name,
      remark: o.remark,
      created_at: o.created_at,
      settled_at: o.settled_at,
    };
  }

  /** 写敏感操作日志（事务内） */
  private async writeLog(
    manager: EntityManager,
    user: AuthUser,
    action: SensitiveAction,
    targetId: number | null,
    amount: number,
    detail: string,
  ): Promise<void> {
    const repo = manager.getRepository(OperationLog);
    await repo.save(
      repo.create({
        shop_id: user.shopId,
        user_id: user.userId,
        user_name: user.phone,
        action,
        target_type: 'order',
        target_id: targetId,
        amount,
        detail,
      }),
    );
  }
}
