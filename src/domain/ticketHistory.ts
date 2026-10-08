import { loadedTicketHistories } from './config'
import { thresholdsFor } from './thresholds'

/* ==========================================================================
   The ticket history ingested for an engagement.

   Before a commitment can be made, somebody has to say what the work looks
   like today — and that statement has to come from the client's own records
   rather than from a bid team's instinct. This file holds what one extract
   yielded: how much work arrived, how it divides into themes, which phrasings
   repeat, and how concentrated the whole book is.

   Two things make it platform code rather than one client's spreadsheet.
   A history belongs to an engagement, so a second client loads its own and
   nothing here changes. And every history carries what its extract will not
   support: a field left at a default, a timestamp nobody supplied. A measure
   that needs one of those is refused rather than estimated, which is why
   `cannot` is as load-bearing as the counts above it.
   ========================================================================== */

/** What an extract can be asked for. A history says which of these it supports. */
export type Derivable =
  | 'volume'
  | 'recurrence'
  | 'arrival'
  | 'theme'
  | 'inventory_match'
  | 'problem_coverage'
  | 'priority'
  | 'handling_time'

export const DERIVABLE_LABEL: Record<Derivable, string> = {
  volume: 'How much work arrives',
  recurrence: 'What repeats',
  arrival: 'When it arrives',
  theme: 'What it is about',
  inventory_match: 'Whether the application is on the client’s list',
  problem_coverage: 'Whether a cause was ever raised',
  priority: 'How urgent the client said it was',
  handling_time: 'How long it took to resolve',
}

/** A theme of demand, and the costed classes that stand against it. */
export interface DemandTheme {
  id: string
  name: string
  incidents: number
  pctOfInScope: number
  /**
   * The demand classes in the elimination ledger that answer this theme.
   * Named here rather than inferred, so a removal figure can be audited back
   * to the classes it was read from.
   */
  classIds: string[]
}

/** A phrasing that keeps coming back, as the extract spells it. */
export interface Cluster {
  id: string
  /** The example the extract carries, verbatim. */
  example: string
  subCategory: string
  incidents: number
  /** Distinct months it was seen in. A cluster seen once is noise. */
  months: number
  /** The demand class carrying its cause, where one exists. */
  classId?: string
}

export interface TicketHistory {
  engagementId: string
  source: string
  period: { from: string; to: string; months: number }
  /** Everything in the extract, before scope is applied. */
  volumes: { incidents: number; requests: number; problems: number; catalogueTasks: number }
  scope: {
    rule: string
    inScope: number
    inScopePct: number
    byLine: { id: string; name: string; incidents: number }[]
  }
  themes: DemandTheme[]
  clusters: Cluster[]
  shape: {
    subCategories: number
    top5Pct: number
    top16Pct: number
    singletons: number
    /** Share of in-scope incidents arriving outside 08:00–18:00 local. */
    outOfHoursPct: number
    weekendPct: number
    /** Share of in-scope incidents whose phrasing has been seen before. */
    repeatPct: number
    clustersOverTen: number
    clusterSharePct: number
    /** Raised by a person rather than by monitoring. */
    humanRaisedPct: number
    stillOpenPct: number
    /** Applications seen in tickets but absent from the client's own list. */
    offInventoryPct: number
    offInventory: number
  }
  problems: { records: number; open: number; inScopeWithoutProblemPct: number }
  /** Request growth across the extract's two halves. */
  growth: { firstHalf: number; secondHalf: number; pct: number }
  cannot: { what: Derivable; because: string }[]
}

/* ------------------------------- The extracts ------------------------------- */

/**
 * The histories ingested for each engagement.
 *
 * These were a TypeScript literal until the extract moved into the database.
 * An engagement with nothing ingested simply has no row — which is why
 * `historyFor` returns null rather than an empty history, and why every
 * reading that needs one refuses instead of counting zero.
 */
export const TICKET_HISTORIES: TicketHistory[] = loadedTicketHistories() as TicketHistory[]

export const historyFor = (engagementId: string): TicketHistory | null =>
  TICKET_HISTORIES.find((h) => h.engagementId === engagementId) ?? null

/** Why a derivation is refused, or null where the extract supports it. */
export const refusal = (h: TicketHistory, what: Derivable): string | null =>
  h.cannot.find((c) => c.what === what)?.because ?? null

export const themeOf = (h: TicketHistory, id: string): DemandTheme | null => h.themes.find((t) => t.id === id) ?? null

/** Clusters at or above the threshold a problem record is expected at. */
export const recurring = (h: TicketHistory, atLeast?: number): Cluster[] => {
  const floor = atLeast ?? thresholdsFor(h.engagementId).recurringClusterThreshold
  return h.clusters.filter((c) => c.incidents >= floor)
}

/** Clusters whose cause is carried by a costed demand class. */
export const clustersWithCause = (h: TicketHistory, atLeast?: number): Cluster[] =>
  recurring(h, atLeast).filter((c) => Boolean(c.classId))
