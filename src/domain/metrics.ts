import { TOWERS } from './estate'
import { DECISIONS, DEMAND_CLASSES, OBLIGATIONS, TRANSFORM } from './ledgers'
import { ASSERTIONS } from './knowledge'

/* ==========================================================================
   Operational metrics.

   Two kinds of figure appear on the surfaces, and they are kept apart on
   purpose:

   1. DERIVED — computed from the ledgers, the estate and the store. These are
      functions. They cannot drift from the data they describe because they
      are the data they describe. Prefer these always.

   2. SEEDED — measurements the platform would take in production but this
      build has no instrumentation for: response latencies, human decision
      times, historical series predating the simulated window. Each carries a
      note saying what would produce it in a real deployment.

   What must never appear is a third kind: a figure written inline in a
   component. A number in JSX has no provenance, cannot be traced, and quietly
   contradicts the ledger it sits beside.
   ========================================================================== */

/* --------------------------------- Derived --------------------------------- */

const runTowers = () => TOWERS.filter((t) => t.state === 'S4')

/** Share of historical volume covered by human-verified knowledge, across Run towers. */
export function verifiedVolumeCoverage(): number {
  const t = runTowers()
  if (!t.length) return 0
  return t.reduce((s, x) => s + x.verificationCoverage * x.baselineHrsPerQtr, 0) / t.reduce((s, x) => s + x.baselineHrsPerQtr, 0)
}

/** Weighted glidepath attainment against the countersigned baseline. */
export function glidepathAttainment(): { actual: number; contracted: number } {
  const t = runTowers()
  const base = t.reduce((s, x) => s + x.baselineHrsPerQtr, 0) || 1
  return {
    actual: t.reduce((s, x) => s + x.glidepathActual * x.baselineHrsPerQtr, 0) / base,
    contracted: t.reduce((s, x) => s + x.glidepathContracted * x.baselineHrsPerQtr, 0) / base,
  }
}

/** Mean autonomy-eligible volume across Run towers. */
export function autonomyEligible(): number {
  const t = runTowers()
  return t.length ? t.reduce((s, x) => s + x.autonomyEligibleVolume, 0) / t.length : 0
}


/** Year-one volume removed — classes eliminated or verifying, against the whole book. */
/**
 * `projectedRemoval` is a fraction of the class, not a percentage — a class at
 * 0.94 has 94% of its volume gone, not 0.94%. Only classes actually eliminated
 * count; one still verifying has not yet earned its decay.
 */
export function volumeRemoved(): number {
  const all = DEMAND_CLASSES.reduce((s, d) => s + d.volumeYr, 0) || 1
  const removed = DEMAND_CLASSES.filter((d) => d.eliminationState === 'eliminated').reduce(
    (s, d) => s + d.volumeYr * (d.projectedRemoval ?? 1),
    0,
  )
  return (removed / all) * 100
}

/**
 * Conditions and obligations currently on track.
 *
 * Not "closed by due date" — the registers hold current RAG state, not a
 * closure history, and the surface label says so. A metric named for
 * something the data cannot show is the same defect as a fabricated one.
 */
export function followThroughRate(): number {
  const tracked = [
    ...DECISIONS.filter((d) => d.followThrough).map((d) => d.followThrough!.state),
    ...OBLIGATIONS.map((o) => o.state),
  ]
  if (!tracked.length) return 100
  return (tracked.filter((s) => s === 'green').length / tracked.length) * 100
}

/** Realised versus promised yield on delivered transform items. */
export function realisedYield(): number | null {
  const delivered = TRANSFORM.flatMap((t) => t.allocations).filter((a) => a.yieldRealised !== undefined)
  if (!delivered.length) return null
  const promised = delivered.reduce((s, a) => s + a.yieldPromised, 0)
  const realised = delivered.reduce((s, a) => s + (a.yieldRealised ?? 0), 0)
  return promised ? ((realised - promised) / promised) * 100 : null
}

/**
 * Contradictions currently open in the demo's assertion slice.
 *
 * Deliberately an absolute count, not a rate. ASSERTIONS is a working sample
 * of a few dozen rows, not the estate's full graph — expressing two conflicts
 * out of that sample as "per thousand" would state a graph-wide quality
 * measure the sample cannot support. The graph-wide rate is instrumented in
 * production and seeded as OPERATIONAL.contradictionRatePerK.
 */
export function openContradictions(): number {
  return ASSERTIONS.filter((a) => a.conflictsWith).length
}

/** Autonomy decisions taken by the governance board, by direction. */
export function autonomyMoves(): { promotions: number; demotions: number; refused: number } {
  const approved = (d: (typeof DECISIONS)[number]) => d.decision === 'approved' || d.decision === 'approved_with_condition'
  return {
    promotions: DECISIONS.filter((d) => /^promote/i.test(d.subject) && approved(d)).length,
    demotions: DECISIONS.filter((d) => /demote/i.test(d.subject) && approved(d)).length,
    refused: DECISIONS.filter((d) => /promotion|promote/i.test(d.subject) && d.decision === 'rejected').length,
  }
}

/** Demand classes fully retired — coupling F4's only honest measure. */
export function classesRetired(): number {
  return DEMAND_CLASSES.filter((d) => d.eliminationState === 'eliminated').length
}

/**
 * Movement in autonomy-eligible volume against the last recorded quarter
 * (coupling F1). Null until a quarter has been recorded to move against.
 */
export function autonomyDelta(): number | null {
  const prior = HISTORY.autonomyEligible[HISTORY.autonomyEligible.length - 1]
  return prior === undefined ? null : autonomyEligible() - prior
}

/* --------------------------------- Seeded ---------------------------------- */

/**
 * Measurements a production deployment would instrument. Seeded here, with
 * the source named, rather than written into a component where it would read
 * as fact without provenance.
 */
export const OPERATIONAL = {
  /** Approval card opened → decision recorded. Source: gate telemetry, 30d median. */
  medianDecisionSec: 24,
  /** Assertion presented → verdict recorded. Source: verification queue telemetry. */
  medianVerificationSec: 41,
  /** Diagnosis minutes a resolver no longer spends. Source: shadow-period comparison. */
  preWorkSavingMins: 68,
  /** How often a resolver takes the agent's plan unchanged. Source: resolver telemetry. */
  planAdoptRate: 87,
  /** Evidence chain query response. Source: evidence store SLO. */
  evidenceRetrievalSec: 5,
  /** SLA disputes currently open with the client. Source: commercial register. */
  openDisputes: 1,
  /** First-review dispute closure on clock audit alone. Source: dispute history. */
  disputeFirstReviewClosure: 90,
  /** Runs staying inside their declared context budget. Source: gateway telemetry. */
  contextBudgetAdherence: 99.1,
  /** Graph-wide contradictions per 1,000 assertions per month. Source: graph QA job. */
  contradictionRatePerK: 1.4,
  /** Graph-wide assertions relied on by L3/L4 that are inside TTL. Source: graph QA job. */
  verificationCurrency: 99.2,
} as const

/**
 * The recorded history behind every trend the platform draws.
 *
 * The axes are calendar and contract: which quarters the schedule runs over,
 * what reduction each one commits to, which releases were evaluated, which
 * hours a shift covers. Those are known in advance.
 *
 * The series measured against them start empty. Each one used to carry a
 * hand-written curve — a delivery line that beat its contract in every
 * quarter, seven months of SLA attainment, six quarters of innovation value
 * rising to $380k, a shift profile peaking at noon, four releases of
 * evaluation pass rates. A chart drawn from those is indistinguishable from
 * one drawn from records, which is exactly why none may be drawn until there
 * are records: a sparkline is the most persuasive and least examined thing on
 * a screen.
 *
 * Every reader here handles an empty series by drawing nothing.
 */
export const HISTORY = {
  quarters: ['26-Q1', '26-Q2', '26-Q3', '26-Q4', '27-Q1'],
  /** Glidepath, % reduction against baseline, by quarter. Contracted: the schedule. */
  glidepathContracted: [-2, -5, -8, -10, -12],
  /** Delivered against it, by quarter. Filled from the banked glidepath ledger. */
  glidepathActual: [] as number[],
  /** SLA attainment by month, from the service records. */
  slaAttainment: [] as number[],
  /** Autonomy-eligible volume by quarter. Current value appended at use. */
  autonomyEligible: [] as number[],
  /** Verified innovation value, thousands USD, by quarter. */
  innovationValueK: [] as number[],
  /** Estate verification coverage, %, by month of transition. */
  verificationCoverage: [] as number[],
  /** Resolution volume by execution kind, across a shift's eight hours. */
  shiftHours: ['00', '03', '06', '09', '12', '15', '18', '21'],
  shiftAgentExecuted: [] as number[],
  shiftAgentAssisted: [] as number[],
  shiftHumanOnly: [] as number[],
  /** Evaluation suite pass rate by model tier, by release. */
  evalReleases: ['4.15', '4.16', '4.17', '4.18'],
  evalFrontier: [] as number[],
  evalMid: [] as number[],
  evalSmall: [] as number[],
} as const
