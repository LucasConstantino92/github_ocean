import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerTransform, ShipProfile } from '../../types/ocean'
import { PlayerCamera } from './PlayerCamera'

function Captain({ color, captainRef }: { color: string; captainRef: React.RefObject<THREE.Group | null> }) {
  return <group ref={captainRef} scale={.55}>
    <mesh position={[0, .18, 0]} castShadow><cylinderGeometry args={[.095, .12, .36, 6]} /><meshStandardMaterial color={color} /></mesh>
    <mesh position={[0, .43, 0]} castShadow><sphereGeometry args={[.11, 7, 6]} /><meshStandardMaterial color="#dca27d" /></mesh>
    <mesh position={[0, .53, 0]} castShadow><cylinderGeometry args={[.12, .14, .08, 6]} /><meshStandardMaterial color="#243445" /></mesh>
    <mesh position={[0, .58, 0]} castShadow><cylinderGeometry args={[.075, .105, .035, 6]} /><meshStandardMaterial color="#243445" /></mesh>
  </group>
}

export function CaptainNavigator({ profile, onPositionChange, onHeadingChange, onBoard }: {
  profile: ShipProfile
  onPositionChange: (position: [number, number, number]) => void
  onHeadingChange: (heading: number) => void
  onBoard: () => void
}) {
  const keys = useRef(new Set<string>())
  const captain = useRef<THREE.Group>(null)
  const recenterCamera = useRef(true)
  const mainLand = profile.island.landmasses[0]
  const start = useMemo(() => [profile.homePosition[0] + mainLand.x, .65 + mainLand.height * .24, profile.homePosition[2] + mainLand.z] as [number, number, number], [mainLand.height, mainLand.x, mainLand.z, profile.homePosition])
  const current = useRef<PlayerTransform>({ position: start, rotation: 0 })
  const lastReport = useRef(0)
  const lastHeading = useRef(0)
  const boardLatch = useRef(false)
  const orbitHeading = useRef<number | null>(null)
  const viewDirection = useRef(new THREE.Vector3())

  useEffect(() => {
    current.current = { position: start, rotation: 0 }
    captain.current?.position.set(...start)
    captain.current?.rotation.set(0, 0, 0)
    recenterCamera.current = true
  }, [profile, start])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e'].includes(key)) {
        keys.current.add(key)
        event.preventDefault()
      }
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const onLand = (x: number, z: number) => profile.island.landmasses.some((land) => {
    const dx = x - (profile.homePosition[0] + land.x)
    const dz = z - (profile.homePosition[2] + land.z)
    const localX = Math.cos(land.rotation) * dx + Math.sin(land.rotation) * dz
    const localZ = -Math.sin(land.rotation) * dx + Math.cos(land.rotation) * dz
    return (localX / (land.radius * land.stretch * .83)) ** 2 + (localZ / (land.radius * .83)) ** 2 < 1
  })

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, .08)
    const strafe = (keys.current.has('d') || keys.current.has('arrowright') ? 1 : 0) - (keys.current.has('a') || keys.current.has('arrowleft') ? 1 : 0)
    const forwardInput = (keys.current.has('w') || keys.current.has('arrowup') ? 1 : 0) - (keys.current.has('s') || keys.current.has('arrowdown') ? 1 : 0)
    const length = Math.hypot(strafe, forwardInput)
    let next = current.current.position
    if (length) {
      // Movimento de terceira pessoa: W sempre avança para onde a câmera está
      // olhando; A/D fazem strafe. Assim o capitão nunca "anda de lado" ao
      // girar a visão com o botão direito.
      const view = viewDirection.current
      camera.getWorldDirection(view)
      view.y = 0
      view.normalize()
      const rightX = -view.z
      const rightZ = view.x
      const dx = (view.x * forwardInput + rightX * strafe) / length * .95 * dt
      const dz = (view.z * forwardInput + rightZ * strafe) / length * .95 * dt
      const x = next[0] + dx, z = next[2] + dz
      if (onLand(x, z)) next = [x, next[1], z]
      const targetRotation = Math.atan2(-dz, dx)
      const difference = Math.atan2(Math.sin(targetRotation - current.current.rotation), Math.cos(targetRotation - current.current.rotation))
      const rotation = current.current.rotation + difference * (1 - Math.exp(-14 * dt))
      current.current = { position: next, rotation }
      captain.current?.position.set(...next)
      captain.current?.rotation.set(0, rotation, 0)
    } else if (orbitHeading.current !== null) {
      // O capitão acompanha a direção em que o jogador está olhando enquanto
      // o botão direito está pressionado, inclusive parado.
      const difference = Math.atan2(Math.sin(orbitHeading.current - current.current.rotation), Math.cos(orbitHeading.current - current.current.rotation))
      const rotation = current.current.rotation + difference * (1 - Math.exp(-14 * dt))
      current.current = { position: next, rotation }
      captain.current?.rotation.set(0, rotation, 0)
    }
    const now = performance.now()
    if (now - lastReport.current > 220) { lastReport.current = now; onPositionChange(next) }
    if (now - lastHeading.current > 220) { lastHeading.current = now; onHeadingChange(current.current.rotation) }
    const dx = next[0] - profile.position[0], dz = next[2] - profile.position[2]
    if (keys.current.has('e') && dx * dx + dz * dz < 2.5 * 2.5) {
      if (!boardLatch.current) { boardLatch.current = true; onBoard() }
    } else if (!keys.current.has('e')) boardLatch.current = false
  })

  return <>
    <Captain color={profile.languages[0]?.color ?? '#c46a48'} captainRef={captain} />
    <PlayerCamera transformRef={current} recenterRef={recenterCamera} initialDistance={5.2} minDistance={3} maxDistance={11} targetHeight={.3} onOrbitHeading={(heading) => { orbitHeading.current = heading }} />
  </>
}
