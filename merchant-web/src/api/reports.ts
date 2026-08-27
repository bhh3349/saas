import { request } from './http';

// ---------- 公共 ----------

export interface MethodSummary {
  name: string;
  order_count: number;
  /** 实收金额（元） */
  amount: number;
}

export interface ReportSummary {
  from: string;
  to: string;
  order_count: number;
  revenue: number;
  pending_receivable: number;
  methods: MethodSummary[];
}

/** 默认最近 7 天（含今天） */
export function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = now;
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
  };
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'all') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ---------- 按日营业统计 ----------

export interface DailyReportRow {
  date: string;
  order_count: number;
  revenue: number;
  avg_amount: number;
  table_count: number;
}

export interface DailyReportResult {
  from: string;
  to: string;
  items: DailyReportRow[];
}

export function fetchDailyReport(params: {
  from?: string;
  to?: string;
}): Promise<DailyReportResult> {
  return request<DailyReportResult>(`/reports/daily${qs(params)}`);
}

// ---------- 菜品销售统计 ----------

export interface DishSalesRow {
  dish_id: number;
  name: string;
  spec_name: string | null;
  unit_price: number;
  qty: number;
  amount: number;
  order_count: number;
  qty_ratio: number;
  amount_ratio: number;
}

export interface DishSalesResult {
  total: number;
  items: DishSalesRow[];
  summary: { total_qty: number; total_amount: number; order_count: number };
}

export function fetchDishSales(params: {
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  dish_name?: string;
}): Promise<DishSalesResult> {
  return request<DishSalesResult>(`/reports/dish-sales${qs(params)}`);
}

// ---------- 菜品销售明细 ----------

export interface DishDetailRow {
  order_id: number;
  order_no: string;
  settled_at: string;
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

export interface DishDetailResult {
  total: number;
  items: DishDetailRow[];
  summary: { total_qty: number; total_amount: number };
}

export function fetchDishDetail(params: {
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}): Promise<DishDetailResult> {
  return request<DishDetailResult>(`/reports/dish-detail${qs(params)}`);
}

// ---------- 餐区 / 桌台营业统计 ----------

export interface TableStatsRow {
  table_id: number;
  table_name: string;
  area: string;
  order_count: number;
  revenue: number;
  avg_amount: number;
}

export interface TableStatsResult {
  total: number;
  items: TableStatsRow[];
  summary: { order_count: number; revenue: number };
}

export function fetchTableStats(params: {
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  area?: string;
}): Promise<TableStatsResult> {
  return request<TableStatsResult>(`/reports/table-stats${qs(params)}`);
}

// ---------- 营业指标同环比 ----------

export interface CompareMetric {
  order_count: number;
  revenue: number;
  avg_amount: number;
}

export interface CompareData {
  from: string;
  to: string;
  prev_from: string;
  prev_to: string;
  current: CompareMetric;
  previous: CompareMetric;
  order_count_change: number;
  revenue_change: number;
  avg_amount_change: number;
}

export function fetchCompare(params: {
  from?: string;
  to?: string;
}): Promise<CompareData> {
  return request<CompareData>(`/reports/compare${qs(params)}`);
}

// ---------- 促销活动统计（数据模型扩展后填充） ----------

export interface PromoStatsResult {
  total: number;
  items: never[];
  summary: { promo_count: number; discount_amount: number; order_count: number };
}

export function fetchPromoStats(params: {
  from?: string;
  to?: string;
}): Promise<PromoStatsResult> {
  return request<PromoStatsResult>(`/reports/promo-stats${qs(params)}`);
}

// ---------- 店内订单明细 ----------

export interface OrderItemSnapshot {
  dish_id: number;
  name: string;
  spec_name: string | null;
  unit_price: number;
  qty: number;
  amount: number;
}

export interface OrderRow {
  id: number;
  order_no: string;
  mode: string;
  table_id: number | null;
  table_name: string | null;
  ticket_no: number | null;
  status: string;
  items: OrderItemSnapshot[];
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  payment_method_id: number | null;
  payment_method_name: string | null;
  remark: string | null;
  created_at: string;
  settled_at: string | null;
}

export interface OrdersResult {
  total: number;
  items: OrderRow[];
}

export function fetchOrders(params: {
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  status?: string;
  method?: string;
  table_name?: string;
  keyword?: string;
}): Promise<OrdersResult> {
  return request<OrdersResult>(`/reports/orders${qs(params)}`);
}

/** 日期范围营业汇总（今日 / 区间） */
export function fetchReportSummary(params: {
  from?: string;
  to?: string;
}): Promise<ReportSummary> {
  return request<ReportSummary>(`/reports/summary${qs(params)}`);
}

// ---------- 菜品优惠统计（按优惠类型聚合） ----------

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

export interface DiscountStatsResult {
  total: number;
  items: DiscountStatsRow[];
  summary: { discount_amount: number; order_count: number };
}

export function fetchDishDiscount(params: {
  from?: string;
  to?: string;
}): Promise<DiscountStatsResult> {
  return request<DiscountStatsResult>(`/reports/dish-discount${qs(params)}`);
}

// ---------- 菜品退菜统计 ----------

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

export interface DishRefundResult {
  total: number;
  items: DishRefundRow[];
  summary: { total_qty: number; total_amount: number; refund_count: number };
}

export function fetchDishRefund(params: {
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}): Promise<DishRefundResult> {
  return request<DishRefundResult>(`/reports/dish-refund${qs(params)}`);
}

// ---------- 敏感操作统计 / 明细 ----------

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

export interface SensitiveStatsResult {
  total: number;
  items: SensitiveRow[];
  summary: { total_count: number; total_amount: number };
}

export function fetchSensitiveStats(params: {
  from?: string;
  to?: string;
}): Promise<SensitiveStatsResult> {
  return request<SensitiveStatsResult>(`/reports/sensitive-stats${qs(params)}`);
}

export interface SensitiveDetailRow {
  id: number;
  time: string;
  operator: string;
  action: string;
  action_name: string;
  target_type: string;
  target_id: number | null;
  /** 涉及金额（元） */
  amount: number;
  detail: string;
}

export interface SensitiveDetailResult {
  total: number;
  items: SensitiveDetailRow[];
  summary: { total_count: number; total_amount: number };
}

export function fetchSensitiveDetail(params: {
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  keyword?: string;
}): Promise<SensitiveDetailResult> {
  return request<SensitiveDetailResult>(`/reports/sensitive-detail${qs(params)}`);
}

// ---------- 收入优惠统计 ----------

export function fetchIncomeDiscount(params: {
  from?: string;
  to?: string;
}): Promise<DiscountStatsResult> {
  return request<DiscountStatsResult>(`/reports/income-discount${qs(params)}`);
}

// ---------- 券收入统计 ----------

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

export interface CouponStatsResult {
  total: number;
  items: CouponStatsRow[];
  summary: { redeem_count: number; redeem_amount: number; order_count: number };
}

export function fetchIncomeCoupon(params: {
  from?: string;
  to?: string;
}): Promise<CouponStatsResult> {
  return request<CouponStatsResult>(`/reports/income-coupon${qs(params)}`);
}

// ---------- 收入优惠明细 ----------

export interface IncomeDiscountDetailRow {
  order_id: number;
  order_no: string;
  settled_at: string;
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

export interface IncomeDiscountDetailResult {
  total: number;
  items: IncomeDiscountDetailRow[];
  summary: { discount_amount: number; order_count: number };
}

export function fetchIncomeDiscountDetail(params: {
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  keyword?: string;
}): Promise<IncomeDiscountDetailResult> {
  return request<IncomeDiscountDetailResult>(`/reports/income-discount-detail${qs(params)}`);
}
