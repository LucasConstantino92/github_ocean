import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ShipProfile } from '../../types/ocean'
import { hash, getOceanWaveHeight, playerSailingMetrics, shipWaterlineOffset } from '../../utils/oceanMath'

export function Ship({
  profile,
  onClick,
  shipRef,
  position,
  rotation,
  isPlayerControlled = false,
}: {
  profile: ShipProfile
  onClick?: () => void
  shipRef?: React.RefObject<THREE.Group | null>
  position?: [number, number, number]
  rotation?: number
  isPlayerControlled?: boolean
}) {
  const color = profile.languages[0]?.color ?? '#d5a34c'
  const size = { Skiff: 0.65, Sloop: 0.85, Brigantine: 1.05, Frigate: 1.25, Galleon: 1.5 }[profile.shipClass]
  const masts = profile.shipClass === 'Skiff' ? 1 : profile.shipClass === 'Sloop' ? 1 : profile.shipClass === 'Brigantine' ? 2 : profile.shipClass === 'Frigate' ? 2 : 3
  const bob = useRef<THREE.Group>(null)
  const sailsRef = useRef<(THREE.Mesh | null)[]>([])
  const flagRef = useRef<THREE.Mesh>(null)
  const bowSplashLeft = useRef<THREE.MeshBasicMaterial>(null)
  const bowSplashRight = useRef<THREE.MeshBasicMaterial>(null)
  const wake = useRef<THREE.MeshBasicMaterial>(null)
  const phase = (hash(profile.user.login) % 100) / 17

  useFrame(({ clock }) => {
    const oceanTime = clock.elapsedTime
    const animationTime = oceanTime + phase
    const speed = isPlayerControlled ? playerSailingMetrics.speed : 0
    const absSpeed = Math.abs(speed)

    // A onda usa o mesmo relógio e as mesmas coordenadas do shader do oceano.
    // Como este grupo fica dentro da escala da classe do barco, compensamos a
    // escala para que a altura final continue em unidades reais do mundo.
    if (!isPlayerControlled && bob.current) {
      const [baseX, , baseZ] = position ?? profile.position
      const waveH = getOceanWaveHeight(baseX, baseZ, oceanTime)
      bob.current.position.y = waveH / size + shipWaterlineOffset
      const bowH = getOceanWaveHeight(baseX + 0.8, baseZ, oceanTime)
      const sternH = getOceanWaveHeight(baseX - 0.8, baseZ, oceanTime)
      const rightH = getOceanWaveHeight(baseX, baseZ + 0.4, oceanTime)
      const leftH = getOceanWaveHeight(baseX, baseZ - 0.4, oceanTime)
      bob.current.rotation.x = (rightH - leftH) * 0.45
      bob.current.rotation.z = (bowH - sternH) * 0.35
    }

    // Velas enfunando e reagindo ao vento e velocidade
    const sailPuff = Math.min(absSpeed / 4.0, 1.0)
    for (let i = 0; i < sailsRef.current.length; i++) {
      const sail = sailsRef.current[i]
      if (!sail) continue
      const flutter = Math.sin(animationTime * (2.8 + sailPuff * 2.0) + i) * (0.04 + sailPuff * 0.03)
      sail.rotation.y = flutter
      sail.rotation.z = -0.1 - sailPuff * 0.16 + flutter * 0.5
      sail.scale.set(1 + sailPuff * 0.15, 1, 1)
    }

    // Bandeira/flâmula ondulando no mastro principal
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(animationTime * (4 + sailPuff * 4)) * (0.2 + sailPuff * 0.25)
      flagRef.current.rotation.z = -sailPuff * 0.2
    }

    // Espuma de corte de proa (Bow splash)
    if (bowSplashLeft.current && bowSplashRight.current) {
      const splashOpacity = Math.min(Math.max((speed - 0.4) / 4.0, 0), 0.55)
      bowSplashLeft.current.opacity = splashOpacity
      bowSplashRight.current.opacity = splashOpacity
    }

    if (wake.current) {
      wake.current.opacity = isPlayerControlled
        ? Math.min(absSpeed / 3.0, 0.35)
        : 0.12 + (Math.sin(animationTime * 2.1) + 1) * 0.05
    }
  })

  return (
    <group
      ref={shipRef}
      position={position ?? profile.position}
      rotation={[0, rotation ?? -0.35, 0]}
      scale={size}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      <group ref={bob}>
        {/* Casco */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[1.35 + masts * 0.18, 0.35 + masts * 0.03, 0.58 + masts * 0.05]} />
          <meshStandardMaterial color={profile.shipClass === 'Galleon' ? '#3b2017' : '#4a2617'} roughness={0.82} />
        </mesh>
        {/* Bico de proa */}
        <mesh position={[0.7 + masts * 0.09, 0.22, 0]} rotation={[0, 0, -Math.PI / 8]} castShadow>
          <coneGeometry args={[0.26, 0.55, 4]} />
          <meshStandardMaterial color="#5c301c" />
        </mesh>
        <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 4, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.32, 0.32, 4]} />
          <meshStandardMaterial color="#6e3821" />
        </mesh>

        {/* Mastros e Velas */}
        {Array.from({ length: masts }, (_, index) => {
          const mastX = (index - (masts - 1) / 2) * 0.5
          const mastH = 1.65 + index * 0.14
          const isMainMast = index === masts - 1
          return (
            <group key={index} position={[mastX, 0, 0]}>
              {/* Mastro vertical */}
              <mesh position={[0, 1.15 + index * 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.055, mastH]} />
                <meshStandardMaterial color="#31190e" />
              </mesh>
              {/* Verga superior (cruzeta de madeira que sustenta a vela) */}
              <mesh position={[0.18, 1.8 + index * 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.02, 0.02, 0.62 + index * 0.08]} />
                <meshStandardMaterial color="#22110a" />
              </mesh>
              {/* Vela */}
              <mesh
                ref={(el) => {
                  sailsRef.current[index] = el
                }}
                position={[0.24, 1.23 + index * 0.08, 0]}
                rotation={[0, Math.sin(phase + index) * 0.05, -0.1]}
                castShadow
              >
                <planeGeometry args={[0.52 + index * 0.08, 0.84 + index * 0.08]} />
                <meshStandardMaterial
                  color={index === 0 ? color : '#e8e5d4'}
                  side={THREE.DoubleSide}
                  roughness={0.7}
                />
              </mesh>
              {/* Flâmula no topo do mastro principal */}
              {isMainMast && (
                <mesh
                  ref={flagRef}
                  position={[-0.14, 1.95 + index * 0.08, 0]}
                  rotation={[0, 0, 0]}
                >
                  <coneGeometry args={[0.08, 0.32, 3]} />
                  <meshStandardMaterial color={color} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          )
        })}

        {/* Espuma de corte de proa (Bow splash) */}
        <mesh position={[0.72 + masts * 0.08, 0.04, 0.24]} rotation={[-Math.PI / 2, 0.2, 0.4]}>
          <planeGeometry args={[0.65, 0.22]} />
          <meshBasicMaterial ref={bowSplashLeft} color="#dcf8ff" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0.72 + masts * 0.08, 0.04, -0.24]} rotation={[-Math.PI / 2, -0.2, -0.4]}>
          <planeGeometry args={[0.65, 0.22]} />
          <meshBasicMaterial ref={bowSplashRight} color="#dcf8ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* Rastro imediato na popa */}
      <mesh position={[-1.35, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 0.72]} />
        <meshBasicMaterial ref={wake} color="#b9efff" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  )
}
