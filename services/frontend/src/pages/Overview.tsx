import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Database,
  Package,
  RefreshCw,
  ShoppingCart,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api, type DailyRevenue, type TopProduct, type LambdaView } from '../services/api'

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

export default function Overview() {
  const [revenue, setRevenue] = useState<DailyRevenue[]>([])
  const [products, setProducts] = useState<TopProduct[]>([])
  const [lambda, setLambda] = useState<LambdaView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadDashboard() {
    try {
      setLoading(true)
      setError('')

      const [revenueData, productsData, lambdaData] = await Promise.all([
        api.dailyRevenue(),
        api.topProducts(),
        api.lambdaView(),
      ])

      setRevenue(revenueData.reverse())
      setProducts(productsData)
      setLambda(lambdaData)
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

  const latestDay = revenue[revenue.length - 1]

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
      <div className="flex items-center justify-between">
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

        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
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
        />

        <MetricCard
          title="Today's Orders"
          value={formatNumber(lambda?.merged_estimate.order_count ?? 0)}
          subtitle="Current estimated total"
          icon={ShoppingCart}
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

      {/* Revenue chart */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl shadow-black/10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Revenue Trend
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Daily revenue from the batch analytics layer.
            </p>
          </div>

          <BarChart3 className="h-5 w-5 text-slate-500" />
        </div>

        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenue}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopOpacity={0.35} />
                  <stop offset="100%" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e293b"
              />

              <XAxis
                dataKey="order_date"
                stroke="#64748b"
                fontSize={12}
              />

              <YAxis
                stroke="#64748b"
                fontSize={12}
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

      {/* Lower section */}
      <div className="grid gap-6 xl:grid-cols-2">
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
            {products.slice(0, 5).map((product, index) => (
              <div
                key={product.product_id}
                className="flex items-center gap-4"
              >
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

                  <p className="mt-1 flex items-center justify-end gap-1 text-xs text-emerald-400">
                    <ArrowUpRight className="h-3 w-3" />
                    Revenue
                  </p>
                </div>
              </div>
            ))}
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
              status="Operational"
            />

            <LayerStatus
              icon={Activity}
              name="Speed Layer"
              description="Spark Structured Streaming + Redis"
              status="Operational"
            />

            <LayerStatus
              icon={BarChart3}
              name="Serving Layer"
              description="FastAPI"
              status="Operational"
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
      </div>
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  subtitle: string
  icon: typeof CircleDollarSign
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-black/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>

          <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="rounded-xl bg-emerald-500/10 p-3">
          <Icon className="h-5 w-5 text-emerald-400" />
        </div>
      </div>
    </div>
  )
}

interface LayerStatusProps {
  icon: typeof Database
  name: string
  description: string
  status: string
}

function LayerStatus({
  icon: Icon,
  name,
  description,
  status,
}: LayerStatusProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="rounded-lg bg-slate-800 p-2">
        <Icon className="h-4 w-4 text-slate-300" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      <div className="flex items-center gap-2 text-xs text-emerald-400">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        {status}
      </div>
    </div>
  )
}
