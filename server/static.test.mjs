import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { isImmutable, mimeFor, resolveStatic } from './static.mjs'

// Resolved, not joined: on Windows a rooted path without a drive resolves
// against the current one, and the fixture has to match what resolveStatic
// computes rather than what reads nicely here.
const DIST = path.resolve(path.join('/srv', 'app', 'dist'))
const index = path.join(DIST, 'index.html')
/** Everything exists, so only the containment rule decides. */
const all = () => true

test('a real file inside the web root is served', () => {
  const r = resolveStatic(DIST, '/assets/index-abc123.js', all)
  assert.equal(r.target, path.join(DIST, 'assets', 'index-abc123.js'))
  assert.equal(r.inside, true)
  assert.equal(r.fellBack, false)
})

test('the root and a deep link both land on index.html', () => {
  for (const url of ['/', '', '/governance/commitments', '/w/thread-1']) {
    const r = resolveStatic(DIST, url, (p) => p === index)
    assert.equal(r.target, index, url)
    assert.equal(r.inside, true, url)
  }
})

test('a request may not escape the web root', () => {
  for (const url of ['/../package.json', '/../../etc/passwd', '/assets/../../server/agent.mjs']) {
    const r = resolveStatic(DIST, url, all)
    assert.equal(r.inside, false, url)
    assert.equal(r.target, index, url)
  }
})

test('a sibling directory that merely starts with the root name is outside it', () => {
  // The bug a bare startsWith(dist) check allows: /srv/app/dist-backup/secret
  // resolves outside the web root while still carrying its prefix.
  const r = resolveStatic(DIST, '/../dist-backup/secret.json', all)
  assert.equal(r.inside, false)
  assert.equal(r.target, index)
})

test('an encoded separator cannot smuggle a segment past the check', () => {
  const r = resolveStatic(DIST, '/..%2Fpackage.json', all)
  assert.equal(r.inside, false)
  assert.equal(r.target, index)
})

test('an asset whose name carries an encoded space resolves to the real file', () => {
  const wanted = path.join(DIST, 'assets', 'brand mark.svg')
  const r = resolveStatic(DIST, '/assets/brand%20mark.svg', (p) => p === wanted)
  assert.equal(r.target, wanted)
  assert.equal(r.found, true)
})

test('a malformed escape falls back without pretending to be an escape attempt', () => {
  const r = resolveStatic(DIST, '/assets/%ZZ.js', all)
  assert.equal(r.malformed, true)
  assert.equal(r.inside, true)
  assert.equal(r.target, index)
})

test('a query string or fragment is not part of the path', () => {
  const r = resolveStatic(DIST, '/assets/app.css?v=2#top', all)
  assert.equal(r.target, path.join(DIST, 'assets', 'app.css'))
})

test('a path inside the root that does not exist falls back without being an escape', () => {
  const r = resolveStatic(DIST, '/assets/missing.js', (p) => p === index)
  assert.equal(r.inside, true)
  assert.equal(r.found, false)
  assert.equal(r.target, index)
})

test('content types and immutable caching follow the built layout', () => {
  assert.equal(mimeFor(path.join(DIST, 'index.html')), 'text/html; charset=utf-8')
  assert.equal(mimeFor(path.join(DIST, 'assets', 'a.js')), 'text/javascript; charset=utf-8')
  assert.equal(mimeFor(path.join(DIST, 'a.bin')), 'application/octet-stream')
  assert.equal(isImmutable(path.join(DIST, 'assets', 'a.js')), true)
  assert.equal(isImmutable(index), false)
})
