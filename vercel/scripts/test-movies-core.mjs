import assert from 'node:assert/strict'
import {
  computeProgressPercent,
  deriveWatchState,
  isContinuePosition,
  isWatchedProgress,
  normalizeMovieId,
  normalizeProgressInput,
  normalizeSeconds,
} from '../lib/movieProgress.js'

assert.equal(normalizeSeconds(-3), 0)
assert.equal(normalizeSeconds(12.9), 12)

assert.equal(computeProgressPercent(0, 100), 0)
assert.equal(computeProgressPercent(30, 100), 30)
assert.equal(computeProgressPercent(100, 0), 0)

assert.equal(isContinuePosition(29), false)
assert.equal(isContinuePosition(30), true)

assert.equal(isWatchedProgress(94.99), false)
assert.equal(isWatchedProgress(95), true)

assert.equal(deriveWatchState({ positionSeconds: 0, progressPercent: 0 }), 'new')
assert.equal(deriveWatchState({ positionSeconds: 35, progressPercent: 10 }), 'continue')
assert.equal(deriveWatchState({ positionSeconds: 10, progressPercent: 95 }), 'watched')

assert.equal(normalizeMovieId('abc'), 0)
assert.equal(normalizeMovieId('17'), 17)

const normalized = normalizeProgressInput({ position_seconds: 145, duration_seconds: 200 })
assert.equal(normalized.positionSeconds, 145)
assert.equal(normalized.durationSeconds, 200)
assert.equal(normalized.progressPercent, 72.5)
assert.equal(normalized.isCompleted, false)

console.log('movies-core: all assertions passed')
