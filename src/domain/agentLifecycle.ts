import { readEscalations, type EscalationReading } from './escalations'
import { AGENTS, SKILL_BY_ID } from './estate'
import { SHADOW } from './knowledge'
import { AC, MODE_TO_LEVEL } from './reference'
import { NOW } from './workSeed'
import type { Agent } from './types'

/* ==========================================================================
   The agent lifecycle — how an agent is built, proved, made operational and
   watched.

   An agent is not a prompt. Before it may touch a client's estate it needs a
   charter that says what it is for and what it may never do, an identity of
   its own with least privilege, the action classes it is allowed to take and
   the skills that carry them, a model the client has approved, evidence from
   replay and from shadow running that it behaves in this estate rather than
   in general, a budget and a step limit so a loop cannot run away, a person
   to escalate to when context is missing, a tested stop, and monitoring that
   would catch it drifting.

   Each of those is a check against a record the platform already holds, not
   a box someone ticks. The checks are grouped by the four things a platform
   team actually does — build it, prove it, make it operational, watch it —
   and each stage of the lifecycle requires the checks of the stages before
   it. What blocks an agent from its next stage is therefore computed, and an
   agent cannot be promoted by assertion.
   ========================================================================== */

export type Stage = 'draft' | 'evaluated' | 'shadow' | 'supervised' | 'autonomous' | 'suspended'

export const STAGE_LABEL: Record<Stage, string> = {
  draft: 'Draft', evaluated: 'Evaluated', shadow: 'Shadow', supervised: 'Supervised', autonomous: 'Autonomous', suspended: 'Suspended',
}

/** The order an agent moves through. Suspended is not a stage, it is a state. */
export const STAGES: Stage[] = ['draft', 'evaluated', 'shadow', 'supervised', 'autonomous']

export type Phase = 'build' | 'prove' | 'operate' | 'watch'

export const PHASE_LABEL: Record<Phase, string> = {
  build: 'Build it', prove: 'Prove it', operate: 'Make it operational', watch: 'Watch it',
}

/* ------------------------------ Operations seed ----------------------------- */

/**
 * What the platform team sets up around an agent. Held beside the agent
 * record because it is the platform's own configuration rather than anything
 * the client's estate supplies.
 */
export interface AgentOps {
  /** What the agent's own identity may reach. */
  identityScope: string
  /** Monthly model spend it is allowed, in USD. */
  budgetUsd30d: number
  /** Steps a single run may take before it is stopped. */
  maxSteps: number
  /** Who picks it up when the agent escalates rather than guesses. */
  escalateTo: string
  /** The model it runs on, checked against the approved registry. */
  servedModel: string
  /** When the global stop was last exercised against it. */
  killSwitchTestedAt?: string
  /** The change record its current configuration was released under. */
  changeRef?: string
  /** What it retrieves at run time to know this client. */
  contextSources: string[]
}

const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

const BASE: Omit<AgentOps, 'identityScope' | 'escalateTo'> = {
  budgetUsd30d: 500, maxSteps: 25, servedModel: 'claude-opus-5', killSwitchTestedAt: ago(38), changeRef: 'CHG-2027-0148',
  contextSources: ['Ticket history', 'Verified runbooks', 'CMDB and inventory', 'Platform telemetry'],
}

export const AGENT_OPS: Record<string, AgentOps> = {
  agt_sentinel: { ...BASE, budgetUsd30d: 900, identityScope: 'ServiceNow read, monitoring read', escalateTo: 'Shift lead' },
  agt_diagnost: { ...BASE, budgetUsd30d: 1400, identityScope: 'Telemetry read, graph read', maxSteps: 40, escalateTo: 'Resolver on shift' },
  agt_remedian: { ...BASE, budgetUsd30d: 800, identityScope: 'Named runbooks on in-scope hosts', escalateTo: 'Resolver on shift' },
  agt_forge: { ...BASE, budgetUsd30d: 1800, identityScope: 'Repository branch and pull request only', maxSteps: 60, escalateTo: 'Application lead', changeRef: 'CHG-2027-0151' },
  agt_sentryq: { ...BASE, budgetUsd30d: 900, identityScope: 'Test environments only', maxSteps: 45, escalateTo: 'Application lead' },
  agt_custodian: {
    ...BASE, budgetUsd30d: 700, identityScope: 'Data Factory operate, datamart read', escalateTo: 'Data platform engineer',
    contextSources: ['Ticket history', 'Verified runbooks', 'Pipeline run history', 'Data estate register', 'Data contracts'],
  },
  agt_prospect: { ...BASE, budgetUsd30d: 400, identityScope: 'Read-only across registers', escalateTo: 'Service delivery manager' },
  agt_bursar: { ...BASE, budgetUsd30d: 250, identityScope: 'Billing and capacity read', escalateTo: 'Commercial manager' },
  agt_warden: { ...BASE, budgetUsd30d: 500, identityScope: 'Patch orchestration on in-scope hosts', escalateTo: 'Security lead', killSwitchTestedAt: ago(104) },
  agt_archivist: {
    ...BASE, budgetUsd30d: 1400, identityScope: 'Read-only across platforms', maxSteps: 50, escalateTo: 'Transition lead',
    contextSources: ['Ticket history', 'Platform metadata', 'Interviews', 'Data estate register'],
  },
  agt_herald: { ...BASE, budgetUsd30d: 1000, identityScope: 'Reporting read', escalateTo: 'Service delivery manager' },
  agt_concierge: { ...BASE, budgetUsd30d: 600, identityScope: 'Entitlement rules, catalogue fulfilment', escalateTo: 'Service desk lead', changeRef: undefined },
}

/* --------------------------------- Checks ----------------------------------- */

export type CheckState = 'pass' | 'fail' | 'unknown'

export interface Check {
  id: string
  phase: Phase
  name: string
  /** The stage this check is required from. */
  requiredFrom: Stage
  state: CheckState
  /** What the check found, in figures. */
  detail: string
  /** The record it was read from. */
  source: string
}

/** How far through the lifecycle an agent has come, read from its record. */
export function stageOf(a: Agent): Stage {
  if (a.state === 'suspended') return 'suspended'
  if (a.state === 'onboarding') return a.evaluation.score > 0 ? 'evaluated' : 'draft'
  if (a.state === 'probation') return 'shadow'
  if (a.ceiling === 'autonomous') return 'autonomous'
  if (a.ceiling === 'supervised') return 'supervised'
  return 'shadow'
}

const EVAL_SCORE_BAR = 0.9
const EVAL_REPLAY_BAR = 200
const EVAL_STALE_DAYS = 45
const KILL_SWITCH_DAYS = 90
/** How long an escalation may sit before the escalation path is not really staffed. */
const PICKUP_TARGET_MINS = 120

const daysSince = (iso?: string) => (iso ? Math.round((NOW.getTime() - Date.parse(iso)) / 86_400_000) : null)

/**
 * Every check for one agent. `approvedModels` comes from the AI system
 * registry the gateway enforces; without it the model check reports unknown
 * rather than guessing.
 */
export function checksFor(a: Agent, approvedModels?: string[]): Check[] {
  const ops = AGENT_OPS[a.id]
  const grants = Object.keys(a.grants)
  const skills = a.skills.map((s) => SKILL_BY_ID[s]).filter(Boolean)
  // A skill that only reads has nothing to verify afterwards; one that changes something does.
  const changing = skills.filter((s) => s.actionClasses.some((c) => AC[c] && AC[c].reversibility !== 'read_only'))
  const unverified = changing.filter((s) => !s.verificationPack || s.verificationPack === 'none')
  const shadow = SHADOW.filter((s) => grants.some((g) => g.startsWith(s.actionClass)))
  const belowBar = shadow.filter((s) => s.agreement < s.threshold)
  // The engine caps each class at its own floor, so a ceiling above a floor is
  // capped rather than breached. What matters is that every class is known to it.
  const unknownClass = grants.filter((g) => !AC[g])
  const capped = grants.filter((g) => AC[g] && MODE_TO_LEVEL[a.ceiling] > MODE_TO_LEVEL[AC[g].floor])
  const evalAge = daysSince(a.evaluation.lastRun)
  const killAge = daysSince(ops?.killSwitchTestedAt)
  const openIncidents = a.incidents.filter((i) => i.demotedDays > 0)
  const esc = readEscalations(a.id)
  const budgetUsed = ops ? (a.economics.costUsd30d / ops.budgetUsd30d) * 100 : null

  const check = (id: string, phase: Phase, name: string, requiredFrom: Stage, state: CheckState, detail: string, source: string): Check =>
    ({ id, phase, name, requiredFrom, state, detail, source })

  return [
    // Build it.
    check('charter', 'build', 'Charter and accountable human', 'draft',
      a.mission && a.ownerHuman ? 'pass' : 'fail',
      a.ownerHuman ? `${a.ownerHuman} accountable` : 'No accountable human', 'Agent record'),
    check('prohibitions', 'build', 'Prohibitions it can never cross', 'draft',
      a.prohibited.length ? 'pass' : 'fail',
      a.prohibited.length ? `${a.prohibited.length} action classes forbidden` : 'None recorded', 'Agent record'),
    check('identity', 'build', 'Own identity, least privilege', 'draft',
      a.nhi && ops?.identityScope ? 'pass' : 'fail',
      ops?.identityScope ?? 'No scope recorded', 'Agent record and platform configuration'),
    check('classes', 'build', 'Action classes granted', 'draft',
      grants.length ? 'pass' : 'fail',
      grants.length ? `${grants.length} classes` : 'None granted', 'Autonomy schedule'),
    check('skills', 'build', 'Changing skills carry a verification pack', 'draft',
      skills.length === 0 ? 'fail' : unverified.length ? 'fail' : 'pass',
      skills.length === 0
        ? 'No skills'
        : unverified.length
          ? `${unverified.length} of ${changing.length} changing skills unverified`
          : changing.length
            ? `${changing.length} changing skills verified`
            : `${skills.length} read-only skills`,
      'Skill registry'),
    check('context', 'build', 'Context it retrieves at run time', 'draft',
      ops?.contextSources.length ? 'pass' : 'fail',
      ops ? `${ops.contextSources.length} sources` : 'None recorded', 'Platform configuration'),

    // Prove it.
    check('evaluation', 'prove', 'Evaluation against this estate', 'evaluated',
      a.evaluation.score >= EVAL_SCORE_BAR && a.evaluation.replayN >= EVAL_REPLAY_BAR ? 'pass' : 'fail',
      `${(a.evaluation.score * 100).toFixed(1)}% over ${a.evaluation.replayN.toLocaleString('en-GB')} replays`, 'Evaluation suite'),
    check('eval_fresh', 'prove', 'Evaluation still current', 'evaluated',
      evalAge === null ? 'unknown' : evalAge <= EVAL_STALE_DAYS ? 'pass' : 'fail',
      evalAge === null ? 'Never run' : `${evalAge} days ago`, 'Evaluation suite'),
    check('shadow', 'prove', 'Shadow agreement at threshold', 'supervised',
      shadow.length === 0 ? 'unknown' : belowBar.length ? 'fail' : 'pass',
      shadow.length === 0 ? 'No shadow record for its classes' : belowBar.length ? `${belowBar.length} of ${shadow.length} classes below threshold` : `${shadow.length} classes at threshold`,
      'Shadow scoreboard'),
    check('floor', 'prove', 'Every granted class known to the engine', 'shadow',
      unknownClass.length ? 'fail' : 'pass',
      unknownClass.length
        ? `${unknownClass.join(', ')} not in the policy register`
        : capped.length
          ? `Ceiling ${a.ceiling}, capped lower on ${capped.length} of ${grants.length} classes`
          : `Ceiling ${a.ceiling}`,
      'Policy engine'),

    // Make it operational.
    check('model', 'operate', 'Runs on an approved model', 'supervised',
      !approvedModels ? 'unknown' : approvedModels.includes(ops?.servedModel ?? '') ? 'pass' : 'fail',
      ops?.servedModel ? `${ops.servedModel}${approvedModels ? '' : ' · registry not read'}` : 'No model recorded', 'AI system registry'),
    check('budget', 'operate', 'Model budget set and within it', 'supervised',
      budgetUsed === null ? 'fail' : budgetUsed <= 100 ? 'pass' : 'fail',
      budgetUsed === null ? 'No budget set' : `$${a.economics.costUsd30d} of $${ops!.budgetUsd30d} · ${budgetUsed.toFixed(0)}%`, 'Model economics'),
    check('steps', 'operate', 'Step limit on every run', 'shadow',
      ops?.maxSteps ? 'pass' : 'fail', ops?.maxSteps ? `${ops.maxSteps} steps` : 'None set', 'Platform configuration'),
    check('escalation', 'operate', 'Escalates to a named person', 'shadow',
      ops?.escalateTo ? 'pass' : 'fail', ops?.escalateTo ?? 'Nobody named', 'Platform configuration'),
    check('change', 'operate', 'Configuration under change control', 'supervised',
      ops?.changeRef ? 'pass' : 'fail', ops?.changeRef ?? 'No change record', 'Change log'),
    check('stop', 'operate', 'Stop exercised, not assumed', 'autonomous',
      killAge === null ? 'fail' : killAge <= KILL_SWITCH_DAYS ? 'pass' : 'fail',
      killAge === null ? 'Never tested' : `${killAge} days ago`, 'Game day record'),

    // Watch it.
    check('drift', 'watch', 'No drift alarm', 'shadow',
      a.driftAlarm ? 'fail' : 'pass', a.driftAlarm ? 'Alarm raised' : `Live success ${(a.evaluation.liveSuccess90d * 100).toFixed(1)}%`, 'Drift monitor'),
    check('incidents', 'watch', 'No incident holding it down', 'supervised',
      openIncidents.length ? 'fail' : 'pass',
      openIncidents.length ? `${openIncidents.length} demoting incident` : `${a.incidents.length} historical`, 'Agent incidents'),
    check('pickup', 'watch', 'Escalations picked up, not left waiting', 'shadow',
      esc.runs === 0 ? 'unknown' : esc.medianPickupMins === null ? 'unknown' : esc.medianPickupMins <= PICKUP_TARGET_MINS ? 'pass' : 'fail',
      esc.runs === 0
        ? 'Has not run'
        : `${esc.count} escalations · ${esc.ratePct}% of runs · median pick-up ${esc.medianPickupMins ?? '—'} min${esc.waiting ? ` · ${esc.waiting} waiting` : ''}`,
      'Escalation log'),
    check('worth', 'watch', 'Costs less than the effort it displaces', 'supervised',
      a.economics.humanMinsDisplaced30d > 0 ? 'pass' : 'unknown',
      a.economics.humanMinsDisplaced30d > 0
        ? `${Math.round(a.economics.humanMinsDisplaced30d / 60)} h displaced for $${a.economics.costUsd30d}`
        : 'Nothing displaced yet', 'Model economics'),
  ]
}

/* -------------------------------- Readings ---------------------------------- */

export interface AgentReading {
  agent: Agent
  ops?: AgentOps
  stage: Stage
  checks: Check[]
  passed: number
  failed: Check[]
  unknown: Check[]
  /** The stage it could move to next, and what stands in the way. */
  next: Stage | null
  /** Checks the next stage needs that are failing. */
  blockers: Check[]
  /** Checks the next stage needs that could not be read. Not a failure, not a pass. */
  unverified: Check[]
  /** Model spend against its budget, as a percentage. */
  budgetPct: number | null
  /** What it handed back to people, and why. */
  escalations: EscalationReading
}

const stageIndex = (s: Stage) => STAGES.indexOf(s)

export function readAgent(a: Agent, approvedModels?: string[]): AgentReading {
  const checks = checksFor(a, approvedModels)
  const stage = stageOf(a)
  const ops = AGENT_OPS[a.id]
  const next = stage === 'suspended' || stage === 'autonomous' ? null : STAGES[stageIndex(stage) + 1] ?? null
  // A check is a blocker when the next stage requires it and it is not passing.
  // A check that could not be read is reported as unverified rather than counted
  // against the agent: the platform does not turn its own blind spot into a fault.
  const needed = (c: Check) => (next ? stageIndex(c.requiredFrom) <= stageIndex(next) : true)
  const blockers = checks.filter((c) => c.state === 'fail' && needed(c))
  const unverified = checks.filter((c) => c.state === 'unknown' && needed(c))
  return {
    agent: a, ops, stage, checks,
    passed: checks.filter((c) => c.state === 'pass').length,
    failed: checks.filter((c) => c.state === 'fail'),
    unknown: checks.filter((c) => c.state === 'unknown'),
    next, blockers, unverified,
    escalations: readEscalations(a.id),
    budgetPct: ops ? Math.round((a.economics.costUsd30d / ops.budgetUsd30d) * 100) : null,
  }
}

export interface FleetLifecycle {
  agents: AgentReading[]
  byStage: Record<Stage, number>
  /** Agents with nothing standing in the way of their next stage. */
  readyToPromote: AgentReading[]
  blocked: AgentReading[]
  overBudget: AgentReading[]
  /** Checks failing across the fleet, worst first. */
  commonGaps: { check: string; phase: Phase; agents: number }[]
}

export function fleetLifecycle(approvedModels?: string[], agents: Agent[] = AGENTS): FleetLifecycle {
  const readings = agents.map((a) => readAgent(a, approvedModels))
  const byStage = Object.fromEntries(['draft', 'evaluated', 'shadow', 'supervised', 'autonomous', 'suspended'].map((s) => [s, 0])) as Record<Stage, number>
  for (const r of readings) byStage[r.stage]++
  const gaps = new Map<string, { check: string; phase: Phase; agents: number }>()
  for (const r of readings) {
    for (const c of r.checks.filter((x) => x.state === 'fail')) {
      const seen = gaps.get(c.id) ?? { check: c.name, phase: c.phase, agents: 0 }
      seen.agents++
      gaps.set(c.id, seen)
    }
  }
  return {
    agents: readings,
    byStage,
    readyToPromote: readings.filter((r) => r.next && r.blockers.length === 0),
    blocked: readings.filter((r) => r.blockers.length > 0),
    overBudget: readings.filter((r) => (r.budgetPct ?? 0) > 100),
    commonGaps: [...gaps.values()].sort((a, b) => b.agents - a.agents),
  }
}
