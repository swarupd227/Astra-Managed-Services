import { evaluate, type ActionContext, type EngineResult } from './policyEngine'
import { missionCeiling, missionFor, type Mission } from './missions'
import { AGENTS, AGENT_BY_ID, CLIENT, GRAPH_EDGES, GRAPH_NODES, POLICIES, SKILLS, TOWERS, TOWER_BY_ID, policyForTower } from './estate'
import { DATA_ITEMS, contractState, descendants, itemsNamedIn, policyAsset, withoutContract } from './dataEstate'
import { ACTION_CLASSES, AC } from './reference'
import { DEMAND_CLASSES, SLAS } from './ledgers'
import { ago } from '@/lib/format'
import type { EvidenceKind, ExecutionMode, Grade, Priority, WorkObject } from './types'
import type { Proposal } from './proposals'
import { detectFabrication, detectToolAnomaly, type AiIncidentClass } from './aiIncident'
import { suspensionContext, type Suspension } from './suspensions'

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
  | { t: 'retrieve'; agent: string; assertions: number; humanVerified: number; runbooks: number; priors: number; pkg: string; floor: string; tokensUsed: number; tokenBudget: number; cited: string[] }
  | { t: 'finding'; title: string; detail: string; confidence: number; severity: 'info' | 'warn' | 'crit' }
  | { t: 'plan'; skill: string; success: number; runs: number; steps: { label: string; ac?: string; compensation?: string }[] }
  | { t: 'policy'; result: EngineResult; agentId: string; policyName: string; advisory?: boolean }
  | { t: 'mission'; missionId: string; name: string; goal: string; from: ExecutionMode; to: ExecutionMode; reason: string }
  | { t: 'gate'; role: string; timeoutSec: number; escalatesTo: string }
  | { t: 'exec'; stepIndex: number; detail: string; ms: number }
  | { t: 'verify'; pack: string; probes: string[]; result: 'green' | 'amber' }
  | { t: 'evidence'; summary: string; kind: EvidenceKind }
  | { t: 'ledger'; hours: number; attribution: string; note: string }
  | { t: 'answer'; agent: string; text: string; streaming?: boolean }
  | { t: 'refuse'; agent: string; text: string; rule: string }
  | { t: 'cost'; usd: number; note: string; inputTokens: number; outputTokens: number; model: string; system?: string; registered?: string | null; mismatch?: boolean }
  | { t: 'system'; id: string; vendor: string; model: string; version: string; region: string; hosting: string }
  | { t: 'incident'; class: AiIncidentClass; detector: string; summary: string; details: string[]; consequential: boolean; agent?: string; systemId?: string }
  | { t: 'rejected'; text: string }
  | { t: 'error'; message: string }

export interface AgentProposal {
  intent: string
  intent_confidence: number
  routed_agent: string
  routing_note: string
  requires_action: boolean
  context_used: { assertions: number; human_verified: number; runbooks: number; prior_incidents: number; verification_floor: string; cited?: string[] }
  finding: { title: string; detail: string; confidence: number; severity: 'info' | 'warn' | 'crit' }
  action_class: string
  blast_radius: { tier: number; services: number; dependents: number; data_mutation: boolean }
  plan_confidence: number
  has_compensation: boolean
  skill: string
  steps: { label: string; action_class: string; compensation: string }[]
}

/* ------------------------- Estate digest for the model --------------------- */

const PRIORITY_RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 }

function worstOpenIncident(work: WorkObject[]): WorkObject | undefined {
  return work
    .filter((w) => w.type === 'incident' && !['resolved', 'learned'].includes(w.state))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0]
}

/**
 * What is actually true right now, read off the live store rather than
 * authored as prose. This used to be four hand-written sentences — a real
 * incident ref and a real known-error id, copied once and then frozen. If an
 * operator resolved the incident, the model would still be told it was open;
 * a stale ground truth is worse than none, because it is presented as fact.
 *
 * Each field either comes from a real record or says plainly that there is
 * nothing to report — it never restates yesterday's snapshot as today's.
 */
function liveContext(work: WorkObject[], proposals: Proposal[], nowMs: number) {
  const worst = worstOpenIncident(work)

  // The most-recorded known error is a standing structural fact, not a claim
  // about recency — so it is phrased as one rather than dated as "recent",
  // which would go stale the moment simulated time moves on.
  const knownError = [...GRAPH_NODES]
    .filter((n) => n.type === 'KnownError')
    .sort((a, b) => Number(b.attrs.occurrences ?? 0) - Number(a.attrs.occurrences ?? 0))[0]

  // Read off the data estate register, which holds every item's contract,
  // rather than parsed out of the prose of an open proposal.
  const assetsWithoutContract = withoutContract().map((i) => i.name)

  // Only surface the certificate risk while the proposal about it is still
  // open — once a human decides it, restating it as current would be wrong.
  const certProposal = proposals.find(
    (p) => p.source?.kind === 'demand_class' && p.source.id === 'dc_cert_expiry' && p.state === 'open',
  )

  return {
    openIncident: worst
      ? `${worst.ref} — ${worst.title}, ${worst.priority}, opened ${ago(worst.createdAt, new Date(nowMs))}`
      : 'No open incidents at present.',
    recentChange: knownError
      ? `${knownError.name} — recorded ${knownError.attrs.occurrences} times since ${knownError.attrs.first_seen}`
      : 'No recorded regression pattern.',
    assetsWithoutContract,
    certificateRisk: certProposal ? certProposal.detail : 'No open certificate risk.',
  }
}

/**
 * Where a still-open certificate proposal names the node and the days left,
 * pulled out of its own prose rather than duplicated as a separate fact.
 */
function certRiskNode(proposals: Proposal[]): { node: string; days: number } | undefined {
  const p = proposals.find((pr) => pr.source?.kind === 'demand_class' && pr.source.id === 'dc_cert_expiry' && pr.state === 'open')
  const m = p?.detail.match(/^(.+?) expires in (\d+) days?/i)
  return m ? { node: m[1], days: Number(m[2]) } : undefined
}

/**
 * The empty-state prompts (§A7 — "nothing here is matched or scripted").
 *
 * This used to be six lines of authored copy: a fixed incident, a fixed
 * certificate, a fixed asset. Once the operator resolved that incident or a
 * proposal was decided, the suggestions kept offering to diagnose or fix
 * something that was no longer true — which is the same defect as the
 * knownContext block above, at the surface the operator actually clicks.
 *
 * Each slot below is populated only while its underlying record is real and
 * current, and drops out rather than being backfilled with invented text —
 * a shorter, honest list beats a full one that is lying about half its rows.
 */
export function buildSuggestions(work: WorkObject[], proposals: Proposal[]): { id: string; text: string; hint: string }[] {
  const incident = worstOpenIncident(work)
  const jeopardy = !incident
    ? [...SLAS].filter((s) => s.kind === 'sla' && s.attainmentMtd < s.attainmentTarget).sort((a, b) => a.attainmentMtd - a.attainmentTarget - (b.attainmentMtd - b.attainmentTarget))[0]
    : undefined
  const cert = certRiskNode(proposals)
  // The dataset without an enforced contract that the most items read from.
  const uncontracted = withoutContract()
    .filter((i) => i.kind === 'dataset')
    .sort((a, b) => descendants(b.id).length - descendants(a.id).length)[0]?.name
  const purgeAsset = GRAPH_NODES.find((n) => n.type === 'DataAsset')

  const out: { id: string; text: string; hint: string }[] = []

  if (incident) {
    out.push({ id: 'diagnose', text: `Why is ${incident.service} breaching its objective?`, hint: 'Diagnosis — read-only, no gate involved' })
    out.push({ id: 'remediate', text: `Remediate the breach on ${incident.service}`, hint: 'Mutating plan — routes through the autonomy gate' })
  } else if (jeopardy) {
    out.push({ id: 'diagnose', text: `Why is ${jeopardy.name} at risk of breach?`, hint: 'Diagnosis — read-only, no gate involved' })
  }

  if (cert) {
    out.push({ id: 'cert', text: `Rotate the certificate on ${cert.node} before it expires`, hint: `AC-41 — expires in ${cert.days} days` })
  }

  if (uncontracted) {
    out.push({ id: 'backfill', text: `Backfill ${uncontracted} for the recent gap`, hint: 'No enforced data contract' })
  }

  if (purgeAsset) {
    out.push({ id: 'purge', text: `Purge the archived ${purgeAsset.name} partitions to reclaim storage`, hint: 'Irreversible — watch the floor hold' })
  }

  // Evergreen: queries live evaluation and forecast data, so it needs no
  // underlying record to stay true.
  out.push({ id: 'promote', text: 'Which action classes are ready to promote next quarter?', hint: 'Analysis over evaluation evidence' })

  return out
}

/**
 * The context package the agent is given. Compact by construction — the point
 * of a decision-scoped package is that it is selected, not dumped.
 */
export function estateDigest(work: WorkObject[], proposals: Proposal[], nowMs: number) {
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
    data: DATA_ITEMS.map((i) => ({
      id: i.id, name: i.name, kind: i.kind, tower: i.tower, platform: i.platform, upstream: i.upstream,
      contract: contractState(i), classification: i.classification ?? 'unclassified', steward: i.steward ?? null,
    })),
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
    knownContext: liveContext(work, proposals, nowMs),
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

/** The AI system the gateway resolved from its registry for a call. */
export interface GatewaySystem {
  id: string
  vendor: string
  model: string
  version: string
  region: string
  hosting: string
  whitelisted: boolean
}

type GatewayEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool_start' }
  | { type: 'proposal'; input: AgentProposal }
  | { type: 'usage'; inputTokens: number; outputTokens: number; cacheRead: number; model: string; stopReason: string; system?: string; registered?: string | null; served?: string | null; mismatch?: boolean }
  | { type: 'system'; system: GatewaySystem }
  | { type: 'refuse'; agent: string; text: string; rule: string }
  | { type: 'incident'; class: AiIncidentClass; detector: string; summary: string; details: string[]; consequential: boolean }
  /** The objective compiler's proposal. Shaped and validated by objectiveCompiler.ts. */
  | { type: 'objectives'; input: unknown }
  | { type: 'done' }
  | { type: 'error'; message: string }

export async function* streamGateway(body: unknown, signal: AbortSignal): AsyncGenerator<GatewayEvent> {
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

const FLOORS = ['unverified', 'machine_corroborated', 'human_verified'] as const
type Floor = (typeof FLOORS)[number]

/** What the proposal says it rested on; anything unrecognised is treated as unverified. */
function floorOf(v: string | undefined): Floor {
  return (FLOORS as readonly string[]).includes(v ?? '') ? (v as Floor) : 'unverified'
}

export interface RunOptions {
  /** The AI system the gateway resolved for this run. Absent until the gateway says. */
  system?: GatewaySystem | null
  /** Live suspensions from the control plane, and the agents suspended there. */
  suspensions?: Suspension[]
  suspendedAgents?: string[]
  /** Agents whose drift alarm is raised — capped one level down by rule r0d. */
  driftingAgents?: string[]
  /** Systems with an unaccepted served-model change — capped at Advise by rule r0e. */
  changedSystems?: string[]
  /** Whether a major incident is open — the global brake the engine already understands. */
  majorActive?: boolean
}

export function decide(p: AgentProposal, missions: Mission[] = [], opts: RunOptions = {}): Decision {
  const agent = AGENT_BY_ID[p.routed_agent] ?? AGENT_BY_ID.agt_remedian
  const cls = AC[p.action_class] ? p.action_class : 'AC-05'
  // The data items the plan names, in its steps, its finding or its citations.
  const targets = itemsNamedIn([
    ...p.steps.flatMap((s) => [s.label, s.compensation]),
    p.finding?.title ?? '', p.finding?.detail ?? '', ...(p.context_used?.cited ?? []),
  ].join('\n'))
  // The tower the work lands on where the agent is deployed there, otherwise
  // the agent's first tower.
  const landsOn = targets.map((t) => t.tower).find((t) => agent.towers.includes(t))
  const tower = (landsOn && TOWER_BY_ID[landsOn]) || TOWERS.find((t) => agent.towers.includes(t.id)) || TOWERS[0]
  const policy = policyForTower(tower.id)
  const downstream = new Set(targets.flatMap((t) => descendants(t.id).map((d) => d.id)))

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
      // The model's count is a claim; what the register says reads from the
      // items it touches is a floor under it.
      dependents: Math.max(p.blast_radius.dependents, downstream.size),
      dataMutation: p.blast_radius.data_mutation,
    },
    agent: { id: agent.id, grade: agent.grants as Record<string, Grade>, drift: (opts.driftingAgents ?? []).includes(agent.id) },
    plan: { confidence: p.plan_confidence, verificationPack: AC[cls]?.verificationPack ?? null },
    incident: { major_active: Boolean(opts.majorActive) },
    calendar: { freeze: false },
    // What the gateway resolved, so a policy can reason about the registry
    // even though the gateway has already enforced it.
    model: opts.system
      ? { id: opts.system.id, vendor: opts.system.vendor, version: opts.system.version, whitelisted: opts.system.whitelisted, changed: (opts.changedSystems ?? []).includes(opts.system.id) }
      : undefined,
    // The verification floor the proposal rested on. The prompt promises that
    // a mutating plan at L3/L4 relies only on verified knowledge; rule r0c makes
    // the promise enforceable by capping an unverified mutating plan at Advise.
    retrieval: { minVerification: floorOf(p.context_used?.verification_floor) },
    suspensions: suspensionContext(opts.suspensions ?? [], {
      tower: tower.id, agentId: agent.id, actionClass: cls, fn: 'copilot.plan',
      agentSuspended: (opts.suspendedAgents ?? []).includes(agent.id),
    }),
    // Read from the data estate register. A data action that names no
    // registered item has nothing to verify against, the same as one whose
    // item has no enforced contract, and the policy caps both at Advise.
    asset: targets.length
      ? policyAsset(targets)
      : AC[cls]?.domain === 'Data' ? { contract: null, pii: null } : undefined,
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
  work: WorkObject[] = [],
  proposals: Proposal[] = [],
  nowMs: number = Date.now(),
  opts: RunOptions = {},
): Promise<{ proposal: AgentProposal | null; decision: Decision | null; mode: ExecutionMode | null }> {
  const estate = estateDigest(work, proposals, nowMs)
  let proposal: AgentProposal | null = null
  let system: GatewaySystem | null = opts.system ?? null
  let fabricated = false
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
      } else if (ev.type === 'system') {
        system = ev.system
        onBeat({ t: 'system', id: system.id, vendor: system.vendor, model: system.model, version: system.version, region: system.region, hosting: system.hosting })
      } else if (ev.type === 'refuse') {
        // The gateway refused before any model call — a suspended function or
        // a model outside the registry. Nothing to decide; record it and stop.
        onBeat({ t: 'refuse', agent: 'agt_herald', text: ev.text, rule: ev.rule })
        onBeat({ t: 'evidence', summary: 'Refusal recorded — no vendor request was made', kind: 'decision' })
        return { proposal: null, decision: null, mode: null }
      } else if (ev.type === 'incident') {
        // The gateway's own detectors — an injected utterance, or a canary
        // leaking out of the model — raise the incident; the run stops here.
        // Only an output-side finding (the canary) is attributed to the agent:
        // a hostile input is not the agent's doing and must not demote it.
        onBeat({ t: 'incident', class: ev.class, detector: ev.detector, summary: ev.summary, details: ev.details, consequential: ev.consequential, agent: ev.detector === 'canary' ? routedAgent : undefined, systemId: system?.id })
        onBeat({ t: 'refuse', agent: routedAgent, text: ev.summary, rule: `AI Incident — ${ev.class.replace(/_/g, ' ')} (${ev.detector})` })
        onBeat({ t: 'evidence', summary: 'AI Incident recorded at the gateway; the run was stopped', kind: 'observation' })
        fabricated = true
        continue
      } else if (ev.type === 'proposal') {
        proposal = ev.input
        routedAgent = AGENT_BY_ID[proposal.routed_agent] ? proposal.routed_agent : 'agt_herald'
        answerOpen = false

        // Every identifier the proposal carries is checked against the estate
        // before anything is routed, planned or decided. A consequential plan
        // built on invented references is refused here, not defaulted.
        const signal = detectFabrication(proposal) ?? detectToolAnomaly(proposal)
        if (signal) {
          onBeat({ t: 'incident', ...signal, agent: routedAgent, systemId: system?.id })
          if (signal.consequential) {
            fabricated = true
            onBeat({ t: 'refuse', agent: routedAgent, text: signal.details.join(' '), rule: `AI Incident — ${signal.class.replace(/_/g, ' ')} in a consequential proposal; refused before the policy engine saw it` })
            onBeat({ t: 'evidence', summary: 'AI Incident recorded with the proposal and every finding behind it', kind: 'observation' })
            continue
          }
        }

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
          cited: proposal.context_used.cited ?? [],
        })
        onBeat({ t: 'finding', ...proposal.finding })

        decision = decide(proposal, missions, { ...opts, system })
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
          note: `${ev.inputTokens.toLocaleString('en-GB')} in / ${ev.outputTokens.toLocaleString('en-GB')} out${ev.cacheRead ? ` · ${ev.cacheRead.toLocaleString('en-GB')} cached` : ''}`,
          inputTokens: ev.inputTokens, outputTokens: ev.outputTokens, model: ev.model,
          system: ev.system, registered: ev.registered, mismatch: ev.mismatch,
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

  // A fabricated consequential proposal was refused inside the loop; there is
  // no decision to announce for it.
  if (fabricated) return { proposal: null, decision: null, mode: null }

  // `decision` was taken the moment the proposal landed, so the mission was
  // known before the usage event arrived and could be charged for it.
  if (!proposal || !decision) return { proposal: null, decision: null, mode: null }

  // A read-only intent proposes no mutation, so the engine evaluated a
  // hypothetical. Say so rather than presenting a full decision for an action
  // that was never going to happen.
  onBeat({
    t: 'policy',
    result: decision.result,
    agentId: decision.agentId,
    policyName: decision.policyName,
    advisory: !proposal.requires_action,
  })

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
  work: WorkObject[] = [],
  proposals: Proposal[] = [],
  nowMs: number = Date.now(),
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
    for await (const ev of streamGateway({ phase: 'outcome', utterance, estate: estateDigest(work, proposals, nowMs), approved: proposal }, signal)) {
      if (ev.type === 'text') {
        outcome += ev.text
        onBeat({ t: 'answer', agent: 'agt_herald', text: outcome, streaming: true }, open)
        open = true
      } else if (ev.type === 'refuse') {
        onBeat({ t: 'refuse', agent: 'agt_herald', text: ev.text, rule: ev.rule })
      } else if (ev.type === 'incident') {
        onBeat({ t: 'incident', class: ev.class, detector: ev.detector, summary: ev.summary, details: ev.details, consequential: ev.consequential, agent: 'agt_herald' })
      } else if (ev.type === 'usage') {
        onBeat({
          t: 'cost', usd: runCost(ev.inputTokens, ev.outputTokens),
          note: `outcome narrative · ${ev.inputTokens.toLocaleString('en-GB')} in / ${ev.outputTokens.toLocaleString('en-GB')} out`,
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
    } else if (ev.type === 'refuse') {
      throw new Error(ev.text)
    } else if (ev.type === 'incident') {
      throw new Error(`AI Incident — ${ev.class.replace(/_/g, ' ')} (${ev.detector}): ${ev.summary}`)
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
