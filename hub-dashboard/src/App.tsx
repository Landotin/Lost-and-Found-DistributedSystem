import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, ScrollText, BarChart3, Wifi } from 'lucide-react'
import Monitor from './pages/Monitor'
import Ledger from './pages/Ledger'
import Logs from './pages/Logs'
import Analytics from './pages/Analytics'

const navItems = [
  { to: '/monitor', label: 'Monitor', icon: LayoutDashboard },
  { to: '/ledger', label: 'Ledger', icon: ClipboardList },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
] as const

function App() {
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Logo / Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-800">
          <Wifi className="w-6 h-6 text-blue-400" />
          <span className="font-semibold text-lg tracking-tight">RDLFT Hub</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
        <div className="px-6 py-4 border-t border-gray-800 text-xs text-gray-500">
          Hub Dashboard v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/monitor" replace />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
