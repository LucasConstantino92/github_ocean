import type { ShipProfile } from '../../types/ocean'
import { DirectionMarker } from './DirectionMarker'

export function MiniMap({
  profile,
  developers,
  playerPosition,
  discoveredPorts,
  heading,
}: {
  profile: ShipProfile
  developers: ShipProfile[]
  playerPosition: [number, number, number]
  discoveredPorts: ReadonlySet<string>
  heading: number
}) {
  const scale = 1.08
  const ports = [profile, ...developers.filter((developer) => developer.user.login !== profile.user.login)]

  return (
    <aside className="minimap" aria-label="Mapa da região">
      <div className="compass">N</div>
      <div className="map-ring">
        <div className="minimap-content" style={{ transform: `rotate(${heading * 180 / Math.PI - 90}deg)` }}>
        {ports.map((developer) => {
          const left = 50 + (developer.homePosition[0] - playerPosition[0]) * scale
          const top = 50 + (developer.homePosition[2] - playerPosition[2]) * scale
          if (left < 4 || left > 96 || top < 4 || top > 96) return null
          const discovered = discoveredPorts.has(developer.user.login.toLowerCase())
          return (
            <button
              key={developer.user.login}
              className={`map-port ${discovered ? '' : 'undiscovered'}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              title={discovered ? `@${developer.user.login}` : 'Águas desconhecidas'}
              aria-label={discovered ? `Porto de ${developer.user.login}` : 'Águas desconhecidas'}
            />
          )
        })}
        </div>
        <DirectionMarker className="map-player" />
      </div>
      <span className="map-label">REGIÃO ATUAL</span>
    </aside>
  )
}
