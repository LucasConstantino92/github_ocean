import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001';
const statePath = path.resolve('data', 'public-indexer.json');
const headers = { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function state() {
    try {
        return JSON.parse(await readFile(statePath, 'utf8'));
    }
    catch {
        return { since: 0 };
    }
}
async function save(next) { await mkdir(path.dirname(statePath), { recursive: true }); await writeFile(statePath, JSON.stringify(next), 'utf8'); }
async function run() {
    const delay = process.env.GITHUB_TOKEN ? 9_000 : 12 * 60_000;
    console.log(`Índice contínuo iniciado (${process.env.GITHUB_TOKEN ? 'token detectado' : 'sem token: modo econômico'}).`);
    let cursor = await state();
    while (true) {
        try {
            const usersResponse = await fetch(`https://api.github.com/users?since=${cursor.since}&per_page=100`, { headers });
            if (!usersResponse.ok)
                throw new Error(`GitHub respondeu ${usersResponse.status} ao listar usuários.`);
            const users = await usersResponse.json();
            if (!users.length) {
                await sleep(60_000);
                continue;
            }
            for (const user of users) {
                const response = await fetch(`${apiOrigin}/api/developers/${encodeURIComponent(user.login)}`);
                if (response.ok) {
                    cursor = { since: user.id };
                    await save(cursor);
                    console.log(`✓ ${user.login} · próximo ${cursor.since}`);
                }
                else
                    console.warn(`× ${user.login} · ${response.status}`);
                await sleep(delay);
            }
        }
        catch (error) {
            console.warn(error instanceof Error ? error.message : error);
            await sleep(30_000);
        }
    }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
