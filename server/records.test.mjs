import test from 'node:test'
import assert from 'node:assert/strict'
import { KINDS, StaleEpoch } from './records.mjs'

/* ==========================================================================
   The generation invariant: a write may only carry records from the
   generation it read.

   These exercise the parts that need no database — the key functions that
   decide what a duplicate is, and the error that carries a stale generation
   back to the browser. The round trip through Postgres is exercised by the
   application; what matters here is that the rules themselves hold.
   ========================================================================== */

test('every register says what makes one of its rows unique', () => {
  for (const [kind, keyOf] of Object.entries(KINDS)) {
    assert.equal(typeof keyOf, 'function', `${kind} needs a key function`)
  }
})

test('a register keyed on time does not collide across two moments', () => {
  const a = KINDS.publishLog({ itemId: 'pl_x', at: '2027-02-18T09:55:00.000Z' })
  const b = KINDS.publishLog({ itemId: 'pl_x', at: '2027-02-18T10:06:00.000Z' })
  assert.notEqual(a, b, 'two gate decisions on one item must not overwrite each other')
})

test('a register keyed on identity does collide, so a retry converges', () => {
  // Funding the same finding twice is the same experiment, not two.
  const a = KINDS.experiments({ findingId: 'sec_over_retained' })
  const b = KINDS.experiments({ findingId: 'sec_over_retained' })
  assert.equal(a, b)
})

test('a stale generation carries both the one held and the one current', () => {
  const err = new StaleEpoch(3, 4)
  assert.equal(err.name, 'StaleEpoch')
  assert.equal(err.held, 3)
  assert.equal(err.current, 4)
  // The message has to name both, because the browser shows it to a person
  // whose screen is about to empty.
  assert.match(err.message, /3/)
  assert.match(err.message, /4/)
})

test('a save with no generation at all is stale, not trusted', () => {
  // The case that matters most: an older client that does not know about
  // generations must not be allowed to write over a reset by omission.
  const err = new StaleEpoch(null, 2)
  assert.equal(err.held, null)
  assert.equal(err.current, 2)
})
