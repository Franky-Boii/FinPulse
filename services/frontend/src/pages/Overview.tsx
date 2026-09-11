import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Globe2,
  Package,
  PieChart as PieIcon,
  RefreshCw,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  api,
  type CustomersByRegion,
  type DailyRevenue,
  type LambdaView,
  type PipelineHealth,
  type RealtimeRevenue,
  type RealtimeTopProduct,
  type TopProduct,
} from '../services/api'
import {
  computeCategoryBreakdown,
  computeRegionShares,
  computeRevenueSummary,
  deriveLayerStatus,
  percentChange,
  type PipelineStatus,
} from '../lib/dashboardMath'

type RangeKey = '7d' | '30d' | '90d'

const RANGE_DAYS: Record<RangeKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const CATEGORY_COLORS = [
  '#34d399',
  '#22d3ee',
  '#a78bfa',
  '#fbbf24',
  '#fb7185',
  '#60a5fa',
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-ZA').format(value)
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Overview() {
  const [revenue, setRevenue] = useState<DailyRevenue[]>([])
  const [products, setProducts] = useState<TopProduct[]>([])
  const [lambda, setLambda] = useState<LambdaView | null>(null)
  const [regions, setRegions] = useState<CustomersByRegion[]>([])
  const [realtime, setRealtime] = useState<RealtimeRevenue | null>(null)
  const [realtimeProducts, setRealtimeProducts] = useState<
    RealtimeTopProduct[]
  >([])
  const [pipeline, setPipeline] = useState<PipelineHealth | null>(null)
  const [range, setRange] = useState<RangeKey>('30d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    try {
      setLoading(true)
      setError('')

      const [
        revenueData,
        productsData,
        lambdaData,
        regionsData,
        realtimeData,
        realtimeProductsData,
        pipelineData,
      ] = await Promise.all([
        api.dailyRevenue(90),
        api.topProducts(),
        api.lambdaView(),
        api.customersByRegion(),
        api.realtimeRevenue().catch(() => null),
        api.realtimeTopProducts().catch(() => []),
        api.pipelineHealth().catch(() => null),
      ])

      setRevenue(revenueData.reverse())
      setProducts(productsData)
      setLambda(lambdaData)
      setRegions(regionsData)
      setRealtime(realtimeData)
      setRealtimeProducts(realtimeProductsData)
      setPipeline(pipelineData)
    } catch (err) {
      console.error(err)
      setError('Unable to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()

    const interval = setInterval(loadDashboard, 30000)

    return () => clearInterval(interval)
  }, [])

  const rangedRevenue = useMemo(
    () => revenue.slice(-RANGE_DAYS[range]),
    [revenue, range],
  )

  const latestDay = revenue[revenue.length - 1]
  const previousDay = revenue[revenue.length - 2]

  const revenueChange = percentChange(
    latestDay?.revenue ?? 0,
    previousDay?.revenue,
  )

  const ordersChange = percentChange(
    latestDay?.order_count ?? 0,
    previousDay?.order_count,
  )

  const summary = useMemo(
    () => computeRevenueSummary(rangedRevenue),
    [rangedRevenue],
  )

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(products),
    [products],
  )

  const categoryTotal = categoryBreakdown.reduce(
    (sum, entry) => sum + entry.value,
    0,
  )

  const regionShares = useMemo(
    () => computeRegionShares(regions),
    [regions],
  )

  const batchStatus = deriveLayerStatus(pipeline?.checks, [
    'Airflow',
    'dbt',
    'Warehouse',
  ])

  const speedStatus = deriveLayerStatus(pipeline?.checks, [
    'Spark',
    'Redpanda',
    'Debezium',
    'Redis',
  ])

  const servingStatus = deriveLayerStatus(pipeline?.checks, ['FastAPI'])

  const customers = 6334
  const productCount = 10

  if (loading && !lambda) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading FinPulse data...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-400">
            DATA INTELLIGENCE
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
            Overview
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Real-time visibility across the FinPulse data platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {realtime && (
            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/10 bg-emerald-500/5 px-3 py-1.5 sm:flex">
              <span className="status-dot h-1.5 w-1.5" />
              <span className="text-[11px] font-medium text-emerald-400">
                Live &middot; {formatTime(realtime.window_start)}
              </span>
            </div>
          )}

          <button
            onClick={loadDashboard}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today's Revenue"
          value={formatCurrency(lambda?.merged_estimate.revenue ?? 0)}
          subtitle="Batch + latest speed window"
          icon={CircleDollarSign}
          change={revenueChange}
          sparkline={revenue.slice(-7).map((d) => ({ value: d.revenue }))}
          sparkColor="#34d399"
        />

        <MetricCard
          title="Today's Orders"
          value={formatNumber(lambda?.merged_estimate.order_count ?? 0)}
          subtitle="Current estimated total"
          icon={ShoppingCart}
          change={ordersChange}
          sparkline={revenue.slice(-7).map((d) => ({ value: d.order_count }))}
          sparkColor="#22d3ee"
        />

        <MetricCard
          title="Customers"
          value={formatNumber(customers)}
          subtitle="Customers in warehouse"
          icon={Users}
        />

        <MetricCard
          title="Products"
          value={formatNumber(productCount)}
          subtitle="Products tracked"
          icon={Package}
        />
      </div>

      {/* Revenue chart + summary */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/10 xl:col-span-2">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Revenue Trend
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Daily revenue from the batch analytics layer.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
              {(['7d', '30d', '90d'] as RangeKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    range === key
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {key.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rangedRevenue}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                <XAxis
                  dataKey="order_date"
                  stroke="#64748b"
                  fontSize={11}
                  minTickGap={24}
                />

                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(value) =>
                    `R${(value / 1000000).toFixed(0)}M`
                  }
                />

                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#fff',
                  }}
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    'Revenue',
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#34d399"
                  fill="url(#revenueFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Revenue summary */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Revenue Summary
            </h2>

            <BarChart3 className="h-5 w-5 text-slate-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SummaryStat
              icon={CircleDollarSign}
              label="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
            />

            <SummaryStat
              icon={ShoppingCart}
              label="Total Orders"
              value={formatNumber(summary.totalOrders)}
              color="text-cyan-400"
              bg="bg-cyan-500/10"
            />

            <SummaryStat
              icon={ArrowUpRight}
              label="Avg Order Value"
              value={formatCurrency(summary.avgOrderValue)}
              color="text-violet-400"
              bg="bg-violet-500/10"
            />

            <SummaryStat
              icon={Boxes}
              label="Units Sold"
              value={formatNumber(summary.totalUnits)}
              color="text-amber-400"
              bg="bg-amber-500/10"
            />
          </div>

          <p className="mt-5 text-[11px] text-slate-600">
            Totals across the selected {RANGE_DAYS[range]}-day window.
          </p>
        </section>
      </div>

      {/* Products / Lambda / Activity */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Top products */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Top Products
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Ranked by revenue.
              </p>
            </div>

            <Boxes className="h-5 w-5 text-slate-500" />
          </div>

          <div className="space-y-4">
            {products.slice(0, 5).map((product, index) => {
              const max = products[0]?.revenue || 1
              const width = (product.revenue / max) * 100

              return (
                <div key={product.product_id}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-sm font-semibold text-slate-400">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {product.product_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(product.units_sold)} units
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  </div>

                  <div className="ml-[52px] mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Lambda status */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">
              Lambda Architecture
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Batch and speed layers working together.
            </p>
          </div>

          <div className="space-y-3">
            <LayerStatus
              icon={Database}
              name="Batch Layer"
              description="Airflow + dbt + PostgreSQL"
              status={batchStatus}
            />

            <LayerStatus
              icon={Activity}
              name="Speed Layer"
              description="Spark Structured Streaming + Redis"
              status={speedStatus}
            />

            <LayerStatus
              icon={BarChart3}
              name="Serving Layer"
              description="FastAPI"
              status={servingStatus}
            />
          </div>

          {latestDay && (
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  Latest batch
                </span>

                <span className="text-xs text-slate-500">
                  {latestDay.order_date}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatCurrency(latestDay.revenue)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Orders</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatNumber(latestDay.order_count)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Recent Activity
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Latest signals across the platform.
              </p>
            </div>

            <Zap className="h-5 w-5 text-slate-500" />
          </div>

          <div className="space-y-5">
            {latestDay && (
              <ActivityItem
                icon={CheckCircle2}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                title="Batch ETL Completed"
                detail={`${formatNumber(latestDay.order_count)} orders processed for ${latestDay.order_date}`}
              />
            )}

            {realtime && (
              <ActivityItem
                icon={Activity}
                color="text-cyan-400"
                bg="bg-cyan-500/10"
                title="Realtime Window Processed"
                detail={`${formatNumber(realtime.order_count)} orders \u00b7 ${formatCurrency(realtime.revenue)} at ${formatTime(realtime.window_start)}`}
              />
            )}

            {realtimeProducts[0] && (
              <ActivityItem
                icon={Boxes}
                color="text-violet-400"
                bg="bg-violet-500/10"
                title="Top Realtime Product"
                detail={`${realtimeProducts[0].product_name} \u00b7 ${formatCurrency(realtimeProducts[0].revenue)}`}
              />
            )}

            {pipeline && (
              <ActivityItem
                icon={Database}
                color="text-amber-400"
                bg="bg-amber-500/10"
                title="Pipeline Health Checked"
                detail={`${pipeline.summary.healthy}/${pipeline.summary.total} components healthy at ${formatTime(pipeline.checked_at)}`}
              />
            )}
          </div>
        </section>
      </div>

      {/* Category + Region */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Category breakdown */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Revenue by Category
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Share of tracked product revenue.
              </p>
            </div>

            <PieIcon className="h-5 w-5 text-slate-500" />
          </div>

          {categoryBreakdown.length > 0 ? (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="h-[200px] w-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="category"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={entry.category}
                          fill={
                            CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        color: '#fff',
                      }}
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        String(name),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full space-y-3">
                {categoryBreakdown.map((entry, index) => {
                  const pct =
                    categoryTotal > 0
                      ? (entry.value / categoryTotal) * 100
                      : 0

                  return (
                    <div
                      key={entry.category}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background:
                              CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                          }}
                        />
                        <span className="text-slate-300">
                          {entry.category}
                        </span>
                      </div>

                      <span className="text-slate-500">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No product category data available yet.
            </p>
          )}
        </section>

        {/* Region breakdown */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Customers by Region
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Geographic distribution of the customer base.
              </p>
            </div>

            <Globe2 className="h-5 w-5 text-slate-500" />
          </div>

          <div className="space-y-5">
            {regionShares.map((region) => (
              <div key={region.region}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    {region.region}
                  </span>

                  <span className="text-xs text-slate-500">
                    {formatNumber(region.customer_count)} &middot;{' '}
                    {region.percent.toFixed(1)}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-cyan-400"
                    style={{ width: `${region.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  subtitle: string
  icon: typeof CircleDollarSign
  change?: number
  sparkline?: { value: number }[]
  sparkColor?: string
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  sparkline,
  sparkColor = '#34d399',
}: MetricCardProps) {
  const hasChange =
    typeof change === 'number' &&
    !Number.isNaN(change) &&
    Number.isFinite(change) &&
    change !== 0
  const positive = (change ?? 0) >= 0
  const gradientId = `spark-${title.replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-400">{title}</p>

          <div className="mt-3 flex items-center gap-2">
            <p className="text-2xl font-semibold tracking-tight text-white">
              {value}
            </p>

            {hasChange && (
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  positive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {positive ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(change ?? 0).toFixed(1)}%
              </span>
            )}
          </div>

          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-xl bg-emerald-500/10 p-3">
          <Icon className="h-5 w-5 text-emerald-400" />
        </div>
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="mt-4 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <Area
                type="monotone"
                dataKey="value"
                stroke={sparkColor}
                fill={`url(#${gradientId})`}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

interface SummaryStatProps {
  icon: typeof CircleDollarSign
  label: string
  value: string
  color: string
  bg: string
}

function SummaryStat({ icon: Icon, label, value, color, bg }: SummaryStatProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className={`inline-flex rounded-lg ${bg} p-2`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>

      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  )
}

interface LayerStatusProps {
  icon: typeof Database
  name: string
  description: string
  status: PipelineStatus
}

function LayerStatus({
  icon: Icon,
  name,
  description,
  status,
}: LayerStatusProps) {
  const config = {
    healthy: {
      label: 'Operational',
      color: 'text-emerald-400',
      dot: 'bg-emerald-400',
    },
    degraded: {
      label: 'Degraded',
      color: 'text-amber-400',
      dot: 'bg-amber-400',
    },
    unhealthy: {
      label: 'Unhealthy',
      color: 'text-red-400',
      dot: 'bg-red-400',
    },
  }[status]

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="rounded-lg bg-slate-800 p-2">
        <Icon className="h-4 w-4 text-slate-300" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <div className={`flex items-center gap-2 text-xs ${config.color}`}>
        <span className={`h-2 w-2 rounded-full ${config.dot}`} />
        {config.label}
      </div>
    </div>
  )
}

interface ActivityItemProps {
  icon: typeof Activity
  color: string
  bg: string
  title: string
  detail: string
}

function ActivityItem({ icon: Icon, color, bg, title, detail }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 rounded-lg ${bg} p-2`}>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  )
}