import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

type GitHubRepository = { name: string; full_name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; updated_at: string }
type WorldRepository = GitHubRepository & { commit_count: number }
type WorldProfile = { user: { login: string; name: string | null; avatar_url: string; bio: string | null; public_repos: number; followers: number }; repositories: WorldRepository[]; cached: boolean }
type GitHubNeighbor = { login: string; avatar_url: string; html_url: string }
type CachedDeveloper = { expiresAt: number; value: WorldProfile & { world_position: WorldPosition } }

const app = express()
const cache = new Map<string, CachedDeveloper>()
const cacheTtlMs = 15 * 60 * 1000
const githubHeaders = { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }
const oauthStates = new Map<string, number>()
const sessions = new Map<string, { login: string; avatarUrl: string }>()
const prisma = new PrismaClient()
type WorldPosition = [number, number]
const positionHash = (value: string, salt = 0) => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0) + salt) >>> 0, 7 + salt)
async function availablePosition(login: string): Promise<WorldPosition> {
  const ports = await prisma.port.findMany({ select: { worldX: true, worldZ: true } })
  const spacing = 15
  for (let attempt = 0; attempt < 6000; attempt++) {
    const xSeed = positionHash(login, attempt * 17 + 11)
    const zSeed = positionHash(login, attempt * 29 + 23)
    const radius = 1 + (xSeed % 6)
    const angle = (zSeed % 3600) / 3600 * Math.PI * 2
    const x = Math.round((Math.cos(angle) * radius + ((xSeed >>> 8) % 3 - 1) * .28) * spacing)
    const z = Math.round((Math.sin(angle) * radius + ((zSeed >>> 12) % 3 - 1) * .28) * spacing)
    if (ports.every((port) => Math.hypot(port.worldX - x, port.worldZ - z) >= 12)) return [x, z]
  }
  throw new Error('Não foi possível reservar uma posição no oceano.')
}
async function saveDeveloper(profile: WorldProfile) {
  const { user, repositories } = profile
  const stars = repositories.reduce((sum, repository) => sum + repository.stargazers_count, 0)
  const forks = repositories.reduce((sum, repository) => sum + repository.forks_count, 0)
  const commits = repositories.reduce((sum, repository) => sum + repository.commit_count, 0)
  const languageCounts = repositories.reduce<Record<string, number>>((all, repository) => { if (repository.language) all[repository.language] = (all[repository.language] ?? 0) + 1; return all }, {})
  const islandScore = Math.log10(Math.max(commits, 1)) + Math.log10(stars + 1) * .7 + Math.log10(user.public_repos + 1) * .5
  const islandSize = Math.min(1.7, Math.max(.72, .72 + islandScore * .22))
  const islandLevel = islandScore < 1.2 ? 1 : islandScore < 2.2 ? 2 : islandScore < 3.2 ? 3 : 4
  const shipScore = user.public_repos * 2 + stars * 3 + user.followers
  const shipClass = shipScore < 15 ? 'Skiff' : shipScore < 50 ? 'Sloop' : shipScore < 150 ? 'Brigantine' : shipScore < 500 ? 'Frigate' : 'Galleon'
  const existing = await prisma.developer.findUnique({ where: { githubLogin: user.login.toLowerCase() }, include: { port: true } })
  const position = existing?.port ? [existing.port.worldX, existing.port.worldZ] as WorldPosition : await availablePosition(user.login)
  const developer = await prisma.developer.upsert({ where: { githubLogin: user.login.toLowerCase() }, create: { githubLogin: user.login.toLowerCase(), name: user.name, avatarUrl: user.avatar_url, bio: user.bio, publicRepos: user.public_repos, followers: user.followers, stars, forks, languages: languageCounts }, update: { name: user.name, avatarUrl: user.avatar_url, bio: user.bio, publicRepos: user.public_repos, followers: user.followers, stars, forks, languages: languageCounts } })
  await prisma.port.upsert({ where: { developerId: developer.id }, create: { developerId: developer.id, worldX: position[0], worldZ: position[1], islandSize, islandLevel, totalCommits: commits, shipClass }, update: { islandSize, islandLevel, totalCommits: commits, shipClass } })
  await prisma.repository.deleteMany({ where: { developerId: developer.id } })
  await prisma.repository.createMany({ data: repositories.map((repository) => ({ developerId: developer.id, githubUrl: repository.html_url, name: repository.name, fullName: repository.full_name, description: repository.description, language: repository.language, stars: repository.stargazers_count, forks: repository.forks_count, commits: repository.commit_count, updatedAt: new Date(repository.updated_at) })) })
  return position
}

async function discoverNeighbors(username: string) {
  try {
    const response = await github(`/users/${encodeURIComponent(username)}/followers?per_page=12`)
    const neighbors = await response.json() as GitHubNeighbor[]
    for (const neighbor of neighbors) {
      const login = neighbor.login.toLowerCase()
      const exists = await prisma.developer.findUnique({ where: { githubLogin: login } })
      if (exists) continue
      const position = await availablePosition(login)
      const developer = await prisma.developer.create({ data: { githubLogin: login, name: neighbor.login, avatarUrl: neighbor.avatar_url, bio: 'Explorador descoberto nas conexões públicas do GitHub.', publicRepos: 0, followers: 0, languages: {} } })
      await prisma.port.create({ data: { developerId: developer.id, worldX: position[0], worldZ: position[1], islandSize: .72, islandLevel: 1, totalCommits: 0, shipClass: 'Skiff' } })
    }
  } catch { /* Descoberta é complementar; o perfil principal continua funcionando. */ }
}

app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' }))

app.get('/api/auth/github', (_request, response) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return response.status(503).json({ message: 'Configure GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET no .env.' })
  const state = randomBytes(24).toString('hex')
  oauthStates.set(state, Date.now())
  const redirectUri = `${process.env.API_ORIGIN ?? 'http://localhost:3001'}/api/auth/callback`
  response.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read%3Auser&state=${state}`)
})

app.get('/api/auth/callback', async (request, response) => {
  const { code, state } = request.query
  if (typeof code !== 'string' || typeof state !== 'string' || !oauthStates.has(state) || Date.now() - (oauthStates.get(state) ?? 0) > 10 * 60 * 1000) return response.status(400).send('Login GitHub inválido ou expirado.')
  oauthStates.delete(state)
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }) })
    const tokenData = await tokenResponse.json() as { access_token?: string }
    if (!tokenData.access_token) throw new Error('GitHub não retornou o token.')
    const userResponse = await fetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${tokenData.access_token}` } })
    if (!userResponse.ok) throw new Error('Não foi possível ler o perfil GitHub.')
    const user = await userResponse.json() as { login: string; avatar_url: string }
    const session = randomBytes(32).toString('hex')
    sessions.set(session, { login: user.login, avatarUrl: user.avatar_url })
    response.setHeader('Set-Cookie', `github_ocean_session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`)
    response.redirect(`${process.env.WEB_ORIGIN ?? 'http://localhost:5173'}?github=${encodeURIComponent(user.login)}`)
  } catch (error) { response.status(502).send(error instanceof Error ? error.message : 'Falha ao entrar com GitHub.') }
})

app.get('/api/auth/me', (request, response) => {
  const session = request.headers.cookie?.match(/github_ocean_session=([^;]+)/)?.[1]
  const user = session ? sessions.get(session) : undefined
  response.json({ user: user ?? null })
})

app.get('/api/world', async (_request, response) => {
  const developers = await prisma.developer.findMany({ include: { port: true, repositories: true }, orderBy: { syncedAt: 'desc' }, take: 120 })
  response.json({ developers: developers.map((developer) => ({ user: { login: developer.githubLogin, name: developer.name, avatar_url: developer.avatarUrl, bio: developer.bio, public_repos: developer.publicRepos, followers: developer.followers }, repositories: developer.repositories.map((repository) => ({ name: repository.name, full_name: repository.fullName, html_url: repository.githubUrl, description: repository.description, language: repository.language, stargazers_count: repository.stars, forks_count: repository.forks, updated_at: repository.updatedAt.toISOString(), commit_count: repository.commits })), world_position: [developer.port?.worldX ?? 0, developer.port?.worldZ ?? 0] })) })
})

app.get('/api/world/chunks/:x/:z', async (request, response) => {
  const chunkSize = 88
  const x = Number(request.params.x) * chunkSize
  const z = Number(request.params.z) * chunkSize
  const ports = await prisma.port.findMany({ where: { worldX: { gte: x, lt: x + chunkSize }, worldZ: { gte: z, lt: z + chunkSize } }, include: { developer: { include: { repositories: true } } } })
  response.json({ chunk: [Number(request.params.x), Number(request.params.z)], ports: ports.map((port) => ({ login: port.developer.githubLogin, position: [port.worldX, port.worldZ], island: { size: port.islandSize, level: port.islandLevel }, repositories: port.developer.repositories.length })) })
})

async function github(path: string) {
  const response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders })
  if (!response.ok) throw new Error(response.status === 404 ? 'Usuário não encontrado.' : `GitHub respondeu ${response.status}. Configure GITHUB_TOKEN no .env para aumentar o limite.`)
  return response
}

async function getCommitCount(repository: GitHubRepository) {
  try {
    const response = await github(`/repos/${repository.full_name}/commits?per_page=1`)
    const lastPage = response.headers.get('link')?.match(/[?&]page=(\d+)>; rel="last"/)?.[1]
    return lastPage ? Number(lastPage) : 1
  } catch { return 0 }
}

app.get('/api/developers/:username', async (request, response) => {
  const username = request.params.username.replace('@', '').toLowerCase()
  const cached = cache.get(username)
  if (cached && cached.expiresAt > Date.now()) return response.json({ ...cached.value as object, cached: true })
  try {
    const [userResponse, reposResponse] = await Promise.all([github(`/users/${encodeURIComponent(username)}`), github(`/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`)])
    const user = await userResponse.json()
    const repositories = await reposResponse.json() as GitHubRepository[]
    const relevantRepositories = [...repositories].sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 8)
    const commitCounts = await Promise.all(relevantRepositories.map(async (repository) => [repository.html_url, await getCommitCount(repository)] as const))
    const commitsByUrl = new Map(commitCounts)
    const baseValue = { user, repositories: repositories.map((repository) => ({ ...repository, commit_count: commitsByUrl.get(repository.html_url) ?? 0 })), cached: false }
    const position = await saveDeveloper(baseValue)
    await discoverNeighbors(user.login)
    const value = { ...baseValue, world_position: position }
    cache.set(username, { value, expiresAt: Date.now() + cacheTtlMs })
    response.json(value)
  } catch (error) { response.status(502).json({ message: error instanceof Error ? error.message : 'Falha ao consultar o GitHub.' }) }
})

app.listen(Number(process.env.PORT ?? 3001), () => console.log('GitHub Ocean API listening on http://localhost:3001'))
