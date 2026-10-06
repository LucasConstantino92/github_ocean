import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RepositoryIsland, ShipProfile } from '../../types/ocean'
import { HomeIsland } from './Island'
import { Ship } from './Ship'

export function WorldPort({
  developer,
  onDeveloperClick,
  onRepositoryClick,
}: {
  developer: ShipProfile
  onDeveloperClick: (developer: ShipProfile) => void
  onRepositoryClick: (repository: RepositoryIsland) => void
}) {
  const detailedRef = useRef(true)
  const [detailed, setDetailed] = useState(true)
  const world = useRef(new THREE.Vector3(...developer.homePosition))

  useFrame(({ camera }) => {
    const next = camera.position.distanceToSquared(world.current) < 58 * 58
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
      <mesh scale={[developer.island.size, 0.45, developer.island.size]}>
        <cylinderGeometry args={[2.1, 2.55, 0.75, 7]} />
        <meshStandardMaterial color="#557a53" roughness={1} />
      </mesh>
      <mesh position={[2.6, 0.16, 0]} scale={0.65}>
        <boxGeometry args={[1.5, 0.35, 0.62]} />
        <meshStandardMaterial color="#4a2617" />
      </mesh>
    </group>
  )
}
