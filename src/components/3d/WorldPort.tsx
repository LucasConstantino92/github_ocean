import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Building, RepositoryIsland, ShipProfile } from '../../types/ocean'
import { HomeIsland } from './Island'
import { Ship } from './Ship'

function FogBank({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    <mesh position={[0, 1.1, 0]} scale={[5.2, 1.2, 3.8]}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial color="#b4ced7" transparent opacity={.2} depthWrite={false} />
    </mesh>
    <mesh position={[1.5, .75, -.7]} scale={[3.2, .75, 2.3]}>
      <sphereGeometry args={[1, 10, 7]} />
      <meshBasicMaterial color="#d3e2e6" transparent opacity={.16} depthWrite={false} />
    </mesh>
    <mesh position={[-1.8, .66, .85]} scale={[2.9, .66, 2.1]}>
      <sphereGeometry args={[1, 10, 7]} />
      <meshBasicMaterial color="#a9c7d1" transparent opacity={.14} depthWrite={false} />
    </mesh>
  </group>
}

export function WorldPort({
  developer,
  onDeveloperClick,
  onRepositoryClick,
  onBuildingClick,
  isNight,
  discovered,
}: {
  developer: ShipProfile
  onDeveloperClick: (developer: ShipProfile) => void
  onRepositoryClick: (repository: RepositoryIsland) => void
  onBuildingClick: (building: Building) => void
  isNight: boolean
  discovered: boolean
}) {
  const visibility = useRef({ visible: false, detailed: false, lastCheck: 0 })
  const [renderMode, setRenderMode] = useState<'hidden' | 'proxy' | 'detailed'>('hidden')
  const world = useRef(new THREE.Vector3(...developer.homePosition))
  const bounds = useRef(new THREE.Sphere())
  const frustum = useRef(new THREE.Frustum())
  const projection = useRef(new THREE.Matrix4())

  useFrame(({ camera, clock }) => {
    // Checking a port four times per second is enough for fluid movement and
    // avoids keeping full islands alive outside the camera's real V-shaped view.
    if (clock.elapsedTime - visibility.current.lastCheck < .12) return
    visibility.current.lastCheck = clock.elapsedTime
    world.current.set(...developer.homePosition)
    bounds.current.center.copy(world.current)
    bounds.current.radius = developer.progression.island.radius + 4
    projection.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.current.setFromProjectionMatrix(projection.current)
    const distance = camera.position.distanceTo(world.current)
    const visible = distance < 170 && frustum.current.intersectsSphere(bounds.current)
    // Full buildings and ambient life are kept close to the player; farther
    // ports retain a recognizable low-detail silhouette.
    const detailed = visible && distance < 56
    const nextMode = !visible ? 'hidden' : detailed ? 'detailed' : 'proxy'
    const currentMode = visibility.current.visible
      ? visibility.current.detailed ? 'detailed' : 'proxy'
      : 'hidden'
    if (nextMode === currentMode) return
    visibility.current.visible = visible
    visibility.current.detailed = detailed
    setRenderMode(nextMode)
  })

  if (renderMode === 'hidden') return null

  if (!discovered) return <FogBank position={developer.homePosition} />

  if (renderMode === 'detailed') {
    return (
      <group>
        <HomeIsland
          profile={developer}
          onClick={() => onDeveloperClick(developer)}
          onRepositoryClick={onRepositoryClick}
          onBuildingClick={onBuildingClick}
          isNight={isNight}
        />
        <Ship profile={developer} onClick={() => onDeveloperClick(developer)} />
      </group>
    )
  }

  return (
    <group
      position={developer.homePosition}
      onClick={(event) => {
        event.stopPropagation()
        onDeveloperClick(developer)
      }}
    >
      {developer.island.landmasses.map((land, index) => (
        <group key={index} position={[land.x, .2, land.z]} rotation={[0, land.rotation, 0]} scale={[land.stretch, 1, 1]}>
          <mesh>
            <cylinderGeometry args={[land.radius * .84, land.radius, .42, 8]} />
            <meshStandardMaterial color={index ? '#6e9562' : '#557a53'} roughness={1} />
          </mesh>
        </group>
      ))}
      <mesh position={[developer.position[0] - developer.homePosition[0], .2, developer.position[2] - developer.homePosition[2]]} scale={developer.progression.ship.size}>
        <boxGeometry args={[developer.progression.ship.hullLength, .35, developer.progression.ship.hullWidth]} />
        <meshStandardMaterial color={developer.progression.ship.wood} />
      </mesh>
    </group>
  )
}
