import { DATA_ITEM_BY_ID } from './dataEstate'

/* ==========================================================================
   The publish gate — what a consumer is allowed to read.

   The data-quality watch already tells this client to move each contract to
   enforced "so a breach stops the run instead of reaching a consumer". The
   platform has been saying that for as long as the watch has existed and had
   no mechanism behind it: a load either landed or it did not, and whatever it
   contained went straight to whoever read the report.

   This is the mechanism. A load is reconciled against what the source said it
   sent before anything downstream can see it. Totals that agree are
   published; totals that do not are held, and the consumer keeps reading the
   last set that did agree, labelled with when it landed. Nobody is shown a
   figure the platform cannot stand behind, and nobody is shown a blank
   report either.

   Two figures, two origins, and they must not be confused. The expected
   totals are the source's own declaration — part of the feed, carried with
   it. The observed totals are what the platform counted after the load ran.
   The decision between them is the platform's, and it is recorded.
   ========================================================================== */

/** What a load claims to have moved, as the source declared it. */
export interface ControlTotals {
  rows: number
  /** Named measures the source totals for itself, e.g. revenue, hours. */
  measures: Record<string, number>
}

export type PublishState = 'published' | 'held'

export const PUBLISH_LABEL: Record<PublishState, string> = {
  published: 'Verified',
  held: 'Held — showing the last verified figures',
}

/** One measure that did not reconcile. */
export interface TotalsBreak {
  measure: string
  expected: number
  observed: number
  /** Signed, as a percentage of expected. Null where expected is zero. */
  deltaPct: number | null
}

export interface Reconciliation {
  matches: boolean
  breaks: TotalsBreak[]
  /** The tolerance applied, as a percentage. */
  tolerancePct: number
}

/**
 * Compares what landed against what the source said it sent.
 *
 * A tolerance is allowed because a late-arriving correction is not a broken
 * load, but it is applied per measure rather than to a total: half a load
 * that happens to even out across two measures is still half a load.
 */
export function reconcile(expected: ControlTotals, observed: ControlTotals, tolerancePct = 0.5): Reconciliation {
  const breaks: TotalsBreak[] = []
  const check = (measure: string, e: number, o: number) => {
    const deltaPct = e === 0 ? null : ((o - e) / e) * 100
    // A measure the source expected and the load did not produce at all is a
    // break whatever the tolerance says.
    if (deltaPct === null ? o !== 0 : Math.abs(deltaPct) > tolerancePct) {
      breaks.push({ measure, expected: e, observed: o, deltaPct })
    }
  }
  check('rows', expected.rows, observed.rows)
  for (const [m, e] of Object.entries(expected.measures)) check(m, e, observed.measures[m] ?? 0)
  return { matches: breaks.length === 0, breaks, tolerancePct }
}

/** The platform's decision about one load, written when it is taken. */
export interface PublishRecord {
  id: string
  itemId: string
  at: string
  by: string
  state: PublishState
  /** Why it was held, in the gate's own words. Absent when published. */
  reason?: string
  expected: ControlTotals
  observed: ControlTotals
  breaks: TotalsBreak[]
  /** The work object raised when a load was held, where one was. */
  workObjectId?: string
  evidenceId?: string
}

export interface PublicationReading {
  itemId: string
  name: string
  state: PublishState
  /** The most recent decision, or null where the item has never been gated. */
  last: PublishRecord | null
  /**
   * The last load that reconciled — what a consumer is reading while a later
   * one is held. Null where nothing has ever been published.
   */
  lastGood: PublishRecord | null
  /** Decisions taken against this item, newest first. */
  history: PublishRecord[]
}

/**
 * What a consumer of one item is reading, and whether it is the latest.
 *
 * An item nobody has gated reads as published: the gate is the thing that can
 * hold data back, and an item it has never seen is not being held by it. That
 * is stated here rather than assumed, because "no record" and "verified" look
 * the same on a screen and are not the same fact.
 */
export function readPublication(log: PublishRecord[], itemId: string): PublicationReading {
  const history = log.filter((p) => p.itemId === itemId).sort((a, b) => b.at.localeCompare(a.at))
  const last = history[0] ?? null
  return {
    itemId,
    name: DATA_ITEM_BY_ID[itemId]?.name ?? itemId,
    state: last?.state ?? 'published',
    last,
    lastGood: history.find((p) => p.state === 'published') ?? null,
    history,
  }
}

export interface PublicationSummary {
  readings: PublicationReading[]
  held: number
  published: number
  /** Items the gate has never seen. Not held, and not verified by it either. */
  ungated: number
}

/** Every item the gate has an opinion about, plus how many it has never seen. */
export function publicationSummary(log: PublishRecord[], itemIds: string[]): PublicationSummary {
  const readings = itemIds.map((id) => readPublication(log, id))
  return {
    readings: readings.filter((r) => r.last !== null).sort((a, b) => (a.state === b.state ? 0 : a.state === 'held' ? -1 : 1)),
    held: readings.filter((r) => r.state === 'held' && r.last).length,
    published: readings.filter((r) => r.state === 'published' && r.last).length,
    ungated: readings.filter((r) => r.last === null).length,
  }
}
