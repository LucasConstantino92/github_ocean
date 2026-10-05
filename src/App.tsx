import { useCallback, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'
import './repository.css'
import './world-layout.css'

type GitHubUser = { login: string; name: string | null; avatar_url: string; html_url: string; bio: string | null; public_repos: number; followers: number }
type GitHubRepository = { name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; updated_at: string; commit_count: number }
type RepositoryIsland = GitHubRepository & { position: [number, number, number]; color: string; size: number }
type ShipProfile = { user: GitHubUser; languages: { name: string; count: number; color: string }[]; stars: number; forks: number; repositories: RepositoryIsland[]; shipClass: 'Skiff' | 'Sloop' | 'Brigantine' | 'Frigate' | 'Galleon'; position: [number, number, number]; homePosition: [number, number, number]; island: { size: number; level: number; commits: number } }

const languageColors: Record<string, string> = { Dart: '#31b9f3', TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572a5', Java: '#b07219', Kotlin: '#a97bff', Swift: '#f05138', Go: '#00add8', Rust: '#dea584', 'C#': '#178600', 'C++': '#f34b7d', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Ruby: '#701516' }
const hash = (value: string) => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7)

function createProfile(user: GitHubUser, repositories: GitHubRepository[], worldPosition?: [number, number]): ShipProfile {
  const languageCount = repositories.reduce<Record<string, number>>((all, repo) => { if (repo.language) all[repo.language] = (all[repo.language] ?? 0) + 1; return all }, {})
  const languages = Object.entries(languageCount).map(([name, count]) => ({ name, count, color: languageColors[name] ?? '#8b9bb4' })).sort((a, b) => b.count - a.count).slice(0, 4)
  const stars = repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0)
  const forks = repositories.reduce((sum, repo) => sum + repo.forks_count, 0)
  const score = user.public_repos * 2 + stars * 3 + user.followers
  const shipClass = score < 15 ? 'Skiff' : score < 50 ? 'Sloop' : score < 150 ? 'Brigantine' : score < 500 ? 'Frigate' : 'Galleon'
  const seed = hash(user.login)
  const homePosition: [number, number, number] = worldPosition ? [worldPosition[0], 0, worldPosition[1]] : [((seed % 360) - 180) / 9, 0, (((seed >>> 9) % 360) - 180) / 9]
  const totalCommits = repositories.reduce((sum, repository) => sum + repository.commit_count, 0)
  const islandScore = Math.log10(Math.max(totalCommits, 1)) + Math.log10(stars + 1) * .7 + Math.log10(user.public_repos + 1) * .5
  const island = { size: Math.min(1.7, Math.max(.72, .72 + islandScore * .22)), level: islandScore < 1.2 ? 1 : islandScore < 2.2 ? 2 : islandScore < 3.2 ? 3 : 4, commits: totalCommits }
  const position: [number, number, number] = [homePosition[0] + island.size * 2.35, 0, homePosition[2]]
  const repositoryIslands = [...repositories].sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 8).map((repo, index) => {
    const angle = (index / Math.min(repositories.length, 8)) * Math.PI * 2 + (seed % 100) / 100
    // A ilha fica no arquipélago do desenvolvedor, nunca encostada no barco/porto.
    const distance = 9 + (index % 2) * 2.5
    const importance = Math.log10(Math.max(repo.commit_count, 1)) * .42 + Math.log10(repo.stargazers_count + 1) * .26 + Math.log10(repo.forks_count + 1) * .14
    return { ...repo, size: Math.min(1.3, Math.max(.58, .58 + importance)), color: languageColors[repo.language ?? ''] ?? '#8b9bb4', position: [homePosition[0] + Math.cos(angle) * distance, .25, homePosition[2] + Math.sin(angle) * distance] as [number, number, number] }
  })
  return { user, languages, stars, forks, repositories: repositoryIslands, shipClass, position, homePosition, island }
}

function Ship({ profile, onClick }: { profile: ShipProfile; onClick?: () => void }) {
  const color = profile.languages[0]?.color ?? '#d5a34c'
  const size = { Skiff: .65, Sloop: .85, Brigantine: 1.05, Frigate: 1.25, Galleon: 1.5 }[profile.shipClass]
  return <group position={profile.position} rotation={[0, -.35, 0]} scale={size} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <mesh position={[0, .2, 0]} castShadow><boxGeometry args={[1.6, .35, .6]} /><meshStandardMaterial color="#4a2617" roughness={.82} /></mesh>
    <mesh position={[0, .35, 0]} rotation={[Math.PI / 4, Math.PI / 4, 0]} castShadow><coneGeometry args={[.32, .32, 4]} /><meshStandardMaterial color="#6e3821" /></mesh>
    <mesh position={[0, 1.25, 0]} castShadow><cylinderGeometry args={[.035, .055, 1.8]} /><meshStandardMaterial color="#31190e" /></mesh>
    <mesh position={[.37, 1.34, 0]} rotation={[0, 0, -.1]} castShadow><planeGeometry args={[.75, 1.05]} /><meshStandardMaterial color={color} side={THREE.DoubleSide} /></mesh>
    <mesh position={[-.3, .92, 0]} rotation={[0, 0, .12]} castShadow><planeGeometry args={[.5, .72]} /><meshStandardMaterial color="#e8e5d4" side={THREE.DoubleSide} /></mesh>
    <pointLight color={color} intensity={6} distance={4} position={[0, 1.5, .4]} />
  </group>
}

function Island({ position, color, size = 1, onClick }: { position: [number, number, number]; color: string; size?: number; onClick?: () => void }) {
  return <group position={position} scale={size} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <mesh receiveShadow castShadow><cylinderGeometry args={[1.3, 1.55, .5, 7]} /><meshStandardMaterial color="#6e5a36" /></mesh>
    <mesh position={[0, .35, 0]} receiveShadow><cylinderGeometry args={[1.13, 1.26, .28, 7]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, .9, 0]} castShadow><coneGeometry args={[.35, 1.2, 6]} /><meshStandardMaterial color="#1b5e3a" /></mesh>
    <mesh position={[.45, .75, -.2]} castShadow><coneGeometry args={[.25, .85, 6]} /><meshStandardMaterial color="#28774c" /></mesh>
    <pointLight color={color} intensity={3} distance={3} position={[0, 1, 0]} />
  </group>
}

function HomeIsland({ profile, onClick, onRepositoryClick }: { profile: ShipProfile; onClick?: () => void; onRepositoryClick?: (repository: RepositoryIsland) => void }) {
  const { size, level } = profile.island
  return <group position={profile.homePosition} scale={size} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <mesh receiveShadow castShadow><cylinderGeometry args={[2.4, 2.75, .6, 9]} /><meshStandardMaterial color="#765a2d" /></mesh>
    <mesh position={[0, .4, 0]} receiveShadow><cylinderGeometry args={[2.14, 2.36, .28, 9]} /><meshStandardMaterial color="#6daf66" /></mesh>
    <mesh position={[-.72, 1.15, -.4]} castShadow><coneGeometry args={[.38, 1.5, 6]} /><meshStandardMaterial color="#175a36" /></mesh>
    <mesh position={[-1.2, .9, .45]} castShadow><coneGeometry args={[.28, 1.1, 6]} /><meshStandardMaterial color="#207445" /></mesh>
    <mesh position={[-.1, .76, 1.15]} castShadow><coneGeometry args={[.25, .95, 6]} /><meshStandardMaterial color="#1b663d" /></mesh>
    {profile.repositories.slice(0, level).map((repository, index) => <RepoBuilding key={repository.html_url} repository={repository} index={index} onClick={() => onRepositoryClick?.(repository)} />)}
  </group>
}

function RepoBuilding({ repository, index, onClick }: { repository: RepositoryIsland; index: number; onClick: () => void }) {
  const positions: [number, number, number][] = [[.3, .6, -.25], [1.1, .64, .55], [.95, .95, -.95], [-.25, .64, .85]]
  const position = positions[index]
  const fortress = index === 3
  return <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }}>
    <mesh castShadow><boxGeometry args={fortress ? [.75, 1.15, .7] : [.7, .58, .62]} /><meshStandardMaterial color={fortress ? '#8c8b83' : '#cf9b5a'} /></mesh>
    <mesh position={[0, fortress ? .82 : .45, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[fortress ? .52 : .6, fortress ? .55 : .5, 4]} /><meshStandardMaterial color={repository.color} /></mesh>
    <pointLight color={repository.color} intensity={2} distance={2.2} position={[0, 1.1, 0]} />
  </group>
}

function CameraTravel({ destination }: { destination: [number, number, number] | null }) {
  const { camera } = useThree()
  useEffect(() => {
    if (!destination) return
    const [x, y, z] = destination
    camera.position.set(x + 7, y + 7, z + 10)
    camera.lookAt(x, y + .75, z)
  }, [camera, destination])
  return null
}

function Ocean({ profile, worldProfiles, onDeveloperClick, onRepositoryClick }: { profile: ShipProfile | null; worldProfiles: ShipProfile[]; onDeveloperClick: (developer: ShipProfile) => void; onRepositoryClick: (repository: RepositoryIsland) => void }) {
  return <Canvas camera={{ position: [10, 9, 13], fov: 48 }} shadows>
    <color attach="background" args={['#071c35']} /><fog attach="fog" args={['#071c35', 18, 68]} />
    <ambientLight intensity={1.6} /><directionalLight position={[-8, 12, 4]} intensity={2.4} castShadow />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[150, 150, 48, 48]} /><meshStandardMaterial color="#0a4b78" metalness={.2} roughness={.48} /></mesh>
    <gridHelper args={[150, 50, '#12628e', '#0d5a88']} position={[0, .012, 0]} />
    <Island position={[-9, .25, -7]} color="#d4b359" /><Island position={[9, .25, -5]} color="#5cb979" /><Island position={[2, .25, 8]} color="#ae70e3" />
    {worldProfiles.filter((developer) => developer.user.login !== profile?.user.login).map((developer) => <group key={developer.user.login}><HomeIsland profile={developer} onClick={() => onDeveloperClick(developer)} onRepositoryClick={onRepositoryClick} /><Ship profile={developer} onClick={() => onDeveloperClick(developer)} /></group>)}
    {profile && <><HomeIsland profile={profile} onRepositoryClick={onRepositoryClick} /><Ship profile={profile} /></>}<CameraTravel destination={profile?.position ?? null} /><Stars radius={70} depth={35} count={1800} factor={3} saturation={0} fade speed={.3} />
    <OrbitControls makeDefault target={profile?.position ?? [0, 0, 0]} minDistance={4} maxDistance={40} maxPolarAngle={Math.PI / 2.08} />
  </Canvas>
}

function App() {
  const [username, setUsername] = useState('')
  const [profile, setProfile] = useState<ShipProfile | null>(null)
  const [worldProfiles, setWorldProfiles] = useState<ShipProfile[]>([])
  const [selectedDeveloper, setSelectedDeveloper] = useState<ShipProfile | null>(null)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [selectedRepository, setSelectedRepository] = useState<RepositoryIsland | null>(null)
  const [status, setStatus] = useState('Digite um usuário público do GitHub para encontrar seu porto.')
  const [loading, setLoading] = useState(false)
  const loadDeveloper = useCallback(async (rawLogin: string) => {
    const login = rawLogin.trim().replace('@', ''); if (!login) return
    setLoading(true); setStatus('Mapeando o porto e contando as expedições do GitHub…')
    try {
      const developerResponse = await fetch(`http://localhost:3001/api/developers/${encodeURIComponent(login)}`)
      const developer = await developerResponse.json() as { message?: string; user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }
      if (!developerResponse.ok) throw new Error(developer.message ?? 'Não foi possível consultar o GitHub.')
      const { user, repositories } = developer
      const nextProfile = createProfile(user, repositories, developer.world_position); setProfile(nextProfile); setSelectedRepository(null); setSelectedDeveloper(null); setStatus(`Porto encontrado: ${user.login} navega como ${nextProfile.shipClass}. Clique nas construções da ilha para abrir os repositórios.`)
      const worldResponse = await fetch('http://localhost:3001/api/world')
      if (worldResponse.ok) {
        const world = await worldResponse.json() as { developers: { user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }[] }
        setWorldProfiles(world.developers.map((developer) => createProfile(developer.user, developer.repositories, developer.world_position)))
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível localizar esse dev.') } finally { setLoading(false) }
  }, [])
  const findDeveloper = useCallback((event: React.FormEvent) => { event.preventDefault(); void loadDeveloper(username) }, [loadDeveloper, username])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const login = params.get('github')
    if (login) { setUsername(login); setGithubLogin(login); void loadDeveloper(login); window.history.replaceState({}, '', window.location.pathname) }
    void fetch('http://localhost:3001/api/auth/me').then((response) => response.json()).then((data: { user: { login: string } | null }) => { if (data.user) setGithubLogin(data.user.login) }).catch(() => undefined)
  }, [loadDeveloper])
  const displayedProfile = selectedDeveloper ?? profile
  return <main className="app-shell"><div className="ocean"><Ocean profile={profile} worldProfiles={worldProfiles} onDeveloperClick={setSelectedDeveloper} onRepositoryClick={setSelectedRepository} /></div>
    <header className="topbar"><a className="brand" href="/"><span>⚓</span> GitHub Ocean</a>{githubLogin ? <span className="mode">⚓ @{githubLogin}</span> : <a className="login" href="http://localhost:3001/api/auth/github">Entrar com GitHub</a>}</header>
    <section className={`search-card ${profile ? 'docked' : ''}`}><p className="eyebrow">EXPLORE THE DEVELOPER WORLD</p><h1>Encontre um barco pelo GitHub.</h1><form onSubmit={findDeveloper}><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ex.: lucasconstantino" aria-label="GitHub username" /><button disabled={loading}>{loading ? 'Navegando…' : 'Ir ao porto'}</button></form><p className="status">{status}</p></section>
    <aside className={`profile-card ${displayedProfile ? 'visible' : ''}`}>{displayedProfile && <><img src={displayedProfile.user.avatar_url} alt="" /><div><p className="eyebrow">{displayedProfile.shipClass.toUpperCase()}</p><h2>{displayedProfile.user.name ?? displayedProfile.user.login}</h2><a href={displayedProfile.user.html_url} target="_blank">@{displayedProfile.user.login} ↗</a></div><p className="bio">{displayedProfile.user.bio ?? 'Explorador das águas abertas do código.'}</p><div className="stats"><span><b>{displayedProfile.user.public_repos}</b> repos</span><span><b>{displayedProfile.stars}</b> stars</span><span><b>{displayedProfile.user.followers}</b> followers</span></div><div className="languages">{displayedProfile.languages.length ? displayedProfile.languages.map((language) => <span key={language.name} style={{ borderColor: language.color }}><i style={{ background: language.color }} />{language.name}</span>) : <span>Stack não identificada</span>}</div></>}</aside>
    <aside className={`repository-card ${selectedRepository ? 'visible' : ''}`}>{selectedRepository && <><button className="close" onClick={() => setSelectedRepository(null)} aria-label="Fechar">×</button><p className="eyebrow" style={{ color: selectedRepository.color }}>REPOSITORY ISLAND</p><h2>{selectedRepository.name}</h2><p>{selectedRepository.description ?? 'Uma ilha sem descrição, esperando por novos exploradores.'}</p><div className="repo-stats"><span>⌁ {selectedRepository.commit_count} commits</span><span>★ {selectedRepository.stargazers_count}</span><span>{selectedRepository.language ?? 'Code'}</span></div><a href={selectedRepository.html_url} target="_blank">Abrir no GitHub ↗</a></>}</aside>
    <footer><span>Arraste para olhar · Scroll para zoom</span><span>Barcos e ilhas são gerados proceduralmente</span></footer>
  </main>
}
export default App
