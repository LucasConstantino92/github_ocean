// Shared by the API and the scene. Only public, observed data awards points.
export type ProgressRepository = {
  html_url: string; name: string; language: string | null; stargazers_count: number
  forks_count: number; commit_count: number | null; updated_at: string
}
export type ProgressUser = { login: string; public_repos: number; followers: number }
export type BuildingKind = 'campfire' | 'settlement' | 'fort' | 'harbor' | 'market'
export type Building = {
  id: string; kind: BuildingKind; level: number; title: string
  metric: string; value: number; next: number | null; repositoryUrl?: string
  position: [number, number, number]
}
export const BUILDING_NAMES: Record<BuildingKind, string> = {
  campfire: 'Fogueira', settlement: 'Assentamento', fort: 'Forte', harbor: 'Porto', market: 'Loja de tesouros',
}
export const PROGRESSION_VERSION = 2
const count = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0
const points = (n: number, ceiling: number) => Math.min(100, Math.log1p(count(n)) / Math.log1p(ceiling) * 100)
const levelAt = (value: number, thresholds: number[]) => thresholds.filter((threshold) => value >= threshold).length
export const identitySeed = (value: string) => [...value.toLowerCase()].reduce((n, char) => (n * 31 + char.charCodeAt(0)) >>> 0, 7)
export function rankedRepositories<T extends ProgressRepository>(repositories: T[]): T[] {
  return [...repositories].sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.updated_at) - Date.parse(a.updated_at) || a.html_url.localeCompare(b.html_url))
}

export function calculateProgression(user: ProgressUser, repositories: ProgressRepository[]) {
  const seed = identitySeed(user.login)
  const projects = count(user.public_repos)
  const stars = repositories.reduce((n, repo) => n + count(repo.stargazers_count), 0)
  const forks = repositories.reduce((n, repo) => n + count(repo.forks_count), 0)
  const measured = repositories.filter((repo) => typeof repo.commit_count === 'number' && Number.isFinite(repo.commit_count))
  const commits = measured.reduce((n, repo) => n + count(repo.commit_count ?? 0), 0)
  const languages = new Set(repositories.flatMap((repo) => repo.language ? [repo.language] : [])).size
  const axes = {
    projects: points(projects, 200), activity: points(commits, 10000),
    recognition: points(stars, 5000), community: points(forks + count(user.followers) * 0.25, 1500),
    diversity: points(languages, 12),
  }
  const score = Math.round(axes.projects * .3 + axes.activity * .3 + axes.recognition * .2 + axes.community * .15 + axes.diversity * .05)
  const shipClass: 'Skiff' | 'Sloop' | 'Brigantine' | 'Frigate' | 'Galleon' = score < 15 ? 'Skiff' : score < 32 ? 'Sloop' : score < 52 ? 'Brigantine' : score < 75 ? 'Frigate' : 'Galleon'
  const masts = 1 + levelAt(score, [24, 48, 76])
  const extraSails = Math.min(masts, levelAt(commits, [50, 250, 1000, 4000]))
  const crewThresholds = [10, 50, 150, 400, 1000, 2500, 6000]
  const crew = 1 + levelAt(commits, crewThresholds)
  const ship = {
    size: .7 + score * .0075, masts, sails: masts + extraSails, crew,
    nextCrew: crewThresholds.find((n) => n > commits) ?? null,
    hullLength: 1.6 + masts * .3 + axes.projects * .003,
    hullWidth: .65 + axes.community * .003,
    cabinLevel: levelAt(projects, [5, 25, 80]),
    trimLevel: levelAt(stars, [5, 50, 500]),
    cargo: levelAt(forks, [1, 10, 100]),
    wood: ['#593722', '#453b31', '#6b352a', '#3b4c50'][seed % 4],
    sailPattern: seed % 3,
  }

  const buildings: Building[] = []
  const add = (id: string, kind: BuildingKind, value: number, thresholds: number[], metric: string, repositoryUrl?: string) => {
    const level = levelAt(value, thresholds)
    if (!level) return
    buildings.push({ id, kind, level, title: BUILDING_NAMES[kind], metric, value,
      next: thresholds.find((n) => n > value) ?? null, repositoryUrl, position: [0, .65, 0] })
  }
  add('campfire', 'campfire', commits, [0, 100, 1000], 'commits de autoria confirmada na amostra')
  add('settlement', 'settlement', projects, [3, 15, 60], 'repositórios públicos')
  add('fort', 'fort', stars, [10, 100, 1000], 'stars nos repositórios analisados')
  add('harbor', 'harbor', projects, [1, 10, 40], 'repositórios públicos')
  add('market', 'market', forks, [1, 20, 200], 'forks recebidos nos repositórios analisados')

  for (const repo of rankedRepositories(repositories).slice(0, 8)) {
    const kind: BuildingKind = repo.stargazers_count >= 10 ? 'fort' : repo.forks_count >= 2 ? 'market' : (repo.commit_count ?? 0) >= 50 ? 'campfire' : 'settlement'
    const value = kind === 'fort' ? repo.stargazers_count : kind === 'market' ? repo.forks_count : repo.commit_count ?? 0
    const thresholds = kind === 'fort' ? [0, 100, 1000] : kind === 'market' ? [0, 20, 200] : [0, 100, 1000]
    add(repo.html_url, kind, value, thresholds, kind === 'fort' ? 'stars deste projeto' : kind === 'market' ? 'forks deste projeto' : 'commits confirmados neste projeto', repo.html_url)
  }
  // Regular plots keep every building on solid ground and leave circulation space.
  const plots = Math.max(4 + Math.floor(score / 5), buildings.length + 1)
  const columns = plots <= 6 ? 2 : plots <= 12 ? 3 : 4
  const rows = Math.ceil(plots / columns)
  const spacing = 1.28
  buildings.forEach((building, index) => {
    building.position = [(index % columns - (columns - 1) / 2) * spacing, .65, (Math.floor(index / columns) - (rows - 1) / 2) * spacing]
  })
  const radius = Math.hypot(columns * spacing / 2, rows * spacing / 2) + .3
  return {
    version: PROGRESSION_VERSION, score, axes, shipClass, ship, buildings,
    stars, forks, commits, measuredRepos: measured.length, sampledRepos: repositories.length,
    island: { size: radius / 2.4, radius, level: 1 + Math.floor(score / 10), commits, columns, rows, spacing },
  }
}
export type Progression = ReturnType<typeof calculateProgression>
