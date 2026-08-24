import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { OrderStatus } from '../../common/enums';
import { Order } from '../../entities/order.entity';
import { OrdersService } from '../orders/orders.service';

export interface MethodSummary {
  name: string;
  order_count: number;
  /** 实收金额（元） */
  amount: number;
}

export interface ReportSummary {
  /** 起止日期 YYYY-MM-DD */
  from: string;
  to: string;
  /** 已结账订单数 */
  order_count: number;
  /** 营业额 = 已结账实收之和（元）；免单实收 0 不计入 */
  revenue: number;
  /** 挂账待收（元） */
  pending_receivable: number;
  /** 按结账方式汇总 */
  methods: MethodSummary[];
}

/** 'YYYY-MM-DD' → 当日 00:00 与次日 00:00（本地时区） */
function dayRange(from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (from) {
    const [y, m, d] = from.split('-').map(Number);
    start = new Date(y, m - 1, d);
  }
  if (to) {
    const [y, m, d] = to.split('-').map(Number);
    end = new Date(y, m - 1, d + 1);
  }
  return { start, end };
}

function fmtDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly ordersService: OrdersService,
  ) {}

  /** 今日概览 */
  async today(user: AuthUser): Promise<ReportSummary> {
    const { start, end } = dayRange();
    return this.summaryBetween(user, start, end);
  }

  /** 日期范围营业汇总 */
  async summary(user: AuthUser, from?: string, to?: string): Promise<ReportSummary> {
    const { start, end } = dayRange(from, to);
    return this.summaryBetween(user, start, end);
  }

  /** 日期范围订单明细（已结账 + 挂账） */
  async orderList(
    user: AuthUser,
    from: string | undefined,
    to: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ total: number; items: ReturnType<OrdersService['toItem']>[] }> {
    const { start, end } = dayRange(from, to);
    const [items, total] = await this.orderRepo.findAndCount({
      where: {
        shop_id: user.shopId,
        settled_at: Between(start, end),
        status: In([OrderStatus.Completed, OrderStatus.OnAccount]),
      },
      order: { settled_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { total, items: items.map((o) => this.ordersService.toItem(o)) };
  }

  // ---------- 私有 ----------

  private async summaryBetween(
    user: AuthUser,
    start: Date,
    end: Date,
  ): Promise<ReportSummary> {
    const orders = await this.orderRepo.find({
      where: { shop_id: user.shopId, settled_at: Between(start, end) },
    });
    const completed = orders.filter((o) => o.status === OrderStatus.Completed);
    const onAccount = orders.filter((o) => o.status === OrderStatus.OnAccount);

    const revenue = completed.reduce((sum, o) => sum + o.paid_amount, 0);
    const pendingReceivable = onAccount.reduce(
      (sum, o) => sum + o.total_amount,
      0,
    );

    const methodMap = new Map<string, { name: string; count: number; amount: number }>();
    for (const o of completed) {
      const name = o.payment_method_name || '未知';
      const cur = methodMap.get(name) ?? { name, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += o.paid_amount;
      methodMap.set(name, cur);
    }
    const methods: MethodSummary[] = [...methodMap.values()].map((m) => ({
      name: m.name,
      order_count: m.count,
      amount: m.amount / 100,
    }));

    return {
      from: fmtDay(start),
      to: fmtDay(new Date(end.getTime() - 1)),
      order_count: completed.length,
      revenue: revenue / 100,
      pending_receivable: pendingReceivable / 100,
      methods,
    };
  }
}
