import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerTransform } from '../../types/ocean'

export function PlayerCamera({
  transformRef,
  recenterRef,
  initialDistance = 13,
  minDistance = 7,
  maxDistance = 34,
  targetHeight = 1.15,
  onOrbitHeading,
}: {
  transformRef: React.MutableRefObject<PlayerTransform>
  recenterRef: React.MutableRefObject<boolean>
  initialDistance?: number
  minDistance?: number
  maxDistance?: number
  targetHeight?: number
  onOrbitHeading?: (heading: number | null) => void
}) {
  const { camera, gl } = useThree()
  const initialized = useRef(false)
  const dragging = useRef(false)
  const yawOffset = useRef(0)
  const manualOrbitYaw = useRef<number | null>(null)
  const pitch = useRef(0.42)
  const cameraDistance = useRef(initialDistance)
  const desiredPosition = useRef(new THREE.Vector3())
  const target = useRef(new THREE.Vector3())

  useEffect(() => {
    const element = gl.domElement
    const onPointerDown = (event: MouseEvent) => {
      if (event.button !== 2) return
      event.preventDefault()
      dragging.current = true
      const [x, y, z] = transformRef.current.position
      target.current.set(x, y + targetHeight, z)
      const offset = camera.position.clone().sub(target.current)
      const distance = Math.max(offset.length(), 0.01)
      cameraDistance.current = THREE.MathUtils.clamp(distance, minDistance, maxDistance)
      // While dragging, keep an absolute world angle. Deriving this from the
      // vessel each frame feeds its own rotation back into the target heading,
      // which is what previously made a held right-click spin forever.
      manualOrbitYaw.current = Math.atan2(offset.x, offset.z)
      pitch.current = Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1))
    }
    const onPointerMove = (event: MouseEvent) => {
      if (!dragging.current) return
      if (manualOrbitYaw.current !== null) manualOrbitYaw.current -= event.movementX * 0.006
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.005, 0.08, 1.08)
    }
    const onPointerUp = () => {
      const manualYaw = manualOrbitYaw.current
      if (manualYaw !== null) {
        const baseYaw = transformRef.current.rotation - Math.PI / 2
        yawOffset.current = Math.atan2(Math.sin(manualYaw - baseYaw), Math.cos(manualYaw - baseYaw))
      }
      manualOrbitYaw.current = null
      dragging.current = false
      onOrbitHeading?.(null)
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cameraDistance.current = THREE.MathUtils.clamp(cameraDistance.current + event.deltaY * 0.018, minDistance, maxDistance)
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
  }, [camera, gl, maxDistance, minDistance, onOrbitHeading, targetHeight, transformRef])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const transform = transformRef.current
    const [x, y, z] = transform.position
    const distance = cameraDistance.current
    target.current.set(x, y + targetHeight, z)

    if (recenterRef.current) {
      yawOffset.current = 0
      manualOrbitYaw.current = null
      recenterRef.current = false
    }
    // When the right mouse button is released, the orbit gently returns behind
    // the vessel. While held, the manual angle is retained without fighting it.
    if (!dragging.current) {
      yawOffset.current = THREE.MathUtils.damp(yawOffset.current, 0, 2.4, dt)
      pitch.current = THREE.MathUtils.damp(pitch.current, 0.42, 2.4, dt)
    }
    const orbitYaw = manualOrbitYaw.current ?? (transform.rotation - Math.PI / 2 + yawOffset.current)
    if (dragging.current) onOrbitHeading?.(orbitYaw + Math.PI / 2)
    const orbitPitch = pitch.current
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
      const smooth = 1 - Math.exp(-(dragging.current ? 8.5 : 5.5) * dt)
      camera.position.lerp(desiredPosition.current, smooth)
    }
    camera.up.set(0, 1, 0)
    camera.lookAt(target.current)
    camera.updateMatrixWorld()
  })

  return null
}
