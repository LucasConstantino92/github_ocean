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

  return (
    <section className={`search-card ${isDocked ? 'docked' : ''}`}>
      <p className="eyebrow">EXPLORE THE DEVELOPER WORLD</p>
      <h1>{t.search}</h1>
      <form onSubmit={onSubmit}>
        <input
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder={t.username}
          aria-label={t.username}
        />
        <button disabled={loading}>{loading ? t.loading : t.go}</button>
      </form>
      <p className="status">{status}</p>
    </section>
  )
}
