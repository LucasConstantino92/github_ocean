import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateProgression, type ProgressRepository } from './progression.js'

const user = { login: 'captain', public_repos: 1, followers: 0 }
function repositories(n: number, overrides: Partial<ProgressRepository> = {}): ProgressRepository[] {
  return Array.from({ length: n }, (_, i) => ({ name: 'project-' + i, html_url: 'https://github.com/captain/project-' + i,
    language: 'TypeScript', stargazers_count: 0, forks_count: 0, commit_count: null, updated_at: '2026-10-01T00:00:00Z', ...overrides }))
}

test('activity and recognition unlock different upgrades', () => {
  const active = calculateProgression(user, repositories(1, { commit_count: 1100 }))
  const popular = calculateProgression(user, repositories(1, { stargazers_count: 1100 }))
  assert.ok(active.ship.crew > popular.ship.crew)
  assert.equal(active.buildings.find((b) => b.id === 'campfire')?.level, 3)
  assert.equal(active.buildings.find((b) => b.id === 'fort'), undefined)
  assert.equal(popular.buildings.find((b) => b.id === 'fort')?.level, 3)
  assert.equal(popular.ship.crew, 1)
})

test('crew thresholds have exact boundaries; missing counts are not zero measurements', () => {
  for (const [commits, crew] of [[9, 1], [10, 2], [49, 2], [50, 3], [5999, 7], [6000, 8]]) {
    assert.equal(calculateProgression(user, repositories(1, { commit_count: commits })).ship.crew, crew)
  }
  const unknown = calculateProgression(user, repositories(1))
  const empty = calculateProgression(user, repositories(1, { commit_count: 0 }))
  assert.equal(unknown.measuredRepos, 0)
  assert.equal(empty.measuredRepos, 1)
  assert.equal(unknown.score, empty.score)
})

test('reordering stored repositories does not change any visual identity', () => {
  const repos = repositories(100)
  assert.deepEqual(calculateProgression(user, repos), calculateProgression({ ...user, login: 'CAPTAIN' }, [...repos].reverse()))
})

test('all highlighted projects have distinct clickable plots even at low scores', () => {
  const progress = calculateProgression({ ...user, public_repos: 100 }, repositories(100))
  const projects = progress.buildings.filter((b) => b.repositoryUrl)
  assert.equal(projects.length, 8)
  assert.equal(new Set(progress.buildings.map((b) => b.position.join(':'))).size, progress.buildings.length)
  for (const building of progress.buildings) {
    assert.ok(Math.abs(building.position[0]) + .55 < progress.island.columns * progress.island.spacing / 2)
    assert.ok(Math.abs(building.position[2]) + .55 < progress.island.rows * progress.island.spacing / 2)
  }
})

test('small, medium and large profiles grow without overflowing port spacing', () => {
  const examples = [
    calculateProgression({ ...user, public_repos: 0 }, []),
    calculateProgression({ ...user, public_repos: 12 }, repositories(12, { commit_count: 15, stargazers_count: 2 })),
    calculateProgression({ ...user, public_repos: 200, followers: 6000 }, repositories(100, { commit_count: 1000, stargazers_count: 500, forks_count: 100 })),
  ]
  assert.ok(examples[0].score < examples[1].score && examples[1].score < examples[2].score)
  assert.ok(examples[0].ship.size < examples[1].ship.size && examples[1].ship.size < examples[2].ship.size)
  assert.ok(examples[0].island.rows * examples[0].island.columns < examples[1].island.rows * examples[1].island.columns)
  assert.ok(examples[1].island.rows * examples[1].island.columns < examples[2].island.rows * examples[2].island.columns)
  for (const p of examples) {
    assert.ok(p.score <= 100 && p.island.radius < 6)
    assert.ok(p.ship.sails <= 8 && p.ship.crew <= 8)
    assert.ok(p.buildings.every((building) => building.level >= 1 && building.level <= 3))
  }
})
