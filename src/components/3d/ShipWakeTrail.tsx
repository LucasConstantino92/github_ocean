import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { PlayerTransform } from '../../types/ocean'
import { getOceanWaveHeight, playerSailingMetrics } from '../../utils/oceanMath'

type WakeNode = {
  x: number
  z: number
  heading: number
  born: number
  speed: number
  active: boolean
}

export function ShipWakeTrail({
  playerTransformRef,
}: {
  playerTransformRef: React.MutableRefObject<PlayerTransform>
}) {
  const count = 36
  const nodes = useRef<WakeNode[]>(
    Array.from({ length: count }, () => ({ x: 0, z: 0, heading: 0, born: 0, speed: 0, active: false }))
  )
  const nextIndex = useRef(0)
  const lastEmitPos = useRef(new THREE.Vector3())
  const meshes = useRef<(THREE.Group | null)[]>([])
  const materials = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    const [px, , pz] = playerTransformRef.current.position
    const rot = playerTransformRef.current.rotation
    const currentPos = new THREE.Vector3(px, 0, pz)
    const dist = currentPos.distanceTo(lastEmitPos.current)
    const speed = Math.abs(playerSailingMetrics.speed)

    // Emitir novo anel de espuma na popa se o barco se moveu o suficiente
    if (dist > 0.45 && speed > 0.3) {
      lastEmitPos.current.copy(currentPos)
      const sternOffset = 1.15
      const sternX = px - Math.cos(rot) * sternOffset
      const sternZ = pz + Math.sin(rot) * sternOffset
      const slot = nextIndex.current
      nodes.current[slot] = {
        x: sternX,
        z: sternZ,
        heading: rot,
        born: time,
        speed,
        active: true,
      }
      nextIndex.current = (nextIndex.current + 1) % count
    }

    // Atualizar cada anel de espuma ativo
    for (let i = 0; i < count; i++) {
      const node = nodes.current[i]
      const mesh = meshes.current[i]
      const mat = materials.current[i]
      if (!mesh || !mat) continue

      if (!node.active) {
        mesh.visible = false
        continue
      }

      const age = time - node.born
      const maxLife = 3.2
      if (age > maxLife) {
        node.active = false
        mesh.visible = false
        continue
      }

      mesh.visible = true
      const lifeRatio = age / maxLife
      const waveH = getOceanWaveHeight(node.x, node.z, time)
      mesh.position.set(node.x, waveH + 0.018, node.z)
      mesh.rotation.y = node.heading

      // O rastro expande em V e ganha largura
      const expandScale = 0.5 + age * 0.75
      mesh.scale.set(expandScale * 1.35, 1, expandScale * 0.85)

      // Opacidade suave decaindo
      const initialOpacity = 0.35 * Math.min(node.speed / 2.5, 1.0)
      mat.opacity = Math.max(0, initialOpacity * (1 - lifeRatio * lifeRatio))
    }
  })

  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
          visible={false}
        >
          {/* Par de asas de espuma em V */}
          <mesh rotation={[-Math.PI / 2, 0, 0.22]}>
            <planeGeometry args={[1.2, 0.42]} />
            <meshBasicMaterial
              ref={(el) => {
                materials.current[i] = el
              }}
              color="#e0f7ff"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, -0.22]} position={[0, 0.001, 0]}>
            <planeGeometry args={[1.2, 0.42]} />
            <meshBasicMaterial
              color="#b9efff"
              transparent
              opacity={0.16}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
