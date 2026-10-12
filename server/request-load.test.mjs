import test from 'node:test'
import assert from 'node:assert/strict'
import { mapRequests, readWhen } from './request-load.mjs'

/* ==========================================================================
   Whether a dump of service requests can be read as it actually arrives.

   Both cases here are things the client's own export did, not things it
   might. The timestamp column is headed "Year" and holds Excel date serials,
   and two of its 63,349 rows repeat a reference. The second of those was
   found by Postgres refusing the load — "ON CONFLICT DO UPDATE command cannot
   affect row a second time" — which is a late and expensive place to find it.
   ========================================================================== */

const HEADER = ['Number', 'Short description', 'state', 'priority', 'Opened Location', 'Assignment Group', 'Year']
const MAP = {
  ref: 'Number', shortDescription: 'Short description', state: 'state',
  priority: 'priority', location: 'Opened Location', assignmentGroup: 'Assignment Group', openedAt: 'Year',
}
const row = (ref, text, when = '45811.811215277798') =>
  [ref, text, 'Closed', '3 - Moderate', 'Chicago', 'WW_SRVCNOW_AG_ADV_ANALYTICS_GG', when]

test('a reference the export lists twice is folded, and counted', () => {
  const { requests, folded } = mapRequests([
    HEADER,
    row('UR0118863', 'Claude AI access'),
    row('UR0057860', 'Alteryx license request'),
    row('UR0118863', 'Claude AI access'),
  ], MAP)
  assert.equal(requests.length, 2, 'one row per reference')
  assert.equal(folded, 1, 'and it says how many it folded')
  assert.deepEqual(requests.map((r) => r.ref).sort(), ['UR0057860', 'UR0118863'])
})

test('Excel date serials are read as dates', () => {
  // The column is headed "Year" and holds these. 45811.81 is mid-2025, which
  // is inside the period the extract claims to cover.
  assert.equal(readWhen('45811.811215277798'), '2025-06-03T19:28:09.000Z')
  assert.equal(readWhen('45811'), '2025-06-03T00:00:00.000Z')
})

test('an ordinary timestamp is still read', () => {
  assert.equal(readWhen('2025-06-12 19:28'), '2025-06-12T19:28:00.000Z')
  assert.equal(readWhen(''), null)
  assert.equal(readWhen('not a date'), null)
})

test('a row with no reference cannot be written and is reported', () => {
  const { requests, unreadable } = mapRequests([HEADER, row('', 'no reference on this one')], MAP)
  assert.equal(requests.length, 0)
  assert.equal(unreadable.length, 1)
})

test('a row with no readable date is kept, not refused', () => {
  // The opposite of the incident loader, deliberately: the text is the part
  // this platform acts on, so losing the row would cost more than losing its
  // place in time.
  const { requests, undated } = mapRequests([HEADER, row('UR1', 'Alteryx licence', 'not a date')], MAP)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].openedAt, null)
  assert.deepEqual(undated, ['UR1'])
})
