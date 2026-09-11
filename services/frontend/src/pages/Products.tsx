import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  DollarSign,
  Package,
  PieChart as PieIcon,
  TrendingUp,
} from 'lucide-react'
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
import { api, type TopProduct } from '../services/api'
import { computeCategoryBreakdown } from '../lib/dashboardMath'

const CATEGORY_COLORS = [
  '#34d399',
  '#22d3ee',
  '#a78bfa',
  '#fbbf24',
  '#fb7185',
  '#60a5fa',
]

interface ProductsProps {
  onOpenProduct: (productId: number) => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-ZA').format(value)
}

export default function Products({
  onOpenProduct,
}: ProductsProps) {
  const [products, setProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadProducts() {
    try {
      setError(null)

      const data = await api.topProducts()

      setProducts(data)
    } catch (err) {
      console.error(err)
      setError('Unable to load product data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()

    const interval = setInterval(loadProducts, 30_000)

    return () => clearInterval(interval)
  }, [])

  const metrics = useMemo(() => {
    const totalRevenue = products.reduce(
      (sum, product) => sum + Number(product.revenue),
      0,
    )

    const totalUnits = products.reduce(
      (sum, product) => sum + Number(product.units_sold),
      0,
    )

    const topProduct = products[0]

    return {
      totalRevenue,
      totalUnits,
      topProduct,
      productCount: products.length,
    }
  }, [products])

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(products),
    [products],
  )

  const categoryTotal = categoryBreakdown.reduce(
    (sum, entry) => sum + entry.value,
    0,
  )

  const productChartData = useMemo(
    () =>
      [...products]
        .sort((a, b) => Number(b.revenue) - Number(a.revenue))
        .slice(0, 8)
        .map((product) => ({
          name:
            product.product_name.length > 16
              ? `${product.product_name.slice(0, 16)}…`
              : product.product_name,
          revenue: Number(product.revenue),
        })),
    [products],
  )

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-sm text-slate-400">
          Loading product intelligence...
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
              Products
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Product performance and sales intelligence from the batch
              analytics layer.
            </p>
          </div>

          <button
            onClick={loadProducts}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        <MetricCard
          label="Products Tracked"
          value={formatNumber(metrics.productCount)}
          description="Products in warehouse"
          icon={<Boxes size={18} />}
        />

        <MetricCard
          label="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          description="Revenue across products"
          icon={<DollarSign size={18} />}
        />

        <MetricCard
          label="Units Sold"
          value={formatNumber(metrics.totalUnits)}
          description="Total units sold"
          icon={<Package size={18} />}
        />

        <MetricCard
          label="Top Product"
          value={metrics.topProduct?.product_name ?? '—'}
          description="Highest revenue product"
          icon={<TrendingUp size={18} />}
        />

      </div>

      {/* Category donut + product revenue bar chart */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Revenue by Category
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Share of revenue across tracked categories.
              </p>
            </div>
            <PieIcon className="h-5 w-5 text-slate-500" />
          </div>

          {categoryBreakdown.length > 0 ? (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <div className="h-[190px] w-[190px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="category"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={entry.category}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
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
            <p className="text-sm text-slate-500">No category data yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">
              Revenue by Product
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Top products ranked by revenue.
            </p>
          </div>

          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={productChartData}
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
                  tickFormatter={formatCompactCurrency}
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
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    'Revenue',
                  ]}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }}
                />

                <Bar dataKey="revenue" fill="#34d399" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Product Ranking */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/60">

        <div className="border-b border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white">
            Product Performance
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Products ranked by revenue generated. Select a product to view
            detailed performance.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">

            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-medium">
                  Rank
                </th>

                <th className="px-6 py-4 font-medium">
                  Product
                </th>

                <th className="px-6 py-4 font-medium">
                  Category
                </th>

                <th className="px-6 py-4 font-medium">
                  Units Sold
                </th>

                <th className="px-6 py-4 font-medium">
                  Revenue
                </th>

                <th className="px-6 py-4 font-medium">
                  Revenue Share
                </th>
              </tr>
            </thead>

            <tbody>
              {products.map((product, index) => {
                const revenueShare =
                  metrics.totalRevenue > 0
                    ? (Number(product.revenue) /
                        metrics.totalRevenue) *
                      100
                    : 0

                return (
                  <tr
                    key={product.product_id}
                    onClick={() =>
                      onOpenProduct(product.product_id)
                    }
                    className="cursor-pointer border-b border-slate-900 transition hover:bg-slate-900/60"
                    title={`View ${product.product_name} details`}
                  >

                    {/* Rank */}
                    <td className="px-6 py-5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                          index === 0
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {index + 1}
                      </div>
                    </td>

                    {/* Product */}
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
                          <Package className="h-4 w-4 text-slate-400" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-white transition group-hover:text-emerald-400">
                            {product.product_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Product #{product.product_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-5">
                      <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400">
                        {product.category}
                      </span>
                    </td>

                    {/* Units */}
                    <td className="px-6 py-5 text-sm text-slate-300">
                      {formatNumber(product.units_sold)}
                    </td>

                    {/* Revenue */}
                    <td className="px-6 py-5">
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(product.revenue)}
                      </span>
                    </td>

                    {/* Revenue Share */}
                    <td className="px-6 py-5">
                      <div className="min-w-[140px]">

                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {revenueShare.toFixed(1)}%
                          </span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{
                              width: `${Math.min(
                                revenueShare,
                                100,
                              )}%`,
                            }}
                          />
                        </div>

                      </div>
                    </td>

                  </tr>
                )
              })}
            </tbody>

          </table>
        </div>
      </section>

      {/* Top Product Highlight */}
      {metrics.topProduct && (
        <section className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-6">

          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Leading Product
              </p>

              <h2 className="mt-2 text-2xl font-bold text-white">
                {metrics.topProduct.product_name}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Currently the highest revenue-generating product in the
                FinPulse warehouse.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">

              <div>
                <p className="text-xs text-slate-500">
                  Revenue
                </p>

                <p className="mt-1 text-xl font-bold text-white">
                  {formatCurrency(metrics.topProduct.revenue)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Units
                </p>

                <p className="mt-1 text-xl font-bold text-white">
                  {formatNumber(metrics.topProduct.units_sold)}
                </p>
              </div>

            </div>
          </div>

        </section>
      )}
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
        <span className="text-sm text-slate-400">
          {label}
        </span>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-cyan-400">
          {icon}
        </div>
      </div>

      <div className="mt-5 truncate text-2xl font-bold tracking-tight text-white">
        {value}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>

    </div>
  )
}