import { apiUrl } from './constants'

export type ClientEvent = 'app_opened' | 'repository_opened'

function anonymousId() {
  const key = 'github-ocean-anonymous-id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const created = crypto.randomUUID()
  localStorage.setItem(key, created)
  return created
}

export function trackEvent(type: ClientEvent, metadata?: Record<string, string | number | boolean>) {
  void fetch(apiUrl('/api/analytics/events'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    keepalive: true,
    body: JSON.stringify({ type, anonymousId: anonymousId(), path: window.location.pathname, metadata }),
  }).catch(() => undefined)
}
