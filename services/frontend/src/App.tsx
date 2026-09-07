import {
  Activity,
  BarChart3,
  Boxes,
  Database,
  LayoutDashboard,
  Radio,
  Users,
} from 'lucide-react'
import { useState } from 'react'

import Overview from './pages/Overview'
import Revenue from './pages/Revenue'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Realtime from './pages/Realtime'
import PipelineHealth from './pages/PipelineHealth'

type Page =
  | 'overview'
  | 'revenue'
  | 'products'
  | 'customers'
  | 'realtime'
  | 'pipeline'

function App() {
  const [activePage, setActivePage] = useState<Page>('overview')

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-200">
      <div className="flex min-h-screen">

        {/* =========================
            Sidebar
            ========================= */}

        <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-[#0b0f17] lg:block">

          <div className="sticky top-0 flex h-screen flex-col">

            {/* Logo */}

            <div className="flex h-20 items-center border-b border-slate-800 px-6">

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Activity className="h-5 w-5 text-emerald-400" />
                </div>

                <div>

                  <p className="font-semibold tracking-tight text-white">
                    FinPulse
                  </p>

                  <p className="text-[10px] uppercase tracking-widest text-slate-500">
                    Data Platform
                  </p>

                </div>

              </div>

            </div>

            {/* Navigation */}

            <nav className="flex-1 space-y-1 px-3 py-6">

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
                active={activePage === 'products'}
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

            {/* System Status */}

            <div className="border-t border-slate-800 p-4">

              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">

                <div className="flex items-center gap-2">

                  <span className="h-2 w-2 rounded-full bg-emerald-400" />

                  <span className="text-xs font-medium text-emerald-400">
                    System Operational
                  </span>

                </div>

                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  FinPulse data platform is running normally.
                </p>

              </div>

            </div>

          </div>

        </aside>

        {/* =========================
            Main Content
            ========================= */}

        <main className="min-w-0 flex-1">

          <div className="mx-auto max-w-[1600px] p-5 md:p-8">
            {renderPage(activePage)}
          </div>

        </main>

      </div>
    </div>
  )
}

/* =========================
   Page Router
   ========================= */

function renderPage(page: Page) {
  switch (page) {

    case 'overview':
      return <Overview />

    case 'revenue':
      return <Revenue />

    case 'products':
      return <Products />

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

/* =========================
   Navigation Item
   ========================= */

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
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
        active
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />

      {label}
    </button>
  )
}

export default App