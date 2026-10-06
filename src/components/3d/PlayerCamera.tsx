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
  const pitch = useRef(0)
  const chaseDistance = useRef(10.5)
  const lookTarget = useRef(new THREE.Vector3())

  useEffect(() => {
    const element = gl.domElement
    const onPointerDown = (event: MouseEvent) => {
      if (event.button !== 2) return
      event.preventDefault()
      dragging.current = true
      freeCamera.current = true
      const direction = new THREE.Vector3()
      camera.getWorldDirection(direction)
      yaw.current = Math.atan2(direction.x, -direction.z)
      pitch.current = Math.asin(THREE.MathUtils.clamp(direction.y, -0.95, 0.95))
    }
    const onPointerMove = (event: MouseEvent) => {
      if (!dragging.current) return
      yaw.current -= event.movementX * 0.006
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.005, -1.05, 0.58)
    }
    const onPointerUp = () => {
      dragging.current = false
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      chaseDistance.current = THREE.MathUtils.clamp(chaseDistance.current + event.deltaY * 0.018, 7, 34)
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
  }, [camera, gl])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const transform = transformRef.current
    const forwardX = Math.cos(transform.rotation)
    const forwardZ = -Math.sin(transform.rotation)
    const [x, y, z] = transform.position
    const distance = chaseDistance.current
    const desiredPosition = new THREE.Vector3(
      x - forwardX * distance,
      Math.max(y + 5.1 + distance * 0.2, 5.8),
      z - forwardZ * distance
    )
    const desiredTarget = new THREE.Vector3(x + forwardX * 3.5, y + 1.2, z + forwardZ * 3.5)

    if (!initialized.current) {
      camera.position.copy(desiredPosition)
      lookTarget.current.copy(desiredTarget)
      initialized.current = true
    }
    if (recenterRef.current) {
      freeCamera.current = false
      recenterRef.current = false
    }
    if (freeCamera.current) {
      const direction = new THREE.Vector3(
        Math.sin(yaw.current) * Math.cos(pitch.current),
        Math.sin(pitch.current),
        -Math.cos(yaw.current) * Math.cos(pitch.current)
      )
      lookTarget.current.copy(camera.position).addScaledVector(direction, 14)
    } else {
      const smooth = 1 - Math.exp(-5.5 * dt)
      camera.position.lerp(desiredPosition, smooth)
      lookTarget.current.lerp(desiredTarget, smooth)
    }
    camera.up.set(0, 1, 0)
    camera.lookAt(lookTarget.current)
    camera.updateMatrixWorld()
  })

  return null
}
