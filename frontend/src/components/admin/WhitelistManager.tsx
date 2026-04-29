import { useState, useEffect } from 'preact/hooks'
import { adminApi } from '../../services/AdminApiClient'
import { fetchProfiles, getDisplayName, type NostrProfile } from '../../services/ProfileFetcher'

interface WhitelistEntry {
  hex: string
  npub: string
}

export const WhitelistManager = () => {
  const [entries, setEntries] = useState<WhitelistEntry[]>([])
  const [profiles, setProfiles] = useState<Map<string, NostrProfile>>(new Map())
  const [newPubkey, setNewPubkey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profilesLoading, setProfilesLoading] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchWhitelist = () => {
    setLoading(true)
    adminApi.getWhitelist()
      .then(data => { setEntries(data); setError(null); loadProfiles(data) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  const loadProfiles = async (data: WhitelistEntry[]) => {
    if (data.length === 0) return
    setProfilesLoading(true)
    try {
      const profs = await fetchProfiles(data.map(e => e.hex))
      setProfiles(profs)
    } catch {
      // Profiles are optional
    } finally {
      setProfilesLoading(false)
    }
  }

  useEffect(fetchWhitelist, [])

  const handleAdd = async () => {
    if (!newPubkey.trim()) return
    setError(null)
    try {
      const entry = await adminApi.addToWhitelist(newPubkey.trim())
      setEntries(prev => [...prev.filter(e => e.hex !== entry.hex), entry])
      setNewPubkey('')
      showToast('Pubkey added to whitelist')
      // Fetch profile for new entry
      fetchProfiles([entry.hex]).then(profs => {
        setProfiles(prev => {
          const next = new Map(prev)
          const p = profs.get(entry.hex)
          if (p) next.set(entry.hex, p)
          return next
        })
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    }
  }

  const handleRemove = async (hex: string) => {
    setError(null)
    try {
      await adminApi.removeFromWhitelist(hex)
      setEntries(prev => prev.filter(e => e.hex !== hex))
      setConfirmRemove(null)
      showToast('Pubkey removed from whitelist')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove')
    }
  }

  const truncate = (s: string) => s.length > 16 ? `${s.slice(0, 8)}...${s.slice(-8)}` : s

  return (
    <div>
      <h2 class="text-xl font-bold mb-6">Whitelist Management</h2>

      {toast && (
        <div class="mb-4 p-3 rounded-lg text-sm border" style={{ background: 'rgba(180,249,83,0.08)', color: '#b4f953', borderColor: 'rgba(180,249,83,0.2)' }}>
          {toast}
        </div>
      )}

      {error && (
        <div class="mb-4 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
          {error}
        </div>
      )}

      {/* Add form */}
      <div class="flex gap-2 mb-6">
        <input
          type="text"
          value={newPubkey}
          onInput={(e) => setNewPubkey((e.target as HTMLInputElement).value)}
          placeholder="npub1... or hex pubkey"
          class="flex-1 px-4 py-2 rounded-lg text-sm"
          style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!newPubkey.trim()}
          class="lc-pill-primary text-sm"
          style={{ padding: '8px 20px', borderRadius: '10px' }}
        >
          Add
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div class="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} class="lc-skeleton h-14 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ color: 'var(--color-text-secondary)' }}>No whitelisted pubkeys. The relay is open to all.</div>
      ) : (
        <div class="lc-card overflow-hidden" style={{ padding: 0 }}>
          <table class="w-full">
            <thead>
              <tr style={{ background: 'var(--color-bg-primary)' }}>
                <th class="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Profile</th>
                <th class="text-left px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>npub</th>
                <th class="text-right px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const profile = profiles.get(entry.hex)
                return (
                  <tr key={entry.hex} style={{ borderTop: '1px solid var(--color-border)' }} class="hover:bg-white/[0.02] transition-colors">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-3">
                        {profilesLoading && !profile ? (
                          <div class="lc-skeleton w-8 h-8 rounded-full flex-shrink-0" />
                        ) : profile?.picture ? (
                          <img src={profile.picture} alt="" class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            style={{ border: '1px solid var(--color-border)' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                            style={{ background: 'rgba(180,249,83,0.1)', color: '#b4f953' }}>
                            {(profile?.name || entry.npub.slice(5, 7) || '??').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div class="text-sm font-medium">
                            {profilesLoading && !profile ? (
                              <span class="lc-skeleton inline-block w-24 h-4" />
                            ) : (
                              getDisplayName(profile, entry.npub)
                            )}
                          </div>
                          <div class="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                            {truncate(entry.hex)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>{truncate(entry.npub)}</td>
                    <td class="px-4 py-3 text-right">
                      {confirmRemove === entry.hex ? (
                        <span class="space-x-2">
                          <button
                            onClick={() => handleRemove(entry.hex)}
                            class="text-sm text-red-400 hover:text-red-300 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmRemove(null)}
                            class="text-sm transition-colors" style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmRemove(entry.hex)}
                          class="text-sm text-red-400 hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div class="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {entries.length} whitelisted pubkey{entries.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
