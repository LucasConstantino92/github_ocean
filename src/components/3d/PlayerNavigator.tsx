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
  returnHome,
  onChunkChange,
  onPositionChange,
}: {
  profile: ShipProfile | null
  returnHome: number
  onChunkChange: (chunk: WorldChunk) => void
  onPositionChange: (position: [number, number, number]) => void
}) {
  const keys = useRef(new Set<string>())
  const recenterCamera = useRef(false)
  const loadedChunk = useRef<string | null>(null)
  const ship = useRef<THREE.Group>(null)
  const current = useRef<PlayerTransform>({ position: profile?.position ?? [0, 0, 0], rotation: -0.35 })
  const lastPositionReport = useRef(0)

  // Física de navegação marítima
  const physics = useRef({
    speed: 0,
    angularVelocity: 0,
    heeling: 0,
    pitch: 0,
    roll: 0,
  })

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
    const newX = currX + forwardX * distance
    const newZ = currZ + forwardZ * distance

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

    // Compartilhar métricas para áudio e efeitos
    playerSailingMetrics.speed = physics.current.speed
    playerSailingMetrics.heading = newRotation
    playerSailingMetrics.pitch = physics.current.pitch
    playerSailingMetrics.roll = physics.current.roll

    if (ship.current) {
      ship.current.position.set(newPosition[0], newPosition[1], newPosition[2])
      ship.current.rotation.set(physics.current.pitch, newRotation, physics.current.roll)
    }

    reportChunk(newPosition)
    const now = performance.now()
    if (now - lastPositionReport.current > 180) {
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
