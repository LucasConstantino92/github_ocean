import type { GitHubRepository, GitHubUser, RepositoryIsland, ShipProfile, WorldChunk } from '../types/ocean'
import { languageColors } from './constants'
import { calculateProgression, identitySeed, rankedRepositories } from '../../shared/progression'

export const hash = identitySeed

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
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 4)

  const progression = calculateProgression(user, repositories)
  const { stars, forks, shipClass, island } = progression

  const seed = hash(user.login)
  const homePosition: [number, number, number] = worldPosition
    ? [worldPosition[0], 0, worldPosition[1]]
    : [((seed % 360) - 180) / 9, 0, (((seed >>> 9) % 360) - 180) / 9]

  const position: [number, number, number] = [homePosition[0] + island.columns * island.spacing / 2 + 1.2, 0, homePosition[2] + island.rows * island.spacing / 2 + .3]

  const repositoryIslands: RepositoryIsland[] = rankedRepositories(repositories)
    .slice(0, 8)
    .map((repo) => {
      const building = progression.buildings.find((item) => item.repositoryUrl === repo.html_url)!
      return {
        ...repo,
        building,
        size: .65 + building.level * .12,
        color: languageColors[repo.language ?? ''] ?? '#8b9bb4',
        position: [
          homePosition[0] + building.position[0],
          building.position[1],
          homePosition[2] + building.position[2],
        ] as [number, number, number],
      }
    })

  return { user, languages, stars, forks, repositories: repositoryIslands, shipClass, position, homePosition, island, progression }
}
