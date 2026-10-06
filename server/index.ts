import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { cookie, readCookie, sameValue, signToken, verifyToken } from './security.js'

type GitHubRepository = { name: string; full_name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; updated_at: string }
type WorldRepository = GitHubRepository & { commit_count: number }
type WorldProfile = { user: { login: string; name: string | null; avatar_url: string; bio: string | null; public_repos: number; followers: number }; repositories: WorldRepository[]; cached: boolean }
type GitHubNeighbor = { login: string; avatar_url: string; html_url: string }
type CachedDeveloper = { expiresAt: number; value: WorldProfile & { world_position: WorldPosition } }
type StoredRepository = { name: string; fullName: string; githubUrl: string; description: string | null; language: string | null; stars: number; forks: number; commits: number; updatedAt: Date }
type StoredDeveloper = { githubLogin: string; name: string | null; avatarUrl: string; bio: string | null; publicRepos: number; followers: number; port: { worldX: number; worldZ: number } | null; repositories: StoredRepository[] }
type SessionPayload = { login: string; avatarUrl: string; exp: number }
type OAuthStatePayload = { nonce: string; exp: number }
type AnalyticsEventType = 'app_opened' | 'developer_searched' | 'developer_loaded' | 'repository_opened' | 'login_started' | 'login_succeeded'

type AnalyticsEventRecord = {
  id: string
  type: string
  anonymousId?: string | null
  githubLogin?: string | null
  path?: string | null
  metadata?: unknown
  createdAt: Date
}

type IndexerStateRecord = {
  key: string
  cursor: number
  updatedAt: Date
}

type AnalyticsEventDelegate = {
  create: (args: { data: { type: string; anonymousId?: string; githubLogin?: string; path?: string; metadata?: Record<string, string | number | boolean> } }) => Promise<AnalyticsEventRecord>
  groupBy: (args: { by: string[]; where?: Record<string, unknown>; _count?: { _all: boolean } }) => Promise<Array<{ type: string; _count: { _all: number } }>>
  findMany: (args?: { where?: Record<string, unknown>; distinct?: string[]; select?: Record<string, boolean> }) => Promise<Array<Partial<AnalyticsEventRecord>>>
}

type IndexerStateDelegate = {
  upsert: (args: { where: { key: string }; create: { key: string }; update: Record<string, unknown> }) => Promise<IndexerStateRecord>
  update: (args: { where: { key: string }; data: { cursor: number } }) => Promise<IndexerStateRecord>
}

type ExtendedPrismaClient = PrismaClient & {
  analyticsEvent: AnalyticsEventDelegate
  indexerState: IndexerStateDelegate
}

const app = express()
const cache = new Map<string, CachedDeveloper>()
const cacheTtlMs = 15 * 60 * 1000
const githubHeaders: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'github-ocean', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }
const prisma = new PrismaClient() as unknown as ExtendedPrismaClient
const analyticsEventTypes = new Set<AnalyticsEventType>(['app_opened', 'developer_searched', 'developer_loaded', 'repository_opened', 'login_started', 'login_succeeded'])
type WorldPosition = [number, number]
const positionHash = (value: string, salt = 0) => [...value].reduce((result, char) => (result * 31 + char.charCodeAt(0) + salt) >>> 0, 7 + salt)
function fallbackPosition(login: string): WorldPosition {
  const seed = positionHash(login)
  const radius = 18 + seed % 52
  const angle = ((seed >>> 8) % 3600) / 3600 * Math.PI * 2
  return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]
}
async function availablePosition(login: string): Promise<WorldPosition> {
  const ports = await prisma.port.findMany({ select: { worldX: true, worldZ: true } })
  const spacing = 15
  for (let attempt = 0; attempt < 6000; attempt++) {
    const xSeed = positionHash(login, attempt * 17 + 11)
    const zSeed = positionHash(login, attempt * 29 + 23)
    // The first ports stay close together, then new discoveries expand into
    // further ocean rings. This keeps positions permanent without making the
    // indexed world end after the first few chunks.
    const radius = 1 + Math.floor(attempt / 24) + (xSeed % 6)
    const angle = (zSeed % 3600) / 3600 * Math.PI * 2
    const x = Math.round((Math.cos(angle) * radius + ((xSeed >>> 8) % 3 - 1) * .28) * spacing)
    const z = Math.round((Math.sin(angle) * radius + ((zSeed >>> 12) % 3 - 1) * .28) * spacing)
    if (ports.every((port) => Math.hypot(port.worldX - x, port.worldZ - z) >= 12)) return [x, z]
  }
  throw new Error('Não foi possível reservar uma posição no oceano.')
}

function toWorldDeveloper(developer: StoredDeveloper) {
  const repositories = [...developer.repositories]
    .sort((a, b) => b.stars - a.stars || b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8)
  return {
    user: { login: developer.githubLogin, name: developer.name, avatar_url: developer.avatarUrl, bio: developer.bio, public_repos: developer.publicRepos, followers: developer.followers },
    repositories: repositories.map((repository) => ({ name: repository.name, full_name: repository.fullName, html_url: repository.githubUrl, description: repository.description, language: repository.language, stargazers_count: repository.stars, forks_count: repository.forks, updated_at: repository.updatedAt.toISOString(), commit_count: repository.commits })),
    world_position: [developer.port?.worldX ?? 0, developer.port?.worldZ ?? 0] as WorldPosition,
  }
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

function currentSession(cookieHeader: string | undefined) {
  return verifyToken<SessionPayload>(readCookie(cookieHeader, 'github_ocean_session'))
}

async function recordEvent(type: AnalyticsEventType, details: { anonymousId?: string; githubLogin?: string; path?: string; metadata?: Record<string, string | number | boolean> } = {}) {
  try {
    await prisma.analyticsEvent.create({ data: { type, anonymousId: details.anonymousId, githubLogin: details.githubLogin?.toLowerCase(), path: details.path, metadata: details.metadata } })
  } catch (error) {
    console.warn(`Analytics indisponível para ${type}.`, error)
  }
}

app.set('trust proxy', 1)
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_request, response) => response.json({ ok: true }))

app.post('/api/analytics/events', async (request, response) => {
  const { type, anonymousId, path, metadata } = request.body as { type?: string; anonymousId?: string; path?: string; metadata?: unknown }
  if (!type || !analyticsEventTypes.has(type as AnalyticsEventType) || type.startsWith('login_')) return response.status(400).json({ message: 'Evento inválido.' })
  if (anonymousId && (typeof anonymousId !== 'string' || anonymousId.length > 80)) return response.status(400).json({ message: 'Identificador inválido.' })
  const cleanMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? Object.fromEntries(Object.entries(metadata).slice(0, 8).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => [key.slice(0, 40), typeof value === 'string' ? value.slice(0, 160) : value])) as Record<string, string | number | boolean>
    : undefined
  const session = currentSession(request.headers.cookie)
  await recordEvent(type as AnalyticsEventType, { anonymousId, githubLogin: session?.login, path: typeof path === 'string' ? path.slice(0, 200) : undefined, metadata: cleanMetadata })
  response.status(202).json({ accepted: true })
})

app.get('/api/analytics/summary', async (request, response) => {
  const secret = process.env.ANALYTICS_SECRET
  if (!secret) return response.status(503).json({ message: 'ANALYTICS_SECRET não configurado.' })
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ') || !sameValue(authorization.slice(7), secret)) return response.status(401).json({ message: 'Não autorizado.' })
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const where = { createdAt: { gte: since } }
  const [events, visitors, loggedUsers] = await Promise.all([
    prisma.analyticsEvent.groupBy({ by: ['type'], where, _count: { _all: true } }),
    prisma.analyticsEvent.findMany({ where: { ...where, anonymousId: { not: null } }, distinct: ['anonymousId'], select: { anonymousId: true } }),
    prisma.analyticsEvent.findMany({ where: { ...where, type: 'login_succeeded', githubLogin: { not: null } }, distinct: ['githubLogin'], select: { githubLogin: true } }),
  ])
  response.json({ periodDays: 30, uniqueVisitors: visitors.length, uniqueLoggedUsers: loggedUsers.length, events: Object.fromEntries(events.map((event) => [event.type, event._count?._all ?? 0])) })
})

app.get('/api/auth/github', async (request, response) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return response.status(503).json({ message: 'Configure GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET no .env.' })
  const state = signToken<OAuthStatePayload>({ nonce: randomBytes(24).toString('hex'), exp: Date.now() + 10 * 60 * 1000 })
  response.setHeader('Set-Cookie', cookie('github_ocean_oauth_state', state, 10 * 60))
  await recordEvent('login_started', { path: request.path })
  const redirectUri = `${process.env.API_ORIGIN ?? 'http://localhost:3001'}/api/auth/callback`
  response.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read%3Auser&state=${state}`)
})

app.get('/api/auth/callback', async (request, response) => {
  const { code, state } = request.query
  const stateCookie = readCookie(request.headers.cookie, 'github_ocean_oauth_state')
  if (typeof code !== 'string' || typeof state !== 'string' || !stateCookie || !sameValue(state, stateCookie) || !verifyToken<OAuthStatePayload>(state)) return response.status(400).send('Login GitHub inválido ou expirado.')
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'github-ocean' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
    })
    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string }
    if (!tokenData.access_token) {
      console.error('Erro OAuth access_token:', tokenData)
      throw new Error(tokenData.error_description ?? tokenData.error ?? 'GitHub não retornou o token.')
    }
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'github-ocean', Authorization: `Bearer ${tokenData.access_token}` },
    })
    if (!userResponse.ok) {
      const errText = await userResponse.text()
      console.error('Erro OAuth user fetch:', userResponse.status, errText)
      throw new Error(`Não foi possível ler o perfil GitHub (${userResponse.status}).`)
    }
    const user = await userResponse.json() as { login: string; avatar_url: string }
    const session = signToken<SessionPayload>({ login: user.login, avatarUrl: user.avatar_url, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })
    response.setHeader('Set-Cookie', [cookie('github_ocean_oauth_state', '', 0), cookie('github_ocean_session', session, 7 * 24 * 60 * 60)])
    await recordEvent('login_succeeded', { githubLogin: user.login, path: request.path })
    response.redirect(`${process.env.WEB_ORIGIN ?? 'http://localhost:5173'}?github=${encodeURIComponent(user.login)}`)
  } catch (error) {
    console.error('Falha ao entrar com GitHub:', error)
    response.status(502).send(error instanceof Error ? error.message : 'Falha ao entrar com GitHub.')
  }
})

app.get('/api/auth/me', (request, response) => {
  const session = currentSession(request.headers.cookie)
  response.json({ user: session ? { login: session.login, avatarUrl: session.avatarUrl } : null })
})

app.get('/api/world', async (_request, response) => {
  try {
    const developers = await prisma.developer.findMany({ include: { port: true, repositories: true }, orderBy: { syncedAt: 'desc' }, take: 120 })
    response.json({ developers: developers.map(toWorldDeveloper) })
  } catch { response.json({ developers: [], degraded: true }) }
})

app.get('/api/world/chunks/:x/:z', async (request, response) => {
  const chunkSize = 88
  const chunkX = Number(request.params.x)
  const chunkZ = Number(request.params.z)
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) return response.status(400).json({ message: 'Coordenadas de região inválidas.' })
  const x = chunkX * chunkSize
  const z = chunkZ * chunkSize
  try {
    const ports = await prisma.port.findMany({ where: { worldX: { gte: x, lt: x + chunkSize }, worldZ: { gte: z, lt: z + chunkSize } }, include: { developer: { include: { repositories: true } } } })
    response.json({ chunk: [chunkX, chunkZ], developers: ports.map((port) => toWorldDeveloper({ ...port.developer, port })) })
  } catch { response.json({ chunk: [chunkX, chunkZ], developers: [], degraded: true }) }
})

async function github(path: string) {
  let response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders })
  if (response.status === 401 && githubHeaders.Authorization) {
    console.warn('⚠️ GITHUB_TOKEN expirado ou inválido. Alternando automaticamente para modo público sem token.')
    delete githubHeaders.Authorization
    response = await fetch(`https://api.github.com${path}`, { headers: githubHeaders })
  }
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

async function syncDeveloper(username: string, discover = true) {
  const normalizedUsername = username.replace('@', '').toLowerCase()
  const cached = cache.get(normalizedUsername)
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, cached: true }
  const [userResponse, reposResponse] = await Promise.all([github(`/users/${encodeURIComponent(normalizedUsername)}`), github(`/users/${encodeURIComponent(normalizedUsername)}/repos?per_page=100&sort=updated`)])
  const user = await userResponse.json()
  const repositories = await reposResponse.json() as GitHubRepository[]
  const relevantRepositories = [...repositories].sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.updated_at) - Date.parse(a.updated_at)).slice(0, 8)
  const commitCounts = await Promise.all(relevantRepositories.map(async (repository) => [repository.html_url, await getCommitCount(repository)] as const))
  const commitsByUrl = new Map(commitCounts)
  const baseValue = { user, repositories: repositories.map((repository) => ({ ...repository, commit_count: commitsByUrl.get(repository.html_url) ?? 0 })), cached: false }
  let position: WorldPosition
  try {
    position = await saveDeveloper(baseValue)
    if (discover) void discoverNeighbors(user.login)
  } catch {
    position = fallbackPosition(user.login)
  }
  const value = { ...baseValue, world_position: position }
  cache.set(normalizedUsername, { value, expiresAt: Date.now() + cacheTtlMs })
  return value
}

app.get('/api/developers/:username', async (request, response) => {
  const username = request.params.username.replace('@', '').toLowerCase()
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) return response.status(400).json({ message: 'Nome de usuário do GitHub inválido.' })
  const session = currentSession(request.headers.cookie)
  await recordEvent('developer_searched', { githubLogin: session?.login, path: request.path, metadata: { username } })
  try {
    const value = await syncDeveloper(username)
    await recordEvent('developer_loaded', { githubLogin: session?.login, path: request.path, metadata: { username } })
    response.json(value)
  } catch (error) { response.status(502).json({ message: error instanceof Error ? error.message : 'Falha ao consultar o GitHub.' }) }
})

app.get('/api/cron/index-world', async (request, response) => {
  const secret = process.env.CRON_SECRET
  if (!secret) return response.status(503).json({ message: 'CRON_SECRET não configurado.' })
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ') || !sameValue(authorization.slice(7), secret)) return response.status(401).json({ message: 'Não autorizado.' })
  try {
    const indexerState = await prisma.indexerState.upsert({ where: { key: 'github-public-users' }, create: { key: 'github-public-users' }, update: {} })
    const usersResponse = await github(`/users?since=${indexerState.cursor}&per_page=8`)
    const users = await usersResponse.json() as { id: number; login: string }[]
    const indexed: string[] = []
    let cursor = indexerState.cursor
    for (const user of users) {
      try {
        await syncDeveloper(user.login, false)
        indexed.push(user.login)
        cursor = user.id
        await prisma.indexerState.update({ where: { key: 'github-public-users' }, data: { cursor } })
      } catch (error) {
        console.warn(`Falha ao indexar ${user.login}.`, error)
        break
      }
    }
    response.json({ indexed, cursor })
  } catch (error) {
    response.status(502).json({ message: error instanceof Error ? error.message : 'Falha no indexador.' })
  }
})

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 3001)
  app.listen(port, () => console.log(`GitHub Ocean API listening on http://localhost:${port}`))
}

export default app
