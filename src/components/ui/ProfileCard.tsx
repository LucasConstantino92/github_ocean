import type { Locale, RepositoryIsland, ShipProfile } from '../../types/ocean'
import { copy } from '../../utils/constants'

export function ProfileCard({
  profile,
  locale,
  onRepositoryClick,
}: {
  profile: ShipProfile | null
  locale: Locale
  onRepositoryClick: (repository: RepositoryIsland) => void
}) {
  const t = copy[locale]

  return (
    <aside className={`profile-card ${profile ? 'visible' : ''}`}>
      {profile && (
        <>
          <img src={profile.user.avatar_url} alt="" />
          <div>
            <p className="eyebrow">{profile.shipClass.toUpperCase()}</p>
            <h2>{profile.user.name ?? profile.user.login}</h2>
            <a href={profile.user.html_url} target="_blank" rel="noreferrer">
              @{profile.user.login} ↗
            </a>
          </div>
          <p className="bio">{profile.user.bio ?? 'Explorador das águas abertas do código.'}</p>
          <div className="stats">
            <span>
              <b>{profile.user.public_repos}</b> {t.repos}
            </span>
            <span>
              <b>{profile.stars}</b> stars
            </span>
            <span>
              <b>{profile.user.followers}</b> {t.followers}
            </span>
          </div>
          <div className="progression-summary">
            <span>⛵ {profile.progression.ship.sails} velas</span>
            <span>⚓ {profile.progression.ship.crew} tripulantes</span>
            <span>Ilha Nv. {profile.island.level}</span>
          </div>
          <details className="progression-details">
            <summary>Evolução · {profile.progression.score}/100 pontos</summary>
            <p>Projetos 30% · atividade 30% · stars 20% · comunidade 15% · linguagens 5%. Cada eixo cresce gradualmente, com limite.</p>
            <p>{profile.progression.commits.toLocaleString('pt-BR')} commits confirmados em {profile.progression.measuredRepos} projetos medidos. {profile.progression.ship.nextCrew === null ? 'Tripulação completa.' : 'Próximo tripulante: ' + profile.progression.ship.nextCrew + ' commits.'}</p>
            {profile.user.profile_complete === false && <p>Perfil ainda não atualizado; os dados atuais serão consultados ao selecionar ou pesquisar este usuário.</p>}
            <p>Amostra: {profile.progression.sampledRepos} de {profile.user.public_repos} repositórios públicos. Commits são de autoria do perfil na branch padrão dos oito projetos destacados; dados indisponíveis não somam pontos.</p>
            <ul>{profile.progression.buildings.filter((building) => !building.repositoryUrl).map((building) => <li key={building.id}>{building.title} · Nv. {building.level}<small>{building.value} {building.metric}{building.next !== null ? ' · próximo: ' + building.next : ' · máximo'}</small></li>)}</ul>
          </details>
          <details className="progression-details">
            <summary>Construções dos projetos · {profile.repositories.length}</summary>
            <div className="project-buildings">{profile.repositories.map((repository) => <button key={repository.html_url} onClick={() => onRepositoryClick(repository)}>
              <span>{repository.name}</span><small>{repository.building.title} · Nv. {repository.building.level}</small>
            </button>)}</div>
          </details>
          <div className="languages">
            {profile.languages.length ? (
              profile.languages.map((language) => (
                <span key={language.name} style={{ borderColor: language.color }}>
                  <i style={{ background: language.color }} />
                  {language.name}
                </span>
              ))
            ) : (
              <span>Stack não identificada</span>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
