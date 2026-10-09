import { estateFindings, type Finding } from './watches'

/* ==========================================================================
   Experiments — a recommendation somebody decided to try.

   The recommendation register could say what had been raised and what had
   been left to expire, and nothing about what any of it returned. That is the
   half of "recommendations and innovation support" that a client actually
   pays for, and the usual way of answering it is a slide claiming a number.

   The answer here is measured instead, and it is measurable only because of
   how the findings are built. A standing finding is a condition derived from
   a register — fourteen items with no contract, three held past their stated
   retention — so funding one records the count the condition held for at the
   time, and the outcome is the same count re-derived after the window. The
   condition either went away, moved, or did not budge.

   That is deliberately not a currency figure. The estate register counts
   datasets, applications and hours of recorded demand; turning those into
   dollars needs a rate nobody has agreed, and an experiment reporting
   $71,400 realised against $62,000 promised is the kind of asserted number
   the rest of the platform refuses. Movement in the thing the experiment set
   out to move is both honest and harder to argue with.

   An experiment that did not work keeps its place in the register. A register
   that cannot say "we tried this and it returned nothing" is a brochure, and
   the two the client will remember are the failure nobody hid and the
   condition that actually went away.
   ========================================================================== */

export type FundingSource = 'capacity_credits' | 'innovation_allowance' | 'client_funded'

export const FUNDING_LABEL: Record<FundingSource, string> = {
  capacity_credits: 'Capacity credits',
  innovation_allowance: 'Innovation allowance',
  client_funded: 'Client-funded',
}

/** What was recorded when somebody decided to try a recommendation. */
export interface Experiment {
  id: string
  /** The recommendation it was struck from. */
  findingId: string
  dimensionId: string
  /** The recommendation's own words, kept so the record stands alone. */
  title: string
  /**
   * How many things the condition held for when it was funded. This is the
   * whole basis of the outcome: without it there is nothing to measure
   * against later, and the experiment becomes an anecdote.
   */
  baselineCount: number
  /** What is expected to happen, in the funder's words. */
  hypothesis: string
  /** What would count as having worked. */
  successCriterion: string
  /** How long it gets before the outcome is read. */
  windowDays: number
  fundedAt: string
  fundedBy: string
  fundingSource: FundingSource
  evidenceId?: string
}

/* --------------------------------- Readings --------------------------------- */

export type Outcome =
  /** The window has not elapsed. Nothing is claimed yet. */
  | 'in_flight'
  /** The condition the experiment set out to end is gone. */
  | 'resolved'
  /** It moved, and it is still there. */
  | 'moved'
  /** The window elapsed and nothing moved. */
  | 'no_movement'
  /** The finding it was struck from is no longer derived at all. */
  | 'unreadable'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  in_flight: 'In flight',
  resolved: 'Condition cleared',
  moved: 'Moved, not cleared',
  no_movement: 'Tested — no movement',
  unreadable: 'Cannot be read',
}

export interface ExperimentReading {
  experiment: Experiment
  outcome: Outcome
  /** The count the condition holds for now, or null where it cannot be read. */
  currentCount: number | null
  /** How far it moved. Negative where the condition grew. */
  movement: number | null
  daysElapsed: number
  /** Null once the window has passed. */
  daysLeft: number | null
  /** What the outcome was read from, so it can be checked. */
  readFrom: string
}

const DAY = 86_400_000

/**
 * One experiment against the register as it stands now.
 *
 * `findings` is passed in rather than re-derived per experiment so that a
 * page reading twenty of them does not walk every watch twenty times.
 */
export function readExperiment(e: Experiment, findings: Finding[], nowMs: number): ExperimentReading {
  const live = findings.find((f) => f.id === e.findingId) ?? null
  const daysElapsed = Math.floor((nowMs - Date.parse(e.fundedAt)) / DAY)
  const elapsed = daysElapsed >= e.windowDays
  const daysLeft = elapsed ? null : e.windowDays - daysElapsed

  // A finding that is no longer derived is not the same as a condition that
  // was cleared: the watch behind it may simply be unable to read its register
  // today, and crediting that as a success would be the worst kind of
  // measurement. Only a watch that ran and found nothing clears a condition.
  const watchRan = findings.some((f) => f.dimensionId === e.dimensionId)
  const currentCount = live ? live.count : watchRan ? 0 : null

  const outcome: Outcome =
    currentCount === null ? 'unreadable'
      : !elapsed ? 'in_flight'
        : currentCount === 0 ? 'resolved'
          : currentCount < e.baselineCount ? 'moved'
            : 'no_movement'

  return {
    experiment: e,
    outcome,
    currentCount,
    movement: currentCount === null ? null : e.baselineCount - currentCount,
    daysElapsed,
    daysLeft,
    readFrom: live
      ? live.readFrom
      : watchRan
        ? `The ${e.dimensionId.replace(/_/g, ' ')} watch ran and no longer derives this condition`
        : `The ${e.dimensionId.replace(/_/g, ' ')} watch could not be read on this request`,
  }
}

export interface ExperimentLedger {
  readings: ExperimentReading[]
  inFlight: number
  resolved: number
  moved: number
  noMovement: number
  /** Experiments whose window has passed, which is what any rate is out of. */
  concluded: number
  /**
   * Share of concluded experiments that cleared or moved their condition.
   * Null until one has concluded — nothing tried is not a nil success rate.
   */
  movedSharePct: number | null
  /** Conditions these experiments were struck against, by finding id. */
  fundedFindingIds: Set<string>
}

export function readExperiments(log: Experiment[], nowMs: number, findings = estateFindings()): ExperimentLedger {
  const readings = log
    .map((e) => readExperiment(e, findings, nowMs))
    .sort((a, b) => b.experiment.fundedAt.localeCompare(a.experiment.fundedAt))

  const by = (o: Outcome) => readings.filter((r) => r.outcome === o).length
  const concluded = by('resolved') + by('moved') + by('no_movement')

  return {
    readings,
    inFlight: by('in_flight'),
    resolved: by('resolved'),
    moved: by('moved'),
    noMovement: by('no_movement'),
    concluded,
    movedSharePct: concluded ? (100 * (by('resolved') + by('moved'))) / concluded : null,
    fundedFindingIds: new Set(log.map((e) => e.findingId)),
  }
}
