import { MODE_TO_LEVEL } from './reference'
import { AGENTS, TOWERS } from './estate'
import { DEMAND_CLASSES } from './ledgers'
import { Rng } from './rng'
import { NOW } from './workSeed'
import type { ExecutionMode, ISO, Tower } from './types'

/* ==========================================================================
   The Mission framework (Addendum A §A4).

   v1.2 autonomy is reactive: agents act when work arrives, per action, under
   policy. A mission is the other half — bounded, goal-directed standing
   delegation. A human states an outcome, constraints and a budget; the
   workforce pursues it continuously; the human supervises by exception.

   Two invariants hold the whole thing up:

     1. A mission can only NARROW. The Autonomy Policy Engine remains the
        ceiling — `missionCeiling` takes the stricter of the two, always.
     2. A mission is finite. Spend, run-count and time budgets bound it, and
        exhaustion degrades to advise rather than stopping silently.
   ========================================================================== */

export type MissionState = 'draft' | 'active' | 'paused' | 'exhausted' | 'expired' | 'retired'

/** Standing missions (§A4.3) are configured at cutover; episodic ones are delegated. */
export type MissionKind = 'standing' | 'episodic'

export interface MissionConstraints {
  /** 'policy_defaults' means the mission adds no ceiling of its own. */
  maxMode: ExecutionMode | 'policy_defaults'
  allow: string[]
  deny: string[]
  honourFreeze: boolean
  spendBudgetUsd: number
  runBudget: number
}

export interface MissionPlan {
  watching: string[]
  prepositioned: string[]
  decisionPoints: string[]
  /** The owner has seen and accepted the read-back. */
  acknowledged: boolean
}

export interface Mission {
  id: string
  name: string
  kind: MissionKind
  goal: string
  tower: string
  owner: string
  sponsor: string
  workforce: string[]
  constraints: MissionConstraints
  escalation: { pageRole: string; on: string[] }
  reporting: string[]
  window: { from: ISO; to: ISO }
  state: MissionState
  consumed: { spendUsd: number; runs: number }
  plan: MissionPlan
  createdAt: ISO
}

/* ------------------------------ The guardrail ------------------------------ */

export interface MissionCeiling {
  mode: ExecutionMode
  /** Why the mission narrowed the engine's answer, if it did. */
  narrowedBy: string | null
}

/**
 * The engine has decided. A mission may only make that answer stricter.
 *
 * Never returns a mode above `policyMode`, whatever the mission asks for —
 * §A4.2's "missions never outrank policy", enforced rather than asserted.
 */
export function missionCeiling(mission: Mission | null, policyMode: ExecutionMode, actionClass: string): MissionCeiling {
  // No mission context at all — the engine's answer stands on its own.
  if (!mission) return { mode: policyMode, narrowedBy: null }

  // A mission that is not running cannot authorise anything under it. Note the
  // ordering: these cases must be handled BEFORE the constraint logic, but they
  // must never return `policyMode` untouched — a stopped mission that widens
  // back to the engine's answer would make exhaustion a reward.
  if (mission.state === 'exhausted' || budgetExhausted(mission)) {
    return {
      mode: MODE_TO_LEVEL[policyMode] > MODE_TO_LEVEL.advise ? 'advise' : policyMode,
      narrowedBy: 'Mission budget exhausted — degraded to advise until the budget is raised',
    }
  }
  if (mission.state !== 'active') {
    return { mode: 'manual', narrowedBy: `Mission is ${mission.state} — nothing executes under it` }
  }

  const { constraints } = mission

  if (constraints.deny.includes(actionClass)) {
    return { mode: 'manual', narrowedBy: `${actionClass} is denied by mission ${mission.id}` }
  }
  if (constraints.allow.length && !constraints.allow.includes(actionClass)) {
    return { mode: 'manual', narrowedBy: `${actionClass} is outside the mission's allowed classes` }
  }

  if (constraints.maxMode === 'policy_defaults') return { mode: policyMode, narrowedBy: null }

  if (MODE_TO_LEVEL[constraints.maxMode] < MODE_TO_LEVEL[policyMode]) {
    return { mode: constraints.maxMode, narrowedBy: `Mission caps this class at ${constraints.maxMode}` }
  }

  return { mode: policyMode, narrowedBy: null }
}

/**
 * Which mission, if any, governs this piece of work.
 *
 * A run is under a mission when the mission is active, covers the tower, and
 * has an opinion about the action class — either allowing it or denying it.
 * Where several qualify, the most restrictive wins: two standing missions
 * over one tower must not let a run pick the laxer parent.
 */
export function missionFor(missions: Mission[], tower: string, actionClass: string): Mission | null {
  const candidates = missions.filter(
    (m) =>
      (m.state === 'active' || m.state === 'exhausted') &&
      m.tower === tower &&
      (m.constraints.deny.includes(actionClass) ||
        m.constraints.allow.length === 0 ||
        m.constraints.allow.includes(actionClass)),
  )
  if (!candidates.length) return null

  const rank = (m: Mission) =>
    m.constraints.deny.includes(actionClass)
      ? -1 // a denial is the most restrictive answer there is
      : m.constraints.maxMode === 'policy_defaults'
        ? MODE_TO_LEVEL.autonomous + 1
        : MODE_TO_LEVEL[m.constraints.maxMode]

  return [...candidates].sort((a, b) => rank(a) - rank(b))[0]
}

/* -------------------------------- Budgets ---------------------------------- */

export function budgetExhausted(m: Mission): boolean {
  return m.consumed.spendUsd >= m.constraints.spendBudgetUsd || m.consumed.runs >= m.constraints.runBudget
}

export function budgetUse(m: Mission) {
  const spend = m.constraints.spendBudgetUsd ? m.consumed.spendUsd / m.constraints.spendBudgetUsd : 0
  const runs = m.constraints.runBudget ? m.consumed.runs / m.constraints.runBudget : 0
  return { spend, runs, worst: Math.max(spend, runs) }
}

/** §A4.1 pages the owner at 80% of budget, before exhaustion is a surprise. */
export const BUDGET_WARN = 0.8

export const MISSION_STATE_META: Record<MissionState, { label: string; tone: 'neutral' | 'ok' | 'brand' | 'warn' | 'crit' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  active: { label: 'Active', tone: 'brand' },
  paused: { label: 'Paused', tone: 'warn' },
  // Exhausted is not failure: the mission degrades to advise and keeps
  // reporting. That is the point of a budget that bites.
  exhausted: { label: 'Budget exhausted', tone: 'crit' },
  expired: { label: 'Expired', tone: 'neutral' },
  retired: { label: 'Retired', tone: 'neutral' },
}

/* --------------------------------- Seed ------------------------------------ */

const iso = (hrs: number) => new Date(NOW.getTime() + hrs * 3600_000).toISOString()

// Module-scoped and advanced in a fixed order, so consumption figures are
// stable across reloads — the same pattern the other seed modules use.
const rng = new Rng(90210)

/* ------------------------- Standing missions (§A4.3) ------------------------ */

/**
 * "Each tower carries standing missions that make the flywheel self-driving …
 * These are configured at cutover."
 *
 * So they are built per tower rather than hand-listed. Four missions across
 * seven steady-state towers is twenty-eight objects; written out by hand they
 * would drift from the estate the moment a tower changed, and AG-11 would be
 * measuring a list instead of a posture.
 */
const STANDING: {
  key: string
  name: string
  goal: (t: Tower) => string
  owner: (t: Tower) => string
  sponsor: string
  maxMode: ExecutionMode | 'policy_defaults'
  allow: string[]
  deny: string[]
  escalation: { pageRole: string; on: string[] }
  reporting: string[]
  spendPerQtrHour: number
  runsPerQtrHour: number
  plan: (t: Tower) => MissionPlan
}[] = [
  {
    key: 'keep_green',
    name: 'Keep Green',
    goal: (t) => `SLA and SLO attainment at or above target across ${t.name}`,
    owner: (t) => t.sdm,
    sponsor: 'T. Bergmann (Client Service Owner)',
    maxMode: 'policy_defaults',
    allow: ['AC-05', 'AC-08', 'AC-12', 'AC-18', 'AC-24', 'AC-31'],
    deny: ['AC-71', 'AC-58'],
    escalation: { pageRole: 'sdm_oncall', on: ['novel_class', 'confidence < 0.8', 'budget 80%', 'any_gate_timeout'] },
    reporting: ['Mon 07:30'],
    spendPerQtrHour: 0.09,
    runsPerQtrHour: 0.05,
    plan: (t) => ({
      watching: [`${t.name} SLA jeopardy`, 'saturation and capacity signals', 'certificate and secret expiry'],
      prepositioned: ['rb_dbpool', 'sk_rolling_restart_v11', 'sk_config_revert_v5'],
      decisionPoints: ['Any AC-31 on a tier-0 node routes to the SDM gate', 'Change freeze honoured'],
      acknowledged: true,
    }),
  },
  {
    key: 'shrink_baseline',
    name: 'Shrink the Baseline',
    goal: (t) => `Continuously propose and, within pre-approved classes, implement demand eliminations against the ${t.name} glidepath`,
    owner: () => 'S. Iyer',
    sponsor: 'T. Bergmann (Client Service Owner)',
    maxMode: 'advise',
    allow: ['AC-05', 'AC-08'],
    deny: [],
    escalation: { pageRole: 'transform_lead', on: ['yield below bar', 'budget 80%'] },
    reporting: ['Mon 08:00'],
    spendPerQtrHour: 0.3,
    runsPerQtrHour: 0.19,
    plan: (t) => ({
      watching: DEMAND_CLASSES.filter((d) => d.tower === t.id).slice(0, 3).map((d) => d.id),
      prepositioned: ['recurrence mining over the tower work history'],
      decisionPoints: ['Elimination candidates above the yield bar route to service governance'],
      acknowledged: true,
    }),
  },
  {
    key: 'earn_autonomy',
    name: 'Earn Autonomy',
    goal: (t) => `Agents on ${t.name} assemble their own promotion evidence and file permission requests as thresholds are met`,
    owner: () => 'L. Nakamura',
    sponsor: 'N. Achebe (Risk & Compliance)',
    maxMode: 'advise',
    allow: [],
    deny: ['AC-71'],
    escalation: { pageRole: 'risk_compliance', on: ['evidence gap', 'grade regression'] },
    reporting: ['Fri 16:00'],
    spendPerQtrHour: 0.05,
    runsPerQtrHour: 0.03,
    plan: (t) => ({
      watching: [`autonomy forecast for ${t.name}`, 'shadow agreement by action class', 'evaluation regressions'],
      prepositioned: ['promotion evidence packs assembled per class'],
      decisionPoints: ['A class reaching its gate files a permission request; humans decide'],
      acknowledged: true,
    }),
  },
  {
    key: 'stay_cheap',
    name: 'Stay Cheap',
    goal: (t) => `Hold unit cost per work object on ${t.name} below the contracted ceiling without degrading resolution quality`,
    owner: () => 'C. Duval',
    sponsor: 'H. Lindqvist (CIO)',
    maxMode: 'advise',
    allow: ['AC-80'],
    deny: [],
    escalation: { pageRole: 'finops', on: ['unit cost above ceiling', 'budget 80%'] },
    reporting: ['Mon 09:00'],
    spendPerQtrHour: 0.04,
    runsPerQtrHour: 0.02,
    plan: (t) => ({
      watching: [`unit cost per work object on ${t.name}`, 'model routing mix', 'context budget adherence'],
      prepositioned: ['routing frontier analysis', 'distillation candidate scoring'],
      decisionPoints: ['Routing changes route to the model change-control report'],
      acknowledged: true,
    }),
  },
]

/**
 * Every steady-state tower carries the full standing set, so AG-11 measures
 * the posture rather than a hand-maintained list. Budgets scale with the
 * tower's baseline: a bigger tower is allowed to spend proportionally more.
 */
/**
 * Who can actually serve a mission on a tower: agents posted to that tower who
 * hold at least one of the classes the mission is allowed to use. A fixed
 * roster per mission kind left several missions with an empty workforce,
 * because the agent estate is assigned per tower and Bursar does not work
 * everywhere Sentinel does.
 */
function workforceFor(tower: string, allow: string[]): string[] {
  return AGENTS.filter(
    (a) =>
      a.towers.includes(tower) &&
      a.state !== 'suspended' &&
      (allow.length === 0 ? Object.keys(a.grants).length > 0 : allow.some((c) => a.grants[c])),
  ).map((a) => a.id)
}

export const MISSIONS: Mission[] = TOWERS.filter((t) => t.state === 'S4').flatMap((t) =>
  STANDING.flatMap((m) => {
    const workforce = workforceFor(t.id, m.allow)
    // A mission no agent on this tower can serve should not exist. Creating it
    // anyway would inflate AG-11 with missions that cannot run.
    if (!workforce.length) return []

    const spendBudgetUsd = Math.round(t.baselineHrsPerQtr * m.spendPerQtrHour)
    const runBudget = Math.round(t.baselineHrsPerQtr * m.runsPerQtrHour)
    // Consumption is a fraction of budget, deterministic per mission.
    const usedFraction = rng.float(0.18, 0.86, 3)

    return [{
      id: `msn_${t.id.replace('twr_', '')}_${m.key}`,
      name: m.name,
      kind: 'standing' as const,
      goal: m.goal(t),
      tower: t.id,
      owner: m.owner(t),
      sponsor: m.sponsor,
      workforce,
      constraints: {
        maxMode: m.maxMode,
        allow: m.allow,
        deny: m.deny,
        honourFreeze: true,
        spendBudgetUsd,
        runBudget,
      },
      escalation: m.escalation,
      reporting: m.reporting,
      window: { from: iso(-720), to: iso(1440) },
      state: 'active' as const,
      consumed: {
        spendUsd: Math.round(spendBudgetUsd * usedFraction * 10) / 10,
        runs: Math.round(runBudget * usedFraction),
      },
      plan: m.plan(t),
      createdAt: iso(-720),
    }]
  }),
)
