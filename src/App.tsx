import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import './App.css'
import './repository.css'
import './world-layout.css'

type GitHubUser = { login: string; name: string | null; avatar_url: string; html_url: string; bio: string | null; public_repos: number; followers: number }
type GitHubRepository = { name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; updated_at: string; commit_count: number }
type RepositoryIsland = GitHubRepository & { position: [number, number, number]; color: string; size: number }
type ShipProfile = { user: GitHubUser; languages: { name: string; count: number; color: string }[]; stars: number; forks: number; repositories: RepositoryIsland[]; shipClass: 'Skiff' | 'Sloop' | 'Brigantine' | 'Frigate' | 'Galleon'; position: [number, number, number]; homePosition: [number, number, number]; island: { size: number; level: number; commits: number } }
type Locale = 'pt-BR' | 'en' | 'es'
type WorldChunk = [number, number]

const languageColors: Record<string, string> = { Dart: '#31b9f3', TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572a5', Java: '#b07219', Kotlin: '#a97bff', Swift: '#f05138', Go: '#00add8', Rust: '#dea584', 'C#': '#178600', 'C++': '#f34b7d', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Ruby: '#701516' }
const hash = (value: string) => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7)
const worldChunkFor = (position: [number, number, number]): WorldChunk => [Math.floor(position[0] / 88), Math.floor(position[2] / 88)]
const initialGithubLogin = new URLSearchParams(window.location.search).get('github')
const copy: Record<Locale, Record<string, string>> = {
  'pt-BR': { search: 'Encontre um barco pelo GitHub.', username: 'Nome de usuário', go: 'Ir ao porto', login: 'Entrar com GitHub', home: 'Ir ao meu porto', loading: 'Navegando…', initial: 'Digite um usuário público do GitHub para encontrar seu porto.', controls: 'WASD para navegar · Botão direito para câmera livre · WASD centraliza', world: 'Ilhas evoluem pelos assets, sem crescer lateralmente', repos: 'repos', followers: 'seguidores' },
  en: { search: 'Find a boat through GitHub.', username: 'Username', go: 'Go to harbour', login: 'Sign in with GitHub', home: 'Go to my harbour', loading: 'Sailing…', initial: 'Enter a public GitHub username to find their harbour.', controls: 'WASD to sail · Right-drag for free camera · WASD recenters', world: 'Islands evolve through assets, without expanding sideways', repos: 'repos', followers: 'followers' },
  es: { search: 'Encuentra un barco en GitHub.', username: 'Nombre de usuario', go: 'Ir al puerto', login: 'Entrar con GitHub', home: 'Ir a mi puerto', loading: 'Navegando…', initial: 'Escribe un usuario público de GitHub para encontrar su puerto.', controls: 'WASD para navegar · Botón derecho para cámara libre · WASD centra', world: 'Las islas evolucionan con assets, sin crecer lateralmente', repos: 'repos', followers: 'seguidores' },
}

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
  // The shore has a hard cap. Further progression upgrades assets, not footprint.
  const island = { size: Math.min(1.28, Math.max(.78, .78 + islandScore * .12)), level: islandScore < 1 ? 1 : islandScore < 1.8 ? 2 : islandScore < 2.6 ? 3 : islandScore < 3.4 ? 4 : 5, commits: totalCommits }
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

function Ship({ profile, onClick, shipRef, position, rotation }: { profile: ShipProfile; onClick?: () => void; shipRef?: React.RefObject<THREE.Group | null>; position?: [number, number, number]; rotation?: number }) {
  const color = profile.languages[0]?.color ?? '#d5a34c'
  const size = { Skiff: .65, Sloop: .85, Brigantine: 1.05, Frigate: 1.25, Galleon: 1.5 }[profile.shipClass]
  const masts = profile.shipClass === 'Skiff' ? 1 : profile.shipClass === 'Sloop' ? 1 : profile.shipClass === 'Brigantine' ? 2 : profile.shipClass === 'Frigate' ? 2 : 3
  const bob = useRef<THREE.Group>(null)
  const wake = useRef<THREE.MeshBasicMaterial>(null)
  const phase = (hash(profile.user.login) % 100) / 17
  useFrame(({ clock }) => {
    if (!bob.current) return
    const time = clock.elapsedTime + phase
    bob.current.position.y = .08 + Math.sin(time * 1.35) * .07
    bob.current.rotation.x = Math.sin(time * 1.05) * .035
    bob.current.rotation.z = Math.cos(time * .86) * .045
    if (wake.current) wake.current.opacity = .15 + (Math.sin(time * 2.1) + 1) * .07
  })
  return <group ref={shipRef} position={position ?? profile.position} rotation={[0, rotation ?? -.35, 0]} scale={size} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <group ref={bob}>
      <mesh position={[0, .2, 0]} castShadow><boxGeometry args={[1.35 + masts * .18, .35 + masts * .03, .58 + masts * .05]} /><meshStandardMaterial color={profile.shipClass === 'Galleon' ? '#3b2017' : '#4a2617'} roughness={.82} /></mesh>
      <mesh position={[0, .35, 0]} rotation={[Math.PI / 4, Math.PI / 4, 0]} castShadow><coneGeometry args={[.32, .32, 4]} /><meshStandardMaterial color="#6e3821" /></mesh>
      {Array.from({ length: masts }, (_, index) => <group key={index} position={[(index - (masts - 1) / 2) * .5, 0, 0]}><mesh position={[0, 1.15 + index * .08, 0]} castShadow><cylinderGeometry args={[.035, .055, 1.65 + index * .14]} /><meshStandardMaterial color="#31190e" /></mesh><mesh position={[.24, 1.23 + index * .08, 0]} rotation={[0, Math.sin(phase + index) * .05, -.1]} castShadow><planeGeometry args={[.52 + index * .08, .84 + index * .08]} /><meshStandardMaterial color={index === 0 ? color : '#e8e5d4'} side={THREE.DoubleSide} /></mesh></group>)}
    </group>
    <mesh position={[-1.35, .025, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.2, .72]} /><meshBasicMaterial ref={wake} color="#b9efff" transparent opacity={.2} depthWrite={false} /></mesh>
  </group>
}

function HomeIsland({ profile, onClick, onRepositoryClick }: { profile: ShipProfile; onClick?: () => void; onRepositoryClick?: (repository: RepositoryIsland) => void }) {
  const { size, level } = profile.island
  const seed = hash(profile.user.login)
  const sides = 7 + seed % 6
  const rotation = (seed % 628) / 100
  const stretchX = .78 + ((seed >>> 4) % 58) / 100
  const stretchZ = .78 + ((seed >>> 10) % 58) / 100
  const hasSandbar = seed % 3 !== 0
  const hasCove = seed % 4 === 0
  return <group position={profile.homePosition} scale={size} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <group rotation={[0, rotation, 0]} scale={[stretchX, 1, stretchZ]}>
      <mesh receiveShadow castShadow><cylinderGeometry args={[2.4, 2.75, .6, sides]} /><meshStandardMaterial color="#765a2d" /></mesh>
      <mesh position={[0, .4, 0]} receiveShadow><cylinderGeometry args={[2.14, 2.36, .28, sides]} /><meshStandardMaterial color="#6daf66" /></mesh>
      {hasSandbar && <><mesh position={[2.05, .08, .12]} scale={[.8, .48, .55]} receiveShadow><cylinderGeometry args={[1.1, 1.25, .18, 7]} /><meshStandardMaterial color="#d7bc77" /></mesh><mesh position={[1.85, .24, .1]} scale={[.7, .35, .43]} receiveShadow><cylinderGeometry args={[1.04, 1.14, .16, 7]} /><meshStandardMaterial color="#73a96b" /></mesh></>}
      {hasCove && <mesh position={[-1.63, .52, .18]} scale={[.42, .18, .5]}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#0a4b78" /></mesh>}
    </group>
    <mesh position={[-.72, 1.15, -.4]} castShadow><coneGeometry args={[.38, 1.5, 6]} /><meshStandardMaterial color="#175a36" /></mesh>
    <mesh position={[-1.2, .9, .45]} castShadow><coneGeometry args={[.28, 1.1, 6]} /><meshStandardMaterial color="#207445" /></mesh>
    <mesh position={[-.1, .76, 1.15]} castShadow><coneGeometry args={[.25, .95, 6]} /><meshStandardMaterial color="#1b663d" /></mesh>
    {level >= 2 && <Settlement />}{level >= 3 && <Market />}{level >= 4 && <Fort />}
    {profile.repositories.slice(0, Math.min(4, level)).map((repository, index) => <RepoBuilding key={repository.html_url} repository={repository} index={index} onClick={() => onRepositoryClick?.(repository)} />)}
  </group>
}

function Settlement() { return <group position={[-.95, .72, -.95]}><mesh castShadow><boxGeometry args={[.48, .38, .48]} /><meshStandardMaterial color="#b9854d" /></mesh><mesh position={[0, .45, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[.42, .38, 4]} /><meshStandardMaterial color="#d26c49" /></mesh></group> }
function Market() { return <group position={[-1.1, .72, .85]}><mesh castShadow><boxGeometry args={[.62, .34, .43]} /><meshStandardMaterial color="#c99655" /></mesh><mesh position={[0, .48, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[.48, .32, 4]} /><meshStandardMaterial color="#e0a95b" /></mesh></group> }
function Fort() { return <group position={[.05, .84, -1.2]}><mesh castShadow><cylinderGeometry args={[.3, .36, .75, 6]} /><meshStandardMaterial color="#77838b" /></mesh><mesh position={[0, .48, 0]}><coneGeometry args={[.38, .36, 6]} /><meshStandardMaterial color="#596675" /></mesh></group> }

function RepoBuilding({ repository, index, onClick }: { repository: RepositoryIsland; index: number; onClick: () => void }) {
  const positions: [number, number, number][] = [[.3, .6, -.25], [1.1, .64, .55], [.95, .95, -.95], [-.25, .64, .85]]
  const position = positions[index]
  const fortress = index === 3
  return <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }}>
    <mesh castShadow><boxGeometry args={fortress ? [.75, 1.15, .7] : [.7, .58, .62]} /><meshStandardMaterial color={fortress ? '#8c8b83' : '#cf9b5a'} /></mesh>
    <mesh position={[0, fortress ? .82 : .45, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[fortress ? .52 : .6, fortress ? .55 : .5, 4]} /><meshStandardMaterial color={repository.color} /></mesh>
  </group>
}

function CameraTravel({ destination, controls }: { destination: [number, number, number] | null; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree()
  useEffect(() => {
    if (!destination) return
    const [x, y, z] = destination
    camera.position.set(x + 7, y + 7, z + 10)
    controls.current?.target.set(x, y + .75, z)
    controls.current?.update()
  }, [camera, controls, destination])
  return null
}

function SkyStars() {
  const sky = useRef<THREE.Group>(null)
  const { camera } = useThree()
  useFrame(() => { sky.current?.position.copy(camera.position) })
  return <group ref={sky}><Stars radius={68} depth={32} count={1800} factor={3} saturation={0} fade speed={.3} /></group>
}

type PlayerTransform = { position: [number, number, number]; rotation: number }

const oceanVertexShader = `
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float broad = sin(p.x * .045 + uTime * .7) * .22 + cos(p.y * .052 - uTime * .55) * .16;
    float detail = sin((p.x + p.y) * .16 + uTime * 1.4) * .045;
    p.z += broad + detail;
    vWave = broad + detail;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const oceanFragmentShader = `
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    float shimmer = sin((vUv.x - vUv.y) * 95.0 + uTime * 1.8) * .5 + .5;
    vec3 deep = vec3(.018, .19, .34);
    vec3 crest = vec3(.055, .43, .62);
    vec3 color = mix(deep, crest, clamp(vWave * 1.3 + .42 + shimmer * .08, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
  }
`

function OceanSurface() {
  const material = useRef<THREE.ShaderMaterial>(null)
  useFrame(({ clock }) => { if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime })
  return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[650, 650, 128, 128]} />
    <shaderMaterial ref={material} vertexShader={oceanVertexShader} fragmentShader={oceanFragmentShader} uniforms={{ uTime: { value: 0 } }} />
  </mesh>
}

function WorldPort({ developer, onDeveloperClick, onRepositoryClick }: { developer: ShipProfile; onDeveloperClick: (developer: ShipProfile) => void; onRepositoryClick: (repository: RepositoryIsland) => void }) {
  const detailedRef = useRef(true)
  const [detailed, setDetailed] = useState(true)
  const world = useRef(new THREE.Vector3(...developer.homePosition))
  useFrame(({ camera }) => {
    const next = camera.position.distanceToSquared(world.current) < 58 * 58
    if (next === detailedRef.current) return
    detailedRef.current = next
    setDetailed(next)
  })
  if (detailed) return <group><HomeIsland profile={developer} onClick={() => onDeveloperClick(developer)} onRepositoryClick={onRepositoryClick} /><Ship profile={developer} onClick={() => onDeveloperClick(developer)} /></group>
  return <group position={developer.homePosition} onClick={(event) => { event.stopPropagation(); onDeveloperClick(developer) }}>
    <mesh scale={[developer.island.size, .45, developer.island.size]}><cylinderGeometry args={[2.1, 2.55, .75, 7]} /><meshStandardMaterial color="#557a53" roughness={1} /></mesh>
    <mesh position={[2.6, .16, 0]} scale={.65}><boxGeometry args={[1.5, .35, .62]} /><meshStandardMaterial color="#4a2617" /></mesh>
  </group>
}

function PlayerNavigator({ profile, returnHome, onChunkChange, onPositionChange }: { profile: ShipProfile | null; returnHome: number; onChunkChange: (chunk: WorldChunk) => void; onPositionChange: (position: [number, number, number]) => void }) {
  const keys = useRef(new Set<string>())
  const recenterCamera = useRef(false)
  const loadedChunk = useRef<string | null>(null)
  const ship = useRef<THREE.Group>(null)
  const current = useRef<PlayerTransform>({ position: profile?.position ?? [0, 0, 0], rotation: -.35 })
  const lastPositionReport = useRef(0)
  const reportChunk = useCallback((position: [number, number, number]) => {
    const chunk = worldChunkFor(position)
    const key = `${chunk[0]}:${chunk[1]}`
    if (loadedChunk.current === key) return
    loadedChunk.current = key
    onChunkChange(chunk)
  }, [onChunkChange])
  useEffect(() => {
    if (!profile) return
    const next = { position: profile.position, rotation: -.35 }
    current.current = next
    ship.current?.position.set(...next.position)
    ship.current?.rotation.set(0, next.rotation, 0)
    reportChunk(next.position)
    onPositionChange(next.position)
  }, [profile, returnHome, reportChunk, onPositionChange])
  useEffect(() => {
    const down = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; const tag = target?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return; if (['w', 'a', 's', 'd'].includes(event.key.toLowerCase())) { keys.current.add(event.key.toLowerCase()); recenterCamera.current = true; event.preventDefault() } }
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])
  useFrame((_, delta) => {
    if (!profile) return
    const turning = (keys.current.has('d') ? 1 : 0) - (keys.current.has('a') ? 1 : 0)
    const throttle = (keys.current.has('w') ? 1 : 0) - (keys.current.has('s') ? 1 : 0)
    const rotation = current.current.rotation - turning * 2.2 * delta
    const distance = throttle * 5.5 * delta
    const forwardX = Math.cos(rotation)
    const forwardZ = -Math.sin(rotation)
    const [x, y, z] = current.current.position
    const next = { position: [x + forwardX * distance, y, z + forwardZ * distance] as [number, number, number], rotation }
    if (turning || throttle) {
      current.current = next
      ship.current?.position.set(...next.position)
      ship.current?.rotation.set(0, next.rotation, 0)
      reportChunk(next.position)
      const now = performance.now()
      if (now - lastPositionReport.current > 180) { lastPositionReport.current = now; onPositionChange(next.position) }
    }
  })
  return profile ? <><Ship profile={profile} shipRef={ship} position={profile.position} rotation={-.35} /><PlayerCamera transformRef={current} recenterRef={recenterCamera} /></> : null
}

function PlayerCamera({ transformRef, recenterRef }: { transformRef: React.MutableRefObject<PlayerTransform>; recenterRef: React.MutableRefObject<boolean> }) {
  const { camera, gl } = useThree()
  const initialized = useRef(false)
  const freeCamera = useRef(false)
  const dragging = useRef(false)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const lookTarget = useRef(new THREE.Vector3())
  useEffect(() => {
    const element = gl.domElement
    const onPointerDown = (event: MouseEvent) => {
      if (event.button !== 2) return
      event.preventDefault()
      dragging.current = true
      freeCamera.current = true
      const direction = new THREE.Vector3()
      camera.getWorldDirection(direction)
      yaw.current = Math.atan2(direction.x, -direction.z)
      pitch.current = Math.asin(THREE.MathUtils.clamp(direction.y, -.95, .95))
    }
    const onPointerMove = (event: MouseEvent) => {
      if (!dragging.current) return
      yaw.current -= event.movementX * .006
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * .005, -1.05, .58)
    }
    const onPointerUp = () => { dragging.current = false }
    const disableMenu = (event: MouseEvent) => event.preventDefault()
    element.addEventListener('mousedown', onPointerDown)
    element.addEventListener('contextmenu', disableMenu)
    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
    return () => { element.removeEventListener('mousedown', onPointerDown); element.removeEventListener('contextmenu', disableMenu); window.removeEventListener('mousemove', onPointerMove); window.removeEventListener('mouseup', onPointerUp) }
  }, [camera, gl])
  useFrame((_, delta) => {
    const transform = transformRef.current
    const forwardX = Math.cos(transform.rotation)
    const forwardZ = -Math.sin(transform.rotation)
    const [x, , z] = transform.position
    const desiredPosition = new THREE.Vector3(x - forwardX * 9, 5.5, z - forwardZ * 9)
    const desiredTarget = new THREE.Vector3(x + forwardX * 4, 1, z + forwardZ * 4)
    if (!initialized.current) { camera.position.copy(desiredPosition); lookTarget.current.copy(desiredTarget); initialized.current = true }
    if (recenterRef.current) { freeCamera.current = false; recenterRef.current = false }
    if (freeCamera.current) {
      const direction = new THREE.Vector3(Math.sin(yaw.current) * Math.cos(pitch.current), Math.sin(pitch.current), -Math.cos(yaw.current) * Math.cos(pitch.current))
      lookTarget.current.copy(camera.position).addScaledVector(direction, 14)
    } else {
      const smooth = 1 - Math.exp(-5 * delta)
      camera.position.lerp(desiredPosition, smooth)
      lookTarget.current.lerp(desiredTarget, smooth)
    }
    camera.up.set(0, 1, 0)
    camera.lookAt(lookTarget.current)
    camera.updateMatrixWorld()
  })
  return null
}

function Ocean({ profile, worldProfiles, canSail, returnHome, onDeveloperClick, onRepositoryClick, onChunkChange, onPositionChange }: { profile: ShipProfile | null; worldProfiles: ShipProfile[]; canSail: boolean; returnHome: number; onDeveloperClick: (developer: ShipProfile) => void; onRepositoryClick: (repository: RepositoryIsland) => void; onChunkChange: (chunk: WorldChunk) => void; onPositionChange: (position: [number, number, number]) => void }) {
  const controls = useRef<OrbitControlsImpl>(null)
  // Do not pass a declarative `camera` prop here: React Three Fiber reapplies
  // it after state updates (such as the world fetch), which was resetting the
  // captain's camera to the sky. PlayerCamera owns the default camera instead.
  return <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
    <color attach="background" args={['#071c35']} /><fog attach="fog" args={['#071c35', 30, 250]} />
    <ambientLight intensity={1.6} /><directionalLight position={[-8, 12, 4]} intensity={2.4} castShadow />
    <OceanSurface />
    {worldProfiles.filter((developer) => developer.user.login.toLowerCase() !== profile?.user.login.toLowerCase()).map((developer) => <WorldPort key={developer.user.login} developer={developer} onDeveloperClick={onDeveloperClick} onRepositoryClick={onRepositoryClick} />)}
    {profile && <><HomeIsland profile={profile} onRepositoryClick={onRepositoryClick} />{canSail ? <PlayerNavigator profile={profile} returnHome={returnHome} onChunkChange={onChunkChange} onPositionChange={onPositionChange} /> : <Ship profile={profile} />}</>}{!canSail && <CameraTravel destination={profile?.position ?? null} controls={controls} />}<SkyStars />
    {!canSail && <OrbitControls ref={controls} makeDefault target={profile?.position ?? [0, 0, 0]} minDistance={4} maxDistance={40} maxPolarAngle={Math.PI / 2.08} />}
  </Canvas>
}

function MiniMap({ profile, developers, playerPosition }: { profile: ShipProfile; developers: ShipProfile[]; playerPosition: [number, number, number] }) {
  const scale = 1.08
  const ports = [profile, ...developers.filter((developer) => developer.user.login !== profile.user.login)]
  return <aside className="minimap" aria-label="Mapa da região"><div className="compass">N</div><div className="map-ring">
    {ports.map((developer) => {
      const left = 50 + (developer.homePosition[0] - playerPosition[0]) * scale
      const top = 50 + (developer.homePosition[2] - playerPosition[2]) * scale
      if (left < 4 || left > 96 || top < 4 || top > 96) return null
      return <button key={developer.user.login} className="map-port" style={{ left: `${left}%`, top: `${top}%` }} title={`@${developer.user.login}`} aria-label={`Porto de ${developer.user.login}`} />
    })}
    <span className="map-player" />
  </div><span className="map-label">REGIÃO ATUAL</span></aside>
}

function useOceanAmbience(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const seconds = 3
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let index = 0; index < data.length; index++) { last = last * .985 + (Math.random() * 2 - 1) * .08; data[index] = last }
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = buffer; source.loop = true
    filter.type = 'lowpass'; filter.frequency.value = 520
    gain.gain.value = .055
    source.connect(filter).connect(gain).connect(context.destination)
    source.start()
    return () => { source.stop(); void context.close() }
  }, [enabled])
}

function App() {
  const [username, setUsername] = useState(initialGithubLogin ?? '')
  const [profile, setProfile] = useState<ShipProfile | null>(null)
  const [worldProfiles, setWorldProfiles] = useState<ShipProfile[]>([])
  const [selectedDeveloper, setSelectedDeveloper] = useState<ShipProfile | null>(null)
  const [githubLogin, setGithubLogin] = useState<string | null>(initialGithubLogin)
  const [selectedRepository, setSelectedRepository] = useState<RepositoryIsland | null>(null)
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem('github-ocean-locale') as Locale | null) ?? 'pt-BR')
  const [status, setStatus] = useState(copy['pt-BR'].initial)
  const [loading, setLoading] = useState(false)
  const [returnHome, setReturnHome] = useState(0)
  const [worldChunk, setWorldChunk] = useState<WorldChunk | null>(null)
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 0, 0])
  const [soundEnabled, setSoundEnabled] = useState(false)
  useOceanAmbience(soundEnabled)
  const t = copy[locale]
  const changeLocale = (next: Locale) => { localStorage.setItem('github-ocean-locale', next); setLocale(next); if (!profile) setStatus(copy[next].initial) }
  const loadDeveloper = useCallback(async (rawLogin: string, asCaptain = false) => {
    const login = rawLogin.trim().replace('@', ''); if (!login) return
    setLoading(true); setStatus('Mapeando o porto e contando as expedições do GitHub…')
    try {
      const developerResponse = await fetch(`http://localhost:3001/api/developers/${encodeURIComponent(login)}`)
      const developer = await developerResponse.json() as { message?: string; user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }
      if (!developerResponse.ok) throw new Error(developer.message ?? 'Não foi possível consultar o GitHub.')
      const { user, repositories } = developer
      const nextProfile = createProfile(user, repositories, developer.world_position)
      if (asCaptain || !githubLogin) { setProfile(nextProfile); setPlayerPosition(nextProfile.position); setSelectedDeveloper(null) } else setSelectedDeveloper(nextProfile)
      setSelectedRepository(null); setStatus(`Porto encontrado: ${user.login} navega como ${nextProfile.shipClass}. Clique nas construções da ilha para abrir os repositórios.`)
      setWorldChunk(worldChunkFor(nextProfile.position))
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Não foi possível localizar esse dev.') } finally { setLoading(false) }
  }, [githubLogin])
  const updateWorldChunk = useCallback((nextChunk: WorldChunk) => {
    setWorldChunk((current) => current?.[0] === nextChunk[0] && current?.[1] === nextChunk[1] ? current : nextChunk)
  }, [])
  const updatePlayerPosition = useCallback((position: [number, number, number]) => setPlayerPosition(position), [])
  const chunkX = worldChunk?.[0]
  const chunkZ = worldChunk?.[1]
  useEffect(() => {
    if (chunkX === undefined || chunkZ === undefined) return
    const abort = new AbortController()
    const regions: WorldChunk[] = []
    for (let x = chunkX - 1; x <= chunkX + 1; x++) for (let z = chunkZ - 1; z <= chunkZ + 1; z++) regions.push([x, z])
    void Promise.all(regions.map(async ([x, z]) => {
      const response = await fetch(`http://localhost:3001/api/world/chunks/${x}/${z}`, { signal: abort.signal })
      if (!response.ok) throw new Error(`Região ${x}:${z} indisponível`)
      return response.json() as Promise<{ developers: { user: GitHubUser; repositories: GitHubRepository[]; world_position?: [number, number] }[] }>
    })).then((chunks) => {
      if (abort.signal.aborted) return
      const developers = new Map<string, ShipProfile>()
      for (const chunk of chunks) for (const developer of chunk.developers) developers.set(developer.user.login, createProfile(developer.user, developer.repositories, developer.world_position))
      setWorldProfiles([...developers.values()])
    }).catch((error: unknown) => { if (!abort.signal.aborted) console.warn('Não foi possível carregar esta região do oceano.', error) })
    return () => abort.abort()
  }, [chunkX, chunkZ])
  const findDeveloper = useCallback((event: React.FormEvent) => { event.preventDefault(); void loadDeveloper(username) }, [loadDeveloper, username])
  useEffect(() => {
    if (initialGithubLogin) { void loadDeveloper(initialGithubLogin, true); window.history.replaceState({}, '', window.location.pathname) }
    void fetch('http://localhost:3001/api/auth/me').then((response) => response.json()).then((data: { user: { login: string } | null }) => { if (data.user && !initialGithubLogin) { setGithubLogin(data.user.login); void loadDeveloper(data.user.login, true) } }).catch(() => undefined)
  }, [loadDeveloper])
  const visitDeveloper = useCallback((developer: ShipProfile) => { setSelectedRepository(null); setSelectedDeveloper(developer) }, [])
  const displayedProfile = selectedDeveloper ?? profile
  const canSail = Boolean(githubLogin && profile && githubLogin.toLowerCase() === profile.user.login.toLowerCase())
  return <main className="app-shell"><div className="ocean"><Ocean profile={profile} worldProfiles={worldProfiles} canSail={canSail} returnHome={returnHome} onDeveloperClick={visitDeveloper} onRepositoryClick={setSelectedRepository} onChunkChange={updateWorldChunk} onPositionChange={updatePlayerPosition} /></div>
    <header className="topbar"><a className="brand" href="/"><span>⚓</span> GitHub Ocean</a><div className="top-actions"><button className={`sound ${soundEnabled ? 'active' : ''}`} onClick={() => setSoundEnabled((value) => !value)} aria-label={soundEnabled ? 'Desligar som do oceano' : 'Ligar som do oceano'}>{soundEnabled ? '♪ ON' : '♪ OFF'}</button><select aria-label="Language" value={locale} onChange={(event) => changeLocale(event.target.value as Locale)}><option value="pt-BR">Português (Brasil)</option><option value="en">English</option><option value="es">Español</option></select>{githubLogin ? <><button className="home" onClick={() => setReturnHome((value) => value + 1)}>{t.home}</button><span className="mode">⚓ @{githubLogin}</span></> : <a className="login" href="http://localhost:3001/api/auth/github">{t.login}</a>}</div></header>
    <section className={`search-card ${profile ? 'docked' : ''}`}><p className="eyebrow">EXPLORE THE DEVELOPER WORLD</p><h1>{t.search}</h1><form onSubmit={findDeveloper}><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={t.username} aria-label={t.username} /><button disabled={loading}>{loading ? t.loading : t.go}</button></form><p className="status">{status}</p></section>
    <aside className={`profile-card ${displayedProfile ? 'visible' : ''}`}>{displayedProfile && <><img src={displayedProfile.user.avatar_url} alt="" /><div><p className="eyebrow">{displayedProfile.shipClass.toUpperCase()}</p><h2>{displayedProfile.user.name ?? displayedProfile.user.login}</h2><a href={displayedProfile.user.html_url} target="_blank">@{displayedProfile.user.login} ↗</a></div><p className="bio">{displayedProfile.user.bio ?? 'Explorador das águas abertas do código.'}</p><div className="stats"><span><b>{displayedProfile.user.public_repos}</b> {t.repos}</span><span><b>{displayedProfile.stars}</b> stars</span><span><b>{displayedProfile.user.followers}</b> {t.followers}</span></div><div className="languages">{displayedProfile.languages.length ? displayedProfile.languages.map((language) => <span key={language.name} style={{ borderColor: language.color }}><i style={{ background: language.color }} />{language.name}</span>) : <span>Stack não identificada</span>}</div></>}</aside>
    <aside className={`repository-card ${selectedRepository ? 'visible' : ''}`}>{selectedRepository && <><button className="close" onClick={() => setSelectedRepository(null)} aria-label="Fechar">×</button><p className="eyebrow" style={{ color: selectedRepository.color }}>REPOSITORY ISLAND</p><h2>{selectedRepository.name}</h2><p>{selectedRepository.description ?? 'Uma ilha sem descrição, esperando por novos exploradores.'}</p><div className="repo-stats"><span>⌁ {selectedRepository.commit_count} commits</span><span>★ {selectedRepository.stargazers_count}</span><span>{selectedRepository.language ?? 'Code'}</span></div><a href={selectedRepository.html_url} target="_blank">Abrir no GitHub ↗</a></>}</aside>
    {profile && <MiniMap profile={profile} developers={worldProfiles} playerPosition={canSail ? playerPosition : profile.position} />}
    <footer><span>{canSail ? t.controls : 'Arraste para olhar · Scroll para zoom'}</span><span>{t.world}</span></footer>
  </main>
}
export default App
