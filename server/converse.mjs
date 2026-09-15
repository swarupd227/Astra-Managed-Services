/**
 * The conversation gateway — what a role may ask the agents to do, and what
 * the orchestrator is told about its situation.
 *
 * The browser runs the tools, because the estate lives there. The gateway
 * decides which tools a role is shown, and refuses a transcript that carries
 * a call to a tool the role does not hold, or a state-changing result nobody
 * confirmed. The role id is taken from the request: there is no sign-in yet,
 * so this is enforcement against a mistaken or stale client, not against a
 * hostile one.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const CATALOGUE = JSON.parse(fs.readFileSync(path.join(HERE, 'tool-catalogue.json'), 'utf8'))

/** The fixed content of a declined confirmation. The client's own text is never trusted for it. */
export const DECLINED = 'The user chose not now. Nothing was changed.'

export function roleOf(catalogue, roleId) {
  return catalogue.roles[roleId] ?? null
}

/** A tool is held when the role holds one of its surfaces, may change things if it changes things, and may approve if it approves. */
export function holds(role, tool) {
  if (!role) return false
  if (!tool.surfaces.some((s) => role.surfaces.includes(s))) return false
  if (tool.mutating && role.readOnly) return false
  if (tool.approval && !role.canApprove) return false
  return true
}

export function toolsForRole(catalogue, roleId) {
  const role = roleOf(catalogue, roleId)
  return catalogue.tools.filter((t) => holds(role, t))
}

/**
 * Checks a transcript before it is sent to a model. Every tool call must be to
 * a tool the role holds, every result must answer a call, and a result for a
 * state-changing tool must have been confirmed or declined by the user. A
 * declined result has its content replaced with the fixed text.
 */
export function checkTranscript(catalogue, roleId, messages, confirmations = []) {
  const role = roleOf(catalogue, roleId)
  if (!role) return { ok: false, reason: `Unknown role "${roleId}".` }
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false, reason: 'The conversation is empty.' }

  const byName = Object.fromEntries(catalogue.tools.map((t) => [t.name, t]))
  const decided = new Map(confirmations.map((c) => [c.id, c.decision]))
  const calls = new Map()
  const out = []

  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') return { ok: false, reason: `Unexpected message role "${m.role}".` }
    const blocks = typeof m.content === 'string' ? null : m.content
    if (m.role === 'assistant' && blocks) {
      for (const b of blocks) {
        if (b.type !== 'tool_use') continue
        const tool = byName[b.name]
        if (!tool || !holds(role, tool)) return { ok: false, reason: `The ${roleId} role does not hold the tool "${b.name}".` }
        calls.set(b.id, tool)
      }
      out.push(m)
      continue
    }
    if (m.role === 'user' && blocks) {
      const content = []
      for (const b of blocks) {
        if (b.type !== 'tool_result') { content.push(b); continue }
        const tool = calls.get(b.tool_use_id)
        if (!tool) return { ok: false, reason: 'A tool result answers no tool call.' }
        if (tool.mutating) {
          const decision = decided.get(b.tool_use_id)
          if (!decision) return { ok: false, reason: `The result for "${tool.name}" was not confirmed by the user.` }
          if (decision === 'declined') { content.push({ type: 'tool_result', tool_use_id: b.tool_use_id, content: DECLINED }); continue }
        }
        content.push(b)
      }
      out.push({ role: 'user', content })
      continue
    }
    out.push(m)
  }
  return { ok: true, messages: out }
}

/** The text a detector should read: the user's words and every tool result, as plain values. */
export function probeText(messages) {
  const user = []
  const retrieved = []
  for (const m of messages ?? []) {
    if (m.role !== 'user') continue
    if (typeof m.content === 'string') { user.push(m.content); continue }
    for (const b of m.content ?? []) {
      if (b.type === 'text') user.push(b.text)
      if (b.type === 'tool_result') retrieved.push(typeof b.content === 'string' ? b.content : JSON.stringify(b.content))
    }
  }
  return { user: user.slice(-1).join('\n'), retrieved: retrieved.join('\n') }
}

export function conversePrompt(ctx = {}, tools = []) {
  const roster = (ctx.agents ?? []).map((a) => `- ${a.name} (${a.id}) — ${a.codename}`).join('\n')
  const owned = tools.map((t) => `- ${t.name}${t.mutating ? ' (changes things — the user confirms first)' : ''} — speaks for ${t.agent === 'astra' ? 'Astra' : t.agent}`).join('\n')
  return `You are Astra, the orchestrator of the managed service Artizent operates for ${ctx.client ?? 'the client'}. The user talks to a team of agents through you, and the agents answer through their tools.

THE USER
${ctx.person ?? 'An operator'} · ${ctx.roleTitle ?? 'role unknown'}. The tools you have are exactly the ones this role holds. If they ask for something no tool covers, say their role does not hold it.

THIS CONVERSATION
${ctx.thread ?? 'Ask Astra — the whole service'}${ctx.scope ? `\nScope: ${ctx.scope}` : ''}
Estate time: ${ctx.now ?? 'unknown'}

THE AGENTS
${roster}

THE TOOLS
${owned}

RULES — facts about your situation, not style preferences
1. Every figure, status, count, name or identifier of a record you state must come from a tool result you received after the user's latest message. You hold no knowledge of this estate except what a tool returns. If you need a fact, call the tool, even if an earlier turn read it.
2. A tool's result is shown to the user as a card beside your words. Introduce it in at most two plain sentences, under 50 words, carrying the numbers that matter and what they mean, then stop. Never restate the rows, lists or tables the card already shows. Go longer only when the user asks you to explain or compare.
   Do not announce a tool call before making it ("Let me check…"); call it, and speak once you have the result.
3. Attribute results to the agent whose tool produced them ("Custodian has five items in breach…"). You are Astra only when no single agent speaks for it.
4. Say "not measured" for anything a tool reports as unmeasured, and say which figures are declared rather than measured when the tool says so.
5. A tool marked as changing things pauses for the user's confirmation. Call it only when the user asks for that action or plainly means it. Never say it happened until its result says so. If the user declines, acknowledge it in one sentence.
6. run_agent hands an intent to the agent runtime, whose policy engine decides whether anything runs. Report the finding and the mode it decided; the decision is the engine's, not yours.
7. If a tool fails, say so with its reason and propose the next step.
8. End every reply with one final line, exactly in this form: Next: <suggestion> | <suggestion> | <suggestion>
   Give two to four suggestions, each phrased as the next thing this user would type, each something the tools can do.

VOICE
A senior engineer talking to a colleague. Plain, specific, brief. British spelling. No headings, no bullet lists unless asked, no marketing language, no exclamation, no "I'd be happy to".`
}

/** Splits the closing suggestions line off a reply. */
export function splitSuggestions(text) {
  const lines = String(text ?? '').replace(/\s+$/, '').split('\n')
  const last = lines[lines.length - 1] ?? ''
  const m = last.match(/^\s*Next:\s*(.+)$/i)
  if (!m) return { text: String(text ?? '').trim(), suggestions: [] }
  const suggestions = m[1].split('|').map((s) => s.trim()).filter(Boolean).slice(0, 4)
  return { text: lines.slice(0, -1).join('\n').trim(), suggestions }
}
