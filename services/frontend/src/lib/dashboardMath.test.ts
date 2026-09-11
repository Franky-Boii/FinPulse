import { describe, expect, it } from 'vitest'
import {
  computeCategoryBreakdown,
  computeRegionShares,
  computeRevenueSummary,
  computeSpendDistribution,
  computeWeekdayAverages,
  deriveLayerStatus,
  percentChange,
} from './dashboardMath'

describe('computeRevenueSummary', () => {
  it('sums revenue, orders, and units across all rows', () => {
    const result = computeRevenueSummary([
      { revenue: 1000, order_count: 10, units_sold: 20 },
      { revenue: 2000, order_count: 15, units_sold: 30 },
    ])

    expect(result.totalRevenue).toBe(3000)
    expect(result.totalOrders).toBe(25)
    expect(result.totalUnits).toBe(50)
  })

  it('computes average order value as revenue / orders', () => {
    const result = computeRevenueSummary([
      { revenue: 3000, order_count: 25, units_sold: 50 },
    ])

    expect(result.avgOrderValue).toBe(120)
  })

  it('returns zeroed totals for an empty input without dividing by zero', () => {
    const result = computeRevenueSummary([])

    expect(result).toEqual({
      totalRevenue: 0,
      totalOrders: 0,
      totalUnits: 0,
      avgOrderValue: 0,
    })
  })

  it('does not divide by zero when orders is 0 but revenue is not', () => {
    const result = computeRevenueSummary([
      { revenue: 500, order_count: 0, units_sold: 0 },
    ])

    expect(result.avgOrderValue).toBe(0)
  })
})

describe('computeCategoryBreakdown', () => {
  it('sums revenue per category', () => {
    const result = computeCategoryBreakdown([
      { category: 'Audio', revenue: 100 },
      { category: 'Audio', revenue: 50 },
      { category: 'Gaming', revenue: 30 },
    ])

    expect(result).toEqual([
      { category: 'Audio', value: 150 },
      { category: 'Gaming', value: 30 },
    ])
  })

  it('sorts categories by revenue descending', () => {
    const result = computeCategoryBreakdown([
      { category: 'Small', revenue: 10 },
      { category: 'Big', revenue: 900 },
      { category: 'Medium', revenue: 200 },
    ])

    expect(result.map((entry) => entry.category)).toEqual([
      'Big',
      'Medium',
      'Small',
    ])
  })

  it('returns an empty array for no products', () => {
    expect(computeCategoryBreakdown([])).toEqual([])
  })
})

describe('computeWeekdayAverages', () => {
  it('returns all seven weekdays even when data only covers some of them', () => {
    const result = computeWeekdayAverages([
      { order_date: '2026-09-07', revenue: 100 }, // Monday
    ])

    expect(result).toHaveLength(7)
    expect(result.map((d) => d.label)).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ])
  })

  it('averages revenue for days that share the same weekday', () => {
    // 2026-09-07 and 2026-09-14 are both Mondays
    const result = computeWeekdayAverages([
      { order_date: '2026-09-07', revenue: 100 },
      { order_date: '2026-09-14', revenue: 300 },
    ])

    const monday = result.find((d) => d.label === 'Mon')

    expect(monday?.average).toBe(200)
  })

  it('reports 0 average for weekdays with no data, not NaN', () => {
    const result = computeWeekdayAverages([
      { order_date: '2026-09-07', revenue: 100 }, // Monday only
    ])

    const sunday = result.find((d) => d.label === 'Sun')

    expect(sunday?.average).toBe(0)
    expect(Number.isNaN(sunday?.average)).toBe(false)
  })
})

describe('computeSpendDistribution', () => {
  it('buckets customers into the correct spend range', () => {
    const result = computeSpendDistribution([
      { total_order_value: 500 }, // < R1k
      { total_order_value: 4000 }, // R1k-5k
      { total_order_value: 50000 }, // R40k+
    ])

    expect(result).toEqual([
      { label: '< R1k', count: 1 },
      { label: 'R1k–5k', count: 1 },
      { label: 'R5k–15k', count: 0 },
      { label: 'R15k–40k', count: 0 },
      { label: 'R40k+', count: 1 },
    ])
  })

  it('places a value exactly on a boundary into the lower bucket (inclusive max)', () => {
    const result = computeSpendDistribution([{ total_order_value: 1000 }])

    expect(result.find((b) => b.label === '< R1k')?.count).toBe(1)
    expect(result.find((b) => b.label === 'R1k–5k')?.count).toBe(0)
  })

  it('supports custom bucket definitions', () => {
    const result = computeSpendDistribution(
      [{ total_order_value: 250 }, { total_order_value: 750 }],
      [
        { label: 'low', max: 500 },
        { label: 'high', max: Infinity },
      ],
    )

    expect(result).toEqual([
      { label: 'low', count: 1 },
      { label: 'high', count: 1 },
    ])
  })
})

describe('computeRegionShares', () => {
  it('computes each region as a percentage of the total', () => {
    const result = computeRegionShares([
      { region: 'Gauteng', customer_count: 75 },
      { region: 'Western Cape', customer_count: 25 },
    ])

    expect(result).toEqual([
      { region: 'Gauteng', customer_count: 75, percent: 75 },
      { region: 'Western Cape', customer_count: 25, percent: 25 },
    ])
  })

  it('returns 0 percent for every region when the total is 0', () => {
    const result = computeRegionShares([
      { region: 'Empty', customer_count: 0 },
    ])

    expect(result[0].percent).toBe(0)
  })

  it('returns an empty array unchanged', () => {
    expect(computeRegionShares([])).toEqual([])
  })
})

describe('percentChange', () => {
  it('computes a positive change correctly', () => {
    expect(percentChange(120, 100)).toBe(20)
  })

  it('computes a negative change correctly', () => {
    expect(percentChange(80, 100)).toBe(-20)
  })

  it('returns 0 when there is no previous value', () => {
    expect(percentChange(100, undefined)).toBe(0)
  })

  it('returns 0 when the previous value is 0, avoiding a divide-by-zero', () => {
    expect(percentChange(100, 0)).toBe(0)
  })
})

describe('deriveLayerStatus', () => {
  const checks = [
    { name: 'Airflow', status: 'healthy' as const },
    { name: 'dbt Batch Layer', status: 'degraded' as const },
    { name: 'Spark Streaming', status: 'healthy' as const },
    { name: 'Redis', status: 'unhealthy' as const },
  ]

  it('returns healthy when there are no checks at all', () => {
    expect(deriveLayerStatus(undefined, ['Airflow'])).toBe('healthy')
    expect(deriveLayerStatus([], ['Airflow'])).toBe('healthy')
  })

  it('returns healthy when no checks match the given keywords', () => {
    expect(deriveLayerStatus(checks, ['Nonexistent'])).toBe('healthy')
  })

  it('returns the single matching status when only one check matches', () => {
    expect(deriveLayerStatus(checks, ['Airflow'])).toBe('healthy')
  })

  it('returns the worst status among multiple matches', () => {
    // Airflow (healthy) + dbt (degraded) -> worst is degraded
    expect(deriveLayerStatus(checks, ['Airflow', 'dbt'])).toBe('degraded')

    // Spark (healthy) + Redis (unhealthy) -> worst is unhealthy
    expect(deriveLayerStatus(checks, ['Spark', 'Redis'])).toBe('unhealthy')
  })

  it('matches on partial, case-sensitive substrings of the check name', () => {
    expect(deriveLayerStatus(checks, ['dbt'])).toBe('degraded')
  })
})