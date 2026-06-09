import { useState, useEffect, useCallback } from 'react'
import { fetchAnalytics, type AnalyticsResult } from '../hooks/useAdminApi'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3, Loader2, AlertCircle, RefreshCw, SearchX } from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// Analytics Page
// ---------------------------------------------------------------------------

function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAnalytics()
      setAnalytics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    // Defer data loading to avoid setState-in-effect lint
    Promise.resolve().then(() => {
      if (!cancelled) loadAnalytics()
    })
    return () => {
      cancelled = true
    }
  }, [loadAnalytics])

  // Prepare chart data
  const chartData = analytics
    ? Object.entries(analytics.itemsByDepartment).map(([department, count]) => ({
        department,
        items: count,
      }))
    : []

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 mt-1">Charts and statistics</p>
        </div>
        <button
          onClick={loadAnalytics}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={loadAnalytics} className="ml-auto text-xs font-medium text-red-200 hover:text-white underline">
            Retry
          </button>
        </div>
      )}

      {loading && !analytics ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="flex flex-col items-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Loading analytics...</p>
          </div>
        </div>
      ) : analytics ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-400">Total Items</h2>
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-4xl font-bold text-white">{analytics.totalItems}</p>
              <p className="text-xs text-gray-500 mt-1">across all departments</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-400">Lost Items</h2>
                <SearchX className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-4xl font-bold text-yellow-300">{analytics.totalLost}</p>
              <p className="text-xs text-gray-500 mt-1">awaiting discovery</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-400">Claim Rate</h2>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-900/50 text-green-300 border border-green-700">
                  resolved
                </span>
              </div>
              <p className="text-4xl font-bold text-white">{formatPercent(analytics.claimRate)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {analytics.totalClaimed} claimed / {analytics.totalFound + analytics.totalClaimed} found
              </p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-400">Found Items</h2>
                <span className="text-xs text-gray-500">total found</span>
              </div>
              <p className="text-4xl font-bold text-white">{analytics.totalFound}</p>
              <p className="text-xs text-gray-500 mt-1">{analytics.totalClaimed} claimed</p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Items by Department</h2>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center min-h-[200px] text-gray-500">
                <p className="text-sm">No department data available</p>
              </div>
            ) : (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="department"
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      axisLine={{ stroke: '#4B5563' }}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      axisLine={{ stroke: '#4B5563' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB',
                        fontSize: '12px',
                      }}
                      cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                    />
                    <Bar dataKey="items" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

export default Analytics
