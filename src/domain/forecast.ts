import { CLIENT, SKILLS, TOWER_BY_ID } from './estate'
import { TRANSFORM } from './ledgers'
import { AUTONOMY_SCHEDULE, SHADOW } from './knowledge'
import { AC } from './reference'
import { NOW } from './workSeed'
import { MODE_TO_LEVEL } from './reference'
import type { ISO } from './types'

/* ==========================================================================
   The Autonomy Forecast (Addendum A §A5.3).

   "Autonomy stops being a static heatmap and becomes a plan with dates —
   which is precisely what a buyer contracts against."

   Every date here is arithmetic over things the platform already holds: how
   many times a class has actually executed, how long it has been running, and
   what the promotion gate requires. Nothing is estimated by feel.

   Where a date cannot honestly be given — a permanent platform floor, a named
   blocker, no execution history at all — the forecast says which, rather than
   inventing a date to fill the column. A projection that cannot be wrong is
   not a projection.
   ========================================================================== */

/**
 * Executions required before a class can be put to the governance board, by
 * the level being requested. These are the promotion pipeline's own gates
 * (§7.2 stages 4 and 5), not estimates — L3 is the "≥ 300 executions"
 * statistical-confidence gate; L4 additionally requires a sustained L3 record.
 */
export const GATE_EXECUTIONS: Record<number, number> = {
  3: 300,
  4: 1_200,
}

/**
 * `evidence_met` is the distinction that makes this a plan rather than a
 * countdown. A class with 65,728 executions against a 1,200 gate is not
 * "eligible in 0 days" — it passed the evidence bar long ago and is waiting on
 * a governance decision. Collapsing that into a date of today would hide the
 * only actionable fact about it: the thing it needs is a person, not time.
 */
export type ForecastState = 'at_target' | 'evidence_met' | 'on_track' | 'blocked' | 'capped' | 'no_history'

export interface ForecastRow {
  tower: string
  towerName: string
  actionClass: string
  actionName: string
  current: number
  target: number
  state: ForecastState
  /** Executions recorded against this class, from the skill registry. */
  runsToDate: number
  runsRequired: number
  /** Executions per day, averaged over the engagement to date. */
  ratePerDay: number
  projectedDate: ISO | null
  daysOut: number | null
  blocker: string | null
  /** The transform item that clears the blocker, where one is in the ledger. */
  clearedBy: { id: string; title: string } | null
  /** Shadow agreement, where this class is still being shadowed. */
  agreement: number | null
}

/** Days the engagement has been running — the denominator for every rate below. */
function engagementDays(): number {
  return Math.max(1, Math.round(CLIENT.monthsElapsed * 30.44))
}

/** Executions recorded against an action class across every skill that covers it. */
export function runsForClass(actionClass: string): number {
  return SKILLS.filter((s) => s.actionClasses.includes(actionClass)).reduce((sum, s) => sum + s.runs, 0)
}

/**
 * The transform item that clears a blocker, found by the id the blocker names.
 *
 * The blocker text is authored by whoever recorded it, so the link is made by
 * looking the id up in the Transform Ledger — if the item is not there, the
 * forecast says the blocker is unlinked rather than pretending it is tracked.
 */
function clearedBy(blocker: string | undefined): { id: string; title: string } | null {
  if (!blocker) return null
  const m = blocker.match(/ta_\d+/)
  if (!m) return null
  const item = TRANSFORM.flatMap((t) => t.allocations).find((a) => a.id === m[0])
  return item ? { id: item.id, title: item.title } : null
}

export function buildForecast(): ForecastRow[] {
  const days = engagementDays()

  return AUTONOMY_SCHEDULE.filter((cell) => {
    const tower = TOWER_BY_ID[cell.tower]
    // Towers still in transition have no steady-state rate to project from.
    return tower && tower.state === 'S4'
  }).map((cell) => {
    const ac = AC[cell.actionClass]
    const runsToDate = runsForClass(cell.actionClass)
    const ratePerDay = runsToDate / days
    const runsRequired = GATE_EXECUTIONS[cell.target] ?? 0
    const shadow = SHADOW.find((s) => s.actionClass === cell.actionClass && s.tower === cell.tower)

    // A class whose platform floor already equals its target cannot move: the
    // floor is not a policy setting and no evidence changes it.
    const floorLevel = ac ? MODE_TO_LEVEL[ac.floor] : 0
    const capped = cell.current >= cell.target || (ac?.fourEyes ?? false) || cell.target <= floorLevel - 1

    let state: ForecastState
    let projectedDate: ISO | null = null
    let daysOut: number | null = null

    if (cell.current >= cell.target) {
      state = 'at_target'
    } else if (cell.blocked) {
      // A blocked class has no honest date until the blocker clears.
      state = 'blocked'
    } else if (ac?.fourEyes || cell.target <= floorLevel - 1) {
      state = 'capped'
    } else if (runsToDate === 0 || ratePerDay === 0) {
      state = 'no_history'
    } else if (runsToDate >= runsRequired) {
      // The evidence gate is already passed; what remains is a decision.
      state = 'evidence_met'
    } else {
      state = 'on_track'
      const remaining = runsRequired - runsToDate
      daysOut = Math.ceil(remaining / ratePerDay)
      projectedDate = new Date(NOW.getTime() + daysOut * 86_400_000).toISOString()
    }

    return {
      tower: cell.tower,
      towerName: TOWER_BY_ID[cell.tower]?.name ?? cell.tower,
      actionClass: cell.actionClass,
      actionName: ac?.name ?? cell.actionClass,
      current: cell.current,
      target: cell.target,
      state,
      runsToDate,
      runsRequired,
      ratePerDay,
      projectedDate,
      daysOut,
      blocker: cell.blocked ?? null,
      clearedBy: clearedBy(cell.blocked),
      agreement: shadow?.agreement ?? null,
    }
  })
}

/** The forecast rolled up to a portfolio view — what a buyer contracts against. */
export function forecastSummary(rows: ForecastRow[]) {
  const movable = rows.filter((r) => r.state !== 'at_target' && r.state !== 'capped')
  const dated = movable.filter((r) => r.daysOut !== null)
  const blocked = movable.filter((r) => r.state === 'blocked')

  return {
    atTarget: rows.filter((r) => r.state === 'at_target').length,
    total: rows.length,
    blocked: blocked.length,
    /** Classes whose blocker has a transform item already tracking it. */
    blockedWithOwner: blocked.filter((r) => r.clearedBy).length,
    /** Past the evidence gate, waiting only on a governance decision. */
    awaitingDecision: rows.filter((r) => r.state === 'evidence_met').length,
    dated: dated.length,
    /** When the last currently-datable class reaches its gate. */
    lastDateOut: dated.length ? Math.max(...dated.map((r) => r.daysOut!)) : null,
    withinQuarter: dated.filter((r) => r.daysOut! <= 90).length,
  }
}
