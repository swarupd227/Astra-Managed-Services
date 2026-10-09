import { DATA_ITEM_BY_ID, type DataItem } from './dataEstate'
import { reconcile, type ControlTotals, type Reconciliation } from './publication'

/* ==========================================================================
   Running a load, and making one go wrong on purpose.

   The run history the estate reports is a seeded thirty days: it is what the
   client's orchestrator did, so it is connector data and it is fixed. This is
   the other thing — a load run now, on request, whose record the platform
   writes itself.

   The fault injection is deliberate and it is honest. Telling a seeded feed
   to arrive late, short, or with a column renamed is seeding the connector,
   which is the one thing this platform is allowed to seed. What happens next
   is not seeded at all: the totals are counted, the reconciliation is
   computed, the decision to publish or hold follows from it, and all three
   are recorded. A demonstration that injects a fault and then also scripts
   the response would be theatre; this injects the fault and lets the
   platform answer.
   ========================================================================== */

export type Fault = 'late' | 'schema_change' | 'half_load' | 'zero_rows'

export const FAULT_LABEL: Record<Fault, string> = {
  late: 'Upstream finished late',
  schema_change: 'A column was renamed upstream',
  half_load: 'Only part of the rows arrived',
  zero_rows: 'Nothing arrived',
}

/**
 * The error each fault puts on the run, in the orchestrator's own phrasing.
 *
 * Taken from the shape of the errors in the client's own extract rather than
 * invented, so a resolver reading one here recognises it.
 */
export const FAULT_ERROR: Record<Fault, string> = {
  late: 'Source extract not ready: upstream dependency had not completed at the scheduled start',
  schema_change: "Column mapping broken by an upstream release: 'engagement_code' not found in source",
  half_load: 'Copy activity ended early: fewer rows read than the source declared',
  zero_rows: 'Copy activity returned no rows',
}

/** Whether a fault is worth retrying, and why. Checked before any retry runs. */
export const RETRYABLE: Record<Fault, { retry: boolean; because: string }> = {
  late: { retry: true, because: 'The upstream dependency finishes and the same load succeeds' },
  schema_change: { retry: false, because: 'The mapping is broken until somebody changes it; a retry breaks the same way' },
  half_load: { retry: false, because: 'A partial read repeated is a partial read; the source must be re-extracted' },
  zero_rows: { retry: false, because: 'Nothing to read again until the source produces something' },
}

/**
 * What the source declared it was sending.
 *
 * Part of the feed, so it travels with the item rather than being computed
 * here. An item whose feed declares nothing cannot be reconciled, and the
 * gate says so rather than passing it.
 */
export function controlTotalsFor(item: DataItem): ControlTotals | null {
  const declared = (item as DataItem & { controlTotals?: ControlTotals }).controlTotals
  return declared ?? null
}

export interface LoadResult {
  itemId: string
  startedAt: string
  endedAt: string
  /** The injected fault, or null for a clean run. */
  fault: Fault | null
  outcome: 'succeeded' | 'failed'
  error?: string
  /** Null where the load failed outright and counted nothing. */
  observed: ControlTotals | null
  expected: ControlTotals | null
  reconciliation: Reconciliation | null
  /** Minutes the load took. */
  durationMins: number
  /** True where the platform retried, which only a retryable fault earns. */
  retried: boolean
}

/**
 * Runs one load and counts what it moved.
 *
 * A fault changes what the source hands over; it never changes what the
 * platform does about it. `late` lands everything but after its window,
 * `half_load` lands half the rows and a proportional share of every measure,
 * `schema_change` and `zero_rows` land nothing at all.
 */
export function runLoad(itemId: string, startedAtIso: string, fault: Fault | null): LoadResult {
  const item = DATA_ITEM_BY_ID[itemId]
  const expected = item ? controlTotalsFor(item) : null
  const base = { itemId, startedAt: startedAtIso, fault, expected }

  const minutes = fault === 'late' ? 96 : fault === 'half_load' ? 41 : 22
  const endedAt = new Date(Date.parse(startedAtIso) + minutes * 60_000).toISOString()
  const retried = fault !== null && RETRYABLE[fault].retry

  // Nothing came across: there is no row to count and nothing to reconcile.
  if (fault === 'schema_change' || fault === 'zero_rows') {
    return {
      ...base, endedAt, outcome: 'failed', error: FAULT_ERROR[fault],
      observed: null, reconciliation: null, durationMins: minutes, retried,
    }
  }

  const share = fault === 'half_load' ? 0.5 : 1
  const observed: ControlTotals | null = expected
    ? {
      rows: Math.round(expected.rows * share),
      measures: Object.fromEntries(Object.entries(expected.measures).map(([m, v]) => [m, Math.round(v * share * 100) / 100])),
    }
    : null

  return {
    ...base,
    endedAt,
    // A late load is a successful load that missed its window: the rows are
    // all there. Whether that matters is the window's business, not the
    // gate's, and the gate must not hold good data for being late.
    outcome: 'succeeded',
    ...(fault === 'late' ? { error: FAULT_ERROR.late } : {}),
    observed,
    reconciliation: expected && observed ? reconcile(expected, observed) : null,
    durationMins: minutes,
    retried,
  }
}
