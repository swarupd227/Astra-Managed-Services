import { AC } from './reference'
import type { Beat } from './agentRuntime'
import type { Run, RunStep } from './types'

/* ==========================================================================
   One event model.

   Addendum A §A7.2 specifies a single Run Theater that plays both live and
   historical runs. The platform had two shapes for the same thing: the durable
   `Run`/`RunStep` the simulation advances, and the `Beat` stream the Copilot
   emits while an agent works.

   `RunStep` wins — it is persisted, referenced by WorkObject.runId, and already
   carries kind, state, compensation and cost. `Beat` is demoted to what it
   actually is: a live transport that projects onto a Run. The player renders
   Runs only, so it works for a Copilot run in flight and a seeded run from
   three weeks ago without knowing the difference.
   ========================================================================== */

/** Read-only and self-healing classes are agent work; the rest mutate the estate. */
function kindFor(actionClass?: string): RunStep['kind'] {
  if (!actionClass) return 'agent'
  const rev = AC[actionClass]?.reversibility
  return rev === 'read_only' ? 'agent' : 'tool'
}

export interface ProjectOptions {
  /** Run id. Stable across re-projections of the same conversation. */
  id: string
  /** The intent that started the run, used as the fallback label. */
  utterance: string
  /** Work object this run belongs to, when it was raised from one. */
  workObjectId?: string
  /** ISO timestamp the run started. */
  startedAt: string
}

/**
 * Projects a Copilot beat stream onto the durable Run shape.
 *
 * Safe to call on a partial stream — a run in flight projects to a Run whose
 * later steps are still `pending`, which is exactly what the player needs to
 * animate. Call it again as beats arrive.
 */
export function runFromBeats(beats: Beat[], opts: ProjectOptions): Run {
  const steps: RunStep[] = []
  let tokensUsd = 0
  let state: Run['state'] = 'planned'
  let agentId: string | undefined

  const route = beats.find((b) => b.t === 'route')
  if (route && route.t === 'route') agentId = route.agent

  // 1. The reasoning that produced the plan is itself a step. It is the only
  //    place the model's thinking has to live, and the Theater streams it.
  const think = beats.find((b) => b.t === 'think')
  const finding = beats.find((b) => b.t === 'finding')
  if (think || finding) {
    steps.push({
      id: `${opts.id}_s0`,
      kind: 'agent',
      label: finding && finding.t === 'finding' ? finding.title : 'Diagnose and plan',
      agentId,
      state: finding ? 'done' : 'running',
      detail: finding && finding.t === 'finding' ? finding.detail : undefined,
      reasoning: think && think.t === 'think' ? think.text : undefined,
      actionClass: 'AC-05',
    })
  }

  // 2. A gate is a barrier in front of the plan, not a step beside it.
  const gate = beats.find((b) => b.t === 'gate')
  const approved = beats.some((b) => b.t === 'exec')
  if (gate && gate.t === 'gate') {
    steps.push({
      id: `${opts.id}_gate`,
      kind: 'gate',
      label: `Approval required — ${gate.role}`,
      state: approved ? 'done' : 'blocked',
      gate: { role: gate.role, timeoutSec: gate.timeoutSec, escalatesTo: gate.escalatesTo },
    })
  }

  // 3. The proposed plan. Execution beats fill these in by index.
  const plan = beats.find((b) => b.t === 'plan')
  if (plan && plan.t === 'plan') {
    plan.steps.forEach((s, i) => {
      const exec = beats.find((b) => b.t === 'exec' && b.stepIndex === i)
      steps.push({
        id: `${opts.id}_s${i + 1}`,
        kind: kindFor(s.ac),
        label: s.label,
        agentId,
        state: exec ? 'done' : 'pending',
        detail: exec && exec.t === 'exec' ? exec.detail : undefined,
        compensation: s.compensation,
        durationMs: exec && exec.t === 'exec' ? exec.ms : undefined,
        actionClass: s.ac,
      })
    })
  }

  // 4. Verification closes the run.
  const verify = beats.find((b) => b.t === 'verify')
  if (verify && verify.t === 'verify') {
    steps.push({
      id: `${opts.id}_verify`,
      kind: 'verify',
      label: `Verification pack — ${verify.pack}`,
      state: verify.result === 'green' ? 'done' : 'failed',
      detail: verify.probes.join(' · '),
    })
  }

  for (const b of beats) {
    if (b.t === 'cost') tokensUsd += b.usd
    if (b.t === 'policy') state = b.result.mode === 'approve_first' ? 'gated' : 'executing'
    if (b.t === 'refuse' || b.t === 'rejected') state = 'aborted'
    if (b.t === 'error') state = 'aborted'
  }

  if (verify) state = 'complete'
  else if (gate && !approved) state = 'gated'

  return {
    id: opts.id,
    workObjectId: opts.workObjectId ?? '',
    skillId: plan && plan.t === 'plan' ? plan.skill : 'none',
    steps,
    state,
    startedAt: opts.startedAt,
    tokensUsd,
  }
}
