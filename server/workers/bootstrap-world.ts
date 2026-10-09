import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { createWorldService } from '../services/world.js'

type GitHubSearch = { items?: { login: string }[] }

const requested = Number(process.argv[2] ?? 36)
const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 60) : 36
const prisma = new PrismaClient()
const world = createWorldService(prisma)

async function run() {
  const query = encodeURIComponent('type:user followers:>=100 repos:>=5')
  const search = await (await world.github(`/search/users?q=${query}&sort=followers&order=desc&per_page=${limit}`)).json() as GitHubSearch
  const logins = (search.items ?? []).map((user) => user.login)
  const existing = new Set((await prisma.developer.findMany({ where: { githubLogin: { in: logins.map((login) => login.toLowerCase()) }, fullProfile: true }, select: { githubLogin: true } })).map((developer) => developer.githubLogin))
  const candidates = logins.filter((login) => !existing.has(login.toLowerCase()))
  if (!candidates.length) throw new Error('O GitHub não retornou perfis para a semeadura inicial.')

  console.log(`${existing.size} portos já completos foram preservados.`)
  let completed = 0
  for (const login of candidates) {
    try {
      await world.syncDeveloper(login, false)
      completed++
      console.log(`✓ ${completed}/${candidates.length} ${login}`)
    } catch (error) {
      console.warn(`× ${login}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log(`Mundo inicial concluído: ${completed} portos completos sincronizados.`)
}

run()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
