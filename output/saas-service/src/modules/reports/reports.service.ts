import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { OrderMode, OrderStatus } from '../../common/enums';
import { OperationLog } from '../../entities/operation-log.entity';
import { Order } from '../../entities/order.entity';
import { OrderRefund } from '../../entities/order-refund.entity';
import { Table } from '../../entities/table.entity';
import { OrdersService, OrderItemSnapshot } from '../orders/orders.service';

/** 敏感操作类型 → 中文名 */
export const ACTION_NAMES: Record<string, string> = {
  price_change: '改价',
  refund: '退菜',
  void_order: '作废订单',
  free_order: '免单',
  voucher: '优惠券核销',
};

/** 优惠类型 → 中文名 */
export const DISCOUNT_TYPE_NAMES: Record<string, string> = {
  discount: '折扣优惠',
  voucher: '优惠券',
  price_change: '改价',
  free: '免单',
};

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

export interface DishSalesRow {
  dish_id: number;
  name: string;
  spec_name: string | null;
  /** 单价（元） */
  unit_price: number;
  /** 销售数量 */
  qty: number;
  /** 销售金额（元） */
  amount: number;
  /** 出现订单数 */
  order_count: number;
  /** 数量占比 % */
  qty_ratio: number;
  /** 金额占比 % */
  amount_ratio: number;
}

export interface DishDetailRow {
  order_id: number;
  order_no: string;
  settled_at: Date | null;
  mode: string;
  table_name: string | null;
  ticket_no: number | null;
  name: string;
  spec_name: string | null;
  unit_price: number;
  qty: number;
  amount: number;
  payment_method_name: string | null;
}

export interface TableStatsRow {
  table_id: number;
  table_name: string;
  area: string;
  order_count: number;
  /** 营业额（元，实收） */
  revenue: number;
  /** 桌均（元） */
  avg_amount: number;
}

export interface CompareMetric {
  order_count: number;
  /** 营业额（元，实收） */
  revenue: number;
  /** 客单价（元） */
  avg_amount: number;
}

export interface CompareResult {
  from: string;
  to: string;
  prev_from: string;
  prev_to: string;
  current: CompareMetric;
  previous: CompareMetric;
  /** 环比变化率 %（可为负） */
  order_count_change: number;
  revenue_change: number;
  avg_amount_change: number;
}

export interface DiscountStatsRow {
  discount_type: string;
  discount_name: string;
  order_count: number;
  /** 优惠金额（元） */
  discount_amount: number;
  /** 金额占比 % */
  amount_ratio: number;
  /** 订单占比 % */
  order_ratio: number;
}

export interface PromoStatsRow {
  /** 活动名称 */
  name: string;
  /** 活动类型（优惠券 / 折扣优惠） */
  type: string;
  /** 优惠金额（元） */
  discount_amount: number;
  /** 参与订单数 */
  order_count: number;
  /** 赠送菜品数（订单快照暂未记录赠品标记，待模型扩展后填充） */
  gift_qty: number;
}

export interface DishRefundRow {
  dish_id: number;
  name: string;
  spec_name: string | null;
  /** 退菜时单价（元） */
  unit_price: number;
  /** 退菜数量 */
  qty: number;
  /** 退菜金额（元） */
  amount: number;
  /** 涉及订单数 */
  order_count: number;
  /** 数量占比 % */
  qty_ratio: number;
  /** 金额占比 % */
  amount_ratio: number;
}

export interface SensitiveRow {
  action: string;
  action_name: string;
  /** 操作次数 */
  count: number;
  /** 涉及金额（元） */
  amount: number;
  /** 次数占比 % */
  count_ratio: number;
}

export interface SensitiveDetailRow {
  id: number;
  time: Date;
  /** 操作人（手机号） */
  operator: string;
  action: string;
  action_name: string;
  target_type: string;
  target_id: number | null;
  /** 涉及金额（元） */
  amount: number;
  detail: string;
}

export interface CouponStatsRow {
  voucher_id: number;
  coupon_name: string;
  /** 核销数量 */
  redeem_count: number;
  /** 核销金额（元） */
  redeem_amount: number;
  /** 参与订单数 */
  order_count: number;
  /** 金额占比 % */
  amount_ratio: number;
}

export interface IncomeDiscountDetailRow {
  order_id: number;
  order_no: string;
  settled_at: Date | null;
  discount_type: string;
  discount_name: string;
  /** 优惠金额（元） */
  discount_amount: number;
  /** 订单金额（元） */
  total_amount: number;
  /** 实收金额（元） */
  paid_amount: number;
  payment_method_name: string | null;
  remark: string;
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

/** 解析 items JSON（保留原始分单位） */
function parseItemsRaw(raw: string): OrderItemSnapshot[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed)
      ? parsed.map((s) => ({
          dish_id: Number(s.dish_id) || 0,
          name: s.name ?? '',
          spec_name: s.spec_name ?? null,
          unit_price: Number(s.unit_price) || 0,
          qty: Number(s.qty) || 0,
          amount: Number(s.amount) || 0,
        }))
      : [];
  } catch {
    return [];
  }
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    @InjectRepository(OrderRefund)
    private readonly refundRepo: Repository<OrderRefund>,
    @InjectRepository(OperationLog)
    private readonly logRepo: Repository<OperationLog>,
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

  /** 按日营业统计：区间内每天一条（含空档日） */
  async daily(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<{
    from: string;
    to: string;
    items: {
      date: string;
      order_count: number;
      revenue: number;
      avg_amount: number;
      table_count: number;
    }[];
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.orderRepo.find({
      where: { shop_id: user.shopId, settled_at: Between(start, end) },
    });
    const completed = orders.filter((o) => o.status === OrderStatus.Completed);
    const map = new Map<
      string,
      { order_count: number; revenue: number; tables: Set<number> }
    >();
    for (const o of completed) {
      if (!o.settled_at) continue;
      const d = fmtDay(o.settled_at);
      const cur = map.get(d) ?? { order_count: 0, revenue: 0, tables: new Set<number>() };
      cur.order_count += 1;
      cur.revenue += o.paid_amount;
      if (o.table_id) cur.tables.add(o.table_id);
      map.set(d, cur);
    }
    const items: {
      date: string;
      order_count: number;
      revenue: number;
      avg_amount: number;
      table_count: number;
    }[] = [];
    const cursor = new Date(start);
    while (cursor < end) {
      const d = fmtDay(cursor);
      const cur = map.get(d);
      const revenue = cur ? cur.revenue / 100 : 0;
      items.push({
        date: d,
        order_count: cur ? cur.order_count : 0,
        revenue,
        avg_amount: cur && cur.order_count ? +((revenue / cur.order_count).toFixed(2)) : 0,
        table_count: cur ? cur.tables.size : 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return { from: fmtDay(start), to: fmtDay(new Date(end.getTime() - 1)), items };
  }

  /** 菜品销售统计：按菜品（含规格）聚合 */
  async dishSales(
    user: AuthUser,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 20,
    dishName?: string,
  ): Promise<{
    total: number;
    items: DishSalesRow[];
    summary: { total_qty: number; total_amount: number; order_count: number };
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.soldOrders(user, start, end);
    const map = new Map<
      string,
      {
        dish_id: number;
        name: string;
        spec_name: string | null;
        unit_price: number;
        qty: number;
        amount: number;
        order_count: number;
      }
    >();
    for (const o of orders) {
      for (const it of parseItemsRaw(o.items)) {
        if (dishName && !it.name.includes(dishName)) continue;
        const key = `${it.dish_id}|${it.spec_name ?? ''}`;
        const cur = map.get(key) ?? {
          dish_id: it.dish_id,
          name: it.name,
          spec_name: it.spec_name,
          unit_price: it.unit_price,
          qty: 0,
          amount: 0,
          order_count: 0,
        };
        cur.qty += it.qty;
        cur.amount += it.amount;
        cur.order_count += 1;
        map.set(key, cur);
      }
    }
    const list = [...map.values()].sort((a, b) => b.amount - a.amount);
    const totalQty = list.reduce((s, r) => s + r.qty, 0);
    const totalAmount = list.reduce((s, r) => s + r.amount, 0);
    const rows: DishSalesRow[] = list.map((r) => ({
      dish_id: r.dish_id,
      name: r.name,
      spec_name: r.spec_name,
      unit_price: r.unit_price / 100,
      qty: r.qty,
      amount: r.amount / 100,
      order_count: r.order_count,
      qty_ratio: totalQty ? +((r.qty / totalQty) * 100).toFixed(2) : 0,
      amount_ratio: totalAmount ? +((r.amount / totalAmount) * 100).toFixed(2) : 0,
    }));
    const startIdx = (page - 1) * pageSize;
    return {
      total: rows.length,
      items: rows.slice(startIdx, startIdx + pageSize),
      summary: {
        total_qty: totalQty,
        total_amount: totalAmount / 100,
        order_count: orders.length,
      },
    };
  }

  /** 菜品销售明细：订单 × 品项展开 */
  async dishDetail(
    user: AuthUser,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    total: number;
    items: DishDetailRow[];
    summary: { total_qty: number; total_amount: number };
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.soldOrders(user, start, end);
    const tableIds = [...new Set(orders.map((o) => o.table_id).filter((v): v is number => !!v))];
    const tables = tableIds.length ? await this.tableRepo.find({ where: { id: In(tableIds) } }) : [];
    const tmap = new Map(tables.map((t) => [t.id, t]));

    const rows: DishDetailRow[] = [];
    for (const o of orders) {
      const t = o.table_id ? tmap.get(o.table_id) : null;
      for (const it of parseItemsRaw(o.items)) {
        rows.push({
          order_id: o.id,
          order_no: o.order_no,
          settled_at: o.settled_at,
          mode: o.mode,
          table_name: t?.name ?? null,
          ticket_no: o.ticket_no,
          name: it.name,
          spec_name: it.spec_name,
          unit_price: it.unit_price / 100,
          qty: it.qty,
          amount: it.amount / 100,
          payment_method_name: o.payment_method_name,
        });
      }
    }
    rows.sort((a, b) => (b.settled_at?.getTime() ?? 0) - (a.settled_at?.getTime() ?? 0));
    const startIdx = (page - 1) * pageSize;
    return {
      total: rows.length,
      items: rows.slice(startIdx, startIdx + pageSize),
      summary: {
        total_qty: rows.reduce((s, r) => s + r.qty, 0),
        total_amount: +rows.reduce((s, r) => s + r.amount, 0).toFixed(2),
      },
    };
  }

  /** 餐区 / 桌台营业统计：已结账桌台订单按桌台聚合 */
  async tableStats(
    user: AuthUser,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 20,
    area?: string,
  ): Promise<{
    total: number;
    items: TableStatsRow[];
    summary: { order_count: number; revenue: number };
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.orderRepo.find({
      where: {
        shop_id: user.shopId,
        settled_at: Between(start, end),
        status: OrderStatus.Completed,
        mode: OrderMode.Table,
      },
    });
    const tableIds = [...new Set(orders.map((o) => o.table_id).filter((v): v is number => !!v))];
    const tables = tableIds.length ? await this.tableRepo.find({ where: { id: In(tableIds) } }) : [];
    const tmap = new Map(tables.map((t) => [t.id, t]));

    const map = new Map<
      number,
      { table_id: number; table_name: string; area: string; order_count: number; revenue: number }
    >();
    for (const o of orders) {
      const t = o.table_id ? tmap.get(o.table_id) : null;
      const key = o.table_id ?? 0;
      const cur = map.get(key) ?? {
        table_id: key,
        table_name: t?.name ?? '未关联桌台',
        area: t?.area ?? '—',
        order_count: 0,
        revenue: 0,
      };
      cur.order_count += 1;
      cur.revenue += o.paid_amount;
      map.set(key, cur);
    }
    let list = [...map.values()];
    if (area && area !== 'all') list = list.filter((r) => r.area === area);
    list.sort((a, b) => b.revenue - a.revenue);

    const rows: TableStatsRow[] = list.map((r) => ({
      table_id: r.table_id,
      table_name: r.table_name,
      area: r.area,
      order_count: r.order_count,
      revenue: r.revenue / 100,
      avg_amount: r.order_count ? +(r.revenue / 100 / r.order_count).toFixed(2) : 0,
    }));
    const startIdx = (page - 1) * pageSize;
    return {
      total: rows.length,
      items: rows.slice(startIdx, startIdx + pageSize),
      summary: {
        order_count: rows.reduce((s, r) => s + r.order_count, 0),
        revenue: +rows.reduce((s, r) => s + r.revenue, 0).toFixed(2),
      },
    };
  }

  /** 营业指标同环比：当期 vs 上一同长区间 */
  async compare(user: AuthUser, from?: string, to?: string): Promise<CompareResult> {
    const { start, end } = dayRange(from, to);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const prevEnd = start;
    const prevStart = new Date(start.getTime() - days * 86400000);
    const current = await this.metricsBetween(user, start, end);
    const previous = await this.metricsBetween(user, prevStart, prevEnd);
    const change = (cur: number, pre: number) =>
      pre > 0 ? +(((cur - pre) / pre) * 100).toFixed(2) : cur > 0 ? 100 : 0;
    return {
      from: fmtDay(start),
      to: fmtDay(new Date(end.getTime() - 1)),
      prev_from: fmtDay(prevStart),
      prev_to: fmtDay(new Date(prevEnd.getTime() - 1)),
      current,
      previous,
      order_count_change: change(current.order_count, previous.order_count),
      revenue_change: change(current.revenue, previous.revenue),
      avg_amount_change: change(current.avg_amount, previous.avg_amount),
    };
  }

  /** 促销活动统计：按活动名称聚合（优惠券 / 折扣优惠；改价、免单不属于促销活动） */
  async promoStats(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<{
    total: number;
    items: PromoStatsRow[];
    summary: { promo_count: number; discount_amount: number; order_count: number };
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.orderRepo.find({
      where: {
        shop_id: user.shopId,
        settled_at: Between(start, end),
        status: OrderStatus.Completed,
      },
    });
    const map = new Map<
      string,
      { name: string; type: string; order_count: number; amount: number }
    >();
    for (const o of orders) {
      if (!o.discount_amount || !o.discount_name) continue;
      if (o.discount_type !== 'voucher' && o.discount_type !== 'discount') continue;
      const cur =
        map.get(o.discount_name) ?? {
          name: o.discount_name,
          type: DISCOUNT_TYPE_NAMES[o.discount_type || ''] ?? '促销活动',
          order_count: 0,
          amount: 0,
        };
      cur.order_count += 1;
      cur.amount += o.discount_amount;
      map.set(o.discount_name, cur);
    }
    const list = [...map.values()].sort((a, b) => b.amount - a.amount);
    const totalAmount = list.reduce((s, r) => s + r.amount, 0);
    const totalOrders = list.reduce((s, r) => s + r.order_count, 0);
    const rows: PromoStatsRow[] = list.map((r) => ({
      name: r.name,
      type: r.type,
      discount_amount: r.amount / 100,
      order_count: r.order_count,
      gift_qty: 0,
    }));
    return {
      total: rows.length,
      items: rows,
      summary: {
        promo_count: rows.length,
        discount_amount: totalAmount / 100,
        order_count: totalOrders,
      },
    };
  }

  /** 菜品优惠统计：按优惠类型聚合优惠金额（与收入优惠统计同源） */
  async dishDiscountStats(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<{
    total: number;
    items: DiscountStatsRow[];
    summary: { discount_amount: number; order_count: number };
  }> {
    return this.discountStats(user, from, to);
  }

  /** 收入优惠统计：按优惠类型聚合优惠金额与订单数 */
  async incomeDiscountStats(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<{
    total: number;
    items: DiscountStatsRow[];
    summary: { discount_amount: number; order_count: number };
  }> {
    return this.discountStats(user, from, to);
  }

  /** 菜品退菜统计：按菜品（含规格）聚合退菜数量与金额 */
  async dishRefundStats(
    user: AuthUser,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 20,
  ): Promise<{
    total: number;
    items: DishRefundRow[];
    summary: { total_qty: number; total_amount: number; refund_count: number };
  }> {
    const { start, end } = dayRange(from, to);
    const refunds = await this.refundRepo.find({
      where: { shop_id: user.shopId, refunded_at: Between(start, end) },
    });
    const map = new Map<
      string,
      { dish_id: number; name: string; spec_name: string | null; unit_price: number; qty: number; amount: number; order_count: number }
    >();
    for (const r of refunds) {
      const key = `${r.dish_id}|${r.spec_name ?? ''}`;
      const cur = map.get(key) ?? {
        dish_id: r.dish_id,
        name: r.name,
        spec_name: r.spec_name,
        unit_price: r.unit_price,
        qty: 0,
        amount: 0,
        order_count: 0,
      };
      cur.qty += r.qty;
      cur.amount += r.amount;
      cur.order_count += 1;
      map.set(key, cur);
    }
    const list = [...map.values()].sort((a, b) => b.amount - a.amount);
    const totalQty = list.reduce((s, r) => s + r.qty, 0);
    const totalAmount = list.reduce((s, r) => s + r.amount, 0);
    const rows: DishRefundRow[] = list.map((r) => ({
      dish_id: r.dish_id,
      name: r.name,
      spec_name: r.spec_name,
      unit_price: r.unit_price / 100,
      qty: r.qty,
      amount: r.amount / 100,
      order_count: r.order_count,
      qty_ratio: totalQty ? +((r.qty / totalQty) * 100).toFixed(2) : 0,
      amount_ratio: totalAmount ? +((r.amount / totalAmount) * 100).toFixed(2) : 0,
    }));
    const startIdx = (page - 1) * pageSize;
    return {
      total: rows.length,
      items: rows.slice(startIdx, startIdx + pageSize),
      summary: {
        total_qty: totalQty,
        total_amount: totalAmount / 100,
        refund_count: refunds.length,
      },
    };
  }

  /** 敏感操作统计：按操作类型聚合次数与涉及金额 */
  async sensitiveStats(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<{
    total: number;
    items: SensitiveRow[];
    summary: { total_count: number; total_amount: number };
  }> {
    const { start, end } = dayRange(from, to);
    const logs = await this.logRepo.find({
      where: { shop_id: user.shopId, created_at: Between(start, end) },
    });
    const map = new Map<string, { action: string; count: number; amount: number }>();
    for (const l of logs) {
      const cur = map.get(l.action) ?? { action: l.action, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += l.amount;
      map.set(l.action, cur);
    }
    const list = [...map.values()].sort((a, b) => b.count - a.count);
    const totalCount = list.reduce((s, r) => s + r.count, 0);
    const totalAmount = list.reduce((s, r) => s + r.amount, 0);
    const rows: SensitiveRow[] = list.map((r) => ({
      action: r.action,
      action_name: ACTION_NAMES[r.action] ?? r.action,
      count: r.count,
      amount: r.amount / 100,
      count_ratio: totalCount ? +((r.count / totalCount) * 100).toFixed(2) : 0,
    }));
    return {
      total: rows.length,
      items: rows,
      summary: { total_count: totalCount, total_amount: totalAmount / 100 },
    };
  }

  /** 敏感操作明细：逐条分页 */
  async sensitiveDetail(
    user: AuthUser,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 20,
    action?: string,
  ): Promise<{
    total: number;
    items: SensitiveDetailRow[];
    summary: { total_count: number; total_amount: number };
  }> {
    const { start, end } = dayRange(from, to);
    const logs = await this.logRepo.find({
      where: { shop_id: user.shopId, created_at: Between(start, end) },
      order: { id: 'DESC' },
    });
    let rows: SensitiveDetailRow[] = logs.map((l) => ({
      id: l.id,
      time: l.created_at,
      operator: l.user_name,
      action: l.action,
      action_name: ACTION_NAMES[l.action] ?? l.action,
      target_type: l.target_type,
      target_id: l.target_id,
      amount: l.amount / 100,
      detail: l.detail,
    }));
    if (action && action !== 'all') rows = rows.filter((r) => r.action === action);
    const startIdx = (page - 1) * pageSize;
    return {
      total: rows.length,
      items: rows.slice(startIdx, startIdx + pageSize),
      summary: {
        total_count: rows.length,
        total_amount: +rows.reduce((s, r) => s + r.amount, 0).toFixed(2),
      },
    };
  }

  /** 券收入统计：按券聚合核销数量与核销金额 */
  async incomeCouponStats(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<{
    total: number;
    items: CouponStatsRow[];
    summary: { redeem_count: number; redeem_amount: number; order_count: number };
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.orderRepo.find({
      where: { shop_id: user.shopId, settled_at: Between(start, end), status: OrderStatus.Completed },
    });
    const map = new Map<
      number,
      { voucher_id: number; coupon_name: string; redeem_count: number; redeem_amount: number; order_count: number }
    >();
    for (const o of orders) {
      if (o.voucher_id === null || o.voucher_id === undefined) continue;
      const cur = map.get(o.voucher_id) ?? {
        voucher_id: o.voucher_id,
        coupon_name: o.discount_name || '优惠券',
        redeem_count: 0,
        redeem_amount: 0,
        order_count: 0,
      };
      cur.redeem_count += 1;
      cur.redeem_amount += o.discount_amount || 0;
      cur.order_count += 1;
      map.set(o.voucher_id, cur);
    }
    const list = [...map.values()].sort((a, b) => b.redeem_amount - a.redeem_amount);
    const totalRedeem = list.reduce((s, r) => s + r.redeem_count, 0);
    const totalAmount = list.reduce((s, r) => s + r.redeem_amount, 0);
    const rows: CouponStatsRow[] = list.map((r) => ({
      voucher_id: r.voucher_id,
      coupon_name: r.coupon_name,
      redeem_count: r.redeem_count,
      redeem_amount: r.redeem_amount / 100,
      order_count: r.order_count,
      amount_ratio: totalAmount ? +((r.redeem_amount / totalAmount) * 100).toFixed(2) : 0,
    }));
    return {
      total: rows.length,
      items: rows,
      summary: {
        redeem_count: totalRedeem,
        redeem_amount: totalAmount / 100,
        order_count: orders.filter((o) => o.voucher_id !== null).length,
      },
    };
  }

  /** 收入优惠明细：逐笔订单优惠记录分页 */
  async incomeDiscountDetail(
    user: AuthUser,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 20,
    discountType?: string,
  ): Promise<{
    total: number;
    items: IncomeDiscountDetailRow[];
    summary: { discount_amount: number; order_count: number };
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.orderRepo.find({
      where: { shop_id: user.shopId, settled_at: Between(start, end), status: OrderStatus.Completed },
    });
    let rows: IncomeDiscountDetailRow[] = orders
      .filter((o) => (o.discount_amount || 0) > 0)
      .map((o) => ({
        order_id: o.id,
        order_no: o.order_no,
        settled_at: o.settled_at,
        discount_type: o.discount_type || '',
        discount_name: o.discount_name || DISCOUNT_TYPE_NAMES[o.discount_type || ''] || '其他优惠',
        discount_amount: (o.discount_amount || 0) / 100,
        total_amount: o.total_amount / 100,
        paid_amount: o.paid_amount / 100,
        payment_method_name: o.payment_method_name,
        remark: o.remark,
      }));
    if (discountType && discountType !== 'all') {
      rows = rows.filter((r) => r.discount_type === discountType);
    }
    rows.sort((a, b) => (b.settled_at?.getTime() ?? 0) - (a.settled_at?.getTime() ?? 0));
    const startIdx = (page - 1) * pageSize;
    return {
      total: rows.length,
      items: rows.slice(startIdx, startIdx + pageSize),
      summary: {
        discount_amount: +rows.reduce((s, r) => s + r.discount_amount, 0).toFixed(2),
        order_count: rows.length,
      },
    };
  }

  /** 日期范围订单明细（已结账 + 挂账），支持状态 / 结账方式 / 桌台 / 关键字过滤 */
  async orderList(
    user: AuthUser,
    from: string | undefined,
    to: string | undefined,
    page: number,
    pageSize: number,
    status?: string,
    method?: string,
    tableName?: string,
    keyword?: string,
  ): Promise<{ total: number; items: ReturnType<OrdersService['toItem']>[] }> {
    const { start, end } = dayRange(from, to);
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoin(Table, 't', 't.id = o.table_id')
      .where('o.shop_id = :shopId', { shopId: user.shopId })
      .andWhere('o.settled_at >= :start', { start })
      .andWhere('o.settled_at < :end', { end })
      .andWhere('o.status IN (:...statuses)', {
        statuses: [OrderStatus.Completed, OrderStatus.OnAccount],
      });
    if (status === 'completed') {
      qb.andWhere('o.status = :st', { st: OrderStatus.Completed });
    } else if (status === 'on_account') {
      qb.andWhere('o.status = :st', { st: OrderStatus.OnAccount });
    }
    if (method) qb.andWhere('o.payment_method_name = :method', { method });
    if (tableName) qb.andWhere('t.name LIKE :tn', { tn: `%${tableName}%` });
    if (keyword) qb.andWhere('(o.order_no LIKE :kw OR o.remark LIKE :kw)', { kw: `%${keyword}%` });
    qb.orderBy('o.settled_at', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    const tableIds = [...new Set(items.map((o) => o.table_id).filter((v): v is number => !!v))];
    const tables = tableIds.length ? await this.tableRepo.find({ where: { id: In(tableIds) } }) : [];
    const tmap = new Map(tables.map((t) => [t.id, t.name]));
    return {
      total,
      items: items.map((o) => {
        const item = this.ordersService.toItem(o);
        return { ...item, table_name: o.table_id ? tmap.get(o.table_id) ?? null : null };
      }),
    };
  }

  // ---------- 私有 ----------

  /** 优惠聚合（按优惠类型）：收入优惠统计 / 菜品优惠统计同源 */
  private async discountStats(
    user: AuthUser,
    from?: string,
    to?: string,
  ): Promise<{
    total: number;
    items: DiscountStatsRow[];
    summary: { discount_amount: number; order_count: number };
  }> {
    const { start, end } = dayRange(from, to);
    const orders = await this.orderRepo.find({
      where: { shop_id: user.shopId, settled_at: Between(start, end), status: OrderStatus.Completed },
    });
    const map = new Map<
      string,
      { discount_type: string; discount_name: string; order_count: number; amount: number }
    >();
    for (const o of orders) {
      if (!o.discount_amount || !o.discount_type) continue;
      const type = o.discount_type;
      const cur = map.get(type) ?? {
        discount_type: type,
        discount_name: o.discount_name || DISCOUNT_TYPE_NAMES[type] || '其他优惠',
        order_count: 0,
        amount: 0,
      };
      cur.order_count += 1;
      cur.amount += o.discount_amount;
      map.set(type, cur);
    }
    const list = [...map.values()].sort((a, b) => b.amount - a.amount);
    const totalAmount = list.reduce((s, r) => s + r.amount, 0);
    const totalOrders = list.reduce((s, r) => s + r.order_count, 0);
    const rows: DiscountStatsRow[] = list.map((r) => ({
      discount_type: r.discount_type,
      discount_name: r.discount_name,
      order_count: r.order_count,
      discount_amount: r.amount / 100,
      amount_ratio: totalAmount ? +((r.amount / totalAmount) * 100).toFixed(2) : 0,
      order_ratio: totalOrders ? +((r.order_count / totalOrders) * 100).toFixed(2) : 0,
    }));
    return {
      total: rows.length,
      items: rows,
      summary: {
        discount_amount: totalAmount / 100,
        order_count: totalOrders,
      },
    };
  }

  /** 看账口径销售订单：已结账 + 挂账 */
  private async soldOrders(user: AuthUser, start: Date, end: Date): Promise<Order[]> {
    return this.orderRepo.find({
      where: {
        shop_id: user.shopId,
        settled_at: Between(start, end),
        status: In([OrderStatus.Completed, OrderStatus.OnAccount]),
      },
    });
  }

  /** 已结账订单核心指标 */
  private async metricsBetween(user: AuthUser, start: Date, end: Date): Promise<CompareMetric> {
    const orders = await this.orderRepo.find({
      where: { shop_id: user.shopId, settled_at: Between(start, end), status: OrderStatus.Completed },
    });
    const orderCount = orders.length;
    const revenue = orders.reduce((s, o) => s + o.paid_amount, 0) / 100;
    return {
      order_count: orderCount,
      revenue: +revenue.toFixed(2),
      avg_amount: orderCount ? +(revenue / orderCount).toFixed(2) : 0,
    };
  }

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
