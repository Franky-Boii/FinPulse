import {
  Activity,
  BarChart3,
  Boxes,
  Database,
  LayoutDashboard,
  Radio,
  RefreshCw,
  Users,
  Wifi,
} from 'lucide-react'
import { useState } from 'react'

import Overview from './pages/Overview'
import Revenue from './pages/Revenue'
import Products from './pages/Products'
import ProductDetails from './pages/ProductDetails'
import Customers from './pages/Customers'
import Realtime from './pages/Realtime'
import PipelineHealth from './pages/PipelineHealth'

type Page =
  | 'overview'
  | 'revenue'
  | 'products'
  | 'product-details'
  | 'customers'
  | 'realtime'
  | 'pipeline'

function App() {
  const [activePage, setActivePage] = useState<Page>('overview')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  )

  function openProduct(productId: number) {
    setSelectedProductId(productId)
    setActivePage('product-details')
  }

  function closeProductDetails() {
    setSelectedProductId(null)
    setActivePage('products')
  }

  return (
    <div className="finpulse-app min-h-screen text-slate-200">
      <div className="flex min-h-screen">

        {/* =====================================================
            SIDEBAR
            ===================================================== */}

        <aside className="hidden w-64 shrink-0 border-r border-slate-800/80 bg-[#090d15]/95 lg:block">

          <div className="sticky top-0 flex h-screen flex-col">

            {/* Logo */}

            <div className="flex h-[78px] items-center border-b border-slate-800/80 px-5">

              <div className="flex items-center gap-3">

                <div className="logo-mark">
                  <Activity className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-[15px] font-semibold tracking-tight text-white">
                    FinPulse
                  </p>

                  <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Data Platform
                  </p>
                </div>

              </div>

            </div>

            {/* Navigation */}

            <div className="px-3 pt-6">

              <p className="px-3 pb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                Platform
              </p>

              <nav className="space-y-1">

                <NavItem
                  icon={LayoutDashboard}
                  label="Overview"
                  active={activePage === 'overview'}
                  onClick={() => setActivePage('overview')}
                />

                <NavItem
                  icon={BarChart3}
                  label="Revenue"
                  active={activePage === 'revenue'}
                  onClick={() => setActivePage('revenue')}
                />

                <NavItem
                  icon={Boxes}
                  label="Products"
                  active={
                    activePage === 'products' ||
                    activePage === 'product-details'
                  }
                  onClick={() => setActivePage('products')}
                />

                <NavItem
                  icon={Users}
                  label="Customers"
                  active={activePage === 'customers'}
                  onClick={() => setActivePage('customers')}
                />

                <NavItem
                  icon={Radio}
                  label="Realtime"
                  active={activePage === 'realtime'}
                  onClick={() => setActivePage('realtime')}
                />

                <NavItem
                  icon={Database}
                  label="Pipeline Health"
                  active={activePage === 'pipeline'}
                  onClick={() => setActivePage('pipeline')}
                />

              </nav>

            </div>

            {/* Sidebar spacer */}

            <div className="flex-1" />

            {/* System Status */}

            <div className="border-t border-slate-800/80 p-4">

              <div className="status-card">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-2">

                    <span className="status-dot" />

                    <span className="text-xs font-semibold text-emerald-400">
                      System Operational
                    </span>

                  </div>

                  <Wifi className="h-3.5 w-3.5 text-emerald-500/70" />

                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  FinPulse data platform is running normally.
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-emerald-500/10 pt-3">
                  <span className="text-[9px] uppercase tracking-wider text-slate-600">
                    Pipeline
                  </span>

                  <span className="text-[10px] font-medium text-emerald-400">
                    Healthy
                  </span>
                </div>

              </div>

            </div>

          </div>

        </aside>

        {/* =====================================================
            MAIN CONTENT
            ===================================================== */}

        <main className="min-w-0 flex-1">

          {/* Top Header */}

          <header className="sticky top-0 z-20 border-b border-slate-800/70 bg-[#080b12]/85 backdrop-blur-xl">

            <div className="flex h-[64px] items-center justify-between px-5 md:px-8">

              <div className="flex items-center gap-3">

                <div className="flex items-center gap-2 lg:hidden">
                  <div className="logo-mark h-8 w-8">
                    <Activity className="h-4 w-4" />
                  </div>

                  <span className="text-sm font-semibold text-white">
                    FinPulse
                  </span>
                </div>

                <div className="hidden h-5 w-px bg-slate-800 lg:block" />

                <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
                  <span>Data Platform</span>
                  <span className="text-slate-700">/</span>
                  <span className="text-slate-400">
                    {getPageLabel(activePage)}
                  </span>
                </div>

              </div>

              <div className="flex items-center gap-3">

                <div className="hidden items-center gap-2 rounded-full border border-emerald-500/10 bg-emerald-500/5 px-3 py-1.5 sm:flex">
                  <span className="status-dot h-1.5 w-1.5" />

                  <span className="text-[10px] font-medium text-emerald-400">
                    Live
                  </span>
                </div>

                <div className="hidden text-[10px] text-slate-600 md:block">
                  {new Date().toLocaleDateString('en-ZA', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>

                <button
                  className="header-refresh"
                  title="Refresh"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

              </div>

            </div>

          </header>

          {/* Page */}

          <div className="relative">

            <div className="dashboard-glow dashboard-glow-one" />
            <div className="dashboard-glow dashboard-glow-two" />

            <div className="relative mx-auto max-w-[1600px] p-5 md:p-8">

              {renderPage(
                activePage,
                selectedProductId,
                openProduct,
                closeProductDetails,
              )}

            </div>

          </div>

        </main>

      </div>
    </div>
  )
}

/* ============================================================
   PAGE ROUTER
   ============================================================ */

function renderPage(
  page: Page,
  selectedProductId: number | null,
  openProduct: (productId: number) => void,
  closeProductDetails: () => void,
) {
  switch (page) {
    case 'overview':
      return <Overview />

    case 'revenue':
      return <Revenue />

    case 'products':
      return <Products onOpenProduct={openProduct} />

    case 'product-details':
      if (selectedProductId === null) {
        return <Products onOpenProduct={openProduct} />
      }

      return (
        <ProductDetails
          productId={selectedProductId}
          onBack={closeProductDetails}
        />
      )

    case 'customers':
      return <Customers />

    case 'realtime':
      return <Realtime />

    case 'pipeline':
      return <PipelineHealth />

    default:
      return <Overview />
  }
}

/* ============================================================
   PAGE LABEL
   ============================================================ */

function getPageLabel(page: Page) {
  switch (page) {
    case 'overview':
      return 'Overview'

    case 'revenue':
      return 'Revenue'

    case 'products':
      return 'Products'

    case 'product-details':
      return 'Products / Details'

    case 'customers':
      return 'Customers'

    case 'realtime':
      return 'Realtime'

    case 'pipeline':
      return 'Pipeline Health'

    default:
      return 'Overview'
  }
}

/* ============================================================
   NAVIGATION ITEM
   ============================================================ */

interface NavItemProps {
  icon: typeof LayoutDashboard
  label: string
  active?: boolean
  onClick: () => void
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`nav-item group ${
        active ? 'nav-item-active' : ''
      }`}
    >
      <span
        className={`nav-icon ${
          active
            ? 'text-emerald-400'
            : 'text-slate-500 group-hover:text-slate-300'
        }`}
      >
        <Icon className="h-[17px] w-[17px]" />
      </span>

      <span className="flex-1 text-left">
        {label}
      </span>

      {active && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      )}
    </button>
  )
}

export default App