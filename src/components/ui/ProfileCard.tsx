import type { Locale, ShipProfile } from '../../types/ocean'
import { copy } from '../../utils/constants'

export function ProfileCard({
  profile,
  locale,
}: {
  profile: ShipProfile | null
  locale: Locale
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
