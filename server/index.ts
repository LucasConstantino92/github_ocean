import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

type GitHubRepository = { name: string; full_name: string; html_url: string; description: string | null; language: string | null; stargazers_count: number; forks_count: number; updated_at: string }
type CachedDeveloper = { expiresAt: number; value: unknown }

const app = express()
const cache = new Map<string, CachedDeveloper>()
const cacheTtlMs = 15 * 60 * 1000
const githubHeaders = { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }
const oauthStates = new Map<string, number>()
const sessions = new Map<string, { login: string; avatarUrl: string }>()
mkdirSync('data', { recursive: true })
const worldFile = join('data', 'world.json')
type WorldPosition = [number, number]
type StoredDeveloper = { login: string; profile: unknown; position: WorldPosition; lastSeenAt: string }
function readWorld(): StoredDeveloper[] { try { return JSON.parse(readFileSync(worldFile, 'utf8')) as StoredDeveloper[] } catch { return [] } }
function availablePosition(world: StoredDeveloper[]): WorldPosition {
  const used = new Set(world.map((developer) => `${developer.position?.[0]}:${developer.position?.[1]}`))
  for (let radius = 0; radius < 12; radius++) for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) {
    if (Math.max(Math.abs(x), Math.abs(z)) !== radius) continue
    const position: WorldPosition = [x * 22, z * 22]
    if (!used.has(`${position[0]}:${position[1]}`)) return position
  }
  return [0, 0]
}
function saveDeveloper(login: string, profile: unknown) {
  const previous = readWorld().find((developer) => developer.login === login)
  const world = readWorld().filter((developer) => developer.login !== login)
  const position = previous?.position ?? availablePosition(world)
  world.unshift({ login, profile, position, lastSeenAt: new Date().toISOString() })
  writeFileSync(worldFile, JSON.stringify(world.slice(0, 100), null, 2))
  return position
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

app.get('/api/world', (_request, response) => {
  response.json({ developers: readWorld().slice(0, 40).map((developer, index) => ({ ...developer.profile as object, world_position: developer.position ?? [index * 22, 0] })) })
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
    const position = saveDeveloper(user.login.toLowerCase(), baseValue)
    const value = { ...baseValue, world_position: position }
    cache.set(username, { value, expiresAt: Date.now() + cacheTtlMs })
    response.json(value)
  } catch (error) { response.status(502).json({ message: error instanceof Error ? error.message : 'Falha ao consultar o GitHub.' }) }
})

app.listen(Number(process.env.PORT ?? 3001), () => console.log('GitHub Ocean API listening on http://localhost:3001'))
