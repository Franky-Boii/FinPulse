import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api } from '../services/api'
import type {
  ProductDetails as ProductDetailsData,
  ProductRecentOrder,
  ProductSalesHistory,
} from '../services/api'

interface ProductDetailsProps {
  productId: number
  onBack: () => void
}

export default function ProductDetails({
  productId,
  onBack,
}: ProductDetailsProps) {
  const [data, setData] = useState<ProductDetailsData | null>(null)

  const [salesHistory, setSalesHistory] = useState<
    ProductSalesHistory[]
  >([])

  const [recentOrders, setRecentOrders] = useState<
    ProductRecentOrder[]
  >([])

  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProduct() {
      try {
        setLoading(true)
        setError(null)

        const result = await api.productDetails(productId)

        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load product details',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    async function loadSalesHistory() {
      try {
        setHistoryLoading(true)
        setHistoryError(null)

        const result = await api.productSalesHistory(
          productId,
          30,
        )

        if (!cancelled) {
          setSalesHistory(result)
        }
      } catch (err) {
        if (!cancelled) {
          setHistoryError(
            err instanceof Error
              ? err.message
              : 'Failed to load sales history',
          )
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      }
    }

    async function loadRecentOrders() {
      try {
        setOrdersLoading(true)
        setOrdersError(null)

        const result = await api.productRecentOrders(
          productId,
          20,
        )

        if (!cancelled) {
          setRecentOrders(result)
        }
      } catch (err) {
        if (!cancelled) {
          setOrdersError(
            err instanceof Error
              ? err.message
              : 'Failed to load recent orders',
          )
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false)
        }
      }
    }

    loadProduct()
    loadSalesHistory()
    loadRecentOrders()

    return () => {
      cancelled = true
    }
  }, [productId])

  const formatCurrency = (value: number) =>
    `R${value.toLocaleString('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const formatNumber = (value: number) =>
    value.toLocaleString('en-ZA')

  const formatDate = (value: string) => {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const chartData = useMemo(() => {
    return [...salesHistory]
      .reverse()
      .map((item) => ({
        ...item,
        dateLabel: new Date(item.order_date).toLocaleDateString(
          'en-ZA',
          {
            day: '2-digit',
            month: 'short',
          },
        ),
      }))
  }, [salesHistory])

  const getStatusClasses = (status: string) => {
    const normalizedStatus = status.toLowerCase()

    if (
      normalizedStatus === 'cancelled' ||
      normalizedStatus === 'canceled'
    ) {
      return 'border-red-500/20 bg-red-500/10 text-red-400'
    }

    if (
      normalizedStatus === 'shipped' ||
      normalizedStatus === 'delivered'
    ) {
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    }

    if (
      normalizedStatus === 'placed' ||
      normalizedStatus === 'processing'
    ) {
      return 'border-blue-500/20 bg-blue-500/10 text-blue-400'
    }

    return 'border-slate-700 bg-slate-800/60 text-slate-400'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Products
        </button>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <p className="text-slate-400">
            Loading product details...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="text-sm text-slate-400 transition hover:text-white"
        >
          ← Back to Products
        </button>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8">
          <h2 className="text-lg font-semibold text-red-400">
            Unable to load product
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { product, metrics } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="mb-3 text-sm text-slate-400 transition hover:text-white"
          >
            ← Back to Products
          </button>

          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {product.product_name}
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Product #{product.product_id} · {product.category}
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400">
          Active Product
        </div>
      </div>

      {/* Product information */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Category
          </p>

          <p className="mt-3 text-lg font-semibold text-white">
            {product.category}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Unit Price
          </p>

          <p className="mt-3 text-lg font-semibold text-white">
            {formatCurrency(product.unit_price)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Product ID
          </p>

          <p className="mt-3 text-lg font-semibold text-white">
            #{product.product_id}
          </p>
        </div>
      </div>

      {/* Performance KPIs */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Sales Performance
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Revenue
            </p>

            <p className="mt-3 text-2xl font-semibold text-emerald-400">
              {formatCurrency(metrics.revenue)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Units Sold
            </p>

            <p className="mt-3 text-2xl font-semibold text-white">
              {formatNumber(metrics.units_sold)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Orders
            </p>

            <p className="mt-3 text-2xl font-semibold text-white">
              {formatNumber(metrics.order_count)}
            </p>
          </div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Revenue Trend
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Daily revenue generated by this product
            </p>
          </div>

          {!historyLoading && salesHistory.length > 0 && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Days Tracked
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-300">
                {salesHistory.length}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 h-80 w-full">
          {historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">
                Loading revenue trend...
              </p>
            </div>
          ) : historyError ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-red-400">
                {historyError}
              </p>
            </div>
          ) : salesHistory.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">
                No sales history available for this product.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 10,
                  left: 10,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148, 163, 184, 0.12)"
                />

                <XAxis
                  dataKey="dateLabel"
                  tick={{
                    fill: '#64748b',
                    fontSize: 12,
                  }}
                  axisLine={{
                    stroke: 'rgba(148, 163, 184, 0.15)',
                  }}
                  tickLine={false}
                />

                <YAxis
                  tick={{
                    fill: '#64748b',
                    fontSize: 12,
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) =>
                    `R${(value / 1000).toFixed(0)}k`
                  }
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '12px',
                    color: '#e2e8f0',
                  }}
                  labelStyle={{
                    color: '#94a3b8',
                  }}
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    'Revenue',
                  ]}
                />

                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: '#34d399',
                  }}
                  activeDot={{
                    r: 5,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Daily sales history */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Daily Sales History
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Daily units, revenue and order activity for this product
          </p>
        </div>

        <div className="mt-5 overflow-x-auto">
          {historyLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading sales history...
            </p>
          ) : historyError ? (
            <p className="py-8 text-center text-sm text-red-400">
              {historyError}
            </p>
          ) : salesHistory.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No sales history available.
            </p>
          ) : (
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-medium">
                    Date
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Units Sold
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Revenue
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Orders
                  </th>
                </tr>
              </thead>

              <tbody>
                {salesHistory.map((item) => (
                  <tr
                    key={item.order_date}
                    className="border-b border-slate-900"
                  >
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {formatDate(item.order_date)}
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-slate-300">
                      {formatNumber(item.units_sold)}
                    </td>

                    <td className="px-4 py-3 text-right text-sm font-medium text-emerald-400">
                      {formatCurrency(item.revenue)}
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-slate-300">
                      {formatNumber(item.order_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Recent Orders
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest orders containing this product
            </p>
          </div>

          {!ordersLoading && recentOrders.length > 0 && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Showing
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-300">
                {recentOrders.length} orders
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 overflow-x-auto">
          {ordersLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Loading recent orders...
            </p>
          ) : ordersError ? (
            <p className="py-8 text-center text-sm text-red-400">
              {ordersError}
            </p>
          ) : recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No recent orders found for this product.
            </p>
          ) : (
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-medium">
                    Order
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Customer
                  </th>

                  <th className="px-4 py-3 font-medium">
                    Date
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Quantity
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Revenue
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.order_id}
                    className="border-b border-slate-900 transition hover:bg-slate-900/40"
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-white">
                        #{order.order_id}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Customer #{order.customer_id}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-300">
                        {order.customer_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {order.customer_email}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-300">
                      {formatDate(order.order_date)}
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-slate-300">
                      {formatNumber(order.quantity)}
                    </td>

                    <td className="px-4 py-4 text-right text-sm font-medium text-emerald-400">
                      {formatCurrency(order.revenue)}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                          order.order_status,
                        )}`}
                      >
                        {order.order_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Product metadata */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">
          Product Information
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Created
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {formatDate(product.created_at)}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Last Updated
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {formatDate(product.updated_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}