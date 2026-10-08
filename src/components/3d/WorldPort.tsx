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
  discovered,
  renderMode,
}: {
  developer: ShipProfile
  onDeveloperClick: (developer: ShipProfile) => void
  onRepositoryClick: (repository: RepositoryIsland) => void
  onBuildingClick: (building: Building) => void
  discovered: boolean
  renderMode: 'proxy' | 'detailed'
}) {
  if (!discovered) return <FogBank position={developer.homePosition} />

  if (renderMode === 'detailed') {
    return (
      <group>
        <HomeIsland
          profile={developer}
          onClick={() => onDeveloperClick(developer)}
          onRepositoryClick={onRepositoryClick}
          onBuildingClick={onBuildingClick}
          isNight={false}
          ambient={false}
          shadows={false}
        />
        <Ship profile={developer} onClick={() => onDeveloperClick(developer)} animate={false} />
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
