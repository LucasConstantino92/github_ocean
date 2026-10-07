import type { RepositoryIsland } from '../../types/ocean'

export function RepositoryCard({
  repository,
  onClose,
}: {
  repository: RepositoryIsland | null
  onClose: () => void
}) {
  return (
    <aside className={`repository-card ${repository ? 'visible' : ''}`}>
      {repository && (
        <>
          <button className="close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
          <p className="eyebrow" style={{ color: repository.color }}>
            {repository.building.title.toUpperCase()} · NV. {repository.building.level}
          </p>
          <h2>{repository.name}</h2>
          <p>{repository.description ?? 'Projeto público deste explorador.'}</p>
          <div className="repo-stats">
            <span>⌁ {repository.commit_count === null ? 'Não medidos' : repository.commit_count + ' commits do autor'}</span>
            <span>★ {repository.stargazers_count}</span>
            <span>{repository.language ?? 'Code'}</span>
          </div>
          <p>{repository.building.value} {repository.building.metric}. {repository.building.next === null ? 'Nível máximo.' : 'Próximo nível: ' + repository.building.next + '.'}</p>
          <a href={repository.html_url} target="_blank" rel="noreferrer">
            Abrir no GitHub ↗
          </a>
        </>
      )}
    </aside>
  )
}
