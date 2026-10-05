import { useCallback, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'
import './repository.css'

type GitHubUser = { login: string; name: string | null; avatar_url: string; html_url: string; bio: string | null; public_repos: number; followers: number }
type GitHubRepository = { name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; updated_at: string }
type RepositoryIsland = GitHubRepository & { position: [number, number, number]; color: string }
type ShipProfile = { user: GitHubUser; languages: { name: string; count: number; color: string }[]; stars: number; forks: number; repositories: RepositoryIsland[]; shipClass: 'Skiff' | 'Sloop' | 'Brigantine' | 'Frigate' | 'Galleon'; position: [number, number, number] }

const languageColors: Record<string, string> = { Dart: '#31b9f3', TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572a5', Java: '#b07219', Kotlin: '#a97bff', Swift: '#f05138', Go: '#00add8', Rust: '#dea584', 'C#': '#178600', 'C++': '#f34b7d', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Ruby: '#701516' }
const hash = (value: string) => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7)

function createProfile(user: GitHubUser, repositories: GitHubRepository[]): ShipProfile {
  const languageCount = repositories.reduce<Record<string, number>>((all, repo) => { if (repo.language) all[repo.language] = (all[repo.language] ?? 0) + 1; return all }, {})
  const languages = Object.entries(languageCount).map(([name, count]) => ({ name, count, color: languageColors[name] ?? '#8b9bb4' })).sort((a, b) => b.count - a.count).slice(0, 4)
  const stars = repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0)
  const forks = repositories.reduce((sum, repo) => sum + repo.forks_count, 0)
  const score = user.public_repos * 2 + stars * 3 + user.followers
  const shipClass = score < 15 ? 'Skiff' : score < 50 ? 'Sloop' : score < 150 ? 'Brigantine' : score < 500 ? 'Frigate' : 'Galleon'
  const seed = hash(user.login)
  const position: [number, number, number] = [((seed % 360) - 180) / 9, 0, (((seed >>> 9) % 360) - 180) / 9]
  const repositoryIslands = [...repositories].sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 8).map((repo, index) => {
    const angle = (index / Math.min(repositories.length, 8)) * Math.PI * 2 + (seed % 100) / 100
    const distance = 4 + (index % 2) * 1.8
    return { ...repo, color: languageColors[repo.language ?? ''] ?? '#8b9bb4', position: [position[0] + Math.cos(angle) * distance, .25, position[2] + Math.sin(angle) * distance] as [number, number, number] }
  })
  return { user, languages, stars, forks, repositories: repositoryIslands, shipClass, position }
}

function Ship({ profile }: { profile: ShipProfile }) {
  const color = profile.languages[0]?.color ?? '#d5a34c'
  const size = { Skiff: .65, Sloop: .85, Brigantine: 1.05, Frigate: 1.25, Galleon: 1.5 }[profile.shipClass]
  return <group position={profile.position} rotation={[0, -.35, 0]} scale={size}>
    <mesh position={[0, .2, 0]} castShadow><boxGeometry args={[1.6, .35, .6]} /><meshStandardMaterial color="#4a2617" roughness={.82} /></mesh>
    <mesh position={[0, .35, 0]} rotation={[Math.PI / 4, Math.PI / 4, 0]} castShadow><coneGeometry args={[.32, .32, 4]} /><meshStandardMaterial color="#6e3821" /></mesh>
    <mesh position={[0, 1.25, 0]} castShadow><cylinderGeometry args={[.035, .055, 1.8]} /><meshStandardMaterial color="#31190e" /></mesh>
    <mesh position={[.37, 1.34, 0]} rotation={[0, 0, -.1]} castShadow><planeGeometry args={[.75, 1.05]} /><meshStandardMaterial color={color} side={THREE.DoubleSide} /></mesh>
    <mesh position={[-.3, .92, 0]} rotation={[0, 0, .12]} castShadow><planeGeometry args={[.5, .72]} /><meshStandardMaterial color="#e8e5d4" side={THREE.DoubleSide} /></mesh>
    <pointLight color={color} intensity={6} distance={4} position={[0, 1.5, .4]} />
  </group>
}

function Island({ position, color, onClick }: { position: [number, number, number]; color: string; onClick?: () => void }) {
  return <group position={position} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <mesh receiveShadow castShadow><cylinderGeometry args={[1.3, 1.55, .5, 7]} /><meshStandardMaterial color="#6e5a36" /></mesh>
    <mesh position={[0, .35, 0]} receiveShadow><cylinderGeometry args={[1.13, 1.26, .28, 7]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, .9, 0]} castShadow><coneGeometry args={[.35, 1.2, 6]} /><meshStandardMaterial color="#1b5e3a" /></mesh>
    <mesh position={[.45, .75, -.2]} castShadow><coneGeometry args={[.25, .85, 6]} /><meshStandardMaterial color="#28774c" /></mesh>
    <pointLight color={color} intensity={3} distance={3} position={[0, 1, 0]} />
  </group>
}

function CameraTravel({ destination }: { destination: [number, number, number] | null }) {
  const { camera } = useThree()
  useFrame(() => {
    if (!destination) return
    const [x, y, z] = destination
    camera.position.lerp(new THREE.Vector3(x + 7, y + 7, z + 10), .025)
    camera.lookAt(x, y + .75, z)
  })
  return null
}

function Ocean({ profile, onRepositoryClick }: { profile: ShipProfile | null; onRepositoryClick: (repository: RepositoryIsland) => void }) {
  return <Canvas camera={{ position: [10, 9, 13], fov: 48 }} shadows>
    <color attach="background" args={['#071c35']} /><fog attach="fog" args={['#071c35', 18, 68]} />
    <ambientLight intensity={1.6} /><directionalLight position={[-8, 12, 4]} intensity={2.4} castShadow />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[150, 150, 48, 48]} /><meshStandardMaterial color="#0a4b78" metalness={.2} roughness={.48} /></mesh>
    <gridHelper args={[150, 50, '#12628e', '#0d5a88']} position={[0, .012, 0]} />
    <Island position={[-9, .25, -7]} color="#d4b359" /><Island position={[9, .25, -5]} color="#5cb979" /><Island position={[2, .25, 8]} color="#ae70e3" />
    {profile?.repositories.map((repository) => <Island key={repository.html_url} position={repository.position} color={repository.color} onClick={() => onRepositoryClick(repository)} />)}
    {profile && <Ship profile={profile} />}<CameraTravel destination={profile?.position ?? null} /><Stars radius={70} depth={35} count={1800} factor={3} saturation={0} fade speed={.3} />
    <OrbitControls makeDefault target={profile?.position ?? [0, 0, 0]} minDistance={4} maxDistance={40} maxPolarAngle={Math.PI / 2.08} />
  </Canvas>
}

function App() {
  const [username, setUsername] = useState('')
  const [profile, setProfile] = useState<ShipProfile | null>(null)
  const [selectedRepository, setSelectedRepository] = useState<RepositoryIsland | null>(null)
  const [status, setStatus] = useState('Digite um usuário público do GitHub para encontrar seu porto.')
  const [loading, setLoading] = useState(false)
  const findDeveloper = useCallback(async (event: React.FormEvent) => {
    event.preventDefault(); const login = username.trim().replace('@', ''); if (!login) return
    setLoading(true); setStatus('Consultando as águas públicas do GitHub…')
    try {
      const [userResponse, reposResponse] = await Promise.all([fetch(`https://api.github.com/users/${encodeURIComponent(login)}`), fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&sort=updated`)])
      if (!userResponse.ok) throw new Error(userResponse.status === 404 ? 'Usuário não encontrado.' : 'GitHub indisponível ou limite público atingido.')
      const user = await userResponse.json() as GitHubUser; const repositories = reposResponse.ok ? await reposResponse.json() as GitHubRepository[] : []
      const nextProfile = createProfile(user, repositories); setProfile(nextProfile); setSelectedRepository(null); setStatus(`Porto encontrado: ${user.login} navega como ${nextProfile.shipClass}. Clique nas ilhas do porto para abrir os repositórios.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível localizar esse dev.') } finally { setLoading(false) }
  }, [username])
  return <main className="app-shell"><div className="ocean"><Ocean profile={profile} onRepositoryClick={setSelectedRepository} /></div>
    <header className="topbar"><a className="brand" href="/"><span>⚓</span> GitHub Ocean</a><span className="mode">MVP · Public profiles</span></header>
    <section className="search-card"><p className="eyebrow">EXPLORE THE DEVELOPER WORLD</p><h1>Encontre um barco pelo GitHub.</h1><form onSubmit={findDeveloper}><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ex.: lucasconstantino" aria-label="GitHub username" /><button disabled={loading}>{loading ? 'Navegando…' : 'Ir ao porto'}</button></form><p className="status">{status}</p></section>
    <aside className={`profile-card ${profile ? 'visible' : ''}`}>{profile && <><img src={profile.user.avatar_url} alt="" /><div><p className="eyebrow">{profile.shipClass.toUpperCase()}</p><h2>{profile.user.name ?? profile.user.login}</h2><a href={profile.user.html_url} target="_blank">@{profile.user.login} ↗</a></div><p className="bio">{profile.user.bio ?? 'Explorador das águas abertas do código.'}</p><div className="stats"><span><b>{profile.user.public_repos}</b> repos</span><span><b>{profile.stars}</b> stars</span><span><b>{profile.user.followers}</b> followers</span></div><div className="languages">{profile.languages.length ? profile.languages.map((language) => <span key={language.name} style={{ borderColor: language.color }}><i style={{ background: language.color }} />{language.name}</span>) : <span>Stack não identificada</span>}</div></>}</aside>
    <aside className={`repository-card ${selectedRepository ? 'visible' : ''}`}>{selectedRepository && <><button className="close" onClick={() => setSelectedRepository(null)} aria-label="Fechar">×</button><p className="eyebrow" style={{ color: selectedRepository.color }}>REPOSITORY ISLAND</p><h2>{selectedRepository.name}</h2><p>{selectedRepository.description ?? 'Uma ilha sem descrição, esperando por novos exploradores.'}</p><div className="repo-stats"><span>★ {selectedRepository.stargazers_count}</span><span>⑂ {selectedRepository.forks_count}</span><span>{selectedRepository.language ?? 'Code'}</span></div><a href={selectedRepository.html_url} target="_blank">Abrir no GitHub ↗</a></>}</aside>
    <footer><span>Arraste para olhar · Scroll para zoom</span><span>Barcos e ilhas são gerados proceduralmente</span></footer>
  </main>
}
export default App
