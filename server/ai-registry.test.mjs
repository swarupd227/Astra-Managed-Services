import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currency, resolveSystem, setStatus } from './ai-registry.mjs'

const registry = {
  version: 1,
  exhibit: 'X-9',
  policyRef: 'Clause 4',
  systems: [
    { id: 'ais_a', vendor: 'V', model: 'model-a', status: 'approved', purposes: ['plan_synthesis', 'narrative'], history: [] },
    { id: 'ais_b', vendor: 'V', model: 'model-b', status: 'approved', purposes: ['narrative'], history: [] },
    { id: 'ais_c', vendor: 'V', model: 'model-c', status: 'revoked', purposes: ['narrative'], history: [] },
    { id: 'ais_d', vendor: 'V', model: 'model-d', status: 'pending', purposes: ['narrative'], noticeDueAt: '2030-01-01T00:00:00Z', history: [] },
  ],
}

test('an approved system resolves for an approved purpose', () => {
  const r = resolveSystem(registry, 'model-a', 'plan_synthesis')
  assert.equal(r.ok, true)
  assert.equal(r.system.id, 'ais_a')
})

test('a system may be addressed by registry id', () => {
  assert.equal(resolveSystem(registry, 'ais_a', 'narrative').ok, true)
})

test('an unknown model is refused and the refusal names the exhibit', () => {
  const r = resolveSystem(registry, 'model-z', 'plan_synthesis')
  assert.equal(r.ok, false)
  assert.match(r.reason, /Exhibit X-9/)
  assert.match(r.rule, /Clause 4/)
})

test('a revoked system is refused even for a purpose it once had', () => {
  const r = resolveSystem(registry, 'model-c', 'narrative')
  assert.equal(r.ok, false)
  assert.match(r.reason, /revoked/)
})

test('a pending system is refused and the refusal carries the notice deadline', () => {
  const r = resolveSystem(registry, 'model-d', 'narrative')
  assert.equal(r.ok, false)
  assert.match(r.reason, /2030-01-01/)
})

test('approval is per purpose', () => {
  const r = resolveSystem(registry, 'model-b', 'plan_synthesis')
  assert.equal(r.ok, false)
  assert.match(r.reason, /not for plan_synthesis/)
})

test('setStatus records history and bumps the registry version without mutating the input', () => {
  const { registry: next, from } = setStatus(registry, 'ais_a', 'revoked', 'auditor', 'test', '2026-01-01T00:00:00Z')
  assert.equal(from, 'approved')
  assert.equal(next.version, 2)
  assert.equal(next.systems.find((s) => s.id === 'ais_a').status, 'revoked')
  assert.equal(next.systems.find((s) => s.id === 'ais_a').history.length, 1)
  assert.equal(registry.systems.find((s) => s.id === 'ais_a').status, 'approved')
  assert.equal(resolveSystem(next, 'model-a', 'plan_synthesis').ok, false)
})

test('setStatus rejects unknown statuses and systems', () => {
  assert.throws(() => setStatus(registry, 'ais_a', 'blessed', 'x', 'y'))
  assert.throws(() => setStatus(registry, 'ais_nope', 'approved', 'x', 'y'))
})

test('currency flags a served model that differs from the registered one', () => {
  assert.equal(currency(registry.systems[0], 'model-a').mismatch, false)
  assert.equal(currency(registry.systems[0], 'model-a-20270101').mismatch, true)
  assert.equal(currency(null, 'model-a').mismatch, false)
})
