import { useCallback, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerTransform, ShipProfile, WorldChunk } from '../../types/ocean'
import { playerSailingMetrics, shipWaterlineOffset, worldChunkFor } from '../../utils/oceanMath'
import { Ship } from './Ship'
import { ShipWakeTrail } from './ShipWakeTrail'
import { PlayerCamera } from './PlayerCamera'

function DockingGuide({ profile, playerTransform }: { profile: ShipProfile; playerTransform: React.MutableRefObject<PlayerTransform> }) {
  const guide = useRef<THREE.Group>(null)
  const ring = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (!guide.current) return
    const [x, , z] = playerTransform.current.position
    const dx = x - profile.position[0]
    const dz = z - profile.position[2]
    const distance = Math.hypot(dx, dz)
    const nearby = distance < 17 && distance > .85
    guide.current.visible = nearby
    if (!nearby) return
    const pulse = .5 + Math.sin(clock.elapsedTime * 2.8) * .5
    guide.current.rotation.y = clock.elapsedTime * .42
    guide.current.position.y = .08 + pulse * .035
    if (ring.current) ring.current.opacity = .3 + pulse * .26
    if (light.current) light.current.intensity = .65 + pulse * .5
  })

  return <group ref={guide} position={[profile.position[0], .08, profile.position[2]]} visible={false}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[.74, .88, 20]} />
      <meshBasicMaterial ref={ring} color="#ffd36d" transparent opacity={.4} depthWrite={false} />
    </mesh>
    {Array.from({ length: 4 }, (_, index) => <mesh key={index} position={[Math.cos(index * Math.PI / 2) * 1.04, .08, Math.sin(index * Math.PI / 2) * 1.04]} rotation={[0, -index * Math.PI / 2, 0]}>
      <coneGeometry args={[.1, .25, 3]} />
      <meshBasicMaterial color="#ffe6a4" transparent opacity={.8} />
    </mesh>)}
    <pointLight ref={light} position={[0, 1.5, 0]} color="#ffc46e" intensity={1} distance={5} decay={2} />
  </group>
}

export function PlayerNavigator({
  profile,
  collisionProfiles,
  returnHome,
  onChunkChange,
  onPositionChange,
  onDiscoverPort,
  onHeadingChange,
  onDisembark,
}: {
  profile: ShipProfile | null
  collisionProfiles: ShipProfile[]
  returnHome: number
  onChunkChange: (chunk: WorldChunk) => void
  onPositionChange: (position: [number, number, number]) => void
  onDiscoverPort: (login: string) => void
  onHeadingChange: (heading: number) => void
  onDisembark: () => void
}) {
  const keys = useRef(new Set<string>())
  const recenterCamera = useRef(false)
  const loadedChunk = useRef<string | null>(null)
  const ship = useRef<THREE.Group>(null)
  const current = useRef<PlayerTransform>({ position: profile?.position ?? [0, 0, 0], rotation: -0.35 })
  const lastPositionReport = useRef(0)
  const lastHeadingReport = useRef(0)
  const lastReportedPosition = useRef<[number, number, number] | null>(null)
  const lastReportedHeading = useRef<number | null>(null)
  const discoveredThisSail = useRef(new Set<string>())
  const disembarkLatch = useRef(false)
  const orbitHeading = useRef<number | null>(null)

  // Física de navegação marítima
  const physics = useRef({
    speed: 0,
    angularVelocity: 0,
    heeling: 0,
    pitch: 0,
    roll: 0,
    waterline: profile?.position[1] ?? 0,
  })

  const collidesAt = useCallback((x: number, z: number) => {
    const hullClearance = profile ? .42 + profile.progression.ship.hullWidth * profile.progression.ship.size * .42 : .7
    const profiles = profile ? [profile, ...collisionProfiles.filter((candidate) => candidate.user.login.toLowerCase() !== profile.user.login.toLowerCase())] : collisionProfiles
    for (const candidate of profiles) {
      const centerX = candidate.homePosition[0]
      const centerZ = candidate.homePosition[2]
      const broadRadius = candidate.island.radius + hullClearance + 1
      const broadX = x - centerX
      const broadZ = z - centerZ
      // Most ports are far away. Avoid rotating/testing every landmass unless
      // the boat first enters the port's inexpensive circular broad phase.
      if (broadX * broadX + broadZ * broadZ > broadRadius * broadRadius) continue
      // Elliptical tests follow the actual rotated landmasses, including the
      // open water in the middle of a lagoon.
      for (const land of candidate.island.landmasses) {
        const dx = x - (candidate.homePosition[0] + land.x)
        const dz = z - (candidate.homePosition[2] + land.z)
        const localX = Math.cos(land.rotation) * dx + Math.sin(land.rotation) * dz
        const localZ = -Math.sin(land.rotation) * dx + Math.cos(land.rotation) * dz
        const radiusX = land.radius * land.stretch + hullClearance
        const radiusZ = land.radius + hullClearance
        if ((localX / radiusX) ** 2 + (localZ / radiusZ) ** 2 < 1) return true
      }
      if (candidate.user.login.toLowerCase() !== profile?.user.login.toLowerCase()) {
        const dx = x - candidate.position[0]
        const dz = z - candidate.position[2]
        const shipClearance = 1.05 + candidate.progression.ship.size * .48 + hullClearance
        if (dx * dx + dz * dz < shipClearance * shipClearance) return true
      }
    }
    return false
  }, [collisionProfiles, profile])

  const reportChunk = useCallback(
    (position: [number, number, number]) => {
      const chunk = worldChunkFor(position)
      const key = `${chunk[0]}:${chunk[1]}`
      if (loadedChunk.current === key) return
      loadedChunk.current = key
      onChunkChange(chunk)
    },
    [onChunkChange]
  )

  useEffect(() => {
    if (!profile) return
    const next = {
      position: [profile.position[0], shipWaterlineOffset, profile.position[2]] as [number, number, number],
      rotation: -0.35,
    }
    current.current = next
    recenterCamera.current = true
    physics.current = { speed: 0, angularVelocity: 0, heeling: 0, pitch: 0, roll: 0, waterline: shipWaterlineOffset }
    playerSailingMetrics.speed = 0
    discoveredThisSail.current.clear()
    ship.current?.position.set(...next.position)
    ship.current?.rotation.set(0, next.rotation, 0)
    lastReportedPosition.current = next.position
    lastReportedHeading.current = next.rotation
    reportChunk(next.position)
    onPositionChange(next.position)
  }, [profile, returnHome, reportChunk, onPositionChange])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      if (['w', 'a', 's', 'd', 'e'].includes(event.key.toLowerCase())) {
        keys.current.add(event.key.toLowerCase())
        event.preventDefault()
      }
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useFrame((_, delta) => {
    if (!profile) return
    const dt = Math.min(delta, 0.1)
    const isW = keys.current.has('w')
    const isS = keys.current.has('s')
    const isA = keys.current.has('a')
    const isD = keys.current.has('d')

    const targetTurn = (isD ? 1 : 0) - (isA ? 1 : 0)
    const targetThrottle = (isW ? 1 : 0) - (isS ? 1 : 0)

    // Parâmetros de navegação
    const ACCEL = 1.35
    const BRAKE_ACCEL = 1.8
    const DRAG = 0.58
    const MAX_FORWARD = 4.8
    const MAX_REVERSE = -1.5
    const BASE_TURN_SPEED = 1.45

    // 1. Aceleração com inércia da água
    if (targetThrottle > 0) {
      physics.current.speed = Math.min(MAX_FORWARD, physics.current.speed + ACCEL * dt)
    } else if (targetThrottle < 0) {
      physics.current.speed = Math.max(MAX_REVERSE, physics.current.speed - BRAKE_ACCEL * dt)
    } else {
      // Arrasto hidrodinâmico natural: barco desliza e vai desacelerando suavemente
      physics.current.speed *= Math.exp(-DRAG * dt)
      if (Math.abs(physics.current.speed) < 0.02) physics.current.speed = 0
    }

    // 2. Resposta do leme: depende do fluxo de água pela quilha
    // Com barco parado vira devagar, em movimento manobra ágil
    const speedRatio = Math.min(Math.abs(physics.current.speed) / 3.8, 1.2)
    const turnResponsiveness = BASE_TURN_SPEED * (0.35 + 0.65 * speedRatio)
    // Se estiver dando ré, inverter a direção do leme como em barco real
    const rudderDir = physics.current.speed < -0.1 ? -targetTurn : targetTurn
    const targetAngularVel = -rudderDir * turnResponsiveness
    physics.current.angularVelocity = THREE.MathUtils.lerp(
      physics.current.angularVelocity,
      targetAngularVel,
      1 - Math.exp(-6 * dt)
    )

    let newRotation = current.current.rotation + physics.current.angularVelocity * dt
    // Enquanto o botão direito está pressionado, o leme acompanha o olhar da
    // câmera. Soltar o botão devolve o controle ao leme/WASD imediatamente.
    if (orbitHeading.current !== null) {
      const difference = Math.atan2(Math.sin(orbitHeading.current - newRotation), Math.cos(orbitHeading.current - newRotation))
      newRotation += difference * (1 - Math.exp(-7 * dt))
    }
    const distance = physics.current.speed * dt
    const forwardX = Math.cos(newRotation)
    const forwardZ = -Math.sin(newRotation)
    const [currX, , currZ] = current.current.position
    let newX = currX + forwardX * distance
    let newZ = currZ + forwardZ * distance

    // Coast and anchored ship collisions: try each axis independently so the
    // player naturally glides along a beach instead of stopping on every touch.
    if (collidesAt(newX, newZ)) {
      const canSlideX = !collidesAt(newX, currZ)
      const canSlideZ = !collidesAt(currX, newZ)
      if (canSlideX) newZ = currZ
      else if (canSlideZ) newX = currX
      else {
        newX = currX
        newZ = currZ
        physics.current.speed *= .22
      }
    }

    // The playable ship is deliberately stabilized. The sea remains animated,
    // but the hull keeps a fixed waterline and zero roll/pitch for crisp input.
    physics.current.waterline = shipWaterlineOffset
    physics.current.pitch = 0
    physics.current.roll = 0
    const newPosition: [number, number, number] = [newX, shipWaterlineOffset, newZ]
    current.current = { position: newPosition, rotation: newRotation }
    const now = performance.now()

    // Compartilhar métricas para áudio e efeitos
    playerSailingMetrics.speed = physics.current.speed
    playerSailingMetrics.heading = newRotation
    playerSailingMetrics.pitch = physics.current.pitch
    playerSailingMetrics.roll = physics.current.roll
    const headingDifference = lastReportedHeading.current === null ? Infinity : Math.abs(Math.atan2(Math.sin(newRotation - lastReportedHeading.current), Math.cos(newRotation - lastReportedHeading.current)))
    if (now - lastHeadingReport.current > 320 && headingDifference > .015) {
      lastHeadingReport.current = now
      lastReportedHeading.current = newRotation
      onHeadingChange(newRotation)
    }

    if (ship.current) {
      ship.current.position.set(newPosition[0], newPosition[1], newPosition[2])
      ship.current.rotation.set(physics.current.pitch, newRotation, physics.current.roll)
    }

    const dockX = newPosition[0] - profile.position[0]
    const dockZ = newPosition[2] - profile.position[2]
    if (keys.current.has('e') && dockX * dockX + dockZ * dockZ < 2.5 * 2.5 && Math.abs(physics.current.speed) < 1.2) {
      if (!disembarkLatch.current) { disembarkLatch.current = true; onDisembark() }
    } else if (!keys.current.has('e')) disembarkLatch.current = false

    // A port is discovered only by arriving in its waters, not by merely loading
    // its world chunk. The set avoids repeating state updates while nearby.
    for (const candidate of [profile, ...collisionProfiles]) {
      const login = candidate.user.login.toLowerCase()
      if (discoveredThisSail.current.has(login)) continue
      const dx = newPosition[0] - candidate.homePosition[0]
      const dz = newPosition[2] - candidate.homePosition[2]
      if (dx * dx + dz * dz > 17 * 17) continue
      discoveredThisSail.current.add(login)
      onDiscoverPort(login)
    }

    reportChunk(newPosition)
    const previousPosition = lastReportedPosition.current
    const positionChanged = !previousPosition || (newPosition[0] - previousPosition[0]) ** 2 + (newPosition[2] - previousPosition[2]) ** 2 > .04
    if (now - lastPositionReport.current > 320 && positionChanged) {
      lastPositionReport.current = now
      lastReportedPosition.current = newPosition
      onPositionChange(newPosition)
    }
  })

  return profile ? (
    <>
      <Ship profile={profile} shipRef={ship} position={profile.position} rotation={-0.35} isPlayerControlled />
      <ShipWakeTrail playerTransformRef={current} />
      <DockingGuide profile={profile} playerTransform={current} />
      <PlayerCamera transformRef={current} recenterRef={recenterCamera} onOrbitHeading={(heading) => { orbitHeading.current = heading }} />
    </>
  ) : null
}
