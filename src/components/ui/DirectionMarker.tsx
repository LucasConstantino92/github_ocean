export function DirectionMarker({ angle = 0, className = '' }: { angle?: number; className?: string }) {
  return <svg className={`direction-marker ${className}`} viewBox="0 0 24 32" aria-hidden="true" style={{ transform: `rotate(${angle}deg)` }}>
    <path d="M12 1 22 29 12 24 2 29Z" />
  </svg>
}
