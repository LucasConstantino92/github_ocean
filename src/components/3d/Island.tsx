import type { RepositoryIsland, ShipProfile } from '../../types/ocean'
import { hash } from '../../utils/oceanMath'

export function Settlement() {
  return (
    <group position={[-0.95, 0.72, -0.95]}>
      <mesh castShadow>
        <boxGeometry args={[0.48, 0.38, 0.48]} />
        <meshStandardMaterial color="#b9854d" />
      </mesh>
      <mesh position={[0, 0.45, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.42, 0.38, 4]} />
        <meshStandardMaterial color="#d26c49" />
      </mesh>
    </group>
  )
}

export function Market() {
  return (
    <group position={[-1.1, 0.72, 0.85]}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.34, 0.43]} />
        <meshStandardMaterial color="#c99655" />
      </mesh>
      <mesh position={[0, 0.48, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.48, 0.32, 4]} />
        <meshStandardMaterial color="#e0a95b" />
      </mesh>
    </group>
  )
}

export function Fort() {
  return (
    <group position={[0.05, 0.84, -1.2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.36, 0.75, 6]} />
        <meshStandardMaterial color="#77838b" />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <coneGeometry args={[0.38, 0.36, 6]} />
        <meshStandardMaterial color="#596675" />
      </mesh>
    </group>
  )
}

export function RepoBuilding({
  repository,
  index,
  onClick,
}: {
  repository: RepositoryIsland
  index: number
  onClick: () => void
}) {
  const positions: [number, number, number][] = [
    [0.3, 0.6, -0.25],
    [1.1, 0.64, 0.55],
    [0.95, 0.95, -0.95],
    [-0.25, 0.64, 0.85],
  ]
  const position = positions[index]
  const fortress = index === 3
  return (
    <group position={position} onClick={(event) => { event.stopPropagation(); onClick() }}>
      <mesh castShadow>
        <boxGeometry args={fortress ? [0.75, 1.15, 0.7] : [0.7, 0.58, 0.62]} />
        <meshStandardMaterial color={fortress ? '#8c8b83' : '#cf9b5a'} />
      </mesh>
      <mesh position={[0, fortress ? 0.82 : 0.45, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[fortress ? 0.52 : 0.6, fortress ? 0.55 : 0.5, 4]} />
        <meshStandardMaterial color={repository.color} />
      </mesh>
    </group>
  )
}

export function HomeIsland({
  profile,
  onClick,
  onRepositoryClick,
}: {
  profile: ShipProfile
  onClick?: () => void
  onRepositoryClick?: (repository: RepositoryIsland) => void
}) {
  const { size, level } = profile.island
  const seed = hash(profile.user.login)
  const sides = 7 + (seed % 6)
  const rotation = (seed % 628) / 100
  const stretchX = 0.78 + ((seed >>> 4) % 58) / 100
  const stretchZ = 0.78 + ((seed >>> 10) % 58) / 100
  const hasSandbar = seed % 3 !== 0
  const hasCove = seed % 4 === 0

  return (
    <group
      position={profile.homePosition}
      scale={size}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      <group rotation={[0, rotation, 0]} scale={[stretchX, 1, stretchZ]}>
        <mesh receiveShadow castShadow>
          <cylinderGeometry args={[2.4, 2.75, 0.6, sides]} />
          <meshStandardMaterial color="#765a2d" />
        </mesh>
        <mesh position={[0, 0.4, 0]} receiveShadow>
          <cylinderGeometry args={[2.14, 2.36, 0.28, sides]} />
          <meshStandardMaterial color="#6daf66" />
        </mesh>
        {hasSandbar && (
          <>
            <mesh position={[2.05, 0.08, 0.12]} scale={[0.8, 0.48, 0.55]} receiveShadow>
              <cylinderGeometry args={[1.1, 1.25, 0.18, 7]} />
              <meshStandardMaterial color="#d7bc77" />
            </mesh>
            <mesh position={[1.85, 0.24, 0.1]} scale={[0.7, 0.35, 0.43]} receiveShadow>
              <cylinderGeometry args={[1.04, 1.14, 0.16, 7]} />
              <meshStandardMaterial color="#73a96b" />
            </mesh>
          </>
        )}
        {hasCove && (
          <mesh position={[-1.63, 0.52, 0.18]} scale={[0.42, 0.18, 0.5]}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#0a4b78" />
          </mesh>
        )}
      </group>
      <mesh position={[-0.72, 1.15, -0.4]} castShadow>
        <coneGeometry args={[0.38, 1.5, 6]} />
        <meshStandardMaterial color="#175a36" />
      </mesh>
      <mesh position={[-1.2, 0.9, 0.45]} castShadow>
        <coneGeometry args={[0.28, 1.1, 6]} />
        <meshStandardMaterial color="#207445" />
      </mesh>
      <mesh position={[-0.1, 0.76, 1.15]} castShadow>
        <coneGeometry args={[0.25, 0.95, 6]} />
        <meshStandardMaterial color="#1b663d" />
      </mesh>
      {level >= 2 && <Settlement />}
      {level >= 3 && <Market />}
      {level >= 4 && <Fort />}
      {profile.repositories.slice(0, Math.min(4, level)).map((repository, index) => (
        <RepoBuilding
          key={repository.html_url}
          repository={repository}
          index={index}
          onClick={() => onRepositoryClick?.(repository)}
        />
      ))}
    </group>
  )
}
