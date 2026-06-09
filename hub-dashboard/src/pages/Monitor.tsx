function Monitor() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Monitor</h1>
        <p className="text-gray-400 mt-1">Real-time connection status and node health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Node count card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400">Connected Nodes</h2>
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
          <p className="text-4xl font-bold text-white">—</p>
        </div>

        {/* Hub uptime card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400">Hub Uptime</h2>
            <span className="text-xs text-gray-500">live</span>
          </div>
          <p className="text-4xl font-bold text-white">—</p>
        </div>

        {/* Items tracked card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-400">Items Tracked</h2>
            <span className="text-xs text-gray-500">total</span>
          </div>
          <p className="text-4xl font-bold text-white">—</p>
        </div>
      </div>
    </div>
  )
}

export default Monitor
