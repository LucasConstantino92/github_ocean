import type { Building } from '../../types/ocean'

export function BuildingCard({ building, onClose }: { building: Building | null; onClose: () => void }) {
  if (!building) return null
  return <aside className="repository-card visible">
    <button className="close" onClick={onClose} aria-label="Fechar">×</button>
    <p className="eyebrow">EVOLUÇÃO DO PORTO</p>
    <h2>{building.title} · Nv. {building.level}</h2>
    <p>Esta construção evolui com {building.metric}.</p>
    <div className="repo-stats"><span>{building.value.toLocaleString('pt-BR')} atualmente</span></div>
    <p>{building.next === null ? 'Nível máximo desta construção.' : 'Próximo nível: ' + building.next.toLocaleString('pt-BR') + ' (' + (building.next - building.value).toLocaleString('pt-BR') + ' restantes).'}</p>
  </aside>
}
