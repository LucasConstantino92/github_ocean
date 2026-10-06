import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerTransform } from '../../types/ocean'

export function PlayerCamera({
  transformRef,
  recenterRef,
}: {
  transformRef: React.MutableRefObject<PlayerTransform>
  recenterRef: React.MutableRefObject<boolean>
}) {
  const { camera, gl } = useThree()
  const initialized = useRef(false)
  const freeCamera = useRef(false)
  const dragging = useRef(false)
  const yaw = useRef(0)
  const pitch = useRef(0.42)
  const cameraDistance = useRef(13)
  const desiredPosition = useRef(new THREE.Vector3())
  const target = useRef(new THREE.Vector3())

  useEffect(() => {
    const element = gl.domElement
    const onPointerDown = (event: MouseEvent) => {
      if (event.button !== 2) return
      event.preventDefault()
      dragging.current = true
      freeCamera.current = true
      const [x, y, z] = transformRef.current.position
      target.current.set(x, y + 1.15, z)
      const offset = camera.position.clone().sub(target.current)
      const distance = Math.max(offset.length(), 0.01)
      cameraDistance.current = THREE.MathUtils.clamp(distance, 7, 34)
      yaw.current = Math.atan2(offset.x, offset.z)
      pitch.current = Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1))
    }
    const onPointerMove = (event: MouseEvent) => {
      if (!dragging.current) return
      yaw.current -= event.movementX * 0.006
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.005, 0.08, 1.08)
    }
    const onPointerUp = () => {
      dragging.current = false
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cameraDistance.current = THREE.MathUtils.clamp(cameraDistance.current + event.deltaY * 0.018, 7, 34)
    }
    const disableMenu = (event: MouseEvent) => event.preventDefault()

    element.addEventListener('mousedown', onPointerDown)
    element.addEventListener('contextmenu', disableMenu)
    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
    element.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      element.removeEventListener('mousedown', onPointerDown)
      element.removeEventListener('contextmenu', disableMenu)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', onPointerUp)
      element.removeEventListener('wheel', onWheel)
    }
  }, [camera, gl, transformRef])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const transform = transformRef.current
    const [x, y, z] = transform.position
    const distance = cameraDistance.current
    target.current.set(x, y + 1.15, z)

    if (recenterRef.current) {
      freeCamera.current = false
      recenterRef.current = false
    }
    const orbitYaw = freeCamera.current ? yaw.current : transform.rotation - Math.PI / 2
    const orbitPitch = freeCamera.current ? pitch.current : 0.42
    const horizontalDistance = Math.cos(orbitPitch) * distance
    desiredPosition.current.set(
      x + Math.sin(orbitYaw) * horizontalDistance,
      target.current.y + Math.sin(orbitPitch) * distance,
      z + Math.cos(orbitYaw) * horizontalDistance
    )

    if (!initialized.current) {
      camera.position.copy(desiredPosition.current)
      initialized.current = true
    } else {
      const smooth = 1 - Math.exp(-(freeCamera.current ? 8.5 : 5.5) * dt)
      camera.position.lerp(desiredPosition.current, smooth)
    }
    camera.up.set(0, 1, 0)
    camera.lookAt(target.current)
    camera.updateMatrixWorld()
  })

  return null
}
