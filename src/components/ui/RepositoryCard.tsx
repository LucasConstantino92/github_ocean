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
            REPOSITORY ISLAND
          </p>
          <h2>{repository.name}</h2>
          <p>{repository.description ?? 'Uma ilha sem descrição, esperando por novos exploradores.'}</p>
          <div className="repo-stats">
            <span>⌁ {repository.commit_count} commits</span>
            <span>★ {repository.stargazers_count}</span>
            <span>{repository.language ?? 'Code'}</span>
          </div>
          <a href={repository.html_url} target="_blank" rel="noreferrer">
            Abrir no GitHub ↗
          </a>
        </>
      )}
    </aside>
  )
}
