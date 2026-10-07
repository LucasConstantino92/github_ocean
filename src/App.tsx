import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Building, GitHubRepository, GitHubUser, Locale, RepositoryIsland, ShipProfile, WorldChunk } from './types/ocean'
import { apiUrl, copy, initialGithubLogin } from './utils/constants'
import { createProfile, worldChunkFor } from './utils/oceanMath'
import { trackEvent } from './utils/analytics'
import { useOceanAmbience } from './audio/useOceanAmbience'
import { OceanScene } from './components/3d/OceanScene'
import { Topbar } from './components/ui/Topbar'
import { SearchCard } from './components/ui/SearchCard'
import { ProfileCard } from './components/ui/ProfileCard'
import { RepositoryCard } from './components/ui/RepositoryCard'
import { MiniMap } from './components/ui/MiniMap'
import { BuildingCard } from './components/ui/BuildingCard'

import './App.css'
import './repository.css'
import './world-layout.css'
import './progression.css'

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
  const [worldChunk, setWorldChunk] = useState<WorldChunk | null>(null)
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0, 0])
  const [soundEnabled, setSoundEnabled] = useState(false)

  useOceanAmbience(soundEnabled)

  useEffect(() => {
    if (sessionStorage.getItem('github-ocean-open-tracked')) return
    sessionStorage.setItem('github-ocean-open-tracked', 'true')
    trackEvent('app_opened')
  }, [])

  const t = copy[locale]

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
    [githubLogin]
  )

  const updateWorldChunk = useCallback((nextChunk: WorldChunk) => {
    setWorldChunk((current) => (current?.[0] === nextChunk[0] && current?.[1] === nextChunk[1] ? current : nextChunk))
  }, [])

  const updatePlayerPosition = useCallback((position: [number, number, number]) => {
    setPlayerPosition(position)
  }, [])

  const chunkX = worldChunk?.[0]
  const chunkZ = worldChunk?.[1]

  useEffect(() => {
    if (chunkX === undefined || chunkZ === undefined) return
    const abort = new AbortController()
    const regions: WorldChunk[] = []
    for (let x = chunkX - 1; x <= chunkX + 1; x++) {
      for (let z = chunkZ - 1; z <= chunkZ + 1; z++) {
        regions.push([x, z])
      }
    }
    void Promise.all(
      regions.map(async ([x, z]) => {
        const response = await fetch(apiUrl(`/api/world/chunks/${x}/${z}`), { signal: abort.signal })
        if (!response.ok) throw new Error(`Região ${x}:${z} indisponível`)
        return response.json() as Promise<{
          developers: { user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }[]
        }>
      })
    )
      .then((chunks) => {
        if (abort.signal.aborted) return
        const developers = new Map<string, ShipProfile>()
        for (const chunk of chunks) {
          for (const developer of chunk.developers) {
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
  }, [chunkX, chunkZ])

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
        />
      </div>

      <Topbar
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((value) => !value)}
        locale={locale}
        onChangeLocale={changeLocale}
        githubLogin={githubLogin}
        onReturnHome={returnToHome}
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
        />
      )}

      <footer>
        <span>{canSail ? t.controls : 'Arraste para olhar · Scroll para zoom'}</span>
        <span>{t.world}</span>
      </footer>
    </main>
  )
}

export default App
