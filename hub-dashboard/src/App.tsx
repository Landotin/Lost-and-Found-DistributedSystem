import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, SearchX, Search, CheckCircle, ScrollText, BarChart3, Wifi } from 'lucide-react'
import Monitor from './pages/Monitor'
import AllItems from './pages/AllItems'
import LostItems from './pages/LostItems'
import FoundItems from './pages/FoundItems'
import ClaimedItems from './pages/ClaimedItems'
import Logs from './pages/Logs'
import Analytics from './pages/Analytics'

const navItems = [
  { to: '/monitor', label: 'Monitor', icon: LayoutDashboard },
  { to: '/all-items', label: 'All Items', icon: ClipboardList },
  { to: '/lost-items', label: 'Lost Items', icon: SearchX },
  { to: '/found-items', label: 'Found Items', icon: Search },
  { to: '/claimed-items', label: 'Claimed Items', icon: CheckCircle },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
] as const

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100 md:h-screen md:flex-row">
      {/* Sidebar */}
      <aside className="flex shrink-0 flex-col border-b border-gray-800 bg-gray-900 md:w-64 md:border-b-0 md:border-r">
        {/* Logo / Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-800">
          <Wifi className="w-6 h-6 text-blue-400" />
          <span className="font-semibold text-lg tracking-tight">RDLFT Hub</span>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible md:py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="hidden px-6 py-4 border-t border-gray-800 text-xs text-gray-500 md:block">
          Hub Dashboard v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/monitor" replace />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/all-items" element={<AllItems />} />
          <Route path="/ledger" element={<Navigate to="/all-items" replace />} />
          <Route path="/lost-items" element={<LostItems />} />
          <Route path="/found-items" element={<FoundItems />} />
          <Route path="/claimed-items" element={<ClaimedItems />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
