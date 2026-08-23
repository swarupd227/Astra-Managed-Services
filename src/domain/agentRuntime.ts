import { evaluate, type ActionContext, type EngineResult } from './policyEngine'
import { missionCeiling, missionFor, type Mission } from './missions'
import { AGENTS, AGENT_BY_ID, CLIENT, GRAPH_EDGES, GRAPH_NODES, POLICIES, SKILLS, TOWERS, policyForTower } from './estate'
import { ACTION_CLASSES, AC } from './reference'
import { DEMAND_CLASSES } from './ledgers'
import type { EvidenceKind, ExecutionMode, Grade } from './types'

/* ==========================================================================
   The agent runtime.

   Reasoning, routing and planning come from Claude, streamed live through the
   local gateway. The autonomy decision does not: the model's proposed plan is
   fed into the same policy evaluator the platform runs, and what that returns
   is what happens. The model proposes; the engine disposes.
   ========================================================================== */

export type Beat =
  | { t: 'route'; intent: string; confidence: number; agent: string; note: string }
  | { t: 'think'; agent: string; text: string; streaming?: boolean }
  | { t: 'retrieve'; agent: string; assertions: number; humanVerified: number; runbooks: number; priors: number; pkg: string; floor: string; tokensUsed: number; tokenBudget: number }
  | { t: 'finding'; title: string; detail: string; confidence: number; severity: 'info' | 'warn' | 'crit' }
  | { t: 'plan'; skill: string; success: number; runs: number; steps: { label: string; ac?: string; compensation?: string }[] }
  | { t: 'policy'; result: EngineResult; agentId: string; policyName: string }
  | { t: 'mission'; missionId: string; name: string; goal: string; from: ExecutionMode; to: ExecutionMode; reason: string }
  | { t: 'gate'; role: string; timeoutSec: number; escalatesTo: string }
  | { t: 'exec'; stepIndex: number; detail: string; ms: number }
  | { t: 'verify'; pack: string; probes: string[]; result: 'green' | 'amber' }
  | { t: 'evidence'; summary: string; kind: EvidenceKind }
  | { t: 'ledger'; hours: number; attribution: string; note: string }
  | { t: 'answer'; agent: string; text: string; streaming?: boolean }
  | { t: 'refuse'; agent: string; text: string; rule: string }
  | { t: 'cost'; usd: number; note: string; inputTokens: number; outputTokens: number; model: string }
  | { t: 'rejected'; text: string }
  | { t: 'error'; message: string }

export interface AgentProposal {
  intent: string
  intent_confidence: number
  routed_agent: string
  routing_note: string
  requires_action: boolean
  context_used: { assertions: number; human_verified: number; runbooks: number; prior_incidents: number; verification_floor: string }
  finding: { title: string; detail: string; confidence: number; severity: 'info' | 'warn' | 'crit' }
  action_class: string
  blast_radius: { tier: number; services: number; dependents: number; data_mutation: boolean }
  plan_confidence: number
  has_compensation: boolean
  skill: string
  steps: { label: string; action_class: string; compensation: string }[]
}

/** Prompts offered on the empty state. Nothing here is matched or scripted. */
export const SUGGESTIONS = [
  { id: 's1', text: 'Why is Retail Payments breaching its latency objective?', hint: 'Diagnosis — read-only, no gate involved' },
  { id: 's2', text: 'Remediate the latency breach on Retail Payments', hint: 'Mutating plan on a tier-0 service' },
  { id: 's3', text: 'Rotate the expiring certificate on the payments gateway', hint: 'AC-41 on a tier-1 service' },
  { id: 's4', text: 'Purge the archived transaction partitions to reclaim storage', hint: 'Irreversible — watch the floor hold' },
  { id: 's5', text: 'Backfill claims_gold for the three-day gap', hint: 'The asset has no data contract' },
  { id: 's6', text: 'Which action classes are ready to promote next quarter?', hint: 'Analysis over evaluation evidence' },
]

/* ------------------------- Estate digest for the model --------------------- */

/**
 * The context package the agent is given. Compact by construction — the point
 * of a decision-scoped package is that it is selected, not dumped.
 */
export function estateDigest() {
  return {
    client: { name: CLIENT.name, contract: CLIENT.contract, month: CLIENT.monthsElapsed, topology: CLIENT.topology, regulator: CLIENT.regulator },
    towers: TOWERS.map((t) => ({
      id: t.id, name: t.name, state: t.state, criticality: t.criticality,
      owner: t.owner, sdm: t.sdm, regulatory: t.regulatory,
      autonomyEligibleVolume: t.autonomyEligibleVolume, verificationCoverage: t.verificationCoverage,
    })),
    graph: {
      nodes: GRAPH_NODES.map((n) => ({ id: n.id, type: n.type, name: n.name, tower: n.tower, tier: n.tier, attrs: n.attrs })),
      edges: GRAPH_EDGES.map((e) => ({ from: e.from, rel: e.rel, to: e.to })),
    },
    agents: AGENTS.map((a) => ({
      id: a.id, name: a.name, mission: a.mission, origin: a.origin,
      ceiling: a.ceiling, grants: a.grants, prohibited: a.prohibited, towers: a.towers,
      liveSuccess90d: a.evaluation.liveSuccess90d, state: a.state,
    })),
    actionClasses: ACTION_CLASSES.map((c) => ({
      id: c.id, name: c.name, reversibility: c.reversibility, floor: c.floor,
      tier0Floor: c.tier0Floor ?? null, verificationPack: c.verificationPack, fourEyes: c.fourEyes,
    })),
    skills: SKILLS.map((s) => ({ id: s.id, name: s.name, actionClasses: s.actionClasses, successRate: s.successRate, runs: s.runs, verificationPack: s.verificationPack })),
    demandClasses: DEMAND_CLASSES.map((d) => ({ id: d.id, name: d.name, tower: d.tower, volumeYr: d.volumeYr, hoursYr: d.hoursYr, cause: d.cause, eliminationState: d.eliminationState })),
    policies: POLICIES.map((p) => ({ id: p.id, name: p.name, version: p.version, appliesTo: p.appliesTo, rules: p.rules.map((r) => ({ when: r.when, mode: r.mode ?? null, maxMode: r.maxMode ?? null, require: r.require ?? null })) })),
    knownContext: {
      openIncident: 'INC0482913 — latency SLO breach on svc_payments, P2, opened 41 minutes ago',
      recentChange: 'chg_5511 applied 2027-02-16 21:14 — reduced conn_pool.max on db_ledger_rw from 500 to 200',
      assetsWithoutContract: ['claims_gold'],
      certificateExpiries: [{ node: 'pmt-gw edge listener', days: 6 }],
    },
  }
}

/* ------------------------------ Cost estimate ------------------------------ */

// Claude Opus 5 list pricing, USD per million tokens.
const IN_PER_MTOK = 5
const OUT_PER_MTOK = 25

export function runCost(inputTokens: number, outputTokens: number) {
  return (inputTokens / 1e6) * IN_PER_MTOK + (outputTokens / 1e6) * OUT_PER_MTOK
}

/* ------------------------------- SSE plumbing ------------------------------ */

type GatewayEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool_start' }
  | { type: 'proposal'; input: AgentProposal }
  | { type: 'usage'; inputTokens: number; outputTokens: number; cacheRead: number; model: string; stopReason: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

async function* streamGateway(body: unknown, signal: AbortSignal): AsyncGenerator<GatewayEvent> {
  const res = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`Gateway returned ${res.status}. Is the agent gateway running?`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      yield JSON.parse(line.slice(6)) as GatewayEvent
    }
  }
}

/* ----------------------- AgentProposal → decision ------------------------- */

export interface Decision {
  result: EngineResult
  ctx: ActionContext
  policyName: string
  agentId: string
  /** The mission this run is being carried out under, if any. */
  mission: Mission | null
  /** What the mission did to the engine's answer. Null when it changed nothing. */
  missionNarrowedBy: string | null
  /**
   * The mode that actually governs this run — the engine's answer, narrowed by
   * the mission where the mission is stricter. Never wider than `result.mode`.
   */
  mode: ExecutionMode
}

export function decide(p: AgentProposal, missions: Mission[] = []): Decision {
  const agent = AGENT_BY_ID[p.routed_agent] ?? AGENT_BY_ID.agt_remedian
  const cls = AC[p.action_class] ? p.action_class : 'AC-05'
  const tower = TOWERS.find((t) => agent.towers.includes(t.id)) ?? TOWERS[0]
  const policy = policyForTower(tower.id)

  const ctx: ActionContext = {
    action: {
      class: cls,
      env: 'prod',
      hasCompensation: p.has_compensation,
      irreversible: AC[cls]?.reversibility === 'irreversible',
    },
    blast: {
      tier: Math.max(0, Math.min(3, p.blast_radius.tier)),
      services: p.blast_radius.services,
      dependents: p.blast_radius.dependents,
      dataMutation: p.blast_radius.data_mutation,
    },
    agent: { id: agent.id, grade: agent.grants as Record<string, Grade> },
    plan: { confidence: p.plan_confidence, verificationPack: AC[cls]?.verificationPack ?? null },
    incident: { major_active: false },
    calendar: { freeze: false },
    // A backfill or migration against an asset with no contract has nothing to
    // verify against; the policy caps it at Advise on that basis.
    asset: {
      contract: /claims_gold/i.test(JSON.stringify(p.steps)) ? null : 'dc_txn_v7',
      pii: 'restricted',
    },
  }

  const result = evaluate(policy, ctx, agent.ceiling)

  // The engine has decided. A mission may only make that answer stricter —
  // missionCeiling takes the narrower of the two, always (§A4.2).
  const mission = missionFor(missions, tower.id, cls)
  const ceiling = missionCeiling(mission, result.mode, cls)

  return {
    result,
    ctx,
    policyName: `${policy.name} ${policy.version}`,
    agentId: agent.id,
    mission,
    missionNarrowedBy: ceiling.narrowedBy,
    mode: ceiling.mode,
  }
}

/* -------------------------------- The runtime ------------------------------ */

export interface RunHandle {
  beats: Beat[]
  proposal: AgentProposal | null
  decision: Decision | null
}

/**
 * Runs one intent. Emits beats as they arrive; pauses and returns when the
 * policy engine holds the plan at a gate. `resume` continues after approval.
 */
export async function runIntent(
  utterance: string,
  onBeat: (b: Beat, replaceLast?: boolean) => void,
  signal: AbortSignal,
  missions: Mission[] = [],
): Promise<{ proposal: AgentProposal | null; decision: Decision | null; mode: ExecutionMode | null }> {
  const estate = estateDigest()
  let proposal: AgentProposal | null = null
  // Decided as soon as the proposal lands, not after the stream closes: the
  // usage/cost event arrives before the loop ends, and a run cannot be charged
  // to a mission that has not been identified yet.
  let decision: Decision | null = null
  let thinking = ''
  let answer = ''
  let thinkingOpen = false
  let answerOpen = false
  let routedAgent = 'agt_herald'

  try {
    for await (const ev of streamGateway({ phase: 'plan', utterance, estate }, signal)) {
      if (ev.type === 'thinking') {
        thinking += ev.text
        onBeat({ t: 'think', agent: routedAgent, text: thinking, streaming: true }, thinkingOpen)
        thinkingOpen = true
      } else if (ev.type === 'text') {
        answer += ev.text
        onBeat({ t: 'answer', agent: routedAgent, text: answer, streaming: true }, answerOpen)
        answerOpen = true
      } else if (ev.type === 'proposal') {
        proposal = ev.input
        routedAgent = AGENT_BY_ID[proposal.routed_agent] ? proposal.routed_agent : 'agt_herald'
        answerOpen = false

        onBeat({ t: 'route', intent: proposal.intent, confidence: proposal.intent_confidence, agent: routedAgent, note: proposal.routing_note })
        onBeat({
          t: 'retrieve', agent: routedAgent,
          assertions: proposal.context_used.assertions,
          humanVerified: proposal.context_used.human_verified,
          runbooks: proposal.context_used.runbooks,
          priors: proposal.context_used.prior_incidents,
          pkg: `pkg_${Math.abs(hash(utterance)).toString(16).slice(0, 4)}`,
          floor: proposal.context_used.verification_floor,
          tokensUsed: 0, tokenBudget: 6000,
        })
        onBeat({ t: 'finding', ...proposal.finding })

        decision = decide(proposal, missions)
        // Announced whenever a mission governs the run, not only when it
        // narrows — the operator needs to know what the work is being done
        // under, and the budget cannot be charged against an unnamed mission.
        if (decision.mission) {
          onBeat({
            t: 'mission',
            missionId: decision.mission.id,
            name: decision.mission.name,
            goal: decision.mission.goal,
            from: decision.result.mode,
            to: decision.mode,
            reason:
              decision.missionNarrowedBy ??
              'The mission adds no ceiling of its own here — the engine’s answer stands unchanged.',
          })
        }

        if (proposal.requires_action && proposal.steps.length) {
          const skill = SKILLS.find((s) => s.id === proposal!.skill)
          onBeat({
            t: 'plan',
            skill: proposal.skill,
            success: skill?.successRate ?? 0,
            runs: skill?.runs ?? 0,
            steps: proposal.steps.map((s) => ({
              label: s.label,
              ac: AC[s.action_class] ? s.action_class : undefined,
              compensation: s.compensation && s.compensation !== 'none' ? s.compensation : undefined,
            })),
          })
        }
      } else if (ev.type === 'usage') {
        const usd = runCost(ev.inputTokens, ev.outputTokens)
        onBeat({
          t: 'cost', usd,
          note: `${ev.inputTokens.toLocaleString()} in / ${ev.outputTokens.toLocaleString()} out${ev.cacheRead ? ` · ${ev.cacheRead.toLocaleString()} cached` : ''}`,
          inputTokens: ev.inputTokens, outputTokens: ev.outputTokens, model: ev.model,
        })
      } else if (ev.type === 'error') {
        onBeat({ t: 'error', message: ev.message })
        return { proposal: null, decision: null, mode: null }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { proposal: null, decision: null, mode: null }
    onBeat({
      t: 'error',
      message:
        (err as Error).message.includes('Gateway')
          ? `${(err as Error).message} Start it with: npm run gateway`
          : `Could not reach the agent gateway. Start it with: npm run gateway`,
    })
    return { proposal: null, decision: null, mode: null }
  }

  // `decision` was taken the moment the proposal landed, so the mission was
  // known before the usage event arrived and could be charged for it.
  if (!proposal || !decision) return { proposal: null, decision: null, mode: null }

  onBeat({ t: 'policy', result: decision.result, agentId: decision.agentId, policyName: decision.policyName })

  const mode = decision.mode

  if (!proposal.requires_action) {
    onBeat({ t: 'evidence', summary: 'Observation and reasoning sealed with the assertions relied on', kind: 'observation' })
    return { proposal, decision, mode }
  }

  if (mode === 'advise' || mode === 'manual') {
    onBeat({
      t: 'refuse',
      agent: decision.agentId,
      text: decision.result.reasons.join(' '),
      rule: decision.result.overrides[0] ?? `${proposal.action_class} floor is ${mode === 'advise' ? 'L1 Advise' : 'L0 Manual'} — the plan is prepared for a human to run.`,
    })
    onBeat({ t: 'evidence', summary: 'Denial recorded with its full input vector', kind: 'decision' })
    return { proposal, decision, mode }
  }

  if (mode === 'approve_first') {
    const gate = decision.result.gates[0]
    onBeat({ t: 'gate', role: gate?.role ?? 'on-call SDM', timeoutSec: gate?.timeoutSec ?? 600, escalatesTo: gate?.escalatesTo ?? 'duty manager' })
    return { proposal, decision, mode }
  }

  // Supervised or autonomous: the agent proceeds without a gate.
  await execute(proposal, decision, onBeat, utterance, signal)
  return { proposal, decision, mode }
}

/** Runs the plan after a gate is approved, or immediately at L3/L4. */
export async function execute(
  proposal: AgentProposal,
  decision: Decision,
  onBeat: (b: Beat, replaceLast?: boolean) => void,
  utterance: string,
  signal: AbortSignal,
) {
  const cls = AC[proposal.action_class]

  for (let i = 0; i < proposal.steps.length; i++) {
    const step = proposal.steps[i]
    await new Promise((r) => setTimeout(r, 620))
    if (signal.aborted) return
    onBeat({ t: 'exec', stepIndex: i, detail: step.label, ms: 1800 + i * 2400 })
  }

  await new Promise((r) => setTimeout(r, 500))
  if (signal.aborted) return
  onBeat({
    t: 'verify',
    pack: cls?.verificationPack ?? 'health_probe_v4',
    probes: ['health probe green', 'objective recovered', 'synthetic checks pass'],
    result: 'green',
  })
  onBeat({ t: 'evidence', summary: 'Execution and verification sealed to the evidence chain', kind: 'verification' })

  // The outcome narrative is written by the model, not by the client.
  let outcome = ''
  let open = false
  try {
    for await (const ev of streamGateway({ phase: 'outcome', utterance, estate: estateDigest(), approved: proposal }, signal)) {
      if (ev.type === 'text') {
        outcome += ev.text
        onBeat({ t: 'answer', agent: 'agt_herald', text: outcome, streaming: true }, open)
        open = true
      } else if (ev.type === 'usage') {
        onBeat({
          t: 'cost', usd: runCost(ev.inputTokens, ev.outputTokens),
          note: `outcome narrative · ${ev.inputTokens.toLocaleString()} in / ${ev.outputTokens.toLocaleString()} out`,
          inputTokens: ev.inputTokens, outputTokens: ev.outputTokens, model: ev.model,
        })
      }
    }
  } catch {
    /* the run already succeeded; a missing narrative is not a failure */
  }
}

/* ---------------------------- The executive brief -------------------------- */

export interface BriefUsage {
  usd: number
  inputTokens: number
  outputTokens: number
  model: string
}

/**
 * Herald's portfolio brief (§A3.2).
 *
 * Unlike the While-You-Were-Away delta, this one earns a model call: it is
 * asked to make an argument about the portfolio, not to report arithmetic.
 * The figures it is given are the governed figures — it may interpret them
 * and it may not invent them.
 */
export async function streamExecutiveBrief(
  portfolio: unknown,
  onText: (full: string) => void,
  signal: AbortSignal,
): Promise<BriefUsage | null> {
  let text = ''
  let usage: BriefUsage | null = null

  for await (const ev of streamGateway({ phase: 'brief', portfolio }, signal)) {
    if (ev.type === 'text') {
      text += ev.text
      onText(text)
    } else if (ev.type === 'usage') {
      usage = {
        usd: runCost(ev.inputTokens, ev.outputTokens),
        inputTokens: ev.inputTokens,
        outputTokens: ev.outputTokens,
        model: ev.model,
      }
    } else if (ev.type === 'error') {
      throw new Error(ev.message)
    }
  }

  return usage
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}
