import { create } from 'zustand'
import { decide, execute, runIntent, type AgentProposal, type Beat } from '@/domain/agentRuntime'
import { makeRunEffects, runOptions } from '@/domain/runEffects'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { NOW } from '@/domain/workSeed'

/* ==========================================================================
   Agent runs started from a conversation. The run's beats are the card's
   content, updated as they arrive; a plan held at a gate waits here for the
   same approve or reject a person gives on the Copilot console.
   ========================================================================== */

export interface WorkspaceRun {
  id: string
  threadId: string
  intent: string
  beats: Beat[]
  running: boolean
  gate: { proposal: AgentProposal; decision: ReturnType<typeof decide> } | null
  verdict?: 'approve' | 'reject'
}

interface RunState {
  runs: Record<string, WorkspaceRun>
}

export const useRuns = create<RunState>(() => ({ runs: {} }))

const patch = (id: string, f: (r: WorkspaceRun) => Partial<WorkspaceRun>) =>
  useRuns.setState((s) => (s.runs[id] ? { runs: { ...s.runs, [id]: { ...s.runs[id], ...f(s.runs[id]) } } } : s))

function emitter(id: string, intent: string) {
  const effects = makeRunEffects(intent)
  return (b: Beat, replaceLast?: boolean) => {
    patch(id, (r) => ({ beats: replaceLast && r.beats.length ? [...r.beats.slice(0, -1), b] : [...r.beats, b] }))
    effects(b)
  }
}

const estateNowMs = () => NOW.getTime() + useAstra.getState().clockOffsetMins * 60_000

/** Called when a gated run settles, so the conversation can say what happened. */
let settled: ((run: WorkspaceRun) => void) | null = null
export const onRunSettled = (f: (run: WorkspaceRun) => void) => { settled = f }

export async function startRun(id: string, threadId: string, intent: string, signal: AbortSignal) {
  useRuns.setState((s) => ({ runs: { ...s.runs, [id]: { id, threadId, intent, beats: [], running: true, gate: null } } }))
  const st = useAstra.getState()
  const out = await runIntent(
    intent, emitter(id, intent), signal, Object.values(st.missions), Object.values(st.work), Object.values(st.proposals), estateNowMs(), runOptions(),
  )
  patch(id, () => ({
    running: false,
    gate: out.proposal && out.decision && out.mode === 'approve_first' ? { proposal: out.proposal, decision: out.decision } : null,
  }))
  return { ...out, beats: useRuns.getState().runs[id]?.beats ?? [] }
}

/** The gate decision, exactly as the console takes it: sealed under the person's name. */
export async function decideRunGate(id: string, verdict: 'approve' | 'reject') {
  const run = useRuns.getState().runs[id]
  if (!run?.gate || run.verdict) return
  const st = useAstra.getState()
  const role = ROLE_BY_ID[st.roleId]
  const emit = emitter(id, run.intent)
  patch(id, () => ({ verdict, running: verdict === 'approve' }))

  if (verdict === 'reject') {
    const evId = st.logEvidence('decision', role.person, 'Gated action rejected by approver', { reason: 'declined at the gate in the conversation workspace' })
    emit({ t: 'rejected', text: `Rejected by ${role.person}. The work returns to the human queue; the proposal is retained and scored against the agent. Evidence ${evId}.` })
    settled?.(useRuns.getState().runs[id])
    return
  }

  const evId = st.logEvidence('approval', role.person, 'Gated action approved', {
    shown: ['plan', 'blast_radius', 'rollback', 'agent_record', 'policy'],
    actionClass: run.gate.proposal.action_class,
  })
  emit({ t: 'evidence', summary: `Approval by ${role.person} sealed — ${evId}`, kind: 'approval' })
  await execute(
    run.gate.proposal, run.gate.decision, emit, run.intent, new AbortController().signal,
    Object.values(st.work), Object.values(st.proposals), estateNowMs(),
  )
  patch(id, () => ({ running: false }))
  settled?.(useRuns.getState().runs[id])
}
