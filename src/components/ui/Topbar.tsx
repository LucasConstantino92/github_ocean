import type { Locale } from '../../types/ocean'
import { apiUrl, copy } from '../../utils/constants'

export function Topbar({
  soundEnabled,
  onToggleSound,
  locale,
  onChangeLocale,
  githubLogin,
  onReturnHome,
}: {
  soundEnabled: boolean
  onToggleSound: () => void
  locale: Locale
  onChangeLocale: (locale: Locale) => void
  githubLogin: string | null
  onReturnHome: () => void
}) {
  const t = copy[locale]

  return (
    <header className="topbar">
      <a className="brand" href="/">
        <span>⚓</span> GitHub Ocean
      </a>
      <div className="top-actions">
        <button
          className={`sound ${soundEnabled ? 'active' : ''}`}
          onClick={onToggleSound}
          aria-label={soundEnabled ? 'Desligar som do oceano' : 'Ligar som do oceano'}
        >
          {soundEnabled ? '♪ ON' : '♪ OFF'}
        </button>
        <select
          aria-label="Language"
          value={locale}
          onChange={(event) => onChangeLocale(event.target.value as Locale)}
        >
          <option value="pt-BR">Português (Brasil)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
        {githubLogin ? (
          <>
            <button className="home" onClick={onReturnHome}>
              {t.home}
            </button>
            <span className="mode">⚓ @{githubLogin}</span>
          </>
        ) : (
          <a className="login" href={apiUrl('/api/auth/github')}>
            {t.login}
          </a>
        )}
      </div>
    </header>
  )
}
