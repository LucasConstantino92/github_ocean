import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Building, GitHubRepository, GitHubUser, Locale, RepositoryIsland, ShipProfile, WorldChunk } from './types/ocean'
import { apiUrl, copy, initialGithubLogin } from './utils/constants'
import { createProfile, worldChunkFor } from './utils/oceanMath'
import { trackEvent } from './utils/analytics'
import { loadPreferences, saveDiscoveredPorts } from './utils/preferences'
import { useOceanAmbience } from './audio/useOceanAmbience'
import { OceanScene } from './components/3d/OceanScene'
import type { CameraView } from './components/3d/OceanScene'
import { Topbar } from './components/ui/Topbar'
import { SearchCard } from './components/ui/SearchCard'
import { ProfileCard } from './components/ui/ProfileCard'
import { RepositoryCard } from './components/ui/RepositoryCard'
import { MiniMap } from './components/ui/MiniMap'
import { BuildingCard } from './components/ui/BuildingCard'
import { WaypointCompass, WorldMap } from './components/ui/WorldMap'

import './App.css'
import './repository.css'
import './world-layout.css'
import './progression.css'

const defaultViewDirection: [number, number, number] = [1, 0, 0]

export function App() {
  const [username, setUsername] = useState(initialGithubLogin ?? '')
  const [profile, setProfile] = useState<ShipProfile | null>(null)
  const [worldProfiles, setWorldProfiles] = useState<ShipProfile[]>([])
  const [selectedDeveloper, setSelectedDeveloper] = useState<ShipProfile | null>(null)
  const [focusedDeveloper, setFocusedDeveloper] = useState<ShipProfile | null>(null)
  const [githubLogin, setGithubLogin] = useState<string | null>(initialGithubLogin)
  const [selectedRepository, setSelectedRepository] = useState<RepositoryIsland | null>(null)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [locale, setLocale] = useState<Locale>(
    () => (localStorage.getItem('github-ocean-locale') as Locale | null) ?? 'pt-BR'
  )
  const [status, setStatus] = useState(copy['pt-BR'].initial)
  const [loading, setLoading] = useState(false)
  const [returnHome, setReturnHome] = useState(0)
  const [, setWorldChunk] = useState<WorldChunk | null>(null)
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0, 0])
  const [cameraView, setCameraView] = useState<CameraView | null>(null)
  const worldChunkCache = useRef(new Map<string, { user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }[]>())
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [discoveredPorts, setDiscoveredPorts] = useState<Set<string>>(() => new Set(loadPreferences().discoveredPorts))
  const [mapOpen, setMapOpen] = useState(false)
  const [waypoint, setWaypoint] = useState<[number, number, number] | null>(null)
  const [playerHeading, setPlayerHeading] = useState(-.35)

  useOceanAmbience(soundEnabled)

  useEffect(() => {
    if (sessionStorage.getItem('github-ocean-open-tracked')) return
    sessionStorage.setItem('github-ocean-open-tracked', 'true')
    trackEvent('app_opened')
  }, [])

  const t = copy[locale]

  const discoverPort = useCallback((login: string) => {
    const normalized = login.toLowerCase()
    setDiscoveredPorts((current) => {
      if (current.has(normalized)) return current
      const next = new Set(current)
      next.add(normalized)
      saveDiscoveredPorts(next)
      return next
    })
  }, [])

  const changeLocale = (next: Locale) => {
    localStorage.setItem('github-ocean-locale', next)
    setLocale(next)
    if (!profile) setStatus(copy[next].initial)
  }

  const loadDeveloper = useCallback(
    async (rawLogin: string, asCaptain = false) => {
      const login = rawLogin.trim().replace('@', '')
      if (!login) return
      setLoading(true)
      setStatus('Mapeando o porto e contando as expedições do GitHub…')
      try {
        const developerResponse = await fetch(apiUrl(`/api/developers/${encodeURIComponent(login)}`))
        const developer = (await developerResponse.json()) as {
          message?: string
          user: GitHubUser
          repositories: GitHubRepository[]
          world_position?: [number, number]
        }
        if (!developerResponse.ok) throw new Error(developer.message ?? 'Não foi possível consultar o GitHub.')
        const { user, repositories } = developer
        const nextProfile = createProfile(user, repositories, developer.world_position)
        discoverPort(nextProfile.user.login)
        if (asCaptain || !githubLogin) {
          setProfile(nextProfile)
          setPlayerPosition(nextProfile.position)
          setSelectedDeveloper(null)
          setFocusedDeveloper(null)
        } else {
          setSelectedDeveloper(nextProfile)
          setFocusedDeveloper(nextProfile)
        }
        setSelectedRepository(null)
        setSelectedBuilding(null)
        setStatus(
          `Porto encontrado: ${user.login} navega como ${nextProfile.shipClass}. Clique nas construções da ilha para abrir os repositórios.`
        )
        setWorldChunk(worldChunkFor(nextProfile.position))
      } catch (error) {
        const message = error instanceof TypeError
          ? 'O servidor do GitHub Ocean não respondeu. Confirme que o backend está rodando.'
          : error instanceof Error ? error.message : 'Não foi possível localizar esse dev.'
        setStatus(message)
      } finally {
        setLoading(false)
      }
    },
    [discoverPort, githubLogin]
  )

  const updateWorldChunk = useCallback((nextChunk: WorldChunk) => {
    setWorldChunk((current) => (current?.[0] === nextChunk[0] && current?.[1] === nextChunk[1] ? current : nextChunk))
  }, [])

  const updatePlayerPosition = useCallback((position: [number, number, number]) => {
    setPlayerPosition(position)
  }, [])

  const updateCameraView = useCallback((next: CameraView) => {
    setCameraView((current) => {
      if (!current) return next
      const dx = next.position[0] - current.position[0]
      const dz = next.position[2] - current.position[2]
      const directionDot = next.direction[0] * current.direction[0] + next.direction[2] * current.direction[2]
      // The loading cone only needs an update after meaningful travel or rotation.
      return dx * dx + dz * dz < 14 * 14 && directionDot > .965 ? current : next
    })
  }, [])

  const updatePlayerHeading = useCallback((heading: number) => {
    setPlayerHeading(heading)
  }, [])

  useEffect(() => {
    const toggleMap = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
      if (event.key.toLowerCase() !== 'm') return
      event.preventDefault()
      setMapOpen((open) => !open)
    }
    window.addEventListener('keydown', toggleMap)
    return () => window.removeEventListener('keydown', toggleMap)
  }, [])

  const chunkSource = cameraView?.position ?? playerPosition
  const sourceChunk = worldChunkFor(chunkSource)
  const loadingDirection = cameraView?.direction ?? defaultViewDirection
  const directionSector = Math.round(Math.atan2(loadingDirection[2], loadingDirection[0]) / (Math.PI / 4))
  const sourceChunkX = sourceChunk[0]
  const sourceChunkZ = sourceChunk[1]
  const regions = useMemo(() => {
    const result: WorldChunk[] = []
    const directionAngle = directionSector * Math.PI / 4
    const forwardX = Math.cos(directionAngle)
    const forwardZ = Math.sin(directionAngle)
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const forward = x * forwardX + z * forwardZ
        const side = Math.abs(x * -forwardZ + z * forwardX)
        // A forward V: reach two chunks ahead, keep a narrow buffer to avoid
        // pop-in during a turn, and avoid requesting the unseen rear ocean.
        if (forward < -.45 || forward > 2.2 || side > forward * .9 + .9) continue
        result.push([sourceChunkX + x, sourceChunkZ + z])
      }
    }
    return result
  }, [directionSector, sourceChunkX, sourceChunkZ])

  useEffect(() => {
    const abort = new AbortController()
    const missing = regions.filter(([x, z]) => !worldChunkCache.current.has(`${x}:${z}`))
    void Promise.all(
      missing.map(async ([x, z]) => {
        const response = await fetch(apiUrl(`/api/world/chunks/${x}/${z}`), { signal: abort.signal })
        if (!response.ok) throw new Error(`Região ${x}:${z} indisponível`)
        const chunk = await response.json() as { developers: { user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }[] }
        return { key: `${x}:${z}`, developers: chunk.developers }
      })
    )
      .then((chunks) => {
        if (abort.signal.aborted) return
        for (const chunk of chunks) worldChunkCache.current.set(chunk.key, chunk.developers)
        // Keep the cache bounded while retaining the current field of view.
        while (worldChunkCache.current.size > 48) {
          const oldest = worldChunkCache.current.keys().next().value
          if (oldest === undefined) break
          worldChunkCache.current.delete(oldest)
        }
        const developers = new Map<string, ShipProfile>()
        for (const [x, z] of regions) {
          for (const developer of worldChunkCache.current.get(`${x}:${z}`) ?? []) {
            developers.set(
              developer.user.login,
              createProfile(developer.user, developer.repositories, developer.world_position)
            )
          }
        }
        setWorldProfiles([...developers.values()])
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) console.warn('Não foi possível carregar esta região do oceano.', error)
      })
    return () => abort.abort()
  }, [regions])

  const findDeveloper = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      void loadDeveloper(username)
    },
    [loadDeveloper, username]
  )

  useEffect(() => {
    if (initialGithubLogin) {
      // oxlint-disable-next-line react/set-state-in-effect
      void loadDeveloper(initialGithubLogin, true)
      window.history.replaceState({}, '', window.location.pathname)
    }
    void fetch(apiUrl('/api/auth/me'))
      .then((response) => response.json())
      .then((data: { user: { login: string } | null }) => {
        if (data.user && !initialGithubLogin) {
          setGithubLogin(data.user.login)
          void loadDeveloper(data.user.login, true)
        }
      })
      .catch(() => undefined)
  }, [loadDeveloper])

  const visitDeveloper = useCallback((developer: ShipProfile) => {
    setSelectedRepository(null)
    setSelectedBuilding(null)
    setSelectedDeveloper(developer)
    if (developer.user.profile_complete === false) {
      // Hydrate discovered/legacy ports without entering search/visit camera mode.
      void fetch(apiUrl(`/api/developers/${encodeURIComponent(developer.user.login)}`))
        .then(async (response) => {
          if (!response.ok) throw new Error('Não foi possível atualizar o porto.')
          return response.json() as Promise<{ user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }>
        })
        .then((data) => {
          const updated = createProfile(data.user, data.repositories, data.world_position)
          const login = updated.user.login.toLowerCase()
          setSelectedDeveloper((current) => current?.user.login.toLowerCase() === login ? updated : current)
          setWorldProfiles((current) => current.map((item) => item.user.login.toLowerCase() === login ? updated : item))
        })
        .catch(() => setStatus('Este porto ainda precisa ser atualizado. Tente pesquisar o usuário novamente.'))
    }
  }, [])

  const visitRepository = useCallback((repository: RepositoryIsland) => {
    trackEvent('repository_opened', { repository: repository.name })
    setSelectedRepository(repository)
    setSelectedBuilding(null)
  }, [])

  const visitBuilding = useCallback((building: Building) => {
    setSelectedRepository(null)
    setSelectedBuilding(building)
  }, [])

  const displayedProfile = selectedDeveloper ?? profile
  const canSail = Boolean(githubLogin && profile && !focusedDeveloper && githubLogin.toLowerCase() === profile.user.login.toLowerCase())
  const visibleWorldProfiles = focusedDeveloper
    ? [...worldProfiles.filter((developer) => developer.user.login.toLowerCase() !== focusedDeveloper.user.login.toLowerCase()), focusedDeveloper]
    : worldProfiles

  const returnToHome = useCallback(() => {
    setSelectedDeveloper(null)
    setFocusedDeveloper(null)
    setSelectedRepository(null)
    setSelectedBuilding(null)
    if (profile) setWorldChunk(worldChunkFor(profile.homePosition))
    setReturnHome((value) => value + 1)
  }, [profile])

  return (
    <main className="app-shell">
      <div className="ocean">
        <OceanScene
          profile={profile}
          worldProfiles={visibleWorldProfiles}
          focusProfile={focusedDeveloper}
          canSail={canSail}
          returnHome={returnHome}
          onDeveloperClick={visitDeveloper}
          onRepositoryClick={visitRepository}
          onBuildingClick={visitBuilding}
          onChunkChange={updateWorldChunk}
          onPositionChange={updatePlayerPosition}
          onViewChange={updateCameraView}
          onDiscoverPort={discoverPort}
          discoveredPorts={discoveredPorts}
          onHeadingChange={updatePlayerHeading}
        />
      </div>

      <Topbar
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((value) => !value)}
        locale={locale}
        onChangeLocale={changeLocale}
        githubLogin={githubLogin}
        onReturnHome={returnToHome}
        discoveredIslands={discoveredPorts.size}
        onOpenMap={() => setMapOpen(true)}
      />

      <SearchCard
        username={username}
        onUsernameChange={setUsername}
        onSubmit={findDeveloper}
        loading={loading}
        status={status}
        isDocked={Boolean(profile)}
        locale={locale}
      />

      <ProfileCard profile={displayedProfile} locale={locale} onRepositoryClick={visitRepository} />

      <RepositoryCard repository={selectedRepository} onClose={() => setSelectedRepository(null)} />
      <BuildingCard building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />

      {profile && (
        <MiniMap
          profile={profile}
          developers={visibleWorldProfiles}
          playerPosition={focusedDeveloper?.homePosition ?? (canSail ? playerPosition : profile.position)}
          discoveredPorts={discoveredPorts}
        />
      )}

      <WaypointCompass waypoint={waypoint} playerPosition={playerPosition} heading={playerHeading} onClear={() => setWaypoint(null)} />
      <WorldMap
        open={mapOpen}
        profile={profile}
        developers={visibleWorldProfiles}
        playerPosition={playerPosition}
        discoveredPorts={discoveredPorts}
        waypoint={waypoint}
        onWaypointChange={(point) => { setWaypoint(point); setMapOpen(false) }}
        onClose={() => setMapOpen(false)}
      />

      <footer>
        <span>{canSail ? t.controls : 'Arraste para olhar · Scroll para zoom'}</span>
        <span>{t.world}</span>
      </footer>
    </main>
  )
}

export default App
