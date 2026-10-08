import { useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'

export function PerformanceHud({ loadedPorts }: { loadedPorts: number }) {
  const { gl } = useThree()
  const [metrics, setMetrics] = useState({ fps: 0, calls: 0, triangles: 0 })
  const last = useRef({ time: 0, frames: 0 })

  useFrame(({ clock }) => {
    last.current.frames += 1
    const elapsed = clock.elapsedTime - last.current.time
    if (elapsed < .5) return
    setMetrics({ fps: Math.round(last.current.frames / elapsed), calls: gl.info.render.calls, triangles: gl.info.render.triangles })
    last.current = { time: clock.elapsedTime, frames: 0 }
  })

  return <Html fullscreen style={{ pointerEvents: 'none' }}>
    <aside className="performance-hud">
      <strong>Performance</strong>
      <span>{metrics.fps} FPS</span>
      <span>{metrics.calls} draw calls</span>
      <span>{metrics.triangles.toLocaleString()} triangles</span>
      <span>{loadedPorts} ports cached</span>
    </aside>
  </Html>
}
