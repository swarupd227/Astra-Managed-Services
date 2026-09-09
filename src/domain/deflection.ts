import { NOW } from './workSeed'
import { DEMAND_CLASSES, GLIDEPATH } from './ledgers'
import type { ISO } from './types'

/* ==========================================================================
   Deflection — the rate at which demand stops arriving.

   The elimination ledger already records that demand went away and what we
   did about it. What it has never carried is a rate: a share of arrivals
   prevented, against an agreed starting point, over a stated window. Without
   those three things a claim of deflection is a number with nothing behind
   it, because the denominator is a counterfactual — you cannot count the
   tickets that were never raised.

   So the counterfactual is made explicit and signed. A baseline is agreed by
   a named person, on a stated basis, and everything is measured against it.
   Two refusals follow, and both matter more than the rate itself:

   A window too short to distinguish a deflection from a quiet fortnight
   yields no rate at all, rather than a precise-looking one.

   And the fall is split into the part the glidepath ledger can attribute and
   the part it cannot. A class whose volume halved for reasons nobody can
   name is not evidence that anything was deflected — it is a question. That
   split is the honest core of this module, and it is usually the larger half
   that is unexplained.
   ========================================================================== */

/** How a baseline was arrived at. A baseline nobody agreed is not a baseline. */
export type BaselineBasis = 'observed_12m' | 'observed_3m_annualised' | 'client_declared' | 'estimated'

export const BASIS_LABEL: Record<BaselineBasis, string> = {
  observed_12m: 'Twelve months observed',
  observed_3m_annualised: 'Three months observed, annualised',
  client_declared: 'Client-declared',
  estimated: 'Estimated at transition',
}

/**
 * Whether the basis carries a full seasonal cycle. An annualised quarter does
 * not: a baseline taken over a period that never contained a year-end close
 * or an intake week will read high or low for reasons that have nothing to do
 * with what anyone did afterwards.
 */
export const BASIS_SEASONAL: Record<BaselineBasis, boolean> = {
  observed_12m: true,
  observed_3m_annualised: false,
  client_declared: false,
  estimated: false,
}

/** Below this, the window cannot separate a deflection from a quiet spell. */
export const MIN_OBSERVED_DAYS = 60

export interface DeflectionBaseline {
  demandClass: string
  /** Arrivals per year at the agreed starting point. */
  baselineVolumeYr: number
  basis: BaselineBasis
  agreedBy: string
  agreedAt: ISO
  /** Arrivals actually counted in the current window — not annualised. */
  observedArrivals: number
  observedDays: number
}

/* --------------------------------- The seed --------------------------------- */

const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

/**
 * Kearney's agreed baselines. The bases vary because they genuinely do in a
 * transition: two towers had a year of clean ServiceNow history, one had a
 * quarter, and one class was estimated because nothing was being recorded.
 */
export const DEFLECTION_BASELINES: DeflectionBaseline[] = [
  {
    demandClass: 'dc_sw_provision', baselineVolumeYr: 2140, basis: 'observed_12m',
    agreedBy: 'M. Okafor (KNet Ops Lead)', agreedAt: ago(94), observedArrivals: 62, observedDays: 90,
  },
  {
    demandClass: 'dc_pwd_reset', baselineVolumeYr: 2484, basis: 'observed_12m',
    agreedBy: 'M. Okafor (KNet Ops Lead)', agreedAt: ago(94), observedArrivals: 508, observedDays: 90,
  },
  {
    demandClass: 'dc_node_pressure', baselineVolumeYr: 240, basis: 'observed_12m',
    agreedBy: 'D. Lindqvist (KNet Infra Lead)', agreedAt: ago(92), observedArrivals: 7, observedDays: 90,
  },
  {
    demandClass: 'dc_tf_drift', baselineVolumeYr: 312, basis: 'observed_12m',
    agreedBy: 'D. Lindqvist (KNet Infra Lead)', agreedAt: ago(92), observedArrivals: 58, observedDays: 90,
  },
  {
    demandClass: 'dc_mq_depth', baselineVolumeYr: 204, basis: 'observed_3m_annualised',
    agreedBy: 'S. Raghunathan (KNet Apps Lead)', agreedAt: ago(88), observedArrivals: 21, observedDays: 88,
  },
  {
    demandClass: 'dc_onedrive_sync', baselineVolumeYr: 926, basis: 'observed_12m',
    agreedBy: 'M. Okafor (KNet Ops Lead)', agreedAt: ago(94), observedArrivals: 268, observedDays: 90,
  },
  {
    demandClass: 'dc_zta_sync_break', baselineVolumeYr: 2362, basis: 'estimated',
    agreedBy: 'R. Venkatesh (Artizent SDM)', agreedAt: ago(60), observedArrivals: 402, observedDays: 42,
  },
]

/* ------------------------------- The reading -------------------------------- */

export interface DeflectionReading {
  baseline: DeflectionBaseline
  className: string
  tower: string
  /** Observed arrivals scaled to a year. Null where the window is too short. */
  annualisedArrivals: number | null
  /** Share of baseline arrivals no longer arriving. Null where unstatable. */
  rate: number | null
  /** Arrivals per year no longer arriving. */
  fallVolume: number | null
  /** The part of the fall the glidepath ledger can attribute, in arrivals. */
  attributedVolume: number
  /** The rest. Usually the larger half, and never presented as deflection. */
  unexplainedVolume: number | null
  /** Share of the fall that is attributed. Null where there is no fall. */
  attributedShare: number | null
  /** Why no rate is stated, where none is. */
  withheld: string | null
  /** Caveats that do not withhold the rate but change how it should be read. */
  warnings: string[]
}

/**
 * Hours the glidepath banked against a class through avoidance or
 * elimination — the two attributions that mean the work stopped arriving.
 * Automation and acceleration mean it still arrives and costs less, which is
 * a different claim and does not belong in a deflection rate.
 */
function attributedHours(demandClass: string): number {
  return GLIDEPATH
    .filter((g) => g.state === 'banked' && g.demandClass === demandClass && (g.attribution === 'avoidance' || g.attribution === 'elimination'))
    .reduce((s, g) => s + g.hoursSaved, 0)
}

export function deflectionReading(b: DeflectionBaseline, nowMs = NOW.getTime()): DeflectionReading {
  void nowMs
  const dc = DEMAND_CLASSES.find((d) => d.id === b.demandClass)
  const className = dc?.name ?? b.demandClass
  const tower = dc?.tower ?? 'unknown'

  const warnings: string[] = []
  if (!BASIS_SEASONAL[b.basis]) {
    warnings.push(
      b.basis === 'estimated'
        ? 'The baseline was estimated at transition rather than observed. The rate below inherits that estimate whole, and a wrong baseline moves the rate more than anything that has actually been done.'
        : 'The baseline covers less than a full seasonal cycle, so it may sit high or low for reasons unrelated to anything that was done since.',
    )
  }

  if (b.observedDays < MIN_OBSERVED_DAYS) {
    return {
      baseline: b, className, tower,
      annualisedArrivals: null, rate: null, fallVolume: null,
      attributedVolume: 0, unexplainedVolume: null, attributedShare: null,
      withheld: `Only ${b.observedDays} days observed. Below ${MIN_OBSERVED_DAYS} a fall cannot be told apart from a quiet spell, so no rate is stated.`,
      warnings,
    }
  }

  const annualisedArrivals = (b.observedArrivals / b.observedDays) * 365
  const fallVolume = b.baselineVolumeYr - annualisedArrivals
  const rate = b.baselineVolumeYr > 0 ? fallVolume / b.baselineVolumeYr : null

  // Attributed hours are converted to arrivals at the class's own hours-per
  // -arrival. That is a derivation, not a measurement: it assumes the
  // arrivals we removed cost what the average arrival costs.
  const hoursPerArrival = dc && dc.volumeYr > 0 ? dc.hoursYr / dc.volumeYr : 0
  const attributedVolume = hoursPerArrival > 0 ? attributedHours(b.demandClass) / hoursPerArrival : 0
  const unexplainedVolume = Math.max(0, fallVolume - attributedVolume)
  const attributedShare = fallVolume > 0 ? Math.min(1, attributedVolume / fallVolume) : null

  if (attributedShare !== null && attributedShare < 0.5) {
    warnings.push(
      `Most of the fall is unattributed: ${Math.round(unexplainedVolume).toLocaleString('en-GB')} of ${Math.round(fallVolume).toLocaleString('en-GB')} fewer arrivals a year cannot be traced to anything in the glidepath ledger. That is a question about this class, not evidence of deflection.`,
    )
  }
  if (fallVolume < 0) {
    warnings.push('Arrivals are running above the agreed baseline. This class is growing, not deflecting.')
  }

  return {
    baseline: b, className, tower,
    annualisedArrivals, rate, fallVolume,
    attributedVolume, unexplainedVolume, attributedShare,
    withheld: null,
    warnings,
  }
}

export interface DeflectionSummary {
  readings: DeflectionReading[]
  /**
   * Fleet deflection rate across classes with a statable rate, weighted by
   * baseline volume so a 40-a-year class cannot outvote a 2,400-a-year one.
   */
  rate: number | null
  /** The same rate counting only the attributed part of each fall. */
  attributedRate: number | null
  withheldCount: number
  baselineVolume: number
  fallVolume: number
  attributedVolume: number
  unexplainedVolume: number
}

export function deflectionSummary(
  baselines: DeflectionBaseline[] = DEFLECTION_BASELINES,
  nowMs = NOW.getTime(),
): DeflectionSummary {
  const readings = baselines.map((b) => deflectionReading(b, nowMs))
  const statable = readings.filter((r) => r.rate !== null)

  const baselineVolume = statable.reduce((s, r) => s + r.baseline.baselineVolumeYr, 0)
  const fallVolume = statable.reduce((s, r) => s + (r.fallVolume ?? 0), 0)
  const attributedVolume = statable.reduce((s, r) => s + r.attributedVolume, 0)

  return {
    readings,
    rate: baselineVolume > 0 ? fallVolume / baselineVolume : null,
    attributedRate: baselineVolume > 0 ? attributedVolume / baselineVolume : null,
    withheldCount: readings.length - statable.length,
    baselineVolume,
    fallVolume,
    attributedVolume,
    unexplainedVolume: Math.max(0, fallVolume - attributedVolume),
  }
}
