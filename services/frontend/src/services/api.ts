const API_BASE = '/api'

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`)

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json()
}

/* =========================
   Batch Layer Types
   ========================= */

export interface DailyRevenue {
  order_date: string
  order_count: number
  revenue: number
  units_sold: number
}

export interface TopProduct {
  product_id: number
  product_name: string
  category: string
  units_sold: number
  revenue: number
}

export interface CustomerSummary {
  customer_count: number
  total_orders: number
  total_revenue: number
  total_units: number
  average_customer_spend: number
  average_orders_per_customer: number
}

export interface CustomerMetric {
  customer_id: number
  full_name: string
  email: string
  country: string
  region: string
  order_count: number
  total_order_value: number
  total_units_sold: number
  first_order_date: string
  latest_order_date: string
}

export interface CustomersByRegion {
  region: string
  customer_count: number
}

/* =========================
   Realtime Layer Types
   ========================= */

export interface RealtimeRevenue {
  window_start: string
  order_count: number
  revenue: number
}

export interface RealtimeTopProduct {
  product_name: string
  revenue: number
}

/* =========================
   Lambda View Types
   ========================= */

export interface LambdaView {
  date: string

  batch_layer: {
    order_count: number
    revenue: number
    note: string
  }

  speed_layer_latest_minute: {
    window_start: string
    order_count: number
    revenue: number
    note: string
  }

  merged_estimate: {
    order_count: number
    revenue: number
    note: string
  }
}

/* =========================
   Pipeline Health Types
   ========================= */

export type PipelineStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'

export interface PipelineCheck {
  name: string
  status: PipelineStatus
  message: string
  latency_ms: number | null
  details: Record<string, unknown>
}

export interface PipelineHealth {
  status: PipelineStatus

  checked_at: string

  summary: {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
  }

  checks: PipelineCheck[]
}

/* =========================
   API Client
   ========================= */

export const api = {
  /* ---------- System ---------- */

  health: () =>
    fetchApi<{ status: string }>('/health'),

  pipelineHealth: () =>
    fetchApi<PipelineHealth>('/pipeline/health'),

  /* ---------- Batch Layer ---------- */

  dailyRevenue: () =>
    fetchApi<DailyRevenue[]>('/batch/daily-revenue'),

  topProducts: () =>
    fetchApi<TopProduct[]>('/batch/top-products'),

  customersSummary: () =>
    fetchApi<CustomerSummary>('/batch/customers-summary'),

  customerMetrics: () =>
    fetchApi<CustomerMetric[]>('/batch/customer-metrics'),

  customersByRegion: () =>
    fetchApi<CustomersByRegion[]>('/batch/customers-by-region'),

  /* ---------- Realtime Layer ---------- */

  realtimeRevenue: () =>
    fetchApi<RealtimeRevenue>('/realtime/revenue'),

  realtimeTopProducts: () =>
    fetchApi<RealtimeTopProduct[]>('/realtime/top-products'),

  /* ---------- Lambda Architecture ---------- */

  lambdaView: () =>
    fetchApi<LambdaView>('/lambda/today-revenue'),
}