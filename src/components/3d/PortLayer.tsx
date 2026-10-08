import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Building, RepositoryIsland, ShipProfile } from '../../types/ocean'
import { WorldPort } from './WorldPort'

type RenderMode = 'hidden' | 'proxy' | 'detailed'
type Tracking = { mode: RenderMode; lastSeen: number }

// A single, stateful LOD manager avoids one frame-loop and one React state
// machine per island. The grace period and wider exit distance make a port
// stable at the edge of the view while the camera turns.
export function PortLayer({
  developers, onDeveloperClick, onRepositoryClick, onBuildingClick, discoveredPorts,
}: {
  developers: ShipProfile[]
  onDeveloperClick: (developer: ShipProfile) => void
  onRepositoryClick: (repository: RepositoryIsland) => void
  onBuildingClick: (building: Building) => void
  discoveredPorts: ReadonlySet<string>
}) {
  const [modes, setModes] = useState<Map<string, RenderMode>>(() => new Map())
  const tracking = useRef(new Map<string, Tracking>())
  const lastCheck = useRef(0)
  const frustum = useRef(new THREE.Frustum())
  const projection = useRef(new THREE.Matrix4())
  const sphere = useRef(new THREE.Sphere())
  const direction = useRef(new THREE.Vector3())
  const offset = useRef(new THREE.Vector3())

  useFrame(({ camera, clock }) => {
    if (clock.elapsedTime - lastCheck.current < .1) return
    lastCheck.current = clock.elapsedTime
    projection.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    frustum.current.setFromProjectionMatrix(projection.current)
    camera.getWorldDirection(direction.current)
    let changed = false
    const next = new Map<string, RenderMode>()

    for (const developer of developers) {
      const login = developer.user.login.toLowerCase()
      const state = tracking.current.get(login) ?? { mode: 'hidden' as RenderMode, lastSeen: -Infinity }
      sphere.current.center.set(...developer.homePosition)
      sphere.current.radius = developer.progression.island.radius + 4
      const distance = camera.position.distanceTo(sphere.current.center)
      const onScreen = distance < 178 && frustum.current.intersectsSphere(sphere.current)
      offset.current.copy(sphere.current.center).sub(camera.position).normalize()
      // Pre-warm what is just ahead of the current view, but never keep the
      // rear hemisphere detailed. It prevents a visible island from popping in.
      const ahead = distance < 202 && offset.current.dot(direction.current) > .08
      if (onScreen) state.lastSeen = clock.elapsedTime
      const keepVisible = clock.elapsedTime - state.lastSeen < .9
      const mode: RenderMode = onScreen
        ? distance < 64 ? 'detailed' : 'proxy'
        : keepVisible ? state.mode
          : ahead ? 'proxy' : 'hidden'
      if (mode !== state.mode) changed = true
      state.mode = mode
      tracking.current.set(login, state)
      if (mode !== 'hidden') next.set(login, mode)
    }
    if (changed || next.size !== modes.size) setModes(next)
  })

  return <>
    {developers.map((developer) => {
      const mode = modes.get(developer.user.login.toLowerCase())
      return mode && mode !== 'hidden' && <WorldPort
        key={developer.user.login}
        developer={developer}
        renderMode={mode}
        onDeveloperClick={onDeveloperClick}
        onRepositoryClick={onRepositoryClick}
        onBuildingClick={onBuildingClick}
        discovered={discoveredPorts.has(developer.user.login.toLowerCase())}
      />
    })}
  </>
}
