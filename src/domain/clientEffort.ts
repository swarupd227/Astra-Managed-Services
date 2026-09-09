import { NOW } from './workSeed'
import { GLIDEPATH } from './ledgers'
import type { ISO } from './types'

/* ==========================================================================
   Client-side effort — the book this platform does not own.

   The glidepath ledger measures the provider's effort against a contracted
   baseline. A client objective about releasing *their own* people from
   run-the-business work is a different baseline entirely, held on the other
   side of the boundary, and the platform has no way to see it: there are no
   client timesheets here, no client queues, no client headcount.

   The dishonest fix is to infer it — to take our banked hours, assert that
   some share of them landed on client staff, and print a figure. This module
   does the opposite. The client declares their own split, signs it, and says
   how they arrived at it. The platform's job is then narrow and honest: hold
   the declaration, show how it was arrived at, say how stale it is, and set
   it beside our banked hours so that a disagreement between the two books is
   visible rather than reconciled away.

   Two rules follow from that and are enforced here and in the store:
   the provider may never write this book, and a figure whose method was a
   manager's estimate never presents as though it were measured.
   ========================================================================== */

/** How a declared split was arrived at. The weakest basis must be visible. */
export type EffortMethod = 'timesheet' | 'sample_study' | 'survey' | 'manager_estimate'

export const METHOD_LABEL: Record<EffortMethod, string> = {
  timesheet: 'Timesheet extract',
  sample_study: 'Sampled time study',
  survey: 'Team survey',
  manager_estimate: "Manager's estimate",
}

/**
 * How much weight the basis deserves. This is not a fudge factor applied to
 * the number — the number is the client's and is never adjusted. It decides
 * what the platform is willing to call the figure.
 */
export const METHOD_STRENGTH: Record<EffortMethod, 'measured' | 'sampled' | 'reported' | 'estimated'> = {
  timesheet: 'measured',
  sample_study: 'sampled',
  survey: 'reported',
  manager_estimate: 'estimated',
}

/** Re-attestation period. Past this a declaration describes a remembered week. */
export const ATTESTATION_DAYS = 90

export interface EffortDeclaration {
  id: string
  /** A client-side function or team. Not a tower — towers are the provider's shape. */
  function: string
  /** The named client person who stands behind the figure. */
  declaredBy: string
  at: ISO
  method: EffortMethod
  /** FTE the client says sit on run-the-business work in this function. */
  runFte: number
  /** FTE on strategic or change work. */
  strategicFte: number
  /**
   * The demand classes this function is exposed to. This is the only link
   * between their book and ours, and it is the client's assertion too.
   */
  exposedTo: string[]
  note: string
}

/* --------------------------------- The seed --------------------------------- */

const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString()

/**
 * Kearney's KNet functions as they declared them at contract start and since.
 * Two functions have re-attested; two have not, and the platform says so
 * rather than carrying the opening figure forward as though it were current.
 */
export const EFFORT_DECLARATIONS: EffortDeclaration[] = [
  {
    id: 'ced_svcdesk_t0', function: 'KNet Service Desk & Endpoint', declaredBy: 'M. Okafor (KNet Ops Lead)',
    at: at(96), method: 'timesheet', runFte: 6.4, strategicFte: 0.6,
    exposedTo: ['dc_pwd_reset', 'dc_sw_provision', 'dc_onedrive_sync', 'dc_zta_sync_break'],
    note: 'Opening declaration, taken from the KNet ServiceNow assignment records for the 12 months before transition.',
  },
  {
    id: 'ced_svcdesk_t1', function: 'KNet Service Desk & Endpoint', declaredBy: 'M. Okafor (KNet Ops Lead)',
    at: at(12), method: 'timesheet', runFte: 4.9, strategicFte: 1.7,
    exposedTo: ['dc_pwd_reset', 'dc_sw_provision', 'dc_onedrive_sync', 'dc_zta_sync_break'],
    note: 'Re-attested at month 3. Two of the team moved to the Workday integration programme in January; a third resigned in February and has not been backfilled, so the run reduction is larger than the strategic gain.',
  },
  {
    id: 'ced_appseng_t0', function: 'KNet Applications Engineering', declaredBy: 'S. Raghunathan (KNet Apps Lead)',
    at: at(96), method: 'manager_estimate', runFte: 3.8, strategicFte: 2.2,
    exposedTo: ['dc_mulesoft_soleowner', 'dc_iem_ghost', 'dc_workday_migration', 'dc_batch_overrun'],
    note: 'Opening declaration. No timesheet discipline in this team; the split is the lead\'s judgement across a typical fortnight.',
  },
  {
    id: 'ced_appseng_t1', function: 'KNet Applications Engineering', declaredBy: 'S. Raghunathan (KNet Apps Lead)',
    at: at(20), method: 'sample_study', runFte: 3.5, strategicFte: 2.5,
    exposedTo: ['dc_mulesoft_soleowner', 'dc_iem_ghost', 'dc_workday_migration', 'dc_batch_overrun'],
    note: 'Two-week diary study run by KNet, prompted by the opening figure being an estimate. Firmer basis, smaller movement than the team expected.',
  },
  {
    id: 'ced_infra_t0', function: 'KNet Infrastructure & Network', declaredBy: 'D. Lindqvist (KNet Infra Lead)',
    at: at(96), method: 'survey', runFte: 4.2, strategicFte: 1.8,
    exposedTo: ['dc_node_pressure', 'dc_tf_drift', 'dc_bgp_flap', 'dc_zta_sync_break'],
    note: 'Opening declaration from a team survey. Never re-attested — the figure below is now beyond the 90-day window.',
  },
  {
    id: 'ced_secops_t0', function: 'KNet Security Operations', declaredBy: 'A. Brennan (KNet CISO office)',
    at: at(101), method: 'manager_estimate', runFte: 2.6, strategicFte: 1.4,
    exposedTo: ['dc_triple_av', 'dc_access_recert', 'dc_shadow_app', 'dc_cert_expiry'],
    note: 'Opening declaration. Security declined a timesheet extract on confidentiality grounds; this is an estimate and has not been revisited.',
  },
]

/* ------------------------------- The reading -------------------------------- */

export interface FunctionEffort {
  function: string
  baseline: EffortDeclaration
  current: EffortDeclaration
  /** True when nothing has been declared since the opening figure. */
  neverReattested: boolean
  ageDays: number
  stale: boolean
  /** Run FTE released since the baseline. Negative means run effort grew. */
  runReleased: number
  /** Strategic FTE gained. Not the same as released: people can simply leave. */
  strategicGained: number
  /**
   * Released FTE that did not turn up as strategic work. The client's own
   * figures, not ours — but an objective about *redirecting* people to
   * strategy is not served by people merely leaving the team.
   */
  unaccounted: number
  /** The weakest basis across the two declarations bounds what we can claim. */
  strength: 'measured' | 'sampled' | 'reported' | 'estimated'
  /** Provider hours banked in the classes this function says it is exposed to. */
  corroboratingHours: number
}

const STRENGTH_ORDER = ['estimated', 'reported', 'sampled', 'measured'] as const

/**
 * Hours we banked in the classes a function declared itself exposed to.
 * This corroborates a claimed release; it does not measure one. Our hours
 * come out of the provider's run model, and whether removing that work
 * reached a client engineer's week is exactly what nobody here can see.
 */
function bankedInClasses(classes: string[]): number {
  return GLIDEPATH
    .filter((g) => g.state === 'banked' && classes.includes(g.demandClass))
    .reduce((s, g) => s + g.hoursSaved, 0)
}

export function functionEffort(
  declarations: EffortDeclaration[] = EFFORT_DECLARATIONS,
  nowMs = NOW.getTime(),
): FunctionEffort[] {
  const byFunction = new Map<string, EffortDeclaration[]>()
  for (const d of declarations) {
    const list = byFunction.get(d.function) ?? []
    list.push(d)
    byFunction.set(d.function, list)
  }

  return [...byFunction.entries()].map(([fn, list]) => {
    const sorted = [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    const baseline = sorted[0]
    const current = sorted[sorted.length - 1]
    const ageDays = Math.round((nowMs - Date.parse(current.at)) / 86_400_000)
    const runReleased = baseline.runFte - current.runFte
    const strategicGained = current.strategicFte - baseline.strategicFte
    const weakest = STRENGTH_ORDER.find((s) => s === METHOD_STRENGTH[baseline.method] || s === METHOD_STRENGTH[current.method])!

    return {
      function: fn,
      baseline,
      current,
      neverReattested: sorted.length === 1,
      ageDays,
      stale: ageDays > ATTESTATION_DAYS,
      runReleased,
      strategicGained,
      unaccounted: runReleased - strategicGained,
      strength: weakest,
      corroboratingHours: bankedInClasses(current.exposedTo),
    }
  })
}

export interface ClientEffortSummary {
  functions: FunctionEffort[]
  /** Released FTE the platform is willing to report — stale figures excluded. */
  releasedFte: number
  /** Released FTE sitting behind a declaration nobody has re-attested. */
  releasedFteStale: number
  strategicGained: number
  /** Functions whose current declaration is beyond the attestation window. */
  staleCount: number
  /** Functions whose figure rests on an estimate rather than a measurement. */
  estimatedCount: number
  corroboratingHours: number
  /**
   * What a reader must be told before using the headline. Empty only when
   * every function is current and measured, which is not the usual case.
   */
  caveats: string[]
}

export function clientEffortSummary(
  declarations: EffortDeclaration[] = EFFORT_DECLARATIONS,
  nowMs = NOW.getTime(),
): ClientEffortSummary {
  const functions = functionEffort(declarations, nowMs)
  const live = functions.filter((f) => !f.stale)
  const stale = functions.filter((f) => f.stale)
  const estimated = functions.filter((f) => f.strength === 'estimated')

  const caveats: string[] = []
  if (stale.length) {
    caveats.push(
      `${stale.length} of ${functions.length} functions last declared more than ${ATTESTATION_DAYS} days ago (${stale.map((f) => f.function).join(', ')}). Their figures are excluded from the headline rather than carried forward.`,
    )
  }
  if (estimated.length) {
    caveats.push(
      `${estimated.length} function${estimated.length === 1 ? '' : 's'} rest on a manager's estimate rather than a measurement. The number is the client's and is reported unadjusted, but it is not evidence of the same kind as a timesheet extract.`,
    )
  }
  const drifted = live.filter((f) => Math.abs(f.unaccounted) > 0.3)
  if (drifted.length) {
    caveats.push(
      `In ${drifted.length} function${drifted.length === 1 ? '' : 's'} the run effort released does not equal the strategic effort gained. People released from run work do not automatically appear on strategic work — attrition, vacancy and reassignment elsewhere all look identical from here.`,
    )
  }
  caveats.push(
    'Every figure on this page is the client\'s own declaration about their own staff. The platform holds it, ages it and shows how it was arrived at. It does not measure it and cannot verify it.',
  )

  return {
    functions,
    releasedFte: live.reduce((s, f) => s + f.runReleased, 0),
    releasedFteStale: stale.reduce((s, f) => s + f.runReleased, 0),
    strategicGained: live.reduce((s, f) => s + f.strategicGained, 0),
    staleCount: stale.length,
    estimatedCount: estimated.length,
    corroboratingHours: functions.reduce((s, f) => s + f.corroboratingHours, 0),
    caveats,
  }
}
