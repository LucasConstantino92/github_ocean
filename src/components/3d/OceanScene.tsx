import { memo, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { Building, RepositoryIsland, ShipProfile, WorldChunk } from '../../types/ocean'
import { OceanSurface } from './OceanSurface'
import { PortLayer } from './PortLayer'
import { HomeIsland } from './Island'
import { Ship } from './Ship'
import { PlayerNavigator } from './PlayerNavigator'
import { CaptainNavigator } from './CaptainNavigator'
import { SkyStars, CameraTravel } from './SkyStars'
import { WeatherSystem } from './WeatherSystem'
import { PerformanceHud } from './PerformanceHud'
import { localWeather, type LocalWeather } from '../../utils/weather'

export type CameraView = {
  position: [number, number, number]
  direction: [number, number, number]
}

function useLocalWeather() {
  const [weather, setWeather] = useState(() => localWeather())
  useEffect(() => {
    const refresh = () => setWeather((current) => {
      const next = localWeather()
      return next.phase === current.phase && next.slot === current.slot ? current : next
    })
    const interval = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(interval)
  }, [])
  return weather as LocalWeather
}

function CameraViewReporter({ onViewChange }: { onViewChange: (view: CameraView) => void }) {
  const lastReport = useRef(0)
  const direction = useRef(new THREE.Vector3())

  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - lastReport.current < .16) return
    lastReport.current = clock.elapsedTime
    camera.getWorldDirection(direction.current)
    direction.current.y = 0
    if (direction.current.lengthSq() < .001) return
    direction.current.normalize()
    onViewChange({
      position: [camera.position.x, camera.position.y, camera.position.z],
      direction: [direction.current.x, 0, direction.current.z],
    })
  })
  return null
}

export const OceanScene = memo(function OceanScene({
  profile,
  worldProfiles,
  focusProfile,
  canSail,
  returnHome,
  playerMode,
  onDeveloperClick,
  onRepositoryClick,
  onBuildingClick,
  onChunkChange,
  onPositionChange,
  onViewChange,
  onDiscoverPort,
  onHeadingChange,
  onDisembark,
  onBoard,
  discoveredPorts,
}: {
  profile: ShipProfile | null
  worldProfiles: ShipProfile[]
  focusProfile: ShipProfile | null
  canSail: boolean
  returnHome: number
  playerMode: 'sail' | 'shore'
  onDeveloperClick: (developer: ShipProfile) => void
  onRepositoryClick: (repository: RepositoryIsland) => void
  onBuildingClick: (building: Building) => void
  onChunkChange: (chunk: WorldChunk) => void
  onPositionChange: (position: [number, number, number]) => void
  onViewChange: (view: CameraView) => void
  onDiscoverPort: (login: string) => void
  onHeadingChange: (heading: number) => void
  onDisembark: () => void
  onBoard: () => void
  discoveredPorts: ReadonlySet<string>
}) {
  const controls = useRef<OrbitControlsImpl>(null)
  const weather = useLocalWeather()
  const showPerformance = new URLSearchParams(window.location.search).has('perf')

  return (
    <Canvas
      shadows="basic"
      dpr={[1, 1.15]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 18, 28], fov: 45, near: .1, far: 210 }}
    >
      <WeatherSystem weather={weather} />
      <OceanSurface />
      <PortLayer
        developers={worldProfiles.filter((developer) => developer.user.login.toLowerCase() !== profile?.user.login.toLowerCase())}
        onDeveloperClick={onDeveloperClick}
        onRepositoryClick={onRepositoryClick}
        onBuildingClick={onBuildingClick}
        discoveredPorts={discoveredPorts}
      />
      {profile && (
        <>
          <HomeIsland profile={profile} onRepositoryClick={onRepositoryClick} onBuildingClick={onBuildingClick} isNight={weather.phase === 'night'} />
          {canSail && playerMode === 'sail' ? (
            <PlayerNavigator
              profile={profile}
              collisionProfiles={worldProfiles}
              returnHome={returnHome}
              onChunkChange={onChunkChange}
              onPositionChange={onPositionChange}
              onDiscoverPort={(login) => onDiscoverPort(login)}
              onHeadingChange={onHeadingChange}
              onDisembark={onDisembark}
            />
          ) : canSail ? (
            <>
              <Ship profile={profile} />
              <CaptainNavigator profile={profile} onPositionChange={onPositionChange} onHeadingChange={onHeadingChange} onBoard={onBoard} />
            </>
          ) : (
            <Ship profile={profile} />
          )}
        </>
      )}
      {!canSail && <CameraTravel destination={focusProfile?.homePosition ?? profile?.homePosition ?? null} controls={controls} />}
      <SkyStars visible={weather.phase === 'night'} />
      <CameraViewReporter onViewChange={onViewChange} />
      {showPerformance && <PerformanceHud loadedPorts={worldProfiles.length} />}
      {!canSail && (
        <OrbitControls
          ref={controls}
          makeDefault
          target={focusProfile?.homePosition ?? profile?.homePosition ?? [0, 1.5, 0]}
          minDistance={5}
          maxDistance={120}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.25}
        />
      )}
    </Canvas>
  )
})
