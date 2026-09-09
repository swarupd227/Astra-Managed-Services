import { NOW } from './workSeed'
import { DEMAND_CLASSES } from './ledgers'
import { TOWERS } from './estate'
import type { ISO } from './types'

/* ==========================================================================
   Growth headroom — whether the service can absorb growth, and whether it
   has yet been asked to.

   "Supports future growth without proportional headcount" is two questions
   wearing one coat, and they have different answers.

   The backward-looking one is measurable: demand moved, effort moved, and
   the comparison between them is already in the ledgers. But it only tests
   absorption if demand actually grew. A service whose volume fell has not
   demonstrated that it absorbs growth; it has demonstrated that it removes
   work, which is a different and also valuable thing. Reporting the second
   as evidence for the first is the easiest flattery available here.

   And rising demand is not automatically growth. Demand rises because the
   client's business grew, because a transition programme is in flight, or
   because the service broke something. Only the first is growth to be
   absorbed. Netting the three together turns self-inflicted work into an
   achievement, so they are separated and never summed into one figure.

   The forward-looking question needs a forecast, a forecast needs a business
   driver, and a business driver is the client's to declare — the same
   boundary the client-effort module sits on. Extrapolating a curve from
   three months of a transition is not a forecast, and where no driver has
   been declared no headroom is stated at all.
   ========================================================================== */

/** Why a class is rising. Only one of these is growth to be absorbed. */
export type GrowthCause = 'business' | 'transition' | 'service_failure' | 'ai_estate'

export const CAUSE_LABEL: Record<GrowthCause, string> = {
  business: 'The client grew',
  transition: 'A programme is in flight',
  service_failure: 'Something the service did',
  ai_estate: 'The AI estate itself grew',
}

export const CAUSE_IS_GROWTH: Record<GrowthCause, boolean> = {
  business: true,
  transition: false,
  service_failure: false,
  ai_estate: false,
}

/**
 * Why each rising class is rising. Held here rather than on the demand class
 * because it is a judgement about causation made for this question, and it
 * should be arguable on its own terms rather than buried in the ledger.
 */
export const RISING_CAUSE: Record<string, GrowthCause> = {
  dc_zta_sync_break: 'transition',
  dc_onedrive_sync: 'service_failure',
  dc_shadow_app: 'business',
  dc_workday_migration: 'transition',
  dc_oracle_blindspot: 'service_failure',
  dc_triple_av: 'service_failure',
  dc_agent_budget: 'ai_estate',
}

/* --------------------------- Business drivers ------------------------------ */

export type DriverBasis = 'client_declared' | 'contracted_assumption' | 'observed_extrapolation'

export const DRIVER_BASIS_LABEL: Record<DriverBasis, string> = {
  client_declared: 'Declared by the client',
  contracted_assumption: 'Assumption written into the contract',
  observed_extrapolation: 'Extrapolated from observation',
}

export interface DemandDriver {
  id: string
  name: string
  /** What the platform would scale with this driver. */
  drives: string[]
  declaredBy: string
  at: ISO
  basis: DriverBasis
  baselineValue: number
  forecastValue: number
  horizonMonths: number
  note: string
}

/** A driver nobody has put a number against. Named so its absence is visible. */
export interface UndeclaredDriver {
  id: string
  name: string
  drives: string[]
  why: string
}

const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()

export const DEMAND_DRIVERS: DemandDriver[] = [
  {
    id: 'drv_consultants', name: 'Consultant headcount',
    drives: ['dc_pwd_reset', 'dc_sw_provision', 'dc_onedrive_sync', 'dc_shadow_app'],
    declaredBy: 'E. Whitfield (CIO)', at: ago(31), basis: 'client_declared',
    baselineValue: 4200, forecastValue: 4536, horizonMonths: 12,
    note: 'Eight per cent headcount growth over twelve months, declared at the January governance forum. It is the only driver anyone has put a number against.',
  },
]

export const UNDECLARED_DRIVERS: UndeclaredDriver[] = [
  {
    id: 'drv_offices', name: 'Office footprint',
    drives: ['dc_bgp_flap', 'dc_zta_sync_break', 'dc_node_pressure'],
    why: 'Ninety-six offices across forty countries are in scope and no growth or consolidation figure has been declared for them. Network and endpoint demand scales with sites, not with people, so consultant headcount does not stand in for it.',
  },
  {
    id: 'drv_acquisitions', name: 'Acquisition activity',
    drives: ['dc_shadow_app', 'dc_access_recert', 'dc_mulesoft_soleowner'],
    why: 'An acquired firm arrives with its own applications, identities and integrations. Nothing in the contract or the governance record states an expected rate, and a single acquisition would move the estate more than a year of headcount growth.',
  },
]

/* ------------------------------- The reading -------------------------------- */

const runTowers = () => TOWERS.filter((t) => t.state === 'S4')

export interface RisingSlice {
  cause: GrowthCause
  classes: { id: string; name: string; volumeYr: number; trend: number }[]
  volumeYr: number
  /** Extra arrivals a year implied by the trend on these classes. */
  incrementalYr: number
}

export interface HeadroomSummary {
  /** Volume-weighted change across every class. Negative means falling. */
  demandChangePct: number
  /** Glidepath actual across towers in run. Negative means effort fell. */
  effortChangePct: number
  /** Change from business-caused classes alone. The only growth to absorb. */
  businessGrowthPct: number
  /** Whether enough business growth has occurred to test absorption at all. */
  growthTested: boolean
  absorption: 'absorbed' | 'not_absorbed' | 'untested'
  absorptionNote: string
  /** What is actually rising, split by cause and never summed. */
  rising: RisingSlice[]
  risingVolumeYr: number
  /** Share of rising volume that is not the client growing. */
  selfInflictedShare: number
  drivers: DemandDriver[]
  undeclared: UndeclaredDriver[]
  /** Share of forecast incremental demand the service could take at flat effort. */
  headroomPct: number | null
  headroomWithheld: string | null
  /** Incremental arrivals a year implied by the declared drivers. */
  forecastIncrementalYr: number
  warnings: string[]
}

/** Below this, no business growth has happened worth calling a test. */
export const GROWTH_TEST_THRESHOLD_PCT = 1

/**
 * Business growth carried by fewer classes than this is not a test either,
 * whatever its size. Every class here was assigned its cause by judgement,
 * so a verdict resting on one class rests entirely on one judgement — and
 * "the service absorbs growth" is too large a claim to hang on that. This is
 * the guard that magnitude alone does not give you: a single contested class
 * can clear any threshold you pick.
 */
export const GROWTH_TEST_MIN_CLASSES = 2

/**
 * A class the service can take more of without adding effort: one with an
 * elimination already moving, or one sitting in a tower with meaningful
 * autonomous handling. This is a capacity judgement, not a measurement, and
 * the summary says so.
 */
function absorbable(id: string): boolean {
  const dc = DEMAND_CLASSES.find((d) => d.id === id)
  if (!dc) return false
  if (['approved', 'verifying', 'eliminated'].includes(dc.eliminationState)) return true
  const tower = TOWERS.find((t) => t.id === dc.tower)
  return Boolean(tower && tower.state === 'S4' && tower.autonomyEligibleVolume >= 40)
}

export function headroomSummary(
  drivers: DemandDriver[] = DEMAND_DRIVERS,
  undeclared: UndeclaredDriver[] = UNDECLARED_DRIVERS,
): HeadroomSummary {
  const warnings: string[] = []

  const totalVolume = DEMAND_CLASSES.reduce((s, d) => s + d.volumeYr, 0) || 1
  const demandChangePct = (DEMAND_CLASSES.reduce((s, d) => s + d.trend * d.volumeYr, 0) / totalVolume) * 100

  const towers = runTowers()
  const baselineHrs = towers.reduce((s, t) => s + t.baselineHrsPerQtr, 0) || 1
  const effortChangePct = towers.reduce((s, t) => s + t.glidepathActual * t.baselineHrsPerQtr, 0) / baselineHrs

  // What is rising, grouped by why.
  const risingClasses = DEMAND_CLASSES.filter((d) => d.trend > 0)
  const causes = [...new Set(risingClasses.map((d) => RISING_CAUSE[d.id] ?? 'service_failure'))]
  const rising: RisingSlice[] = causes.map((cause) => {
    const classes = risingClasses.filter((d) => (RISING_CAUSE[d.id] ?? 'service_failure') === cause)
    return {
      cause,
      classes: classes.map((d) => ({ id: d.id, name: d.name, volumeYr: d.volumeYr, trend: d.trend })),
      volumeYr: classes.reduce((s, d) => s + d.volumeYr, 0),
      incrementalYr: classes.reduce((s, d) => s + d.volumeYr * d.trend, 0),
    }
  }).sort((a, b) => b.incrementalYr - a.incrementalYr)

  const risingVolumeYr = rising.reduce((s, r) => s + r.volumeYr, 0)
  const businessSlice = rising.find((r) => r.cause === 'business')
  const businessGrowthPct = (rising
    .filter((r) => CAUSE_IS_GROWTH[r.cause])
    .reduce((s, r) => s + r.incrementalYr, 0) / totalVolume) * 100
  const selfInflictedShare = risingVolumeYr > 0
    ? rising.filter((r) => !CAUSE_IS_GROWTH[r.cause]).reduce((s, r) => s + r.volumeYr, 0) / risingVolumeYr
    : 0

  const businessClassCount = businessSlice?.classes.length ?? 0
  const growthTested = businessGrowthPct >= GROWTH_TEST_THRESHOLD_PCT && businessClassCount >= GROWTH_TEST_MIN_CLASSES

  const removalNote = `Total demand fell ${Math.abs(demandChangePct).toFixed(1)}% and effort fell ${Math.abs(effortChangePct).toFixed(1)}%, which shows the service removing work — a real and different achievement, and not evidence that it absorbs growth.`

  let absorption: HeadroomSummary['absorption']
  let absorptionNote: string
  if (businessGrowthPct < GROWTH_TEST_THRESHOLD_PCT) {
    absorption = 'untested'
    absorptionNote = `Business-caused demand moved ${businessGrowthPct.toFixed(1)}% against the whole book, below the ${GROWTH_TEST_THRESHOLD_PCT}% at which absorption can be said to have been tested. ${removalNote}`
  } else if (businessClassCount < GROWTH_TEST_MIN_CLASSES) {
    absorption = 'untested'
    absorptionNote = `All ${businessGrowthPct.toFixed(1)}% of business-caused growth sits in a single class${businessSlice ? ` — ${businessSlice.classes[0].name}` : ''}. Every class on this page was assigned its cause by judgement, so a verdict drawn from one of them would rest entirely on one judgement being right. That is too narrow a base for a claim about the whole service, so no verdict is given. ${removalNote}`
  } else if (effortChangePct <= businessGrowthPct) {
    absorption = 'absorbed'
    absorptionNote = `Business-caused demand grew ${businessGrowthPct.toFixed(1)}% while effort moved ${effortChangePct.toFixed(1)}%. The growth was taken without a proportional rise.`
  } else {
    absorption = 'not_absorbed'
    absorptionNote = `Business-caused demand grew ${businessGrowthPct.toFixed(1)}% and effort moved ${effortChangePct.toFixed(1)}% — effort rose at least as fast as the work.`
  }

  if (selfInflictedShare > 0.5) {
    warnings.push(
      `${Math.round(selfInflictedShare * 100)}% of rising volume is not the client growing — it is transition friction, service defects or the AI estate itself. Counting it as growth absorbed would turn work the service caused into an achievement.`,
    )
  }
  if (businessSlice) {
    warnings.push(
      `The one business-caused rise is ${businessSlice.classes.map((c) => c.name).join(', ')}. Whether that is genuinely the client growing rather than a governance gap widening is a judgement, and it is the judgement this whole figure rests on.`,
    )
  }
  warnings.push(
    'Effort is the platform\'s proxy for headcount. The contract speaks of headcount and the ledgers hold hours; a service that absorbed growth by working the same people harder would look identical here.',
  )

  // Forward-looking. No declared driver, no headroom.
  let headroomPct: number | null = null
  let headroomWithheld: string | null = null
  let forecastIncrementalYr = 0

  if (!drivers.length) {
    headroomWithheld = 'No business driver has been declared, so there is no forecast to hold capacity against. Extrapolating the observed curve would forecast the transition, not the business.'
  } else {
    let absorbableIncrement = 0
    for (const d of drivers) {
      const growth = d.baselineValue > 0 ? (d.forecastValue - d.baselineValue) / d.baselineValue : 0
      for (const id of d.drives) {
        const dc = DEMAND_CLASSES.find((c) => c.id === id)
        if (!dc) continue
        const inc = dc.volumeYr * growth
        forecastIncrementalYr += inc
        if (absorbable(id)) absorbableIncrement += inc
      }
    }
    headroomPct = forecastIncrementalYr > 0 ? (absorbableIncrement / forecastIncrementalYr) * 100 : null
    if (headroomPct === null) {
      headroomWithheld = 'The declared drivers imply no incremental demand, so there is nothing to hold capacity against.'
    }
    warnings.push(
      `Headroom covers only the ${drivers.length} declared driver${drivers.length === 1 ? '' : 's'}. ${undeclared.length} more are named and unquantified (${undeclared.map((u) => u.name).join(', ')}), and they drive classes this figure does not touch.`,
    )
  }

  return {
    demandChangePct,
    effortChangePct,
    businessGrowthPct,
    growthTested,
    absorption,
    absorptionNote,
    rising,
    risingVolumeYr,
    selfInflictedShare,
    drivers,
    undeclared,
    headroomPct,
    headroomWithheld,
    forecastIncrementalYr,
    warnings,
  }
}
