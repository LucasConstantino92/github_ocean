import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export function SkyStars() {
  const sky = useRef<THREE.Group>(null)
  const { camera } = useThree()
  useFrame(() => {
    sky.current?.position.copy(camera.position)
  })
  return (
    <group ref={sky}>
      <Stars radius={68} depth={32} count={1800} factor={3} saturation={0} fade speed={0.3} />
    </group>
  )
}

export function CameraTravel({
  destination,
  controls,
}: {
  destination: [number, number, number] | null
  controls: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const travel = useRef<{
    elapsed: number
    fromPosition: THREE.Vector3
    fromTarget: THREE.Vector3
    toPosition: THREE.Vector3
    toTarget: THREE.Vector3
  } | null>(null)

  useEffect(() => {
    if (!destination) return
    const [x, y, z] = destination
    const control = controls.current
    travel.current = {
      elapsed: 0,
      fromPosition: camera.position.clone(),
      fromTarget: control?.target.clone() ?? new THREE.Vector3(x, y, z),
      toPosition: new THREE.Vector3(x + 8.5, y + 8, z + 11.5),
      toTarget: new THREE.Vector3(x, y + 0.75, z),
    }
  }, [camera, controls, destination])

  useFrame((_, delta) => {
    const current = travel.current
    if (!current) return
    current.elapsed = Math.min(current.elapsed + delta, 1.25)
    const progress = current.elapsed / 1.25
    const eased = 1 - Math.pow(1 - progress, 3)
    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased)
    controls.current?.target.lerpVectors(current.fromTarget, current.toTarget, eased)
    controls.current?.update()
    if (progress >= 1) {
      travel.current = null
    }
  })
  return null
}
