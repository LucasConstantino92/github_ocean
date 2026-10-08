import { memo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ShipProfile } from '../../types/ocean'
import { hash, getOceanWaveHeight, playerSailingMetrics, shipWaterlineOffset } from '../../utils/oceanMath'

export const Ship = memo(function Ship({
  profile,
  onClick,
  shipRef,
  position,
  rotation,
  isPlayerControlled = false,
  animate = true,
}: {
  profile: ShipProfile
  onClick?: () => void
  shipRef?: React.RefObject<THREE.Group | null>
  position?: [number, number, number]
  rotation?: number
  isPlayerControlled?: boolean
  animate?: boolean
}) {
  const color = profile.languages[0]?.color ?? '#d5a34c'
  const { size, masts, sails, crew, hullLength, hullWidth, cabinLevel, trimLevel, cargo, wood, sailPattern } = profile.progression.ship
  const bob = useRef<THREE.Group>(null)
  const sailsRef = useRef<(THREE.Mesh | null)[]>([])
  const flagRef = useRef<THREE.Mesh>(null)
  const bowSplashLeft = useRef<THREE.MeshBasicMaterial>(null)
  const bowSplashRight = useRef<THREE.MeshBasicMaterial>(null)
  const wake = useRef<THREE.MeshBasicMaterial>(null)
  const phase = (hash(profile.user.login) % 100) / 17
  // Do not hand transform ownership back to React for the local vessel. It is
  // moved by PlayerNavigator's frame loop, so a parent reconciliation must not
  // even receive `undefined` position/rotation props to reconcile.
  const staticTransform = isPlayerControlled
    ? {}
    : { position: position ?? profile.position, rotation: [0, rotation ?? -0.35, 0] as [number, number, number] }

  useFrame(({ clock }) => {
    if (!animate) return
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
      bob.current.position.y = (waveH + shipWaterlineOffset) / size
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
        ? Math.min(absSpeed / 3.0, .16)
        : 0.12 + (Math.sin(animationTime * 2.1) + 1) * 0.05
    }
  })

  return (
    <group
      ref={shipRef}
      // The player navigator owns this transform imperatively every frame.
      // Keeping it uncontrolled prevents a React update (minimap, UI, etc.)
      // from snapping the ship back to its spawn position for one frame.
      {...staticTransform}
      scale={size}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      <group ref={bob}>
        {/* Casco */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[hullLength, .35 + cabinLevel * .025, hullWidth]} />
          <meshStandardMaterial color={wood} roughness={0.82} />
        </mesh>
        {/* Bico de proa */}
        <mesh position={[hullLength / 2, .22, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[hullWidth * .56, .7, 4]} />
          <meshStandardMaterial color="#5c301c" />
        </mesh>
        <mesh position={[0, .4, 0]}><boxGeometry args={[hullLength * .96, .06, hullWidth * .92]} /><meshStandardMaterial color="#bb9564" /></mesh>
        {[-1, 1].map((side) => <group key={side}>
          <mesh position={[0, .5, side * hullWidth / 2]}><boxGeometry args={[hullLength, .09, .045]} /><meshStandardMaterial color={trimLevel ? '#d4aa58' : wood} /></mesh>
          {Array.from({ length: trimLevel + 1 }, (_, i) => <mesh key={i} position={[-hullLength * .32 + i * .28, .22, side * (hullWidth / 2 + .012)]}>
            <boxGeometry args={[.12, .12, .03]} /><meshStandardMaterial color={trimLevel >= 2 ? '#ebc66e' : '#243746'} />
          </mesh>)}
        </group>)}
        {cabinLevel > 0 && <group position={[-hullLength * .36, .43, 0]}>
          <mesh position={[0, .12 + cabinLevel * .055, 0]} castShadow><boxGeometry args={[.42, .24 + cabinLevel * .11, hullWidth * .72]} /><meshStandardMaterial color={wood} /></mesh>
          <mesh position={[0, .27 + cabinLevel * .11, 0]}><boxGeometry args={[.5, .06, hullWidth * .82]} /><meshStandardMaterial color={color} /></mesh>
          {cabinLevel >= 2 && <mesh position={[.216, .23, 0]}><boxGeometry args={[.015, .12, .2]} /><meshStandardMaterial color="#f9d78a" /></mesh>}
        </group>}
        {Array.from({ length: cargo }, (_, i) => <mesh key={i} position={[hullLength * .3 - i * .23, .53, -hullWidth * .22]} castShadow>
          <boxGeometry args={[.18, .2, .18]} /><meshStandardMaterial color="#ac7f3c" />
        </mesh>)}
        {Array.from({ length: crew }, (_, i) => {
          const side = i % 2 ? 1 : -1
          const row = Math.floor(i / 2)
          const x = -.15 * hullLength + row * hullLength * .17
          const uniform = profile.languages[i % Math.max(profile.languages.length, 1)]?.color ?? color
          return <group key={i} position={[x, .44, side * hullWidth * .3]} scale={1 / size}>
            <mesh position={[0, .12, 0]} castShadow><cylinderGeometry args={[.065, .08, .22, 5]} /><meshStandardMaterial color={uniform} /></mesh>
            <mesh position={[0, .28, 0]}><sphereGeometry args={[.075, 6, 5]} /><meshStandardMaterial color={i % 2 ? '#c79267' : '#e8b58c'} /></mesh>
            {i === 0 && <mesh position={[0, .35, 0]}><boxGeometry args={[.19, .06, .15]} /><meshStandardMaterial color="#243445" /></mesh>}
          </group>
        })}

        {/* Mastros e Velas */}
        {Array.from({ length: masts }, (_, index) => {
          const mastX = (index - (masts - 1) / 2) * (hullLength * .65 / Math.max(masts - 1, 1))
          const mastH = 1.9 + index * 0.14
          const isMainMast = index === masts - 1
          return (
            <group key={index} position={[mastX, 0, 0]}>
              {/* Mastro vertical */}
              <mesh position={[0, 1.15 + index * 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.055, mastH]} />
                <meshStandardMaterial color="#31190e" />
              </mesh>
              {index < sails - masts && <mesh
                ref={(el) => { sailsRef.current[masts + index] = el }}
                position={[.18, 1.94 + index * .08, 0]}
                castShadow>
                <planeGeometry args={[.4 + index * .035, .42]} />
                <meshStandardMaterial color={profile.languages[(index + 1) % Math.max(profile.languages.length, 1)]?.color ?? '#eee3c9'} side={THREE.DoubleSide} />
              </mesh>}
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
                <mesh position={[0, 0, .008]}>
                  <planeGeometry args={sailPattern === 0 ? [.1, .68] : sailPattern === 1 ? [.4, .08] : [.19, .19]} />
                  <meshStandardMaterial color={trimLevel >= 2 ? '#f4ce78' : '#ac8651'} side={THREE.DoubleSide} />
                </mesh>
              </mesh>
              {/* Flâmula no topo do mastro principal */}
              {isMainMast && (
                <mesh
                  ref={flagRef}
                  position={[-0.14, 2.25 + index * 0.08, 0]}
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
        <mesh position={[hullLength / 2, 0.04, hullWidth / 2]} rotation={[-Math.PI / 2, 0.2, 0.4]}>
          <planeGeometry args={[0.65, 0.22]} />
          <meshBasicMaterial ref={bowSplashLeft} color="#dcf8ff" transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[hullLength / 2, 0.04, -hullWidth / 2]} rotation={[-Math.PI / 2, -0.2, -0.4]}>
          <planeGeometry args={[0.65, 0.22]} />
          <meshBasicMaterial ref={bowSplashRight} color="#dcf8ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* Rastro imediato na popa */}
      <mesh position={[-hullLength / 2 - .8, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 0.72]} />
        <meshBasicMaterial ref={wake} color="#b9efff" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  )
})
