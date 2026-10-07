import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { DayPhase, LocalWeather } from '../../utils/weather'


const palette: Record<DayPhase, { background: string; fog: string; light: string; ambient: number; sun: number }> = {
  dawn: { background: '#8e7890', fog: '#b79091', light: '#ffd1a1', ambient: 1.05, sun: 1.45 },
  day: { background: '#78b7d4', fog: '#8ebed1', light: '#fff1c6', ambient: 1.3, sun: 2.25 },
  dusk: { background: '#573d68', fog: '#876b82', light: '#ffb36c', ambient: .82, sun: 1.25 },
  night: { background: '#071c35', fog: '#102d4b', light: '#8ec3df', ambient: .46, sun: .62 },
}

function Rain({ active, storm }: { active: boolean; storm: boolean }) {
  const points = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const drops = new Float32Array(300 * 3)
    for (let index = 0; index < drops.length; index += 3) {
      drops[index] = ((index * 37) % 190) / 10 - 9.5
      drops[index + 1] = ((index * 71) % 190) / 10
      drops[index + 2] = ((index * 53) % 190) / 10 - 9.5
    }
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(drops, 3))
    return next
  }, [])

  useFrame(({ camera }, delta) => {
    if (!points.current) return
    points.current.visible = active
    if (!active) return
    points.current.position.set(camera.position.x, 0, camera.position.z)
    const values = geometry.getAttribute('position') as THREE.BufferAttribute
    const velocity = storm ? 23 : 15
    for (let index = 1; index < values.count * 3; index += 3) {
      const y = values.array[index] as number
      values.array[index] = y - velocity * Math.min(delta, .05) < 0 ? 19 : y - velocity * Math.min(delta, .05)
    }
    values.needsUpdate = true
  })

  useEffect(() => () => geometry.dispose(), [geometry])
  return <points ref={points} geometry={geometry} visible={false} frustumCulled={false}>
    <pointsMaterial color={storm ? '#b8d6ee' : '#d9efff'} size={storm ? .045 : .032} transparent opacity={storm ? .75 : .58} depthWrite={false} />
  </points>
}

export function WeatherSystem({ weather }: { weather: LocalWeather }) {
  const base = palette[weather.phase]
  const weatherDarkness = weather.kind === 'storm' ? .48 : weather.kind === 'rain' ? .65 : weather.kind === 'cloudy' ? .82 : 1
  const background = new THREE.Color(base.background).multiplyScalar(weatherDarkness)
  const fogColor = new THREE.Color(base.fog).multiplyScalar(weatherDarkness)
  const fogNear = weather.kind === 'haze' ? 42 : weather.kind === 'storm' ? 34 : 72
  const fogFar = weather.kind === 'haze' ? 122 : weather.kind === 'storm' ? 108 : weather.kind === 'rain' ? 145 : 190

  return <>
    <color attach="background" args={[background]} />
    <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
    <ambientLight intensity={base.ambient * weatherDarkness} />
    <directionalLight position={[-8, 12, 4]} color={base.light} intensity={base.sun * weatherDarkness} castShadow />
    <Rain active={weather.kind === 'rain' || weather.kind === 'storm'} storm={weather.kind === 'storm'} />
  </>
}
