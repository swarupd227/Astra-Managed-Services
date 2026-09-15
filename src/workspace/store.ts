import { create } from 'zustand'
import { streamGateway } from '@/domain/agentRuntime'
import { AGENTS, CLIENT } from '@/domain/estate'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { NOW } from '@/domain/workSeed'
import { TOOL_BY_NAME, TOOL_VERB, agentName, describeCall } from './catalogue'
import { onRunSettled } from './runs'
import { threadDefs } from './threads'
import { EXECUTORS, ToolError } from './tools'
import type { Artifact, Source, Thread, ThreadMessage, ToolResultBlock } from './types'

/* ==========================================================================
   The conversation loop.

   The browser holds it, because the estate lives here. Each step sends the
   transcript to the gateway; whatever tools come back are run against the
   live store; their results go back in the next step. A state-changing call
   stops the loop on a confirmation until the user decides, and the gateway
   refuses a transcript whose state-changing results nobody confirmed.

   Sources and cards from every step of a turn are held until the agent's
   closing words, so a result is explained first and shown with it.
   ========================================================================== */

const MAX_STEPS = 8
const STORAGE_KEY = 'astra.threads.v1'

let seq = 0
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`

const emptyThread = (id: string): Thread => ({
  id, transcript: [], messages: [], pane: null, running: false, working: null, pending: null, confirmations: [], turn: { sources: [], artifacts: [] },
})

interface WorkspaceState {
  threads: Record<string, Thread>
  send: (threadId: string, text: string) => void
  decide: (threadId: string, messageId: string, toolUseId: string, decision: 'confirmed' | 'declined') => void
  stop: (threadId: string) => void
  openPane: (threadId: string, artifactId: string | null) => void
  clear: (threadId: string) => void
}

function load(): Record<string, Thread> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Thread>
    // A step interrupted by a reload cannot resume: its stream is gone.
    for (const t of Object.values(raw)) {
      t.running = false
      t.working = null
      t.messages = t.messages.map((m) => ({ ...m, streaming: false }))
    }
    return raw
  } catch {
    return {}
  }
}

const controllers = new Map<string, AbortController>()

export const useWorkspace = create<WorkspaceState>((set, get) => {
  const thread = (id: string) => get().threads[id] ?? emptyThread(id)
  const update = (id: string, f: (t: Thread) => Partial<Thread>) =>
    set((s) => ({ threads: { ...s.threads, [id]: { ...thread(id), ...f(thread(id)) } } }))
  const updateMessage = (id: string, messageId: string, f: (m: ThreadMessage) => Partial<ThreadMessage>) =>
    update(id, (t) => ({ messages: t.messages.map((m) => (m.id === messageId ? { ...m, ...f(m) } : m)) }))

  const context = (threadId: string) => {
    const s = useAstra.getState()
    const role = ROLE_BY_ID[s.roleId]
    const def = threadDefs(Object.values(s.missions), s.mi).find((d) => d.id === threadId)
    return {
      client: CLIENT.name,
      person: role.person,
      roleTitle: role.title,
      thread: def?.title ?? 'Ask Astra',
      scope: def?.scope,
      now: new Date(NOW.getTime() + s.clockOffsetMins * 60_000).toISOString(),
      agents: AGENTS.map((a) => ({ id: a.id, name: a.name, codename: a.codename })),
    }
  }

  async function runTool(
    threadId: string, use: { id: string; name: string; input: Record<string, unknown> }, signal: AbortSignal,
    publish: (a: Artifact) => void = () => {},
  ) {
    const tool = TOOL_BY_NAME[use.name]
    const source: Source = { tool: use.name, agent: tool?.agent ?? 'astra', ok: true }
    try {
      const exec = EXECUTORS[use.name]
      if (!exec) throw new ToolError(`The tool "${use.name}" is not available in this browser.`)
      const out = await exec(use.input ?? {}, { threadId, signal, publish })
      const result: ToolResultBlock = { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(out.payload) }
      return { result, source, artifacts: out.artifacts }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { result: { type: 'tool_result', tool_use_id: use.id, content: message, is_error: true } as ToolResultBlock, source: { ...source, ok: false, error: message }, artifacts: [] as Artifact[] }
    }
  }

  function speakerFor(sources: Source[]) {
    const agents = [...new Set(sources.filter((s) => s.ok).map((s) => s.agent))]
    return agents.length === 1 ? agents[0] : 'astra'
  }

  async function step(threadId: string, depth: number) {
    const controller = controllers.get(threadId) ?? new AbortController()
    controllers.set(threadId, controller)
    if (depth >= MAX_STEPS) {
      update(threadId, (t) => ({
        running: false, working: null,
        messages: [...t.messages, { id: uid('msg'), author: 'agent', speaker: 'astra', text: '', at: new Date().toISOString(), sources: t.turn.sources, artifacts: t.turn.artifacts, suggestions: [], notice: { tone: 'warn', text: `Stopped after ${MAX_STEPS} steps without a closing answer.` } }],
      }))
      return
    }

    const messageId = uid('msg')
    update(threadId, (t) => ({
      running: true, working: 'Astra is thinking',
      messages: [...t.messages, { id: messageId, author: 'agent', speaker: 'astra', text: '', at: new Date().toISOString(), sources: [], artifacts: [], suggestions: [], streaming: true }],
    }))

    const s = useAstra.getState()
    let text = ''
    let assistant: Record<string, unknown>[] | null = null

    try {
      for await (const ev of streamGateway({ phase: 'converse', role: s.roleId, context: context(threadId), messages: thread(threadId).transcript, confirmations: thread(threadId).confirmations }, controller.signal)) {
        if (ev.type === 'thinking') update(threadId, () => ({ working: 'Astra is thinking' }))
        else if (ev.type === 'tool_start') {
          const tool = ev.name ? TOOL_BY_NAME[ev.name] : undefined
          update(threadId, () => ({ working: tool ? `${agentName(tool.agent)} is ${TOOL_VERB[tool.name] ?? 'working'}` : 'Astra is working' }))
        } else if (ev.type === 'text') {
          text += ev.text
          updateMessage(threadId, messageId, () => ({ text: text.replace(/\n?\s*Next:[^\n]*$/i, '') }))
        } else if (ev.type === 'assistant') assistant = ev.content
        else if (ev.type === 'refuse') updateMessage(threadId, messageId, () => ({ notice: { tone: 'crit', text: ev.text, rule: ev.rule } }))
        else if (ev.type === 'incident') {
          useAstra.getState().raiseAiIncident({ class: ev.class, detector: ev.detector, summary: ev.summary, details: ev.details, consequential: ev.consequential }, { runRef: `conversation ${threadId}` })
          updateMessage(threadId, messageId, () => ({ notice: { tone: 'crit', text: ev.summary, rule: `AI Incident — ${ev.class.replace(/_/g, ' ')} (${ev.detector})` } }))
        } else if (ev.type === 'usage' && ev.mismatch && ev.system && ev.registered) {
          useAstra.getState().recordModelChange(ev.system, ev.registered, ev.model)
        } else if (ev.type === 'error') updateMessage(threadId, messageId, () => ({ notice: { tone: 'crit', text: ev.message } }))
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        updateMessage(threadId, messageId, () => ({ streaming: false, notice: { tone: 'warn', text: 'Stopped.' } }))
        update(threadId, (t) => ({ running: false, working: null, pending: null, transcript: cleanEnd(t.transcript) }))
        return
      }
      updateMessage(threadId, messageId, () => ({ notice: { tone: 'crit', text: `${(err as Error).message} The agent gateway could not be reached.` } }))
    }

    if (!assistant) {
      // The step produced nothing the model can continue from. The transcript
      // is wound back to its last clean end, so the next message is not sent
      // after an unanswered question or an orphaned tool call.
      updateMessage(threadId, messageId, () => ({ streaming: false }))
      update(threadId, (t) => ({ running: false, working: null, pending: null, transcript: cleanEnd(t.transcript) }))
      return
    }

    const blocks = assistant
    update(threadId, (t) => ({ transcript: [...t.transcript, { role: 'assistant', content: blocks }] }))

    const said = blocks.filter((b) => b.type === 'text').map((b) => String(b.text)).join('\n')
    const { body, suggestions } = splitNext(said)
    const uses = blocks.filter((b) => b.type === 'tool_use') as unknown as { id: string; name: string; input: Record<string, unknown> }[]

    if (!uses.length) {
      // The closing words: everything the turn read is shown with them.
      update(threadId, (t) => {
        const sources = t.turn.sources
        const artifacts = t.turn.artifacts
        return {
          running: false, working: null,
          pane: artifacts[0]?.id ?? t.pane,
          turn: { sources: [], artifacts: [] },
          messages: t.messages.map((m) => (m.id === messageId ? { ...m, text: body, suggestions, sources, artifacts, speaker: speakerFor(sources), streaming: false } : m)),
        }
      })
      return
    }

    // A step that only called tools leaves no bubble of its own.
    update(threadId, (t) => ({
      messages: body || t.messages.find((m) => m.id === messageId)?.notice
        ? t.messages.map((m) => (m.id === messageId ? { ...m, text: body, streaming: false } : m))
        : t.messages.filter((m) => m.id !== messageId),
    }))

    const results: ToolResultBlock[] = []
    const awaiting: string[] = []
    let confirmHost: string | null = null

    for (const use of uses) {
      const tool = TOOL_BY_NAME[use.name]
      if (tool?.mutating) {
        awaiting.push(use.id)
        if (!confirmHost) {
          confirmHost = uid('msg')
          const host = confirmHost
          update(threadId, (t) => ({ messages: [...t.messages, { id: host, author: 'agent', speaker: tool.agent, text: '', at: new Date().toISOString(), sources: [], artifacts: [], suggestions: [], confirm: [] }] }))
        }
        const host = confirmHost
        updateMessage(threadId, host, (m) => ({ confirm: [...(m.confirm ?? []), { toolUseId: use.id, tool: use.name, input: use.input ?? {}, describe: describeCall(tool, use.input ?? {}), state: 'pending' }] }))
        continue
      }
      update(threadId, () => ({ working: `${agentName(tool?.agent ?? 'astra')} is ${TOOL_VERB[use.name] ?? 'working'}` }))
      const out = await runTool(threadId, use, controller.signal, (a) => update(threadId, (t) => ({ turn: { ...t.turn, artifacts: [...t.turn.artifacts, a] } })))
      results.push(out.result)
      update(threadId, (t) => ({ turn: { sources: dedupe([...t.turn.sources, out.source]), artifacts: [...t.turn.artifacts, ...out.artifacts] } }))
    }

    if (awaiting.length) {
      update(threadId, () => ({ running: false, working: null, pending: { results, awaiting } }))
      return
    }

    update(threadId, (t) => ({ transcript: [...t.transcript, { role: 'user', content: results as unknown as Record<string, unknown>[] }] }))
    await step(threadId, depth + 1)
  }

  // A gated run approved or rejected from its card is reported in the thread
  // it was started from, by the agent that ran it.
  onRunSettled((run) => {
    const answer = [...run.beats].reverse().find((b) => b.t === 'answer')
    const rejected = run.beats.find((b) => b.t === 'rejected')
    const verify = run.beats.find((b) => b.t === 'verify')
    const route = run.beats.find((b) => b.t === 'route')
    const text = rejected && rejected.t === 'rejected'
      ? rejected.text
      : answer && answer.t === 'answer'
        ? answer.text
        : verify && verify.t === 'verify' ? `Executed; verification ${verify.result}.` : 'The run settled.'
    update(run.threadId, (t) => ({
      messages: [...t.messages, {
        id: uid('msg'), author: 'agent', speaker: route && route.t === 'route' ? route.agent : 'astra', text,
        at: new Date().toISOString(), sources: [{ tool: 'run_agent', agent: 'astra', ok: true }], artifacts: [], suggestions: [],
      }],
    }))
  })

  return {
    threads: load(),

    send: (threadId, text) => {
      const t = thread(threadId)
      if (t.running || t.pending) return
      const s = useAstra.getState()
      const person = ROLE_BY_ID[s.roleId]?.person ?? 'You'
      controllers.set(threadId, new AbortController())
      update(threadId, (x) => ({
        turn: { sources: [], artifacts: [] },
        transcript: [...x.transcript, { role: 'user', content: text }],
        messages: [...x.messages, { id: uid('msg'), author: 'user', speaker: person, text, at: new Date().toISOString(), sources: [], artifacts: [], suggestions: [] }],
      }))
      void step(threadId, 0)
    },

    decide: async (threadId, messageId, toolUseId, decision) => {
      const t = thread(threadId)
      const pending = t.pending
      if (!pending || !pending.awaiting.includes(toolUseId)) return
      const confirm = t.messages.find((m) => m.id === messageId)?.confirm?.find((c) => c.toolUseId === toolUseId)
      if (!confirm || confirm.state !== 'pending') return

      const setState = (state: 'running' | 'confirmed' | 'declined') =>
        updateMessage(threadId, messageId, (m) => ({ confirm: m.confirm?.map((c) => (c.toolUseId === toolUseId ? { ...c, state } : c)) }))

      let result: ToolResultBlock
      if (decision === 'declined') {
        setState('declined')
        result = { type: 'tool_result', tool_use_id: toolUseId, content: 'declined' }
      } else {
        setState('running')
        const controller = new AbortController()
        controllers.set(threadId, controller)
        update(threadId, () => ({ running: true, working: `${agentName(TOOL_BY_NAME[confirm.tool]?.agent ?? 'astra')} is ${TOOL_VERB[confirm.tool] ?? 'working'}` }))
        // The action's card is shown on the confirmation it answers, the moment
        // there is one: a run narrates itself there while it works.
        const attach = (a: Artifact) => {
          updateMessage(threadId, messageId, (m) => ({ artifacts: [...m.artifacts, a] }))
          update(threadId, () => ({ pane: a.id }))
        }
        const out = await runTool(threadId, { id: toolUseId, name: confirm.tool, input: confirm.input }, controller.signal, attach)
        out.artifacts.forEach(attach)
        updateMessage(threadId, messageId, (m) => ({ sources: dedupe([...m.sources, out.source]) }))
        setState('confirmed')
        result = out.result
      }

      const now = thread(threadId)
      const awaiting = (now.pending?.awaiting ?? []).filter((id) => id !== toolUseId)
      const results = [...(now.pending?.results ?? []), result]
      const confirmations = [...now.confirmations, { id: toolUseId, decision }]
      if (awaiting.length) {
        update(threadId, () => ({ pending: { results, awaiting }, confirmations, running: false, working: null }))
        return
      }
      update(threadId, (x) => ({ pending: null, confirmations, transcript: [...x.transcript, { role: 'user', content: results as unknown as Record<string, unknown>[] }] }))
      await step(threadId, 0)
    },

    stop: (threadId) => {
      controllers.get(threadId)?.abort()
      controllers.delete(threadId)
      update(threadId, () => ({ running: false, working: null }))
    },

    openPane: (threadId, artifactId) => update(threadId, () => ({ pane: artifactId })),

    clear: (threadId) => {
      controllers.get(threadId)?.abort()
      set((s) => ({ threads: { ...s.threads, [threadId]: emptyThread(threadId) } }))
    },
  }
})

/** The transcript up to its last assistant message that called no tool. */
function cleanEnd(transcript: Thread['transcript']) {
  const out = [...transcript]
  while (out.length) {
    const last = out[out.length - 1]
    const calls = Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_use')
    if (last.role === 'assistant' && !calls) break
    out.pop()
  }
  return out
}

function dedupe(sources: Source[]) {
  const seen = new Map<string, Source>()
  for (const s of sources) seen.set(s.tool, seen.has(s.tool) && !s.ok ? seen.get(s.tool)! : s)
  return [...seen.values()]
}

/** The closing suggestions line, split off the reply — the same rule the gateway documents. */
export function splitNext(text: string) {
  const lines = text.replace(/\s+$/, '').split('\n')
  const m = (lines[lines.length - 1] ?? '').match(/^\s*Next:\s*(.+)$/i)
  if (!m) return { body: text.trim(), suggestions: [] as string[] }
  return { body: lines.slice(0, -1).join('\n').trim(), suggestions: m[1].split('|').map((x) => x.trim()).filter(Boolean).slice(0, 4) }
}

// Conversations survive a reload. The transcript is kept whole, so a thread
// resumes exactly where the model left it.
useWorkspace.subscribe((s) => {
  try {
    const trimmed = Object.fromEntries(Object.entries(s.threads).map(([id, t]) => [id, { ...t, messages: t.messages.slice(-80) }]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage full or blocked: the conversation still works for this session.
  }
})

export type { ThreadMessage }
