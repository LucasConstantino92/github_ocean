import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const oceanVertexShader = `
  uniform float uTime;
  uniform vec2 uOrigin;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    vUv = uv + uOrigin / 650.0;
    vec3 p = position;
    vec2 world = p.xy + uOrigin;
    float broad = sin(world.x * .045 + uTime * .7) * .22 + cos(world.y * .052 - uTime * .55) * .16;
    float detail = sin((world.x + world.y) * .16 + uTime * 1.4) * .045;
    p.z += broad + detail;
    vWave = broad + detail;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const oceanFragmentShader = `
  uniform float uTime;
  varying float vWave;
  varying vec2 vUv;
  void main() {
    float shimmer = sin((vUv.x - vUv.y) * 95.0 + uTime * 1.8) * .5 + .5;
    vec3 deep = vec3(.016, .16, .29);
    vec3 crest = vec3(.055, .43, .62);
    vec3 foam = vec3(.78, .93, 1.0);
    vec3 color = mix(deep, crest, clamp(vWave * 1.3 + .42 + shimmer * .08, 0.0, 1.0));
    float foamLine = smoothstep(0.24, 0.38, vWave);
    color = mix(color, foam, foamLine * 0.38);
    gl_FragColor = vec4(color, 1.0);
  }
`

export function OceanSurface() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const surface = useRef<THREE.Mesh>(null)
  useFrame(({ clock, camera }) => {
    if (!material.current || !surface.current) return
    const x = Math.floor(camera.position.x / 40) * 40
    const z = Math.floor(camera.position.z / 40) * 40
    surface.current.position.set(x, 0, z)
    material.current.uniforms.uTime.value = clock.elapsedTime
    material.current.uniforms.uOrigin.value.set(x, -z)
  })
  return (
    <mesh ref={surface} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[650, 650, 96, 96]} />
      <shaderMaterial
        ref={material}
        vertexShader={oceanVertexShader}
        fragmentShader={oceanFragmentShader}
        uniforms={{ uTime: { value: 0 }, uOrigin: { value: new THREE.Vector2() } }}
      />
    </mesh>
  )
}
