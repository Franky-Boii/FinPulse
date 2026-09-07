import { useEffect, useMemo, useState } from 'react'
import {
  Globe2,
  Mail,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react'

import {
  api,
  type CustomerMetric,
  type CustomerSummary,
  type CustomersByRegion,
} from '../services/api'

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

export default function Customers() {
  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [customers, setCustomers] = useState<CustomerMetric[]>([])
  const [regions, setRegions] = useState<CustomersByRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCustomers() {
      try {
        setLoading(true)
        setError(null)

        const [summaryData, customerData, regionData] = await Promise.all([
          api.customersSummary(),
          api.customerMetrics(),
          api.customersByRegion(),
        ])

        setSummary(summaryData)
        setCustomers(customerData)
        setRegions(regionData)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load customer data.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadCustomers()
  }, [])

  const totalRegionCustomers = useMemo(
    () => regions.reduce((sum, region) => sum + region.customer_count, 0),
    [regions],
  )

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
          <p className="mt-4 text-sm text-slate-500">
            Loading customer intelligence...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
        <p className="text-sm font-semibold text-red-400">
          Unable to load customer data
        </p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Customer Intelligence
        </p>

        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Customers
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Customer distribution, purchasing behaviour, and lifetime value.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live from dbt customer marts
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Customers"
          value={formatNumber(summary?.customer_count ?? 0)}
          icon={Users}
          description="Tracked customers"
        />

        <MetricCard
          label="Total Revenue"
          value={formatCurrency(summary?.total_revenue ?? 0)}
          icon={TrendingUp}
          description="Customer-attributed revenue"
        />

        <MetricCard
          label="Average Spend"
          value={formatCurrency(summary?.average_customer_spend ?? 0)}
          icon={ShoppingBag}
          description="Revenue per customer"
        />

        <MetricCard
          label="Average Orders"
          value={(summary?.average_orders_per_customer ?? 0).toFixed(1)}
          icon={Globe2}
          description="Orders per customer"
        />
      </div>

      {/* Regional distribution */}
      <section className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">
                Customers by Region
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Geographic distribution
              </p>
            </div>

            <Globe2 className="h-5 w-5 text-slate-600" />
          </div>

          <div className="mt-6 space-y-5">
            {regions.map((region) => {
              const percentage =
                totalRegionCustomers > 0
                  ? (region.customer_count / totalRegionCustomers) * 100
                  : 0

              return (
                <div key={region.region}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      {region.region}
                    </span>

                    <span className="text-xs text-slate-500">
                      {formatNumber(region.customer_count)} ·{' '}
                      {percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Customer ranking */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b0f17]">
          <div className="border-b border-slate-800 p-6">
            <h2 className="font-semibold text-white">
              Top Customers by Revenue
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Highest-value customers in the current customer mart
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-600">
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Region</th>
                  <th className="px-6 py-4 text-right">Orders</th>
                  <th className="px-6 py-4 text-right">Units</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.customer_id}
                    className="border-b border-slate-800/60 transition hover:bg-slate-800/20"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-200">
                          {customer.full_name}
                        </p>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm text-slate-300">
                          {customer.region}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {customer.country}
                        </p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right text-sm text-slate-300">
                      {formatNumber(customer.order_count)}
                    </td>

                    <td className="px-6 py-4 text-right text-sm text-slate-300">
                      {formatNumber(customer.total_units_sold)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-semibold text-emerald-400">
                        {formatCurrency(customer.total_order_value)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        Latest: {customer.latest_order_date}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: string
  description: string
  icon: typeof Users
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
}: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-emerald-500/10 p-2.5">
          <Icon className="h-4 w-4 text-emerald-400" />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-600">{description}</p>
    </div>
  )
}
