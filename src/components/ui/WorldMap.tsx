import type { ShipProfile } from '../../types/ocean'
import { DirectionMarker } from './DirectionMarker'

const mapRange = 420

export function WorldMap({
  open,
  profile,
  developers,
  playerPosition,
  heading,
  discoveredPorts,
  waypoint,
  onWaypointChange,
  onClose,
}: {
  open: boolean
  profile: ShipProfile | null
  developers: ShipProfile[]
  playerPosition: [number, number, number]
  heading: number
  discoveredPorts: ReadonlySet<string>
  waypoint: [number, number, number] | null
  onWaypointChange: (point: [number, number, number]) => void
  onClose: () => void
}) {
  if (!open) return null
  const ports = profile ? [profile, ...developers.filter((developer) => developer.user.login.toLowerCase() !== profile.user.login.toLowerCase())] : developers
  const coordinate = (value: number, center: number) => 50 + (value - center) / mapRange * 100
  const setWaypoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const screenX = (event.clientX - bounds.left) / bounds.width * mapRange - mapRange / 2
    const screenZ = (event.clientY - bounds.top) / bounds.height * mapRange - mapRange / 2
    const rotation = heading - Math.PI / 2
    const x = playerPosition[0] + screenX * Math.cos(rotation) + screenZ * Math.sin(rotation)
    const z = playerPosition[2] - screenX * Math.sin(rotation) + screenZ * Math.cos(rotation)
    onWaypointChange([x, 0, z])
  }

  return <section className="world-map-backdrop" role="dialog" aria-modal="true" aria-label="Mapa do oceano">
    <div className="world-map-panel">
      <header><div><span className="eyebrow">CARTA NÁUTICA</span><h2>Ocean Atlas</h2></div><button onClick={onClose}>Fechar <kbd>M</kbd></button></header>
      <div className="world-map" onPointerDown={setWaypoint}>
        <span className="map-grid map-grid-x" /><span className="map-grid map-grid-z" />
        <div className="world-map-content" style={{ transform: `rotate(${heading * 180 / Math.PI - 90}deg)` }}>
        {ports.map((port) => {
          const left = coordinate(port.homePosition[0], playerPosition[0])
          const top = coordinate(port.homePosition[2], playerPosition[2])
          if (left < 0 || left > 100 || top < 0 || top > 100) return null
          const discovered = discoveredPorts.has(port.user.login.toLowerCase())
          return <button
            key={port.user.login}
            className={`world-map-port ${discovered ? '' : 'fogged'}`}
            style={{ left: `${left}%`, top: `${top}%` }}
            onPointerDown={(event) => { event.stopPropagation(); onWaypointChange(port.homePosition) }}
            title={discovered ? `Navegar até @${port.user.login}` : 'Águas desconhecidas'}
            aria-label={discovered ? `Marcar porto de ${port.user.login}` : 'Marcar águas desconhecidas'}
          >{discovered ? '◆' : '·'}</button>
        })}
        {waypoint && <span className="world-map-waypoint" style={{ left: `${coordinate(waypoint[0], playerPosition[0])}%`, top: `${coordinate(waypoint[2], playerPosition[2])}%` }}>✦</span>}
        </div>
        <DirectionMarker className="world-map-player" />
      </div>
      <footer>Clique no oceano para marcar um rumo. Clique em um porto para usar sua posição como destino.</footer>
    </div>
  </section>
}

export function WaypointCompass({ waypoint, playerPosition, heading, onClear }: {
  waypoint: [number, number, number] | null
  playerPosition: [number, number, number]
  heading: number
  onClear: () => void
}) {
  if (!waypoint) return null
  const dx = waypoint[0] - playerPosition[0]
  const dz = waypoint[2] - playerPosition[2]
  const distance = Math.round(Math.hypot(dx, dz))
  const length = Math.hypot(dx, dz) || 1
  const targetX = dx / length
  const targetZ = dz / length
  const forwardX = Math.cos(heading)
  const forwardZ = -Math.sin(heading)
  const rightX = Math.sin(heading)
  const rightZ = Math.cos(heading)
  const angle = Math.atan2(targetX * rightX + targetZ * rightZ, targetX * forwardX + targetZ * forwardZ) * 180 / Math.PI
  return <aside className="waypoint-compass" aria-label={`Destino a ${distance} unidades`}>
    <DirectionMarker className="waypoint-arrow" angle={angle} />
    <span><b>{distance} u</b><small>DESTINO MARCADO</small></span>
    <button onClick={onClear} aria-label="Remover destino">×</button>
  </aside>
}
