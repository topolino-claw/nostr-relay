import { SimplePool } from 'nostr-tools'

export interface NostrProfile {
  name?: string
  display_name?: string
  picture?: string
  nip05?: string
}

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://purplepag.es',
]

const profileCache = new Map<string, NostrProfile>()
const pendingFetches = new Map<string, Promise<void>>()

let pool: SimplePool | null = null

function getPool(): SimplePool {
  if (!pool) {
    pool = new SimplePool()
  }
  return pool
}

export async function fetchProfiles(pubkeys: string[]): Promise<Map<string, NostrProfile>> {
  const result = new Map<string, NostrProfile>()
  const toFetch: string[] = []

  for (const pk of pubkeys) {
    const cached = profileCache.get(pk)
    if (cached) {
      result.set(pk, cached)
    } else if (!pendingFetches.has(pk)) {
      toFetch.push(pk)
    }
  }

  // Wait for any pending fetches
  const pendingWaits = pubkeys
    .filter(pk => pendingFetches.has(pk) && !result.has(pk))
    .map(pk => pendingFetches.get(pk)!.then(() => {
      const cached = profileCache.get(pk)
      if (cached) result.set(pk, cached)
    }))

  if (toFetch.length > 0) {
    const fetchPromise = batchFetch(toFetch)

    // Mark all as pending
    for (const pk of toFetch) {
      pendingFetches.set(pk, fetchPromise)
    }

    try {
      await fetchPromise
    } finally {
      for (const pk of toFetch) {
        pendingFetches.delete(pk)
      }
    }

    for (const pk of toFetch) {
      const cached = profileCache.get(pk)
      if (cached) result.set(pk, cached)
    }
  }

  if (pendingWaits.length > 0) {
    await Promise.all(pendingWaits)
  }

  return result
}

async function batchFetch(pubkeys: string[]): Promise<void> {
  const p = getPool()

  try {
    const events = await p.querySync(RELAYS, {
      kinds: [0],
      authors: pubkeys,
    })

    // Use the most recent kind-0 for each pubkey
    const latest = new Map<string, { created_at: number; content: string }>()
    for (const ev of events) {
      const existing = latest.get(ev.pubkey)
      if (!existing || ev.created_at > existing.created_at) {
        latest.set(ev.pubkey, { created_at: ev.created_at, content: ev.content })
      }
    }

    for (const [pk, data] of latest) {
      try {
        const parsed = JSON.parse(data.content) as NostrProfile
        profileCache.set(pk, {
          name: parsed.name,
          display_name: parsed.display_name,
          picture: parsed.picture,
          nip05: parsed.nip05,
        })
      } catch {
        // Invalid JSON, skip
      }
    }

    // Cache empty results so we don't re-fetch
    for (const pk of pubkeys) {
      if (!profileCache.has(pk)) {
        profileCache.set(pk, {})
      }
    }
  } catch {
    // Network error — cache empty to avoid infinite retries
    for (const pk of pubkeys) {
      if (!profileCache.has(pk)) {
        profileCache.set(pk, {})
      }
    }
  }
}

export function getDisplayName(profile: NostrProfile | undefined, npub: string): string {
  if (profile?.display_name) return profile.display_name
  if (profile?.name) return profile.name
  return npub.slice(0, 8) + '...' + npub.slice(-4)
}
