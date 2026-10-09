import { ENGAGEMENT, ENGAGEMENT_BY_ID, type Engagement } from './engagement'
import { readExperiments, type Experiment, type ExperimentLedger, type ExperimentReading, type Outcome } from './experiments'
import { estateWatch, type Finding } from './watches'
import { AGENT_BY_ID } from './estate'
import { INNOVATION } from './ledgers'
import { PROPOSALS, proposalValue, type Proposal } from './proposals'
import { thresholdsFor } from './thresholds'
import { NOW } from './workSeed'
import type { InnovationItem } from './types'

/* ==========================================================================
   Recommendations — what the service proposed without being asked.

   "Proactive recommendations and innovation support" is the least falsifiable
   promise in a managed services contract. Every provider writes it, none
   evidences it, and it settles into two slides a quarter. The only way to
   make it answerable is to count it: raised when, by whom, against which of
   the dimensions the contract names, decided or left to expire, and what the
   delivered ones actually returned against what they promised.

   The register reads two existing books rather than starting a third. A
   proposal is an agent's unprompted case about the estate; an innovation
   item is an idea moving from hypothesis to verified value. Both are
   recommendations, and the question "what have you proposed on security this
   quarter" has to see both.

   It is deliberately two-sided. A recommendation that expired undecided is
   the client's silence, not ours, and it is counted here next to the
   dimensions we have been quiet on. A ledger that only showed our diligence
   would be marketing; one that shows both is a governance paper.
   ========================================================================== */

export interface StandardDimension {
  id: string
  name: string
  /** What a recommendation here is about. */
  covers: string
}

/** What the platform recommends against. A contract names its own and maps onto these. */
export const STANDARD_DIMENSIONS: StandardDimension[] = [
  { id: 'platform_capability', name: 'Platform capabilities', covers: 'What the platform cannot do yet that the estate needs' },
  { id: 'data_quality', name: 'Data quality', covers: 'Contracts, completeness, freshness and the rules that catch a breach before a consumer does' },
  { id: 'automation', name: 'Automation', covers: 'Work a person does today that an agent or a self-service path could take' },
  { id: 'performance', name: 'Performance', covers: 'Run duration, availability against target, and the headroom before a window is missed' },
  { id: 'security', name: 'Security', covers: 'Exposure, entitlement, patch currency and what an agent may do unattended' },
  { id: 'operational_efficiency', name: 'Operational efficiency', covers: 'Hops, handoffs and rework that cost time without producing anything' },
  { id: 'cost', name: 'Cost', covers: 'Spend that buys less than it could — rightsizing, commitment cover, model routing' },
  { id: 'resilience', name: 'Resilience', covers: 'What happens when something fails, and whether that has been rehearsed' },
]

export const DIMENSION_BY_ID = Object.fromEntries(STANDARD_DIMENSIONS.map((d) => [d.id, d])) as Record<string, StandardDimension>

/* ------------------------------ One recommendation --------------------------- */

export type Origin = 'proposal' | 'innovation' | 'watch'

export const ORIGIN_LABEL: Record<Origin, string> = {
  proposal: 'Raised against the estate',
  innovation: 'Innovation register',
  watch: 'Standing finding from the estate watch',
}

/** Where a recommendation has got to. Both books' states, said once. */
export type Progress = 'open' | 'accepted' | 'delivered' | 'realised' | 'failed' | 'declined' | 'expired'

export const PROGRESS_LABEL: Record<Progress, string> = {
  open: 'Open',
  accepted: 'Accepted',
  delivered: 'Delivered',
  realised: 'Value realised',
  /** Tried, and it did not work. A register that cannot say so is a brochure. */
  failed: 'Tested — no value',
  declined: 'Declined',
  expired: 'Expired undecided',
}

export interface Recommendation {
  id: string
  origin: Origin
  title: string
  /**
   * Where a recommendation was funded as an experiment: the condition it was
   * struck against, where it stands now, and what remains of its window. This
   * is the measured answer to "what did it return", and it is a movement
   * rather than a currency figure — see `src/domain/experiments.ts`.
   */
  movement?: { baseline: number; current: number | null; daysLeft: number | null; outcome: Outcome }
  /**
   * A condition that holds rather than an idea somebody had: re-stated for as
   * long as it is true, and gone when it is fixed.
   */
  standing?: boolean
  /** What the finding was read from, and what ends it. */
  readFrom?: string
  fix?: string
  /** Downstream readers exposed by the condition. */
  exposure?: { consumers: number; largestAudience: number | null }
  /** The standard dimension it serves, or null where nobody has said. */
  dimensionId: string | null
  /** The agent or person it came from. */
  raisedBy: string
  /** Raised by an agent rather than asked for by a person. */
  unprompted: boolean
  raisedAt: string | null
  ageDays: number | null
  progress: Progress
  projectedUsd: number | null
  realisedUsd: number | null
  /** For a proposal: when the decision lapses. */
  expiresAt: string | null
  route: string
}

const DAY = 86_400_000
const age = (iso: string | null, nowMs: number) => (iso ? Math.floor((nowMs - Date.parse(iso)) / DAY) : null)

function fromProposal(p: Proposal, nowMs: number): Recommendation {
  const lapsed = Date.parse(p.expiresAt) < nowMs
  const progress: Progress =
    p.state === 'accepted' ? 'accepted'
      : p.state === 'rejected' ? 'declined'
        : p.state === 'expired' || (p.state === 'open' && lapsed) ? 'expired'
          : 'open'
  const value = proposalValue(p)
  return {
    id: p.id,
    origin: 'proposal',
    title: p.claim,
    dimensionId: p.dimension ?? null,
    raisedBy: AGENT_BY_ID[p.from]?.name ?? p.from,
    unprompted: Boolean(AGENT_BY_ID[p.from]),
    raisedAt: p.raisedAt,
    ageDays: age(p.raisedAt, nowMs),
    progress,
    projectedUsd: value.projectedUsd ?? null,
    realisedUsd: null,
    expiresAt: p.expiresAt,
    route: '/governance/proposals',
  }
}

const INNOVATION_PROGRESS: Record<InnovationItem['stage'], Progress> = {
  idea: 'open', assessed: 'open', funded: 'accepted',
  delivered: 'delivered', verified: 'realised', scaled: 'realised', retired: 'declined',
}

function fromInnovation(i: InnovationItem, nowMs: number): Recommendation {
  // The stage says the trial finished; the verdict says whether it was worth
  // finishing. A failed trial must not read as value realised.
  const progress = i.verdict === 'failed' ? 'failed' : INNOVATION_PROGRESS[i.stage]
  return {
    id: i.id,
    origin: 'innovation',
    title: i.title,
    dimensionId: i.dimension ?? null,
    raisedBy: i.source === 'agent' ? 'An agent' : i.source === 'client' ? 'The client' : i.source === 'council' ? 'The council' : 'Artizent',
    unprompted: i.source === 'agent' || i.source === 'artizent',
    raisedAt: i.raisedAt ?? null,
    ageDays: age(i.raisedAt ?? null, nowMs),
    progress,
    projectedUsd: i.projectedValueUsd ?? null,
    realisedUsd: i.realisedValueUsd ?? null,
    expiresAt: null,
    route: '/governance/savings?tab=innovation',
  }
}

/**
 * A standing finding from one of the estate watches. Dated now because the
 * watch ran now and the condition holds now — not because somebody chose
 * today to mention it.
 */
function fromWatch(f: Finding, nowMs: number): Recommendation {
  return {
    id: f.id,
    origin: 'watch',
    title: f.title,
    standing: true,
    readFrom: f.readFrom,
    fix: f.fix,
    exposure: f.exposure,
    dimensionId: f.dimensionId,
    raisedBy: AGENT_BY_ID[f.agentId]?.name ?? f.agentId,
    unprompted: true,
    raisedAt: new Date(nowMs).toISOString(),
    ageDays: 0,
    progress: 'open',
    // No currency figure: the registers behind these count items, hours and
    // readers, and a value derived from those would be asserted, not measured.
    projectedUsd: null,
    realisedUsd: null,
    expiresAt: null,
    route: f.route,
  }
}

/**
 * A finding somebody funded as an experiment.
 *
 * It replaces the standing finding it was struck from rather than sitting
 * beside it: the condition has not stopped holding because somebody decided
 * to act on it, and counting both would report the same thing twice — once as
 * a suggestion nobody has answered and once as work in flight.
 */
function fromExperiment(r: ExperimentReading, nowMs: number): Recommendation {
  const e = r.experiment
  const progress: Progress =
    r.outcome === 'in_flight' ? 'accepted'
      : r.outcome === 'resolved' ? 'realised'
        : r.outcome === 'moved' ? 'delivered'
          : r.outcome === 'no_movement' ? 'failed'
            : 'accepted'
  return {
    id: e.id,
    origin: 'innovation',
    title: e.title,
    readFrom: r.readFrom,
    fix: e.successCriterion,
    movement: { baseline: e.baselineCount, current: r.currentCount, daysLeft: r.daysLeft, outcome: r.outcome },
    dimensionId: e.dimensionId,
    raisedBy: e.fundedBy,
    // The finding behind it was raised unprompted; the decision to try it was
    // somebody's, and that is what this record is.
    unprompted: false,
    raisedAt: e.fundedAt,
    ageDays: age(e.fundedAt, nowMs),
    progress,
    // Movement in the condition, not a currency figure. See experiments.ts.
    projectedUsd: null,
    realisedUsd: null,
    expiresAt: null,
    route: '/governance/recommendations',
  }
}

/* --------------------------------- Readings ---------------------------------- */

export interface DimensionReading {
  /** The contract's own words. */
  name: string
  standard: StandardDimension | null
  recommendations: Recommendation[]
  /** Raised inside the cadence window. */
  inWindow: number
  /** Days since the last one, or null where there has never been one. */
  silentDays: number | null
  /** Nothing raised inside the window. */
  silent: boolean
  projectedUsd: number
  realisedUsd: number
}

export interface RecommendationLedger {
  engagement: Engagement
  windowDays: number
  /** Null when the contract files no dimensions: cadence is then not scored. */
  reference: string | null
  dimensions: DimensionReading[]
  all: Recommendation[]
  raisedInWindow: number
  unpromptedInWindow: number
  /** Ours to answer for. */
  silentDimensions: DimensionReading[]
  /** Raised against nothing the register recognises. */
  unclassified: Recommendation[]
  /** Theirs to answer for: a decision never made. */
  expiredUndecided: Recommendation[]
  /** Open and inside its decision window. */
  awaitingDecision: Recommendation[]
  projectedUsd: number
  realisedUsd: number
  /** Realised against projected on everything that reached a value, or null. */
  realisedVsProjectedPct: number | null
  /** Standard dimensions the contract does not name. Ours, not theirs. */
  notInContract: StandardDimension[]
  /** What has been funded as an experiment, and what it has moved so far. */
  experiments: ExperimentLedger
}


export function readRecommendations(
  opts: { engagementId?: string; nowMs?: number; windowDays?: number; experiments?: Experiment[] } = {},
): RecommendationLedger {
  const engagementId = opts.engagementId ?? ENGAGEMENT.id
  const engagement = ENGAGEMENT_BY_ID[engagementId] ?? ENGAGEMENT
  const nowMs = opts.nowMs ?? NOW.getTime()
  const windowDays = opts.windowDays ?? thresholdsFor(engagementId).recommendationWindowDays

  // The watches run once and both readers use the result: the findings
  // themselves, and the experiments measured against what they now derive —
  // including which watches managed to run, which is how a cleared condition
  // is told apart from a register that could not be read.
  const watch = estateWatch()
  const findings = watch.findings
  const funded = readExperiments(opts.experiments ?? [], nowMs, watch)

  const all = [
    ...PROPOSALS.map((p) => fromProposal(p, nowMs)),
    ...INNOVATION.map((i) => fromInnovation(i, nowMs)),
    ...funded.readings.map((r) => fromExperiment(r, nowMs)),
    // A finding somebody funded is carried as the experiment, not twice.
    ...findings.filter((f) => !funded.fundedFindingIds.has(f.id)).map((f) => fromWatch(f, nowMs)),
  ].sort((a, b) => (b.raisedAt ?? '').localeCompare(a.raisedAt ?? ''))

  const inWindow = (r: Recommendation) => r.ageDays !== null && r.ageDays <= windowDays
  const filed = engagement.improvementDimensions

  const dimensions: DimensionReading[] = (filed?.items ?? []).map((item) => {
    const mine = all.filter((r) => r.dimensionId === item.standardId)
    const last = mine.map((r) => r.ageDays).filter((d): d is number => d !== null).sort((a, b) => a - b)[0] ?? null
    return {
      name: item.name,
      standard: item.standardId ? DIMENSION_BY_ID[item.standardId] ?? null : null,
      recommendations: mine,
      inWindow: mine.filter(inWindow).length,
      silentDays: last,
      silent: !mine.some(inWindow),
      projectedUsd: mine.reduce((n, r) => n + (r.projectedUsd ?? 0), 0),
      realisedUsd: mine.reduce((n, r) => n + (r.realisedUsd ?? 0), 0),
    }
  })

  const named = new Set((filed?.items ?? []).map((i) => i.standardId).filter(Boolean))
  const valued = all.filter((r) => r.realisedUsd !== null && r.projectedUsd)
  const promised = valued.reduce((n, r) => n + (r.projectedUsd ?? 0), 0)
  const returned = valued.reduce((n, r) => n + (r.realisedUsd ?? 0), 0)

  return {
    engagement,
    windowDays,
    reference: filed?.reference ?? null,
    dimensions,
    all,
    raisedInWindow: all.filter(inWindow).length,
    unpromptedInWindow: all.filter((r) => inWindow(r) && r.unprompted).length,
    silentDimensions: dimensions.filter((d) => d.silent),
    unclassified: all.filter((r) => !r.dimensionId),
    expiredUndecided: all.filter((r) => r.progress === 'expired'),
    awaitingDecision: all.filter((r) => r.progress === 'open'),
    projectedUsd: all.reduce((n, r) => n + (r.projectedUsd ?? 0), 0),
    realisedUsd: all.reduce((n, r) => n + (r.realisedUsd ?? 0), 0),
    realisedVsProjectedPct: promised ? (100 * returned) / promised : null,
    notInContract: STANDARD_DIMENSIONS.filter((s) => !named.has(s.id)),
    experiments: funded,
  }
}
