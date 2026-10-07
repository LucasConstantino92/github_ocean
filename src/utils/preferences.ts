const storageKey = 'github-ocean:preferences:v1'

type OceanPreferences = { discoveredPorts: string[] }

export function loadPreferences(): OceanPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<OceanPreferences>
    return { discoveredPorts: [...new Set((value.discoveredPorts ?? []).filter((login): login is string => typeof login === 'string').map((login) => login.toLowerCase()))] }
  } catch {
    return { discoveredPorts: [] }
  }
}

export function saveDiscoveredPorts(logins: Iterable<string>) {
  const discoveredPorts = [...new Set([...logins].map((login) => login.toLowerCase()))].slice(-5000)
  localStorage.setItem(storageKey, JSON.stringify({ discoveredPorts }))
}
