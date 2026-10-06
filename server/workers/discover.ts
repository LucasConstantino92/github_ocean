import 'dotenv/config'

const since = Number(process.argv[2] ?? 0)
const limit = Math.min(Number(process.argv[3] ?? 25), 100)
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001'

async function run() {
  const usersResponse = await fetch(`https://api.github.com/users?since=${since}&per_page=${limit}`, { headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } })
  if (!usersResponse.ok) throw new Error(`GitHub respondeu ${usersResponse.status} ao descobrir usuários.`)
  const users = await usersResponse.json() as { login: string; id: number }[]
  for (const user of users) {
    const response = await fetch(`${apiOrigin}/api/developers/${encodeURIComponent(user.login)}`)
    console.log(`${response.ok ? '✓' : '×'} ${user.login}`)
  }
  console.log(`Próximo cursor: ${users.at(-1)?.id ?? since}`)
  console.log('Execute novamente com esse cursor para continuar indexando o oceano público.')
}

run().catch((error) => { console.error(error); process.exit(1) })
