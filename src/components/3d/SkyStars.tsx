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
  useEffect(() => {
    if (!destination) return
    const [x, y, z] = destination
    camera.position.set(x + 7, y + 7, z + 10)
    controls.current?.target.set(x, y + 0.75, z)
    controls.current?.update()
  }, [camera, controls, destination])
  return null
}
