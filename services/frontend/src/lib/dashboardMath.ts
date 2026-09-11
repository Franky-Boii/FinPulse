/**
 * Pure calculation helpers used by the dashboard pages (Overview, Revenue,
 * Products, Customers, PipelineHealth).
 *
 * These are intentionally free of React, fetch, and DOM dependencies so
 * they can be unit tested in isolation from rendering and network state.
 * Each function accepts the minimal structural shape it needs rather than
 * the full API response types, so tests can build tiny fixtures instead of
 * whole API objects.
 */

export type PipelineStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface RevenueDay {
  revenue: number
  order_count: number
  units_sold: number
}

export interface RevenueSummary {
  totalRevenue: number
  totalOrders: number
  totalUnits: number
  avgOrderValue: number
}

/**
 * Totals + average order value across a set of daily revenue rows.
 * Used for both the Overview "Revenue Summary" panel (a selected date
 * range) and the Revenue page KPI cards (the full loaded period).
 */
export function computeRevenueSummary(days: RevenueDay[]): RevenueSummary {
  const totalRevenue = days.reduce((sum, day) => sum + Number(day.revenue), 0)
  const totalOrders = days.reduce((sum, day) => sum + Number(day.order_count), 0)
  const totalUnits = days.reduce((sum, day) => sum + Number(day.units_sold), 0)
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return { totalRevenue, totalOrders, totalUnits, avgOrderValue }
}

export interface CategoryProduct {
  category: string
  revenue: number
}

export interface CategoryTotal {
  category: string
  value: number
}

/**
 * Groups products by category and sums revenue per category, sorted by
 * revenue descending. Used by the Overview and Products category donuts.
 */
export function computeCategoryBreakdown(
  products: CategoryProduct[],
): CategoryTotal[] {
  const totals = new Map<string, number>()

  products.forEach((product) => {
    totals.set(
      product.category,
      (totals.get(product.category) ?? 0) + Number(product.revenue),
    )
  })

  return Array.from(totals.entries())
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value)
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface WeekdayRevenueDay {
  order_date: string
  revenue: number
}

export interface WeekdayAverage {
  label: string
  average: number
}

/**
 * Average revenue per day-of-week across a set of dated revenue rows.
 * `order_date` is interpreted as a local calendar date (no time component),
 * matching the `YYYY-MM-DD` shape returned by the batch API.
 */
export function computeWeekdayAverages(
  days: WeekdayRevenueDay[],
): WeekdayAverage[] {
  const buckets = WEEKDAY_LABELS.map((label) => ({
    label,
    total: 0,
    count: 0,
  }))

  days.forEach((day) => {
    const weekday = new Date(`${day.order_date}T00:00:00`).getDay()
    buckets[weekday].total += Number(day.revenue)
    buckets[weekday].count += 1
  })

  return buckets.map((bucket) => ({
    label: bucket.label,
    average: bucket.count > 0 ? bucket.total / bucket.count : 0,
  }))
}

export interface SpendCustomer {
  total_order_value: number
}

export interface SpendBucket {
  label: string
  max: number
}

export interface SpendBucketResult {
  label: string
  count: number
}

export const DEFAULT_SPEND_BUCKETS: SpendBucket[] = [
  { label: '< R1k', max: 1_000 },
  { label: 'R1k–5k', max: 5_000 },
  { label: 'R5k–15k', max: 15_000 },
  { label: 'R15k–40k', max: 40_000 },
  { label: 'R40k+', max: Infinity },
]

/**
 * Buckets customers into lifetime-spend ranges. Each customer falls into
 * the first bucket whose `max` is greater than or equal to their total
 * order value, so buckets must be supplied in ascending order.
 */
export function computeSpendDistribution(
  customers: SpendCustomer[],
  buckets: SpendBucket[] = DEFAULT_SPEND_BUCKETS,
): SpendBucketResult[] {
  const counts = buckets.map((bucket) => ({ label: bucket.label, count: 0 }))

  customers.forEach((customer) => {
    const index = buckets.findIndex(
      (bucket) => Number(customer.total_order_value) <= bucket.max,
    )

    if (index !== -1) {
      counts[index].count += 1
    }
  })

  return counts
}

export interface RegionCount {
  region: string
  customer_count: number
}

export interface RegionShare extends RegionCount {
  percent: number
}

/**
 * Adds a `percent` field (share of the total customer count) to each
 * region row. Returns an empty array unchanged, and returns 0% for every
 * region if the total is 0, rather than dividing by zero.
 */
export function computeRegionShares(regions: RegionCount[]): RegionShare[] {
  const total = regions.reduce((sum, region) => sum + region.customer_count, 0)

  return regions.map((region) => ({
    ...region,
    percent: total > 0 ? (region.customer_count / total) * 100 : 0,
  }))
}

/**
 * Percentage change from `previous` to `current`. Returns 0 when there is
 * no meaningful previous value to compare against (undefined, or zero —
 * since a change *from* zero is not expressible as a percentage).
 */
export function percentChange(
  current: number,
  previous: number | undefined,
): number {
  if (!previous) {
    return 0
  }

  return ((current - previous) / previous) * 100
}

export interface StatusCheck {
  name: string
  status: PipelineStatus
}

const STATUS_SEVERITY: Record<PipelineStatus, number> = {
  healthy: 0,
  degraded: 1,
  unhealthy: 2,
}

/**
 * Derives a single status for a logical "layer" (e.g. the batch layer) from
 * the subset of pipeline health checks whose name contains one of the given
 * keywords. The worst status among matches wins. Returns 'healthy' when
 * there are no checks at all or none match — an absence of data should
 * never read as an outage.
 */
export function deriveLayerStatus(
  checks: StatusCheck[] | undefined,
  keywords: string[],
): PipelineStatus {
  if (!checks || checks.length === 0) {
    return 'healthy'
  }

  const matched = checks.filter((check) =>
    keywords.some((keyword) => check.name.includes(keyword)),
  )

  if (matched.length === 0) {
    return 'healthy'
  }

  return matched.reduce<PipelineStatus>(
    (worst, check) =>
      STATUS_SEVERITY[check.status] > STATUS_SEVERITY[worst]
        ? check.status
        : worst,
    'healthy',
  )
}