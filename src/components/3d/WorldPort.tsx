import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Building, RepositoryIsland, ShipProfile } from '../../types/ocean'
import { HomeIsland } from './Island'
import { Ship } from './Ship'

export function WorldPort({
  developer,
  onDeveloperClick,
  onRepositoryClick,
  onBuildingClick,
}: {
  developer: ShipProfile
  onDeveloperClick: (developer: ShipProfile) => void
  onRepositoryClick: (repository: RepositoryIsland) => void
  onBuildingClick: (building: Building) => void
}) {
  const detailedRef = useRef(true)
  const [detailed, setDetailed] = useState(true)
  const world = useRef(new THREE.Vector3(...developer.homePosition))

  useFrame(({ camera }) => {
    world.current.set(...developer.homePosition)
    const limit = detailedRef.current ? 36 : 30
    const next = camera.position.distanceToSquared(world.current) < limit * limit
    if (next === detailedRef.current) return
    detailedRef.current = next
    setDetailed(next)
  })

  if (detailed) {
    return (
      <group>
        <HomeIsland
          profile={developer}
          onClick={() => onDeveloperClick(developer)}
          onRepositoryClick={onRepositoryClick}
          onBuildingClick={onBuildingClick}
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
      <mesh position={[0, .25, 0]}>
        <boxGeometry args={[developer.island.columns * developer.island.spacing, .7, developer.island.rows * developer.island.spacing]} />
        <meshStandardMaterial color="#557a53" roughness={1} />
      </mesh>
      <mesh position={[developer.position[0] - developer.homePosition[0], .2, developer.position[2] - developer.homePosition[2]]} scale={developer.progression.ship.size}>
        <boxGeometry args={[developer.progression.ship.hullLength, .35, developer.progression.ship.hullWidth]} />
        <meshStandardMaterial color={developer.progression.ship.wood} />
      </mesh>
    </group>
  )
}
