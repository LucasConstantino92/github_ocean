import type { ShipProfile } from '../../types/ocean'

export function MiniMap({
  profile,
  developers,
  playerPosition,
}: {
  profile: ShipProfile
  developers: ShipProfile[]
  playerPosition: [number, number, number]
}) {
  const scale = 1.08
  const ports = [profile, ...developers.filter((developer) => developer.user.login !== profile.user.login)]

  return (
    <aside className="minimap" aria-label="Mapa da região">
      <div className="compass">N</div>
      <div className="map-ring">
        {ports.map((developer) => {
          const left = 50 + (developer.homePosition[0] - playerPosition[0]) * scale
          const top = 50 + (developer.homePosition[2] - playerPosition[2]) * scale
          if (left < 4 || left > 96 || top < 4 || top > 96) return null
          return (
            <button
              key={developer.user.login}
              className="map-port"
              style={{ left: `${left}%`, top: `${top}%` }}
              title={`@${developer.user.login}`}
              aria-label={`Porto de ${developer.user.login}`}
            />
          )
        })}
        <span className="map-player" />
      </div>
      <span className="map-label">REGIÃO ATUAL</span>
    </aside>
  )
}
