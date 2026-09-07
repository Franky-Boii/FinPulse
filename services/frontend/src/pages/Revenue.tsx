import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3, DollarSign, ShoppingCart, Package } from 'lucide-react'
import { api, type DailyRevenue, type LambdaView } from '../services/api'

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

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
  })
}

export default function Revenue() {
  const [revenueData, setRevenueData] = useState<DailyRevenue[]>([])
  const [lambdaData, setLambdaData] = useState<LambdaView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    try {
      setError(null)

      const [dailyRevenue, lambdaView] = await Promise.all([
        api.dailyRevenue(),
        api.lambdaView(),
      ])

      setRevenueData(dailyRevenue)
      setLambdaData(lambdaView)
    } catch (err) {
      console.error(err)
      setError('Unable to load revenue data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const interval = setInterval(loadData, 30_000)

    return () => clearInterval(interval)
  }, [])

  const sortedRevenue = useMemo(
    () => [...revenueData].sort(
      (a, b) =>
        new Date(a.order_date).getTime() -
        new Date(b.order_date).getTime()
    ),
    [revenueData]
  )

  const totals = useMemo(() => {
    const revenue = revenueData.reduce(
      (sum, day) => sum + Number(day.revenue),
      0
    )

    const orders = revenueData.reduce(
      (sum, day) => sum + Number(day.order_count),
      0
    )

    const units = revenueData.reduce(
      (sum, day) => sum + Number(day.units_sold),
      0
    )

    return {
      revenue,
      orders,
      units,
      aov: orders > 0 ? revenue / orders : 0,
    }
  }, [revenueData])

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-sm text-slate-400">
          Loading revenue intelligence...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-red-300">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Data Intelligence
        </p>

        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Revenue
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Revenue performance across the FinPulse batch analytics layer.
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(totals.revenue)}
          description="Selected batch period"
          icon={<DollarSign size={18} />}
        />

        <MetricCard
          label="Total Orders"
          value={formatNumber(totals.orders)}
          description="Orders in batch layer"
          icon={<ShoppingCart size={18} />}
        />

        <MetricCard
          label="Units Sold"
          value={formatNumber(totals.units)}
          description="Items sold"
          icon={<Package size={18} />}
        />

        <MetricCard
          label="Average Order Value"
          value={formatCurrency(totals.aov)}
          description="Revenue ÷ orders"
          icon={<BarChart3 size={18} />}
        />
      </div>

      {/* Lambda Revenue */}
      {lambdaData && (
        <div className="grid gap-4 md:grid-cols-3">
          <LayerCard
            title="Batch Revenue"
            value={formatCurrency(lambdaData.batch_layer.revenue)}
            subtitle={`${formatNumber(lambdaData.batch_layer.order_count)} orders`}
          />

          <LayerCard
            title="Latest Speed Window"
            value={formatCurrency(
              lambdaData.speed_layer_latest_minute.revenue
            )}
            subtitle={`${formatNumber(
              lambdaData.speed_layer_latest_minute.order_count
            )} orders`}
          />

          <LayerCard
            title="Current Estimate"
            value={formatCurrency(lambdaData.merged_estimate.revenue)}
            subtitle={`${formatNumber(
              lambdaData.merged_estimate.order_count
            )} orders`}
            highlighted
          />
        </div>
      )}

      {/* Revenue Chart */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">
            Revenue Trend
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Daily revenue generated by the batch analytics layer.
          </p>
        </div>

        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sortedRevenue}>
              <defs>
                <linearGradient
                  id="revenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopOpacity={0.35} />
                  <stop offset="100%" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.08}
              />

              <XAxis
                dataKey="order_date"
                tickFormatter={formatDate}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />

              <YAxis
                tickFormatter={(value) =>
                  `R${Math.round(value / 1_000_000)}M`
                }
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />

              <Tooltip
                formatter={(value) => [
                  formatCurrency(Number(value)),
                  'Revenue',
                ]}
                labelFormatter={(label) =>
                  new Date(`${label}T00:00:00`).toLocaleDateString(
                    'en-ZA',
                    {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    }
                  )
                }
              />

              <Area
                type="monotone"
                dataKey="revenue"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Daily Breakdown */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60">
        <div className="border-b border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white">
            Daily Revenue Breakdown
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Revenue, orders and units sold by day.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Revenue</th>
                <th className="px-6 py-4 font-medium">Orders</th>
                <th className="px-6 py-4 font-medium">Units</th>
                <th className="px-6 py-4 font-medium">AOV</th>
              </tr>
            </thead>

            <tbody>
              {[...revenueData]
                .sort(
                  (a, b) =>
                    new Date(b.order_date).getTime() -
                    new Date(a.order_date).getTime()
                )
                .map((day) => {
                  const aov =
                    day.order_count > 0
                      ? day.revenue / day.order_count
                      : 0

                  return (
                    <tr
                      key={day.order_date}
                      className="border-b border-slate-900 transition hover:bg-slate-900/60"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {new Date(
                          `${day.order_date}T00:00:00`
                        ).toLocaleDateString('en-ZA', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-white">
                        {formatCurrency(day.revenue)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-300">
                        {formatNumber(day.order_count)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-300">
                        {formatNumber(day.units_sold)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-300">
                        {formatCurrency(aov)}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string
  value: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
          {icon}
        </div>
      </div>

      <div className="mt-5 text-2xl font-bold tracking-tight text-white">
        {value}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </div>
  )
}

function LayerCard({
  title,
  value,
  subtitle,
  highlighted = false,
}: {
  title: string
  value: string
  subtitle: string
  highlighted?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlighted
          ? 'border-cyan-500/20 bg-cyan-500/5'
          : 'border-slate-800 bg-slate-950/60'
      }`}
    >
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-3 text-xl font-bold text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  )
}
