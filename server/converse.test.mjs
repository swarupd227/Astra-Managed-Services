import test from 'node:test'
import assert from 'node:assert/strict'
import { CATALOGUE, DECLINED, checkTranscript, probeText, splitSuggestions, toolsForRole } from './converse.mjs'

const call = (id, name, input = {}) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name, input }] })
const result = (id, content = '{}') => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] })

test('a read-only role is shown no state-changing tool', () => {
  const names = toolsForRole(CATALOGUE, 'auditor').map((t) => t.name)
  assert.ok(names.length > 0)
  for (const n of names) assert.ok(!CATALOGUE.tools.find((t) => t.name === n).mutating, n)
})

test('approval tools need the approval pen', () => {
  const resolver = toolsForRole(CATALOGUE, 'resolver').map((t) => t.name)
  assert.ok(!resolver.includes('approve_gate'))
  assert.ok(toolsForRole(CATALOGUE, 'sdm').map((t) => t.name).includes('approve_gate'))
})

test('a consumer holds no estate tool', () => {
  const names = toolsForRole(CATALOGUE, 'consumer').map((t) => t.name)
  assert.ok(!names.includes('get_data_estate'))
  assert.ok(!names.includes('get_approvals'))
})

test('an unknown role is refused', () => {
  assert.equal(checkTranscript(CATALOGUE, 'nobody', [{ role: 'user', content: 'hi' }]).ok, false)
})

test('a call to a tool the role does not hold is refused', () => {
  const r = checkTranscript(CATALOGUE, 'resolver', [{ role: 'user', content: 'approve it' }, call('t1', 'approve_gate', { work_item_id: 'wo_1' }), result('t1')])
  assert.equal(r.ok, false)
  assert.match(r.reason, /does not hold/)
})

test('an unconfirmed state-changing result is refused', () => {
  const r = checkTranscript(CATALOGUE, 'sdm', [{ role: 'user', content: 'approve it' }, call('t1', 'approve_gate', { work_item_id: 'wo_1' }), result('t1', '{"ok":true}')])
  assert.equal(r.ok, false)
  assert.match(r.reason, /not confirmed/)
})

test('a declined result carries the fixed text, whatever the client sent', () => {
  const r = checkTranscript(CATALOGUE, 'sdm', [{ role: 'user', content: 'approve it' }, call('t1', 'approve_gate', { work_item_id: 'wo_1' }), result('t1', '{"ok":true,"approved":true}')], [{ id: 't1', decision: 'declined' }])
  assert.equal(r.ok, true)
  assert.equal(r.messages[2].content[0].content, DECLINED)
})

test('a read result needs no confirmation', () => {
  const r = checkTranscript(CATALOGUE, 'sdm', [{ role: 'user', content: 'data?' }, call('t1', 'get_data_estate'), result('t1')])
  assert.equal(r.ok, true)
})

test('a result that answers no call is refused', () => {
  const r = checkTranscript(CATALOGUE, 'sdm', [{ role: 'user', content: 'x' }, result('ghost')])
  assert.equal(r.ok, false)
})

test('the probe reads the latest user words and every tool result', () => {
  const p = probeText([{ role: 'user', content: 'first' }, call('t1', 'get_brief'), result('t1', 'retrieved text'), { role: 'user', content: 'second' }])
  assert.equal(p.user, 'second')
  assert.match(p.retrieved, /retrieved text/)
})

test('suggestions are split from the closing line', () => {
  const s = splitSuggestions('Five items are in breach.\nNext: Show the lineage | Who owns engagement_gold?')
  assert.equal(s.text, 'Five items are in breach.')
  assert.deepEqual(s.suggestions, ['Show the lineage', 'Who owns engagement_gold?'])
  assert.deepEqual(splitSuggestions('No line here.').suggestions, [])
})

test('every catalogue tool names its agent, surfaces and a schema', () => {
  for (const t of CATALOGUE.tools) {
    assert.ok(t.agent, t.name)
    assert.ok(Array.isArray(t.surfaces) && t.surfaces.length, t.name)
    assert.equal(t.input_schema.type, 'object', t.name)
    if (t.mutating) assert.ok(t.describe, `${t.name} needs a confirmation sentence`)
  }
})
