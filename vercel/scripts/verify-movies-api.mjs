import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const expectedRoutes = [
  'app/api/client/movies/route.js',
  'app/api/client/movies/categories/route.js',
  'app/api/client/movies/continue-watching/route.js',
  'app/api/client/movies/[id]/progress/route.js',
  'app/api/client/movies/[id]/complete/route.js',
  'app/api/client/movies/[id]/favorite/route.js',
]

for (const rel of expectedRoutes) {
  const content = await readFile(path.join(root, rel), 'utf8')
  assert.ok(content.includes('export async function'), `Missing route handler export in ${rel}`)
}

const activityRoute = await readFile(path.join(root, 'app/api/client/activity/route.js'), 'utf8')
for (const eventName of [
  'movie_select',
  'movie_playback_attempt',
  'movie_playback_failed',
  'movie_progress',
  'movie_complete',
  'movie_favorite_toggle',
  'module_switch',
]) {
  assert.ok(activityRoute.includes(`"${eventName}"`), `Missing activity allowlist event: ${eventName}`)
}

console.log('movies-api: route and activity verification passed')
