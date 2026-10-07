import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { cookie, readCookie, sameValue, signToken, verifyToken } from './security.js'
import { createWorldService } from './services/world.js'

type Session = { login: string; avatarUrl: string; exp: number }
type OAuthState = { nonce: string; exp: number }
type EventType = 'app_opened' | 'developer_searched' | 'developer_loaded' | 'repository_opened' | 'login_started' | 'login_succeeded'
const app = express(), prisma = new PrismaClient(), world = createWorldService(prisma)
const eventTypes = new Set<EventType>(['app_opened', 'developer_searched', 'developer_loaded', 'repository_opened', 'login_started', 'login_succeeded'])
const sessionFor = (header: string | undefined) => verifyToken<Session>(readCookie(header, 'github_ocean_session'))
const metadata = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).slice(0, 8).filter(([, item]) => ['string', 'number', 'boolean'].includes(typeof item)).map(([key, item]) => [key.slice(0, 40), typeof item === 'string' ? item.slice(0, 160) : item])) as Record<string, string | number | boolean> : undefined
async function event(type: EventType, data: { anonymousId?: string; githubLogin?: string; path?: string; metadata?: Record<string, string | number | boolean> } = {}) {
  try { await prisma.analyticsEvent.create({ data: { type, anonymousId: data.anonymousId, githubLogin: data.githubLogin?.toLowerCase(), path: data.path, metadata: data.metadata } }) }
  catch (error) { console.warn(`Analytics indisponível para ${type}.`, error) }
}

app.set('trust proxy', 1)
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '16kb' }))
app.get('/api/health', (_request, response) => response.json({ ok: true }))

app.post('/api/analytics/events', async (request, response) => {
  const { type, anonymousId, path, metadata: rawMetadata } = request.body as { type?: string; anonymousId?: string; path?: string; metadata?: unknown }
  if (!type || !eventTypes.has(type as EventType) || type.startsWith('login_')) return response.status(400).json({ message: 'Evento inválido.' })
  if (anonymousId && (typeof anonymousId !== 'string' || anonymousId.length > 80)) return response.status(400).json({ message: 'Identificador inválido.' })
  await event(type as EventType, { anonymousId, githubLogin: sessionFor(request.headers.cookie)?.login, path: typeof path === 'string' ? path.slice(0, 200) : undefined, metadata: metadata(rawMetadata) })
  response.status(202).json({ accepted: true })
})
app.get('/api/analytics/summary', async (request, response) => {
  const secret = process.env.ANALYTICS_SECRET, authorization = request.headers.authorization
  if (!secret) return response.status(503).json({ message: 'ANALYTICS_SECRET não configurado.' })
  if (!authorization?.startsWith('Bearer ') || !sameValue(authorization.slice(7), secret)) return response.status(401).json({ message: 'Não autorizado.' })
  const where = { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
  const [events, visitors, loggedUsers] = await Promise.all([
    prisma.analyticsEvent.groupBy({ by: ['type'], where, _count: { _all: true } }),
    prisma.analyticsEvent.findMany({ where: { ...where, anonymousId: { not: null } }, distinct: ['anonymousId'], select: { anonymousId: true } }),
    prisma.analyticsEvent.findMany({ where: { ...where, type: 'login_succeeded', githubLogin: { not: null } }, distinct: ['githubLogin'], select: { githubLogin: true } }),
  ])
  response.json({ periodDays: 30, uniqueVisitors: visitors.length, uniqueLoggedUsers: loggedUsers.length, events: Object.fromEntries(events.map((item) => [item.type, item._count._all])) })
})

app.get('/api/auth/github', async (request, response) => {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) return response.status(503).json({ message: 'Configure GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET no .env.' })
  const state = signToken<OAuthState>({ nonce: randomBytes(24).toString('hex'), exp: Date.now() + 600_000 })
  response.setHeader('Set-Cookie', cookie('github_ocean_oauth_state', state, 600))
  await event('login_started', { path: request.path })
  const callback = `${process.env.API_ORIGIN ?? 'http://localhost:3001'}/api/auth/callback`
  response.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callback)}&scope=read%3Auser&state=${state}`)
})
app.get('/api/auth/callback', async (request, response) => {
  const { code, state } = request.query, storedState = readCookie(request.headers.cookie, 'github_ocean_oauth_state')
  if (typeof code !== 'string' || typeof state !== 'string' || !storedState || !sameValue(state, storedState) || !verifyToken<OAuthState>(state)) return response.status(400).send('Login GitHub inválido ou expirado.')
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'github-ocean' }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }) })
    const token = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string }
    if (!token.access_token) throw new Error(token.error_description ?? token.error ?? 'GitHub não retornou o token.')
    const userResponse = await fetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'github-ocean', Authorization: `Bearer ${token.access_token}` } })
    if (!userResponse.ok) throw new Error(`Não foi possível ler o perfil GitHub (${userResponse.status}).`)
    const user = await userResponse.json() as { login: string; avatar_url: string }
    const session = signToken<Session>({ login: user.login, avatarUrl: user.avatar_url, exp: Date.now() + 7 * 86_400_000 })
    response.setHeader('Set-Cookie', [cookie('github_ocean_oauth_state', '', 0), cookie('github_ocean_session', session, 7 * 86_400)])
    await event('login_succeeded', { githubLogin: user.login, path: request.path })
    response.redirect(`${process.env.WEB_ORIGIN ?? 'http://localhost:5173'}?github=${encodeURIComponent(user.login)}`)
  } catch (error) { response.status(502).send(error instanceof Error ? error.message : 'Falha ao entrar com GitHub.') }
})
app.get('/api/auth/me', (request, response) => { const session = sessionFor(request.headers.cookie); response.json({ user: session ? { login: session.login, avatarUrl: session.avatarUrl } : null }) })

app.get('/api/world', async (_request, response) => {
  try { response.json({ developers: (await prisma.developer.findMany({ include: { port: true, repositories: true }, orderBy: { syncedAt: 'desc' }, take: 120 })).map(world.toWorldDeveloper) }) }
  catch { response.json({ developers: [], degraded: true }) }
})
app.get('/api/world/chunks/:x/:z', async (request, response) => {
  const x = Number(request.params.x), z = Number(request.params.z), size = 88
  if (!Number.isInteger(x) || !Number.isInteger(z)) return response.status(400).json({ message: 'Coordenadas de região inválidas.' })
  try {
    const ports = await prisma.port.findMany({ where: { worldX: { gte: x * size, lt: (x + 1) * size }, worldZ: { gte: z * size, lt: (z + 1) * size } }, include: { developer: { include: { repositories: true } } } })
    response.json({ chunk: [x, z], developers: ports.map((port) => world.toWorldDeveloper({ ...port.developer, port })) })
  } catch { response.json({ chunk: [x, z], developers: [], degraded: true }) }
})
app.get('/api/developers/:username', async (request, response) => {
  const username = request.params.username.replace('@', '').toLowerCase()
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) return response.status(400).json({ message: 'Nome de usuário do GitHub inválido.' })
  const session = sessionFor(request.headers.cookie)
  await event('developer_searched', { githubLogin: session?.login, path: request.path, metadata: { username } })
  try { const value = await world.syncDeveloper(username); await event('developer_loaded', { githubLogin: session?.login, path: request.path, metadata: { username } }); response.json(value) }
  catch (error) { response.status(502).json({ message: error instanceof Error ? error.message : 'Falha ao consultar o GitHub.' }) }
})
app.get('/api/cron/index-world', async (request, response) => {
  const secret = process.env.CRON_SECRET, authorization = request.headers.authorization
  if (!secret) return response.status(503).json({ message: 'CRON_SECRET não configurado.' })
  if (!authorization?.startsWith('Bearer ') || !sameValue(authorization.slice(7), secret)) return response.status(401).json({ message: 'Não autorizado.' })
  try {
    const state = await prisma.indexerState.upsert({ where: { key: 'github-public-users' }, create: { key: 'github-public-users' }, update: {} })
    const users = await (await world.github(`/users?since=${state.cursor}&per_page=8`)).json() as { id: number; login: string }[]
    const indexed: string[] = []; let cursor = state.cursor
    for (const user of users) { try { await world.syncDeveloper(user.login, false); indexed.push(user.login); cursor = user.id; await prisma.indexerState.update({ where: { key: 'github-public-users' }, data: { cursor } }) } catch (error) { console.warn(`Falha ao indexar ${user.login}.`, error); break } }
    response.json({ indexed, cursor })
  } catch (error) { response.status(502).json({ message: error instanceof Error ? error.message : 'Falha no indexador.' }) }
})

if (!process.env.VERCEL) app.listen(Number(process.env.PORT ?? 3001), () => console.log(`GitHub Ocean API listening on http://localhost:${process.env.PORT ?? 3001}`))
export default app
