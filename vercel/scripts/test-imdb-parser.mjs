import assert from 'node:assert/strict'
import { normalizeImdbId, parseImdbMovieHtml } from '../lib/imdbData.js'

assert.equal(normalizeImdbId('tt39961926'), 'tt39961926')
assert.equal(normalizeImdbId('https://m.imdb.com/title/tt33051946/?ref_=x'), 'tt33051946')
assert.equal(normalizeImdbId('bad-value'), '')

const sampleHtml = `
<html><head>
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Movie",
  "name":"Demo Movie",
  "description":"A demo synopsis",
  "datePublished":"2026-02-14",
  "duration":"PT55M50S",
  "contentRating":"TV-MA",
  "genre":["Drama","Thriller"],
  "image":["https://img.example.com/poster.jpg","https://img.example.com/backdrop.jpg"],
  "aggregateRating":{"ratingValue":"5.2","ratingCount":"5219"},
  "director":[{"@type":"Person","name":"Director One"}],
  "creator":[{"@type":"Person","name":"Writer One"},{"@type":"Person","name":"Writer Two"}],
  "actor":[{"@type":"Person","name":"Star One"},{"@type":"Person","name":"Star Two"}]
}
</script>
</head><body></body></html>`

const parsed = parseImdbMovieHtml(sampleHtml, 'tt39961926')
assert.equal(parsed.imdb_id, 'tt39961926')
assert.equal(parsed.title, 'Demo Movie')
assert.equal(parsed.release_year, 2026)
assert.equal(parsed.runtime_seconds, 3350)
assert.equal(parsed.imdb_rating, 5.2)
assert.equal(parsed.imdb_votes, 5219)
assert.deepEqual(parsed.imdb_directors, ['Director One'])
assert.deepEqual(parsed.imdb_writers, ['Writer One', 'Writer Two'])
assert.deepEqual(parsed.imdb_stars, ['Star One', 'Star Two'])

console.log('imdb-parser: all assertions passed')
