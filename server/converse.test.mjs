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

test('the client’s right over the workforce is held by the client alone', () => {
  // Capping or stopping an agent is the client's authority. A supplier role
  // must not be able to exercise it on their behalf, however senior.
  const clientRight = CATALOGUE.tools.filter((t) => t.clientRight).map((t) => t.name)
  assert.ok(clientRight.length > 0)
  for (const roleId of ['exec', 'serviceowner']) {
    const held = toolsForRole(CATALOGUE, roleId).map((t) => t.name)
    for (const n of clientRight) assert.ok(held.includes(n), `${roleId} should hold ${n}`)
  }
  for (const roleId of ['sdm', 'aieng', 'shiftlead', 'mim', 'transition', 'resolver', 'auditor', 'clientteam', 'commercial', 'consumer']) {
    const held = toolsForRole(CATALOGUE, roleId).map((t) => t.name)
    for (const n of clientRight) assert.ok(!held.includes(n), `${roleId} must not hold ${n}`)
  }
})

test('a supplier role’s call on the client’s right never reaches the model', () => {
  // The client's authority must not be exercisable by us, and a browser that
  // somehow ran it must not get its result in front of the model either.
  const r = checkTranscript(CATALOGUE, 'sdm', [
    { role: 'user', content: 'stop the agent for them' },
    call('t1', 'set_client_autonomy', { kind: 'stop', scope: 'agent', target: 'agt_remedian', reason: 'noise' }),
    result('t1', '{"recorded":"Stopped Remedian"}'),
  ])
  assert.equal(r.ok, true)
  assert.deepEqual(r.redacted, ['set_client_autonomy'])
  const flat = JSON.stringify(r.messages)
  assert.ok(!flat.includes('set_client_autonomy'))
  assert.ok(!flat.includes('Stopped Remedian'))
  assert.ok(!toolsForRole(CATALOGUE, 'sdm').some((t) => t.name === 'set_client_autonomy'), 'and it is never offered')
})

test('an unknown role is refused', () => {
  assert.equal(checkTranscript(CATALOGUE, 'nobody', [{ role: 'user', content: 'hi' }]).ok, false)
})

test('addressing an agent by name grants no authority it did not already have', () => {
  // An @ mention is a routing hint carried in the prompt. The role checks run
  // against the catalogue and never read it, so naming the agent that holds a
  // tool cannot hand that tool to a role without it. Asserted because the
  // hint is the one input to a turn that the user writes freely.
  const clientRight = CATALOGUE.tools.filter((t) => t.clientRight).map((t) => t.name)
  const r = checkTranscript(CATALOGUE, 'sdm', [
    { role: 'user', content: '@Warden stop the agent for them' },
    call('t1', clientRight[0], { kind: 'stop', scope: 'agent', target: 'agt_remedian', reason: 'noise' }),
    result('t1', '{"recorded":"Stopped Remedian"}'),
  ])
  assert.deepEqual(r.redacted, [clientRight[0]])
  assert.ok(!JSON.stringify(r.messages).includes('Stopped Remedian'))
})

test('a call to a tool the role does not hold is left out, and the conversation continues', () => {
  // The person changed role halfway through a thread. The earlier call must not
  // reach the model, and the thread must not become unusable because of it.
  const r = checkTranscript(CATALOGUE, 'resolver', [
    { role: 'user', content: 'approve it' },
    call('t1', 'approve_gate', { work_item_id: 'wo_1' }),
    result('t1', '{"approved":true}'),
    { role: 'user', content: 'what is open on the data platform?' },
  ])
  assert.equal(r.ok, true)
  assert.deepEqual(r.redacted, ['approve_gate'])
  const flat = JSON.stringify(r.messages)
  assert.ok(!flat.includes('approve_gate'), 'the call must not reach the model')
  assert.ok(!flat.includes('"approved":true'), 'nor its result')
  assert.ok(flat.includes('what is open on the data platform?'), 'the new message survives')
})

test('a role that holds the tool still sees the call', () => {
  const r = checkTranscript(CATALOGUE, 'sdm', [
    { role: 'user', content: 'what is open?' },
    call('t1', 'get_work_queue', {}),
    result('t1', '{"items":[]}'),
  ])
  assert.equal(r.ok, true)
  assert.deepEqual(r.redacted, [])
  assert.ok(JSON.stringify(r.messages).includes('get_work_queue'))
})

test('removing a call leaves no empty message and no two turns in a row', () => {
  const r = checkTranscript(CATALOGUE, 'resolver', [
    { role: 'user', content: 'approve it' },
    call('t1', 'approve_gate', { work_item_id: 'wo_1' }),
    result('t1'),
    { role: 'user', content: 'and now?' },
  ])
  assert.equal(r.ok, true)
  for (const m of r.messages) {
    if (typeof m.content !== 'string') assert.ok(m.content.length > 0, 'no message may be left with no content')
  }
  for (let i = 1; i < r.messages.length; i++) {
    assert.notEqual(r.messages[i].role, r.messages[i - 1].role, 'roles must still alternate')
  }
})

test('a tool result answering a call that never existed is still refused', () => {
  const r = checkTranscript(CATALOGUE, 'sdm', [{ role: 'user', content: 'hi' }, result('nope')])
  assert.equal(r.ok, false)
  assert.match(r.reason, /answers no tool call/)
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
