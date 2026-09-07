import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currency, requestSystem, resolveSystem, setStatus } from './ai-registry.mjs'

const registry = {
  version: 1,
  exhibit: 'X-9',
  policyRef: 'Clause 4',
  noticeHours: 72,
  systems: [
    { id: 'ais_a', vendor: 'V', model: 'model-a', region: 'r1', status: 'approved', purposes: ['plan_synthesis', 'narrative'], attestations: { zeroRetention: true }, history: [] },
    { id: 'ais_b', vendor: 'V', model: 'model-b', region: 'r1', status: 'approved', purposes: ['narrative'], attestations: { zeroRetention: true }, history: [] },
    { id: 'ais_c', vendor: 'V', model: 'model-c', region: 'r1', status: 'revoked', purposes: ['narrative'], attestations: { zeroRetention: true }, history: [] },
    { id: 'ais_d', vendor: 'V', model: 'model-d', region: 'r1', status: 'pending', purposes: ['narrative'], noticeDueAt: '2030-01-01T00:00:00Z', attestations: { zeroRetention: true }, history: [] },
    { id: 'ais_e', vendor: 'V', model: 'model-e', region: 'r2', status: 'approved', purposes: ['narrative'], attestations: { zeroRetention: false }, history: [] },
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

test('without residency rules any region resolves', () => {
  assert.equal(resolveSystem(registry, 'model-e', 'narrative').ok, true)
})

test('residency rules refuse an out-of-region system and one without zero retention', () => {
  const withResidency = { ...registry, residency: { policyRef: 'Clause 9', allowedRegions: ['r1'], zeroRetentionRequired: true } }
  const out = resolveSystem(withResidency, 'model-e', 'narrative')
  assert.equal(out.ok, false)
  assert.match(out.reason, /hosted in r2/)
  assert.match(out.rule, /Clause 9/)
  const noZdr = { ...withResidency, residency: { ...withResidency.residency, allowedRegions: [] } }
  const r = resolveSystem(noZdr, 'model-e', 'narrative')
  assert.equal(r.ok, false)
  assert.match(r.reason, /zero-retention/)
  assert.equal(resolveSystem(withResidency, 'model-a', 'narrative').ok, true)
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

test('a pending system cannot be approved inside its notice period without a recorded override', () => {
  assert.throws(() => setStatus(registry, 'ais_d', 'approved', 'x', 'early', '2029-12-31T00:00:00Z'), /notice period/)
  const { system, overridden } = setStatus(registry, 'ais_d', 'approved', 'x', 'early', '2029-12-31T00:00:00Z', { override: true })
  assert.equal(overridden, true)
  assert.equal(system.status, 'approved')
  assert.match(system.history.at(-1).reason, /override/)
  assert.equal(system.history.at(-1).override, true)
  const after = setStatus(registry, 'ais_d', 'approved', 'x', 'on time', '2030-01-02T00:00:00Z')
  assert.equal(after.overridden, false)
})

test('requestSystem creates a pending entry with the notice clock running', () => {
  const { registry: next, system } = requestSystem(registry, { vendor: 'New Co', model: 'nc-1', purposes: ['narrative'], region: 'r1' }, 'requester', 'trial', '2026-01-01T00:00:00Z')
  assert.equal(system.status, 'pending')
  assert.equal(system.id, 'ais_new_co_06')
  assert.equal(system.noticeDueAt, '2026-01-04T00:00:00.000Z')
  assert.equal(next.version, 2)
  assert.equal(resolveSystem(next, 'nc-1', 'narrative').ok, false)
  assert.equal(registry.systems.length, 5)
})

test('requestSystem rejects incomplete and duplicate requests', () => {
  assert.throws(() => requestSystem(registry, { vendor: 'V', model: '', purposes: ['narrative'] }, 'x', 'y'))
  assert.throws(() => requestSystem(registry, { vendor: 'V', model: 'v-9', purposes: [] }, 'x', 'y'))
  assert.throws(() => requestSystem(registry, { vendor: 'V', model: 'model-a', purposes: ['narrative'] }, 'x', 'y'), /already/)
})

test('currency flags a served model that differs from the registered one', () => {
  assert.equal(currency(registry.systems[0], 'model-a').mismatch, false)
  assert.equal(currency(registry.systems[0], 'model-a-20270101').mismatch, true)
  assert.equal(currency(null, 'model-a').mismatch, false)
})
