import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Locale } from '../../types/ocean'
import { copy } from '../../utils/constants'

export function SearchCard({
  username,
  onUsernameChange,
  onSubmit,
  loading,
  status,
  isDocked,
  locale,
}: {
  username: string
  onUsernameChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  loading: boolean
  status: string
  isDocked: boolean
  locale: Locale
}) {
  const t = copy[locale]
  const [collapsed, setCollapsed] = useState(false)
  const isCollapsed = isDocked && collapsed

  return (
    <section className={`search-card ${isDocked ? 'docked' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      {isDocked && (
        <button
          type="button"
          className="search-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? t.showSearch : t.hideSearch}
          title={isCollapsed ? t.showSearch : t.hideSearch}
        >
          <span aria-hidden="true">{isCollapsed ? '⌕' : '−'}</span>
        </button>
      )}
      <div className="search-card-content" aria-hidden={isCollapsed}>
        <p className="eyebrow">EXPLORE THE DEVELOPER WORLD</p>
        <h1>{t.search}</h1>
        <form onSubmit={onSubmit}>
          <input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder={t.username}
            aria-label={t.username}
            tabIndex={isCollapsed ? -1 : undefined}
          />
          <button disabled={loading} tabIndex={isCollapsed ? -1 : undefined}>{loading ? t.loading : t.go}</button>
        </form>
        <p className="status">{status}</p>
      </div>
    </section>
  )
}
