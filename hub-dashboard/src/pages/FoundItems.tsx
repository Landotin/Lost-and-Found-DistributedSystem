import { useState, useEffect, useCallback } from 'react'
import { fetchAllItems, type ItemDetail } from '../hooks/useAdminApi'
import { useItemFilter } from '../hooks/useItemFilter'
import { StatusBadge } from './AllItems'
import { Search, Loader2, AlertCircle, X, Eye, SearchX, WifiOff } from 'lucide-react'

// ---------------------------------------------------------------------------
// Detail Modal (Found-specific)
// ---------------------------------------------------------------------------

function DetailModal({ item, onClose }: { item: ItemDetail | null; onClose: () => void }) {
  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Found Item #{item.id} Detail</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {item.image_data && (
            <div className="flex justify-center">
              <img src={item.image_data} alt={item.item_name} className="max-h-64 rounded-lg border border-gray-700 object-contain" />
            </div>
          )}

          <Section title="Basic Information">
            <Field label="Item Name" value={item.item_name} />
            <Field label="Description" value={item.description ?? '—'} />
            <Field label="Status">
              <StatusBadge status={item.status} />
            </Field>
            <Field label="Department" value={item.department_origin} />
          </Section>

          <Section title="Location">
            <Field label="Found Location" value={item.found_location ?? '—'} />
          </Section>

          {item.reporter_full_name && (
            <Section title="Reporter (PII)">
              <Field label="Full Name" value={item.reporter_full_name} />
              <Field label="Mobile" value={item.reporter_mobile ?? '—'} />
              <Field label="ID Type" value={item.reporter_id_type ?? '—'} />
              <Field label="ID Number" value={item.reporter_id_number ?? '—'} />
            </Section>
          )}

          {item.surrenderer_full_name && (
            <Section title="Surrenderer (PII)">
              <Field label="Full Name" value={item.surrenderer_full_name} />
              <Field label="Mobile" value={item.surrenderer_mobile ?? '—'} />
              <Field label="ID Type" value={item.surrenderer_id_type ?? '—'} />
              <Field label="ID Number" value={item.surrenderer_id_number ?? '—'} />
            </Section>
          )}

          <Section title="Timestamps">
            <Field label="Created At" value={new Date(item.created_at).toLocaleString()} />
            <Field label="Updated At" value={new Date(item.updated_at).toLocaleString()} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children ?? <p className="text-sm text-white">{value ?? '—'}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Found Items Page
// ---------------------------------------------------------------------------

function FoundItems() {
  const [items, setItems] = useState<ItemDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<ItemDetail | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllItems()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) loadItems()
    })
    return () => { cancelled = true }
  }, [loadItems])

  const { searched } = useItemFilter(items, 'found', searchQuery)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Search className="w-7 h-7 text-blue-400" />
          Found Items
        </h1>
        <p className="text-gray-400 mt-1">Items found and awaiting claim processing</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by item name, surrenderer, department, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-800 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={loadItems} className="ml-auto text-xs font-medium text-red-200 hover:text-white underline">
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Items {!loading && <span className="text-sm font-normal text-gray-500">({searched.length})</span>}
          </h2>
          <button
            onClick={loadItems}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading && items.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Loading items...</p>
          </div>
        ) : !loading && items.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <WifiOff className="w-10 h-10 mb-3" />
            <p className="text-sm">No items tracked yet</p>
          </div>
        ) : searched.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-500">
            <SearchX className="w-10 h-10 mb-3" />
            <p className="text-sm">
              {searchQuery ? 'No found items match your search' : 'No found items reported'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Photo</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">ID</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Item</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Department</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Surrenderer</th>
                  <th className="text-left px-6 py-3 text-gray-400 font-medium">Date Found</th>
                  <th className="text-right px-6 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {searched.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      {item.image_data ? (
                        <img src={item.image_data} alt="" className="h-10 w-10 rounded-lg border border-gray-700 object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-gray-600 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">{item.id}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">{item.item_name}</p>
                        {item.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{item.department_origin}</td>
                    <td className="px-6 py-4 text-gray-300">{item.surrenderer_full_name ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-300 text-xs">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  )
}

export default FoundItems
