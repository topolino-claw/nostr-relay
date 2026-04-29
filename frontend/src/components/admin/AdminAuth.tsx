import { useState } from 'preact/hooks'
import { adminApi } from '../../services/AdminApiClient'

interface AdminAuthProps {
  onAuthenticated: () => void
}

export const AdminAuth = ({ onAuthenticated }: AdminAuthProps) => {
  const [mode, setMode] = useState<'choose' | 'nsec'>('choose')
  const [nsec, setNsec] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const signWithExtension = async () => {
    setError(null)
    setLoading(true)

    try {
      if (!(window as any).nostr) {
        throw new Error('No NIP-07 extension found. Install a Nostr signer extension (nos2x, Alby, etc.)')
      }

      const { challenge } = await adminApi.getChallenge()

      const event = {
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['relay', window.location.origin.replace('http', 'ws')],
          ['challenge', challenge],
        ],
        content: '',
      }

      const signedEvent = await (window as any).nostr.signEvent(event)

      await adminApi.authenticate(signedEvent)
      onAuthenticated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const signWithNsec = async () => {
    setError(null)
    setLoading(true)

    try {
      const { finalizeEvent } = await import('nostr-tools')
      const { decode } = await import('nostr-tools/nip19')

      let secretKeyBytes: Uint8Array
      if (nsec.startsWith('nsec')) {
        const decoded = decode(nsec)
        if (decoded.type !== 'nsec') throw new Error('Invalid nsec')
        secretKeyBytes = decoded.data
      } else {
        secretKeyBytes = new Uint8Array(nsec.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
      }

      const { challenge } = await adminApi.getChallenge()

      const event = finalizeEvent({
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['relay', window.location.origin.replace('http', 'ws')],
          ['challenge', challenge],
        ],
        content: '',
      }, secretKeyBytes)

      await adminApi.authenticate(event)
      onAuthenticated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-bg-primary)' }}>
      <div class="max-w-md w-full lc-card lc-glow p-8">
        <h1 class="text-2xl font-bold mb-2 text-center lc-glow-text" style={{ color: '#b4f953' }}>Admin Panel</h1>
        <p class="text-sm text-center mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          Sign in with your Nostr identity to manage the relay.
        </p>

        {error && (
          <div class="mb-4 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        {mode === 'choose' ? (
          <div class="space-y-3">
            <button
              onClick={signWithExtension}
              disabled={loading}
              class="w-full lc-pill-primary py-3 text-base"
              style={{ borderRadius: '10px' }}
            >
              {loading ? (
                <span class="flex items-center justify-center gap-2">
                  <span class="lc-spinner" style={{ width: '16px', height: '16px', borderTopColor: '#0a0a0a' }} />
                  Signing...
                </span>
              ) : 'Sign in with Extension (NIP-07)'}
            </button>
            <button
              onClick={() => setMode('nsec')}
              disabled={loading}
              class="w-full lc-pill-secondary py-3 text-base"
              style={{ borderRadius: '10px' }}
            >
              Enter nsec manually
            </button>
            <div class="text-center pt-2">
              <a href="/" class="text-sm hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
                Back to home
              </a>
            </div>
          </div>
        ) : (
          <div class="space-y-3">
            <input
              type="password"
              value={nsec}
              onInput={(e) => setNsec((e.target as HTMLInputElement).value)}
              placeholder="nsec1... or hex private key"
              class="w-full px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
            <button
              onClick={signWithNsec}
              disabled={loading || !nsec}
              class="w-full lc-pill-primary py-3 text-base"
              style={{ borderRadius: '10px' }}
            >
              {loading ? (
                <span class="flex items-center justify-center gap-2">
                  <span class="lc-spinner" style={{ width: '16px', height: '16px', borderTopColor: '#0a0a0a' }} />
                  Signing...
                </span>
              ) : 'Sign in'}
            </button>
            <button
              onClick={() => { setMode('choose'); setNsec('') }}
              class="w-full py-2 text-sm hover:underline"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
