import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  RefreshCw,
  Server,
  XCircle,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
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
  type PipelineCheck,
  type PipelineHealth as PipelineHealthResponse,
  type PipelineStatus,
} from '../services/api'

const STATUS_COLORS: Record<PipelineStatus, string> = {
  healthy: '#34d399',
  degraded: '#fbbf24',
  unhealthy: '#f87171',
}

function statusConfig(status: PipelineStatus) {
  switch (status) {
    case 'healthy':
      return {
        label: 'Healthy',
        icon: CheckCircle2,
        container:
          'border-emerald-500/20 bg-emerald-500/5',
        iconColor: 'text-emerald-400',
        badge:
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      }

    case 'degraded':
      return {
        label: 'Degraded',
        icon: AlertTriangle,
        container:
          'border-amber-500/20 bg-amber-500/5',
        iconColor: 'text-amber-400',
        badge:
          'bg-amber-500/10 text-amber-400 border-amber-500/20',
      }

    case 'unhealthy':
      return {
        label: 'Unhealthy',
        icon: XCircle,
        container:
          'border-red-500/20 bg-red-500/5',
        iconColor: 'text-red-400',
        badge:
          'bg-red-500/10 text-red-400 border-red-500/20',
      }
  }
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDetailValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function ComponentIcon({ name }: { name: string }) {
  if (name.includes('PostgreSQL')) {
    return <Database className="h-5 w-5" />
  }

  if (
    name.includes('Spark') ||
    name.includes('Redpanda') ||
    name.includes('Debezium')
  ) {
    return <Activity className="h-5 w-5" />
  }

  if (name.includes('FastAPI')) {
    return <Server className="h-5 w-5" />
  }

  if (
    name.includes('Redis') ||
    name.includes('Order')
  ) {
    return <Zap className="h-5 w-5" />
  }

  return <Database className="h-5 w-5" />
}

function PipelineHealth() {
  const [health, setHealth] =
    useState<PipelineHealthResponse | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true)
    }

    try {
      setError(null)

      const result = await api.pipelineHealth()

      setHealth(result)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load pipeline health.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadHealth()

    const interval = window.setInterval(() => {
      loadHealth()
    }, 10000)

    return () => window.clearInterval(interval)
  }, [loadHealth])

  const latencyData = useMemo(
    () =>
      (health?.checks ?? [])
        .filter((check) => check.latency_ms !== null)
        .map((check) => ({
          name:
            check.name.length > 14
              ? `${check.name.slice(0, 14)}…`
              : check.name,
          latency: check.latency_ms as number,
          status: check.status,
        })),
    [health],
  )

  const statusMix = useMemo(() => {
    if (!health) return []

    return [
      { name: 'Healthy', value: health.summary.healthy, status: 'healthy' as PipelineStatus },
      { name: 'Degraded', value: health.summary.degraded, status: 'degraded' as PipelineStatus },
      { name: 'Unhealthy', value: health.summary.unhealthy, status: 'unhealthy' as PipelineStatus },
    ].filter((entry) => entry.value > 0)
  }, [health])

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-emerald-400" />

          <p className="mt-4 text-sm text-slate-400">
            Checking pipeline health...
          </p>
        </div>
      </div>
    )
  }

  if (error && !health) {
    return (
      <div className="space-y-6">
        <PageHeader
          onRefresh={() => loadHealth(true)}
          refreshing={refreshing}
        />

        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <XCircle className="mx-auto h-8 w-8 text-red-400" />

          <h2 className="mt-4 text-lg font-semibold text-white">
            Pipeline health unavailable
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!health) {
    return null
  }

  const overall = statusConfig(health.status)
  return (
    <div className="space-y-8">

      {/* Header */}

      <PageHeader
        onRefresh={() => loadHealth(true)}
        refreshing={refreshing}
        />

      {/* Summary */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <SummaryCard
          label="Components"
          value={health.summary.total}
          icon={<Server className="h-5 w-5" />}
        />

        <SummaryCard
          label="Healthy"
          value={health.summary.healthy}
          icon={<CheckCircle2 className="h-5 w-5" />}
          valueClass="text-emerald-400"
        />

        <SummaryCard
          label="Degraded"
          value={health.summary.degraded}
          icon={<AlertTriangle className="h-5 w-5" />}
          valueClass="text-amber-400"
        />

        <SummaryCard
          label="Unhealthy"
          value={health.summary.unhealthy}
          icon={<XCircle className="h-5 w-5" />}
          valueClass="text-red-400"
        />

      </section>

      {/* Overall status */}

      <section
        className={`rounded-2xl border p-5 ${overall.container}`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div className="flex items-center gap-4">

            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/60 ${overall.iconColor}`}
            >
              <overall.icon className="h-6 w-6" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Platform Status
              </p>

              <h2 className="mt-1 text-xl font-semibold text-white">
                All systems {overall.label.toLowerCase()}
              </h2>
            </div>

          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock3 className="h-4 w-4" />

            Last checked{' '}
            {formatTimestamp(health.checked_at)}
          </div>

        </div>
      </section>

      {/* Latency + status mix */}
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Component Latency
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Response time of each health check.
              </p>
            </div>
            <Gauge className="h-5 w-5 text-slate-500" />
          </div>

          {latencyData.length > 0 ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={latencyData}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    horizontal={false}
                  />

                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={(value) => `${value}ms`}
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    width={110}
                  />

                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      color: '#fff',
                    }}
                    formatter={(value) => [`${value} ms`, 'Latency']}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }}
                  />

                  <Bar dataKey="latency" radius={[0, 6, 6, 0]}>
                    {latencyData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.status]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No latency data reported yet.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Status Mix
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Component health distribution right now.
              </p>
            </div>
            <Server className="h-5 w-5 text-slate-500" />
          </div>

          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-[180px] w-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {statusMix.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.status]}
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
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="w-full space-y-3">
              {statusMix.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: STATUS_COLORS[entry.status] }}
                    />
                    <span className="text-slate-300">{entry.name}</span>
                  </div>
                  <span className="text-slate-500">
                    {entry.value} / {health.summary.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Components */}

      <section>

        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Infrastructure
          </p>

          <h2 className="mt-1 text-xl font-semibold text-white">
            Component Health
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Live operational checks across the FinPulse data platform.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">

          {health.checks.map((check) => (
            <HealthCard
              key={check.name}
              check={check}
            />
          ))}

        </div>

      </section>

      {/* Architecture */}

      <ArchitecturePanel />

      {error && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400">
          Automatic refresh warning: {error}
        </div>
      )}

    </div>
  )
}

function PageHeader({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          FinPulse
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Pipeline Health
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Monitor the operational state of the FinPulse batch,
          streaming, storage, and serving layers.
        </p>
      </div>

      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw
          className={`h-4 w-4 ${
            refreshing ? 'animate-spin' : ''
          }`}
        />

        Refresh
      </button>

    </header>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  valueClass = 'text-white',
}: {
  label: string
  value: number
  icon: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-5">

      <div className="flex items-center justify-between">

        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>

        <div className="text-slate-500">
          {icon}
        </div>

      </div>

      <p className={`mt-4 text-3xl font-bold ${valueClass}`}>
        {value}
      </p>

    </div>
  )
}

function HealthCard({
  check,
}: {
  check: PipelineCheck
}) {
  const config = statusConfig(check.status)
  const Icon = config.icon

  const details = Object.entries(check.details ?? {})

  return (
    <div
      className={`rounded-2xl border p-5 transition ${config.container}`}
    >

      <div className="flex items-start justify-between gap-4">

        <div className="flex min-w-0 items-center gap-4">

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950/50 ${config.iconColor}`}
          >
            <ComponentIcon name={check.name} />
          </div>

          <div className="min-w-0">

            <h3 className="truncate font-semibold text-white">
              {check.name}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {check.message}
            </p>

          </div>

        </div>

        <div
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${config.badge}`}
        >
          <Icon className="h-3 w-3" />
          {config.label}
        </div>

      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-800/70 pt-4">

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock3 className="h-3.5 w-3.5" />

          Latency
        </div>

        <span className="text-xs font-medium text-slate-300">
          {check.latency_ms === null
            ? '—'
            : `${check.latency_ms} ms`}
        </span>

      </div>

      {details.length > 0 && (
        <div className="mt-4 space-y-2">

          {details.map(([key, value]) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-lg bg-slate-950/30 px-3 py-2"
            >

              <span className="text-[11px] text-slate-500">
                {key.replaceAll('_', ' ')}
              </span>

              <span className="max-w-[70%] break-words text-right text-[11px] font-medium text-slate-300">
                {formatDetailValue(value)}
              </span>

            </div>
          ))}

        </div>
      )}

    </div>
  )
}

function ArchitecturePanel() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6">

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Architecture
        </p>

        <h2 className="mt-1 text-xl font-semibold text-white">
          FinPulse Data Flow
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          The platform combines a batch layer and a streaming
          speed layer before exposing data through FastAPI.
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">

        {/* Streaming */}

        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5">

          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />

            <span className="text-sm font-semibold text-white">
              Streaming / Speed Layer
            </span>
          </div>

          <Flow>
            PostgreSQL → Debezium → Redpanda → Spark → Redis
          </Flow>

        </div>

        {/* Batch */}

        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5">

          <div className="mb-4 flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-400" />

            <span className="text-sm font-semibold text-white">
              Batch Layer
            </span>
          </div>

          <Flow>
            PostgreSQL → Airflow → Raw Warehouse → dbt → Marts
          </Flow>

        </div>

      </div>

      <div className="mt-6 flex justify-center">

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-6 py-4 text-center">

          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Serving Layer
          </p>

          <p className="mt-1 font-semibold text-cyan-400">
            FastAPI
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Batch + Realtime + Lambda Views
          </p>

        </div>

      </div>

    </section>
  )
}

function Flow({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-[#080b12] px-4 py-4">

      <p className="whitespace-nowrap text-sm font-medium text-slate-300">
        {children}
      </p>

    </div>
  )
}

export default PipelineHealth