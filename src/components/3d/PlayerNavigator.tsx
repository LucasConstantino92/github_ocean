import { useCallback, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerTransform, ShipProfile, WorldChunk } from '../../types/ocean'
import { getOceanWaveHeight, playerSailingMetrics, shipWaterlineOffset, worldChunkFor } from '../../utils/oceanMath'
import { Ship } from './Ship'
import { ShipWakeTrail } from './ShipWakeTrail'
import { PlayerCamera } from './PlayerCamera'

export function PlayerNavigator({
  profile,
  collisionProfiles,
  returnHome,
  onChunkChange,
  onPositionChange,
  onDiscoverPort,
  onHeadingChange,
}: {
  profile: ShipProfile | null
  collisionProfiles: ShipProfile[]
  returnHome: number
  onChunkChange: (chunk: WorldChunk) => void
  onPositionChange: (position: [number, number, number]) => void
  onDiscoverPort: (login: string) => void
  onHeadingChange: (heading: number) => void
}) {
  const keys = useRef(new Set<string>())
  const recenterCamera = useRef(false)
  const loadedChunk = useRef<string | null>(null)
  const ship = useRef<THREE.Group>(null)
  const current = useRef<PlayerTransform>({ position: profile?.position ?? [0, 0, 0], rotation: -0.35 })
  const lastPositionReport = useRef(0)
  const lastHeadingReport = useRef(0)
  const discoveredThisSail = useRef(new Set<string>())

  // Física de navegação marítima
  const physics = useRef({
    speed: 0,
    angularVelocity: 0,
    heeling: 0,
    pitch: 0,
    roll: 0,
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
    const initialH = getOceanWaveHeight(profile.position[0], profile.position[2], 0)
    const next = {
      position: [profile.position[0], initialH + shipWaterlineOffset, profile.position[2]] as [number, number, number],
      rotation: -0.35,
    }
    current.current = next
    recenterCamera.current = true
    physics.current = { speed: 0, angularVelocity: 0, heeling: 0, pitch: 0, roll: 0 }
    playerSailingMetrics.speed = 0
    discoveredThisSail.current.clear()
    ship.current?.position.set(...next.position)
    ship.current?.rotation.set(0, next.rotation, 0)
    reportChunk(next.position)
    onPositionChange(next.position)
  }, [profile, returnHome, reportChunk, onPositionChange])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      if (['w', 'a', 's', 'd'].includes(event.key.toLowerCase())) {
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

  useFrame(({ clock }, delta) => {
    if (!profile) return
    const dt = Math.min(delta, 0.1)
    const isW = keys.current.has('w')
    const isS = keys.current.has('s')
    const isA = keys.current.has('a')
    const isD = keys.current.has('d')

    const targetTurn = (isD ? 1 : 0) - (isA ? 1 : 0)
    const targetThrottle = (isW ? 1 : 0) - (isS ? 1 : 0)

    // Parâmetros de navegação
    const ACCEL = 4.2
    const BRAKE_ACCEL = 4.8
    const DRAG = 0.88
    const MAX_FORWARD = 7.2
    const MAX_REVERSE = -2.4
    const BASE_TURN_SPEED = 1.9

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

    const newRotation = current.current.rotation + physics.current.angularVelocity * dt
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

    // 3. Altura e inclinação precisas a partir das ondas do mar
    const time = clock.elapsedTime
    const centerH = getOceanWaveHeight(newX, newZ, time)
    const bowH = getOceanWaveHeight(newX + forwardX * 0.9, newZ + forwardZ * 0.9, time)
    const sternH = getOceanWaveHeight(newX - forwardX * 0.9, newZ - forwardZ * 0.9, time)

    const rightX = Math.sin(newRotation)
    const rightZ = Math.cos(newRotation)
    const rightH = getOceanWaveHeight(newX + rightX * 0.45, newZ + rightZ * 0.45, time)
    const leftH = getOceanWaveHeight(newX - rightX * 0.45, newZ - rightZ * 0.45, time)

    const wavePitch = (bowH - sternH) * 0.38
    const waveRoll = (rightH - leftH) * 0.58

    // Adernamento lateral ao fazer curva em velocidade (heeling)
    const targetHeeling = -physics.current.angularVelocity * (physics.current.speed / MAX_FORWARD) * 0.18
    physics.current.heeling = THREE.MathUtils.lerp(physics.current.heeling, targetHeeling, 1 - Math.exp(-5 * dt))

    // Trim de arrancada: ao acelerar, proa sobe ligeiramente
    const accelTrim = (physics.current.speed / MAX_FORWARD) * 0.04
    physics.current.pitch = THREE.MathUtils.lerp(physics.current.pitch, wavePitch + accelTrim, 1 - Math.exp(-8 * dt))
    physics.current.roll = THREE.MathUtils.lerp(physics.current.roll, waveRoll + physics.current.heeling, 1 - Math.exp(-8 * dt))

    const newPosition: [number, number, number] = [newX, centerH + shipWaterlineOffset, newZ]
    current.current = { position: newPosition, rotation: newRotation }
    const now = performance.now()

    // Compartilhar métricas para áudio e efeitos
    playerSailingMetrics.speed = physics.current.speed
    playerSailingMetrics.heading = newRotation
    playerSailingMetrics.pitch = physics.current.pitch
    playerSailingMetrics.roll = physics.current.roll
    if (now - lastHeadingReport.current > 320) {
      lastHeadingReport.current = now
      onHeadingChange(newRotation)
    }

    if (ship.current) {
      ship.current.position.set(newPosition[0], newPosition[1], newPosition[2])
      ship.current.rotation.set(physics.current.pitch, newRotation, physics.current.roll)
    }

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
    if (now - lastPositionReport.current > 320) {
      lastPositionReport.current = now
      onPositionChange(newPosition)
    }
  })

  return profile ? (
    <>
      <Ship profile={profile} shipRef={ship} position={profile.position} rotation={-0.35} isPlayerControlled />
      <ShipWakeTrail playerTransformRef={current} />
      <PlayerCamera transformRef={current} recenterRef={recenterCamera} />
    </>
  ) : null
}
