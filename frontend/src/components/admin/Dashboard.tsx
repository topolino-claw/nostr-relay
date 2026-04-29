import { useState, useEffect } from 'preact/hooks'
import { adminApi } from '../../services/AdminApiClient'

interface Stats {
  active_connections: number
  total_groups: number
  total_members: number
  whitelisted_count: number
  uptime_seconds: number
}

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = () => {
    adminApi.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (error) {
    return <div class="p-4 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>
  }

  if (!stats) {
    return (
      <div class="flex items-center gap-3" style={{ color: 'var(--color-text-secondary)' }}>
        <span class="lc-spinner" />
        Loading stats...
      </div>
    )
  }

  const cards = [
    { label: 'Active Connections', value: stats.active_connections, highlight: true },
    { label: 'Total Groups', value: stats.total_groups, highlight: false },
    { label: 'Total Members', value: stats.total_members, highlight: false },
    { label: 'Whitelisted Pubkeys', value: stats.whitelisted_count, highlight: true },
    { label: 'Uptime', value: formatUptime(stats.uptime_seconds), highlight: false },
  ]

  return (
    <div>
      <h2 class="text-xl font-bold mb-6">Dashboard</h2>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} class="lc-card p-5">
            <div class="text-2xl font-bold" style={{ color: card.highlight ? '#b4f953' : 'var(--color-text-primary)' }}>{card.value}</div>
            <div class="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
