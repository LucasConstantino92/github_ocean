import type { ShipProfile } from '../../types/ocean'

const mapRange = 420

export function WorldMap({
  open,
  profile,
  developers,
  playerPosition,
  discoveredPorts,
  waypoint,
  onWaypointChange,
  onClose,
}: {
  open: boolean
  profile: ShipProfile | null
  developers: ShipProfile[]
  playerPosition: [number, number, number]
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
    const x = playerPosition[0] + (event.clientX - bounds.left) / bounds.width * mapRange - mapRange / 2
    const z = playerPosition[2] + (event.clientY - bounds.top) / bounds.height * mapRange - mapRange / 2
    onWaypointChange([x, 0, z])
  }

  return <section className="world-map-backdrop" role="dialog" aria-modal="true" aria-label="Mapa do oceano">
    <div className="world-map-panel">
      <header><div><span className="eyebrow">CARTA NÁUTICA</span><h2>Ocean Atlas</h2></div><button onClick={onClose}>Fechar <kbd>M</kbd></button></header>
      <div className="world-map" onPointerDown={setWaypoint}>
        <span className="map-grid map-grid-x" /><span className="map-grid map-grid-z" />
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
        <span className="world-map-player">▲</span>
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
  const angle = Math.atan2(forwardZ * targetX - forwardX * targetZ, forwardX * targetX + forwardZ * targetZ) * 180 / Math.PI
  return <aside className="waypoint-compass" aria-label={`Destino a ${distance} unidades`}>
    <span className="waypoint-arrow" style={{ transform: `rotate(${angle}deg)` }}>▲</span>
    <span><b>{distance} u</b><small>DESTINO MARCADO</small></span>
    <button onClick={onClear} aria-label="Remover destino">×</button>
  </aside>
}
