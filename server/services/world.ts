import type { PrismaClient } from '@prisma/client'
import { calculateProgression, rankedRepositories } from '../../shared/progression.js'

export type WorldPosition = [number, number]
export type GitHubRepository = { name: string; full_name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; updated_at: string }
type WorldRepository = GitHubRepository & { commit_count: number | null }
export type WorldProfile = { user: { login: string; name: string | null; avatar_url: string; bio: string | null; public_repos: number; followers: number; profile_complete?: boolean }; repositories: WorldRepository[]; cached: boolean }
type GitHubNeighbor = { login: string; avatar_url: string; html_url: string }
type CachedDeveloper = { expiresAt: number; value: WorldProfile & { world_position: WorldPosition } }
type StoredRepository = { name: string; fullName: string; githubUrl: string; description: string | null; language: string | null; stars: number; forks: number; commits: number; commitAuthor: string | null; updatedAt: Date }
type StoredDeveloper = { githubLogin: string; fullProfile: boolean; name: string | null; avatarUrl: string; bio: string | null; publicRepos: number; followers: number; port: { worldX: number; worldZ: number } | null; repositories: StoredRepository[] }

const cacheTtlMs = 15 * 60 * 1000
const positionHash = (value: string, salt = 0) => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0) + salt) >>> 0, 7 + salt)

export function createWorldService(prisma: PrismaClient) {
  const cache = new Map<string, CachedDeveloper>()
  const connectionDiscovery = new Map<string, number>()
  const githubHeaders: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'github-ocean', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }

  const fallbackPosition = (login: string): WorldPosition => {
    const seed = positionHash(login)
    const radius = 18 + seed % 52
    const angle = ((seed >>> 8) % 3600) / 3600 * Math.PI * 2
    return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]
  }

  const availablePosition = async (login: string): Promise<WorldPosition> => {
    const ports = await prisma.port.findMany({ select: { worldX: true, worldZ: true } })
    for (let attempt = 0; attempt < 6000; attempt++) {
      const xSeed = positionHash(login, attempt * 17 + 11)
      const zSeed = positionHash(login, attempt * 29 + 23)
      const radius = 1 + Math.floor(attempt / 24) + (xSeed % 6)
      const angle = (zSeed % 3600) / 3600 * Math.PI * 2
      const x = Math.round((Math.cos(angle) * radius + ((xSeed >>> 8) % 3 - 1) * .28) * 15)
      const z = Math.round((Math.sin(angle) * radius + ((zSeed >>> 12) % 3 - 1) * .28) * 15)
      if (ports.every((port) => Math.hypot(port.worldX - x, port.worldZ - z) >= 12)) return [x, z]
    }
    throw new Error('Não foi possível reservar uma posição no oceano.')
  }

  const toWorldDeveloper = (developer: StoredDeveloper) => ({
    user: { login: developer.githubLogin, name: developer.name, avatar_url: developer.avatarUrl, html_url: `https://github.com/${developer.githubLogin}`, bio: developer.bio, public_repos: developer.publicRepos, followers: developer.followers, profile_complete: developer.fullProfile },
    repositories: developer.repositories.map((repository) => ({ name: repository.name, full_name: repository.fullName, html_url: repository.githubUrl, description: repository.description, language: repository.language, stargazers_count: repository.stars, forks_count: repository.forks, updated_at: repository.updatedAt.toISOString(), commit_count: repository.commitAuthor === developer.githubLogin.toLowerCase() ? repository.commits : null })),
    world_position: [developer.port?.worldX ?? 0, developer.port?.worldZ ?? 0] as WorldPosition,
  })

  const saveDeveloper = async (profile: WorldProfile) => {
    const { user, repositories } = profile
    const stars = repositories.reduce((sum, repository) => sum + repository.stargazers_count, 0)
    const forks = repositories.reduce((sum, repository) => sum + repository.forks_count, 0)
    const progression = calculateProgression(user, repositories)
    const languages = repositories.reduce<Record<string, number>>((all, repository) => {
      if (repository.language) all[repository.language] = (all[repository.language] ?? 0) + 1
      return all
    }, {})
    const existing = await prisma.developer.findUnique({ where: { githubLogin: user.login.toLowerCase() }, include: { port: true } })
    const position = existing?.port ? [existing.port.worldX, existing.port.worldZ] as WorldPosition : await availablePosition(user.login)
    const developer = await prisma.developer.upsert({ where: { githubLogin: user.login.toLowerCase() }, create: { githubLogin: user.login.toLowerCase(), fullProfile: true, name: user.name, avatarUrl: user.avatar_url, bio: user.bio, publicRepos: user.public_repos, followers: user.followers, stars, forks, languages }, update: { fullProfile: true, name: user.name, avatarUrl: user.avatar_url, bio: user.bio, publicRepos: user.public_repos, followers: user.followers, stars, forks, languages } })
    await prisma.port.upsert({ where: { developerId: developer.id }, create: { developerId: developer.id, worldX: position[0], worldZ: position[1], islandSize: progression.island.size, islandLevel: progression.island.level, totalCommits: progression.commits, shipClass: progression.shipClass }, update: { islandSize: progression.island.size, islandLevel: progression.island.level, totalCommits: progression.commits, shipClass: progression.shipClass } })
    await prisma.$transaction([
      prisma.repository.deleteMany({ where: { developerId: developer.id } }),
      prisma.repository.createMany({ data: repositories.map((repository) => ({ developerId: developer.id, githubUrl: repository.html_url, name: repository.name, fullName: repository.full_name, description: repository.description, language: repository.language, stars: repository.stargazers_count, forks: repository.forks_count, commits: repository.commit_count ?? 0, commitAuthor: repository.commit_count === null ? null : user.login.toLowerCase(), updatedAt: new Date(repository.updated_at) })) }),
    ])
    return position
  }

  const github = async (path: string) => {
    let response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders })
    if (response.status === 401 && githubHeaders.Authorization) {
      console.warn('GITHUB_TOKEN inválido; alternando para a API pública.')
      delete githubHeaders.Authorization
      response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders })
    }
    if (!response.ok) throw new Error(response.status === 404 ? 'Usuário não encontrado.' : `GitHub respondeu ${response.status}. Configure GITHUB_TOKEN no .env para aumentar o limite.`)
    return response
  }

  const discoverConnections = async (username: string) => {
    const normalizedUsername = username.toLowerCase()
    const nextAllowedAt = connectionDiscovery.get(normalizedUsername) ?? 0
    if (nextAllowedAt > Date.now()) return 0
    connectionDiscovery.set(normalizedUsername, Date.now() + cacheTtlMs)
    try {
      const [followers, following] = await Promise.all([
        (await github(`/users/${encodeURIComponent(username)}/followers?per_page=12`)).json() as Promise<GitHubNeighbor[]>,
        (await github(`/users/${encodeURIComponent(username)}/following?per_page=12`)).json() as Promise<GitHubNeighbor[]>,
      ])
      const connections = new Map<string, GitHubNeighbor>()
      for (const neighbor of [...followers, ...following]) connections.set(neighbor.login.toLowerCase(), neighbor)
      let created = 0
      for (const neighbor of connections.values()) {
        const login = neighbor.login.toLowerCase()
        if (await prisma.developer.findUnique({ where: { githubLogin: login } })) continue
        try {
          const position = await availablePosition(login)
          const developer = await prisma.developer.create({ data: { githubLogin: login, name: neighbor.login, avatarUrl: neighbor.avatar_url, bio: 'Explorador descoberto nas conexões públicas do GitHub.', publicRepos: 0, followers: 0, languages: {} } })
          await prisma.port.create({ data: { developerId: developer.id, worldX: position[0], worldZ: position[1], islandSize: .72, islandLevel: 1, totalCommits: 0, shipClass: 'Skiff' } })
          created++
        } catch { /* Another visit can discover the same public connection concurrently. */ }
      }
      return created
    } catch {
      connectionDiscovery.delete(normalizedUsername)
      return 0
    }
  }

  const getCommitCount = async (repository: GitHubRepository, username: string): Promise<number | null> => {
    try {
      const response = await github(`/repos/${repository.full_name}/commits?author=${encodeURIComponent(username)}&per_page=1`)
      const lastPage = response.headers.get('link')?.match(/[?&]page=(\d+)>; rel="last"/)?.[1]
      return lastPage ? Number(lastPage) : (await response.json() as unknown[]).length
    } catch { return null }
  }

  const syncDeveloper = async (username: string, discover = true) => {
    const normalizedUsername = username.replace('@', '').toLowerCase()
    const cached = cache.get(normalizedUsername)
    if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true }
    const [userResponse, reposResponse] = await Promise.all([github(`/users/${encodeURIComponent(normalizedUsername)}`), github(`/users/${encodeURIComponent(normalizedUsername)}/repos?per_page=100&sort=updated`)])
    const user = await userResponse.json() as WorldProfile['user']
    user.profile_complete = true
    const repositories = await reposResponse.json() as GitHubRepository[]
    const featured = rankedRepositories(repositories.map((repo) => ({ ...repo, commit_count: null }))).slice(0, 8)
    const counts = new Map(await Promise.all(featured.map(async (repository) => [repository.html_url, await getCommitCount(repository, user.login)] as const)))
    const baseValue: WorldProfile = { user, repositories: repositories.map((repository) => ({ ...repository, commit_count: counts.get(repository.html_url) ?? null })), cached: false }
    let position: WorldPosition
    let persisted = false
    try {
      position = await saveDeveloper(baseValue)
      persisted = true
      if (discover) void discoverConnections(user.login)
    } catch { position = fallbackPosition(user.login) }
    const value = { ...baseValue, world_position: position }
    if (persisted) cache.set(normalizedUsername, { value, expiresAt: Date.now() + cacheTtlMs })
    return value
  }

  return { github, syncDeveloper, discoverConnections, toWorldDeveloper }
}
