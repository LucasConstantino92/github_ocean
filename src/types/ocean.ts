import type { Building, Progression } from '../../shared/progression'
export type { Building } from '../../shared/progression'

export type GitHubUser = {
  profile_complete?: boolean
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  bio: string | null
  public_repos: number
  followers: number
}

export type GitHubRepository = {
  name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  updated_at: string
  commit_count: number | null
}

export type RepositoryIsland = GitHubRepository & {
  position: [number, number, number]
  color: string
  size: number
  building: Building
}

export type ShipClass = 'Skiff' | 'Sloop' | 'Brigantine' | 'Frigate' | 'Galleon'

export type ShipProfile = {
  user: GitHubUser
  languages: { name: string; count: number; color: string }[]
  stars: number
  forks: number
  repositories: RepositoryIsland[]
  shipClass: ShipClass
  position: [number, number, number]
  homePosition: [number, number, number]
  island: Progression['island']
  progression: Progression
}

export type Locale = 'pt-BR' | 'en' | 'es'

export type WorldChunk = [number, number]

export type PlayerTransform = {
  position: [number, number, number]
  rotation: number
}
