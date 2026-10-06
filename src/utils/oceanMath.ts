import type { GitHubRepository, GitHubUser, RepositoryIsland, ShipProfile, WorldChunk } from '../types/ocean'
import { languageColors } from './constants'

export const hash = (value: string) =>
  [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7)

export const worldChunkFor = (position: [number, number, number]): WorldChunk => [
  Math.floor(position[0] / 88),
  Math.floor(position[2] / 88),
]

export function getOceanWaveHeight(x: number, z: number, time: number): number {
  const px = x
  const py = -z
  const broad = Math.sin(px * 0.045 + time * 0.7) * 0.22 + Math.cos(py * 0.052 - time * 0.55) * 0.16
  const detail = Math.sin((px + py) * 0.16 + time * 1.4) * 0.045
  return broad + detail
}

export const shipWaterlineOffset = 0.14

export const playerSailingMetrics = {
  speed: 0,
  maxSpeed: 7.2,
  heading: 0,
  pitch: 0,
  roll: 0,
}

export function createProfile(
  user: GitHubUser,
  repositories: GitHubRepository[],
  worldPosition?: [number, number]
): ShipProfile {
  const languageCount = repositories.reduce<Record<string, number>>((all, repo) => {
    if (repo.language) all[repo.language] = (all[repo.language] ?? 0) + 1
    return all
  }, {})

  const languages = Object.entries(languageCount)
    .map(([name, count]) => ({ name, count, color: languageColors[name] ?? '#8b9bb4' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  const stars = repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0)
  const forks = repositories.reduce((sum, repo) => sum + repo.forks_count, 0)
  const score = user.public_repos * 2 + stars * 3 + user.followers
  const shipClass =
    score < 15 ? 'Skiff' : score < 50 ? 'Sloop' : score < 150 ? 'Brigantine' : score < 500 ? 'Frigate' : 'Galleon'

  const seed = hash(user.login)
  const homePosition: [number, number, number] = worldPosition
    ? [worldPosition[0], 0, worldPosition[1]]
    : [((seed % 360) - 180) / 9, 0, (((seed >>> 9) % 360) - 180) / 9]

  const totalCommits = repositories.reduce((sum, repository) => sum + repository.commit_count, 0)
  const islandScore = Math.log10(Math.max(totalCommits, 1)) + Math.log10(stars + 1) * 0.7 + Math.log10(user.public_repos + 1) * 0.5

  const island = {
    size: Math.min(1.28, Math.max(0.78, 0.78 + islandScore * 0.12)),
    level: islandScore < 1 ? 1 : islandScore < 1.8 ? 2 : islandScore < 2.6 ? 3 : islandScore < 3.4 ? 4 : 5,
    commits: totalCommits,
  }

  const position: [number, number, number] = [homePosition[0] + island.size * 2.35, 0, homePosition[2]]

  const repositoryIslands: RepositoryIsland[] = [...repositories]
    .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 8)
    .map((repo, index) => {
      const angle = (index / Math.min(repositories.length, 8)) * Math.PI * 2 + (seed % 100) / 100
      const distance = 9 + (index % 2) * 2.5
      const importance =
        Math.log10(Math.max(repo.commit_count, 1)) * 0.42 +
        Math.log10(repo.stargazers_count + 1) * 0.26 +
        Math.log10(repo.forks_count + 1) * 0.14

      return {
        ...repo,
        size: Math.min(1.3, Math.max(0.58, 0.58 + importance)),
        color: languageColors[repo.language ?? ''] ?? '#8b9bb4',
        position: [
          homePosition[0] + Math.cos(angle) * distance,
          0.25,
          homePosition[2] + Math.sin(angle) * distance,
        ] as [number, number, number],
      }
    })

  return { user, languages, stars, forks, repositories: repositoryIslands, shipClass, position, homePosition, island }
}
