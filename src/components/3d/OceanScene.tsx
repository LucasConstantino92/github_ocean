import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { RepositoryIsland, ShipProfile, WorldChunk } from '../../types/ocean'
import { OceanSurface } from './OceanSurface'
import { WorldPort } from './WorldPort'
import { HomeIsland } from './Island'
import { Ship } from './Ship'
import { PlayerNavigator } from './PlayerNavigator'
import { SkyStars, CameraTravel } from './SkyStars'

export function OceanScene({
  profile,
  worldProfiles,
  canSail,
  returnHome,
  onDeveloperClick,
  onRepositoryClick,
  onChunkChange,
  onPositionChange,
}: {
  profile: ShipProfile | null
  worldProfiles: ShipProfile[]
  canSail: boolean
  returnHome: number
  onDeveloperClick: (developer: ShipProfile) => void
  onRepositoryClick: (repository: RepositoryIsland) => void
  onChunkChange: (chunk: WorldChunk) => void
  onPositionChange: (position: [number, number, number]) => void
}) {
  const controls = useRef<OrbitControlsImpl>(null)

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 18, 28], fov: 45 }}
    >
      <color attach="background" args={['#071c35']} />
      <fog attach="fog" args={['#071c35', 30, 250]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[-8, 12, 4]} intensity={2.4} castShadow />
      <OceanSurface />
      {worldProfiles
        .filter((developer) => developer.user.login.toLowerCase() !== profile?.user.login.toLowerCase())
        .map((developer) => (
          <WorldPort
            key={developer.user.login}
            developer={developer}
            onDeveloperClick={onDeveloperClick}
            onRepositoryClick={onRepositoryClick}
          />
        ))}
      {profile && (
        <>
          <HomeIsland profile={profile} onRepositoryClick={onRepositoryClick} />
          {canSail ? (
            <PlayerNavigator
              profile={profile}
              returnHome={returnHome}
              onChunkChange={onChunkChange}
              onPositionChange={onPositionChange}
            />
          ) : (
            <Ship profile={profile} />
          )}
        </>
      )}
      {!canSail && <CameraTravel destination={profile?.position ?? null} controls={controls} />}
      <SkyStars />
      {!canSail && (
        <OrbitControls
          ref={controls}
          makeDefault
          target={profile?.position ?? [0, 1.5, 0]}
          minDistance={5}
          maxDistance={120}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.25}
        />
      )}
    </Canvas>
  )
}
