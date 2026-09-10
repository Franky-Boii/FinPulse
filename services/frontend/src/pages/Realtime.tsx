import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  Clock3,
  DollarSign,
  Package,
  Radio,
  RefreshCw,
  ShoppingCart,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  api,
  type RealtimeRevenue,
  type RealtimeTopProduct,
} from '../services/api'

const HISTORY_LIMIT = 20

interface HistoryPoint {
  time: string
  revenue: number
  order_count: number
}

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

function formatWindow(value: string) {
  if (!value) {
    return 'Waiting for stream...'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function Realtime() {
  const [revenue, setRevenue] = useState<RealtimeRevenue | null>(null)

  const [products, setProducts] = useState<RealtimeTopProduct[]>([])

  const [loading, setLoading] = useState(true)

  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const [history, setHistory] = useState<HistoryPoint[]>([])
  const lastWindowRef = useRef<string | null>(null)

  async function loadRealtimeData(initial = false) {
    try {
      if (initial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError(null)

      const [revenueData, productData] = await Promise.all([
        api.realtimeRevenue(),
        api.realtimeTopProducts(),
      ])

      setRevenue(revenueData)

      setProducts(productData)

      setLastUpdated(new Date())

      if (
        revenueData.window_start &&
        revenueData.window_start !== lastWindowRef.current
      ) {
        lastWindowRef.current = revenueData.window_start

        setHistory((prev) => {
          const next = [
            ...prev,
            {
              time: formatWindow(revenueData.window_start),
              revenue: revenueData.revenue,
              order_count: revenueData.order_count,
            },
          ]

          return next.slice(-HISTORY_LIMIT)
        })
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load realtime data.',
      )
    } finally {
      setLoading(false)

      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadRealtimeData(true)

    const interval = setInterval(() => {
      loadRealtimeData()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  /* =========================
     Loading State
     ========================= */

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />

          <p className="mt-4 text-sm text-slate-500">
            Connecting to realtime stream...
          </p>
        </div>
      </div>
    )
  }

  /* =========================
     Error State
     ========================= */

  if (error && !revenue) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
        <p className="text-sm font-semibold text-red-400">
          Realtime stream unavailable
        </p>

        <p className="mt-2 text-sm text-slate-500">
          {error}
        </p>

        <button
          onClick={() => loadRealtimeData()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />

          Retry
        </button>
      </div>
    )
  }

  const currentRevenue = revenue?.revenue ?? 0

  const currentOrders = revenue?.order_count ?? 0

  const currentWindow = revenue?.window_start ?? ''

  return (
    <div className="space-y-8">

      {/* =========================
          Header
          ========================= */}

      <div>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />

              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Streaming Layer
              </p>
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Realtime
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Live operational metrics processed through Spark Structured
              Streaming and served from Redis.
            </p>
          </div>

          <div className="flex items-center gap-3">

            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-3 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

              <span className="text-xs font-medium text-emerald-400">
                Stream Active
              </span>
            </div>

            <button
              onClick={() => loadRealtimeData()}
              disabled={refreshing}
              className="rounded-lg border border-slate-800 bg-[#0b0f17] p-2.5 text-slate-500 transition hover:border-slate-700 hover:text-white disabled:opacity-50"
              title="Refresh realtime data"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />
            </button>

          </div>
        </div>
      </div>

      {/* =========================
          Stream Status
          ========================= */}

      <div className="rounded-2xl border border-cyan-500/10 bg-cyan-500/5 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10">
              <Radio className="h-5 w-5 text-cyan-400" />
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                Spark Streaming Pipeline
              </p>

              <p className="mt-1 text-xs text-slate-500">
                CDC events → Redpanda → Spark → Redis
              </p>
            </div>
          </div>

          <div className="text-left md:text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-600">
              Latest Window
            </p>

            <p className="mt-1 font-mono text-sm text-cyan-400">
              {formatWindow(currentWindow)}
            </p>
          </div>

        </div>
      </div>

      {/* =========================
          KPI Cards
          ========================= */}

      <div className="grid gap-4 md:grid-cols-3">

        <MetricCard
          label="Latest Window Revenue"
          value={formatCurrency(currentRevenue)}
          description="Revenue processed in the latest streaming window"
          icon={DollarSign}
        />

        <MetricCard
          label="Orders Processed"
          value={formatNumber(currentOrders)}
          description="Orders captured in the latest streaming window"
          icon={ShoppingCart}
        />

        <MetricCard
          label="Window Status"
          value="LIVE"
          description={
            lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString('en-ZA')}`
              : 'Waiting for update'
          }
          icon={Zap}
          live
        />

      </div>

      {/* =========================
          Live Pulse
          ========================= */}

      <section className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white">
              Live Revenue Pulse
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Revenue per streaming window, captured as it arrives.
            </p>
          </div>
          <Activity className="h-5 w-5 text-slate-600" />
        </div>

        {history.length > 1 ? (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />

                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(value) => formatCurrency(Number(value))}
                  width={90}
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
                  stroke="#22d3ee"
                  fill="url(#pulseFill)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[180px] items-center justify-center text-sm text-slate-600">
            Collecting streaming windows — the pulse fills in as new data
            arrives.
          </div>
        )}
      </section>

      {history.length > 1 && (
        <section className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">
                Orders per Window
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Order volume across recent streaming windows.
              </p>
            </div>
            <ShoppingCart className="h-5 w-5 text-slate-600" />
          </div>

          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />

                <YAxis stroke="#64748b" fontSize={11} />

                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#fff',
                  }}
                  formatter={(value) => [
                    formatNumber(Number(value)),
                    'Orders',
                  ]}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }}
                />

                <Bar dataKey="order_count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* =========================
          Main Content
          ========================= */}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">

        {/* Streaming Architecture */}

        <section className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6">

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-400/10 p-2.5">
              <Activity className="h-5 w-5 text-cyan-400" />
            </div>

            <div>
              <h2 className="font-semibold text-white">
                Speed Layer
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Streaming architecture
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">

            <PipelineStep
              number="01"
              title="Debezium CDC"
              description="Captures database changes"
            />

            <PipelineConnector />

            <PipelineStep
              number="02"
              title="Redpanda"
              description="Buffers and distributes events"
            />

            <PipelineConnector />

            <PipelineStep
              number="03"
              title="Spark Structured Streaming"
              description="Processes streaming windows"
            />

            <PipelineConnector />

            <PipelineStep
              number="04"
              title="Redis"
              description="Serves low-latency aggregates"
              active
            />

          </div>
        </section>

        {/* Realtime Products */}

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b0f17]">

          <div className="border-b border-slate-800 p-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="font-semibold text-white">
                  Streaming Product Activity
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Current product rankings from the realtime layer
                </p>
              </div>

              <Package className="h-5 w-5 text-slate-600" />

            </div>

          </div>

          <div className="p-4">

            {products.length === 0 ? (

              <div className="flex min-h-48 items-center justify-center">

                <div className="text-center">

                  <Package className="mx-auto h-8 w-8 text-slate-700" />

                  <p className="mt-3 text-sm text-slate-500">
                    No product activity available.
                  </p>

                </div>

              </div>

            ) : (

              <div className="space-y-2">

                {products.slice(0, 10).map((product, index) => (

                  <div
                    key={product.product_name}
                    className="flex items-center gap-4 rounded-xl p-3 transition hover:bg-slate-800/30"
                  >

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="truncate text-sm font-medium text-slate-200">
                        {product.product_name}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-600">
                        Live revenue activity
                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-sm font-semibold text-emerald-400">
                        {formatCurrency(product.revenue)}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        </section>

      </div>

      {/* =========================
          Technical Note
          ========================= */}

      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0b0f17] p-5">

        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />

        <div>

          <p className="text-xs font-medium text-slate-400">
            Streaming semantics
          </p>

          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Realtime metrics represent the latest processed streaming window.
            They provide low-latency operational visibility, while the batch
            layer remains the authoritative source for historical reporting.
          </p>

        </div>

      </div>

      {/* =========================
          Refresh Warning
          ========================= */}

      {error && (
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-400">
            Realtime refresh warning: {error}
          </p>
        </div>
      )}

    </div>
  )
}

/* =========================
   Metric Card
   ========================= */

interface MetricCardProps {
  label: string
  value: string
  description: string
  icon: typeof DollarSign
  live?: boolean
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  live = false,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-5">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p
            className={`mt-2 text-2xl font-bold tracking-tight ${
              live ? 'text-cyan-400' : 'text-white'
            }`}
          >
            {value}
          </p>

        </div>

        <div className="rounded-xl bg-cyan-400/10 p-2.5">
          <Icon className="h-4 w-4 text-cyan-400" />
        </div>

      </div>

      <p className="mt-3 text-[11px] text-slate-600">
        {description}
      </p>

    </div>
  )
}

/* =========================
   Pipeline Step
   ========================= */

interface PipelineStepProps {
  number: string
  title: string
  description: string
  active?: boolean
}

function PipelineStep({
  number,
  title,
  description,
  active = false,
}: PipelineStepProps) {
  return (
    <div
      className={`flex items-center gap-4 rounded-xl border p-4 ${
        active
          ? 'border-cyan-500/20 bg-cyan-500/5'
          : 'border-slate-800 bg-slate-900/20'
      }`}
    >

      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
          active
            ? 'bg-cyan-400/10 text-cyan-400'
            : 'bg-slate-800 text-slate-500'
        }`}
      >
        {number}
      </div>

      <div>

        <p className="text-sm font-medium text-slate-200">
          {title}
        </p>

        <p className="mt-1 text-xs text-slate-600">
          {description}
        </p>

      </div>

    </div>
  )
}

/* =========================
   Pipeline Connector
   ========================= */

function PipelineConnector() {
  return (
    <div className="ml-8 h-3 border-l border-dashed border-slate-700" />
  )
}