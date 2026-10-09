import { Rng } from './rng'

/* ==========================================================================
   The finance feed, and why two reports disagree.

   This is the first row-level data the platform holds. Everything else in the
   estate is counted at the item — datasets, feeds, how many rows landed —
   which is enough to say a load is short and not enough to say what a number
   is made of. A partner asking why one report says 1.30 and another says 1.55
   is asking about rows, and no amount of item-level telemetry answers it.

   The rows are seeded, which is allowed: they are what the client's finance
   system sends, and data behind a connector is the one thing this platform
   may seed. What is not seeded is the explanation. The gap is partitioned
   across the rows themselves — every row lands in exactly one bucket, and the
   buckets are summed — so the causes add up to the difference by
   construction rather than by three numbers chosen to total it. If something
   cannot be accounted for, the remainder is named rather than absorbed.
   ========================================================================== */

export type EntryKind = 'fee' | 'credit_note' | 'expense'

export const KIND_LABEL: Record<EntryKind, string> = {
  fee: 'Fees',
  credit_note: 'Credit notes',
  expense: 'Recharged expenses',
}

export interface FinanceRow {
  id: string
  client: string
  period: string
  kind: EntryKind
  /** Signed. A credit note is negative, because it takes revenue away. */
  amount: number
  /** When the row reached the warehouse. A report cannot see past its own refresh. */
  bookedAt: string
}

/**
 * What a report counts, and when it last looked.
 *
 * Two definitions of one measure is the condition the estate already records
 * against the Research & Analytics model — "one definition per measure,
 * observed 2 · net revenue". This is what those two definitions actually are.
 */
export interface ReportView {
  id: string
  name: string
  measure: string
  /** The kinds its definition of the measure includes. */
  includes: EntryKind[]
  /** The estate item it reads from, so a held load is visible here too. */
  itemId?: string
  /** When it last refreshed, before anybody refreshes it again. */
  refreshedAt: string
}

export const REPORTS: ReportView[] = [
  {
    id: 'rep_engagement', name: 'Engagement report', measure: 'Net revenue',
    includes: ['fee', 'credit_note'], itemId: 'ds_engagement_gold',
    refreshedAt: '2027-02-18T06:10:00.000Z',
  },
  {
    id: 'rep_finance', name: 'Finance dashboard', measure: 'Net revenue',
    // Finance counts recharged expenses as revenue; the engagement side does
    // not. Neither is wrong — they are answering different questions — and
    // nobody had written down that they differ.
    includes: ['fee', 'credit_note', 'expense'], itemId: 'ds_engagement_gold',
    refreshedAt: '2027-02-16T05:40:00.000Z',
  },
]

export const REPORT_BY_ID = Object.fromEntries(REPORTS.map((r) => [r.id, r])) as Record<string, ReportView>

/* ---------------------------------- The feed --------------------------------- */

const CLIENTS = ['Northwind Trading', 'Calder & Boyd', 'Pennington Group', 'Ashby Logistics', 'Marchetti Partners']
const PERIODS = ['2026-Q3', '2026-Q4', '2027-Q1']

/**
 * The rows the finance system has sent.
 *
 * Deterministic, so the same question gives the same answer every run. The
 * Northwind Q3 rows are set explicitly rather than drawn: that engagement is
 * the one carrying a difference worth explaining, and a demonstration whose
 * numbers move between runs cannot be checked by the person watching it.
 */
function build(): FinanceRow[] {
  const rng = new Rng(41_207)
  const out: FinanceRow[] = []
  let n = 0
  const row = (client: string, period: string, kind: EntryKind, amount: number, bookedAt: string) =>
    out.push({ id: `fin_${String(++n).padStart(4, '0')}`, client, period, kind, amount, bookedAt })

  for (const client of CLIENTS) {
    for (const period of PERIODS) {
      if (client === CLIENTS[0] && period === '2026-Q3') continue
      const fees = Math.round(rng.float(380_000, 2_400_000) / 1000) * 1000
      row(client, period, 'fee', fees, '2027-02-10T02:00:00.000Z')
      if (rng.next() < 0.6) row(client, period, 'expense', Math.round(fees * rng.float(0.03, 0.09) / 1000) * 1000, '2027-02-10T02:00:00.000Z')
      if (rng.next() < 0.3) row(client, period, 'credit_note', -Math.round(fees * rng.float(0.01, 0.05) / 1000) * 1000, '2027-02-12T02:00:00.000Z')
    }
  }

  // Northwind Q3 — the engagement a partner is about to ask about.
  //
  // Fees and expenses were booked before either report last looked. The credit
  // notes were raised on the Wednesday, after the finance dashboard's last
  // refresh and before the engagement report's, so one report can see them and
  // the other cannot. That is the whole of the difference, and it is a
  // difference of two kinds at once: one of timing, one of definition.
  const NW = CLIENTS[0]
  row(NW, '2026-Q3', 'fee', 1_450_000, '2027-02-10T02:00:00.000Z')
  row(NW, '2026-Q3', 'expense', 100_000, '2027-02-10T02:00:00.000Z')
  row(NW, '2026-Q3', 'credit_note', -90_000, '2027-02-17T11:20:00.000Z')
  row(NW, '2026-Q3', 'credit_note', -60_000, '2027-02-17T16:45:00.000Z')

  return out
}

export const FINANCE_ROWS: FinanceRow[] = build()

export const financeClients = () => [...new Set(FINANCE_ROWS.map((r) => r.client))].sort()

/* ------------------------------ Reading a figure ----------------------------- */

/** Whether a report can see a row at all: its definition, and its refresh. */
const visible = (r: FinanceRow, view: ReportView, refreshedAt: string) =>
  view.includes.includes(r.kind) && Date.parse(r.bookedAt) <= Date.parse(refreshedAt)

export function figureFor(client: string, period: string, view: ReportView, refreshedAt = view.refreshedAt): number {
  return FINANCE_ROWS
    .filter((r) => r.client === client && r.period === period && visible(r, view, refreshedAt))
    .reduce((n, r) => n + r.amount, 0)
}

/* ---------------------------- Explaining the gap ----------------------------- */

export type CauseKind = 'timing' | 'definition' | 'timing_and_definition'

export const CAUSE_LABEL: Record<CauseKind, string> = {
  timing: 'Booked after one report last refreshed',
  definition: 'Counted by one definition and not the other',
  timing_and_definition: 'Both: booked late and defined differently',
}

export interface Cause {
  kind: CauseKind
  /** Which report sees it. */
  seenBy: string
  /** What the rows are. */
  entryKind: EntryKind
  amount: number
  rows: number
  /** The rows behind it, so the figure can be checked. */
  examples: { id: string; amount: number; bookedAt: string }[]
}

export interface Difference {
  client: string
  period: string
  measure: string
  a: { view: ReportView; refreshedAt: string; figure: number }
  b: { view: ReportView; refreshedAt: string; figure: number }
  gap: number
  causes: Cause[]
  /** Anything the causes do not account for. Zero by construction, and checked. */
  unexplained: number
}

/**
 * Why two reports disagree, with the rows behind each reason.
 *
 * Every row is placed in exactly one bucket — seen by neither, seen by both,
 * or seen by one and not the other — so the causes sum to the gap as a
 * property of the partition rather than as an assertion. `unexplained` is
 * computed anyway and reported, because a reconciliation that cannot fail its
 * own check is not a reconciliation.
 */
export function explainDifference(opts: {
  client: string
  period: string
  aId?: string
  bId?: string
  /** Refresh times as they stand now, where a report has been refreshed since. */
  refreshedAt?: Record<string, string>
}): Difference {
  const a = REPORT_BY_ID[opts.aId ?? 'rep_engagement']
  const b = REPORT_BY_ID[opts.bId ?? 'rep_finance']
  const aAt = opts.refreshedAt?.[a.id] ?? a.refreshedAt
  const bAt = opts.refreshedAt?.[b.id] ?? b.refreshedAt

  const rows = FINANCE_ROWS.filter((r) => r.client === opts.client && r.period === opts.period)
  const figureA = rows.filter((r) => visible(r, a, aAt)).reduce((n, r) => n + r.amount, 0)
  const figureB = rows.filter((r) => visible(r, b, bAt)).reduce((n, r) => n + r.amount, 0)

  // Only the rows one report sees and the other does not move the gap. The
  // rest cancel, whatever they are worth.
  const buckets = new Map<string, Cause>()
  for (const r of rows) {
    const inA = visible(r, a, aAt)
    const inB = visible(r, b, bAt)
    if (inA === inB) continue
    const seer = inA ? a : b
    const other = inA ? b : a
    const otherAt = inA ? bAt : aAt
    const defines = other.includes.includes(r.kind)
    const timely = Date.parse(r.bookedAt) <= Date.parse(otherAt)
    const kind: CauseKind = !defines && !timely ? 'timing_and_definition' : defines ? 'timing' : 'definition'

    const key = `${seer.id}:${r.kind}:${kind}`
    const got = buckets.get(key) ?? { kind, seenBy: seer.name, entryKind: r.kind, amount: 0, rows: 0, examples: [] }
    got.amount += r.amount
    got.rows += 1
    if (got.examples.length < 3) got.examples.push({ id: r.id, amount: r.amount, bookedAt: r.bookedAt })
    buckets.set(key, got)
  }

  const causes = [...buckets.values()].sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount))
  const gap = figureA - figureB
  // Signed the way each cause pushes the gap: what only A sees raises it.
  const accounted = causes.reduce((n, c) => n + (c.seenBy === a.name ? c.amount : -c.amount), 0)

  return {
    client: opts.client,
    period: opts.period,
    measure: a.measure,
    a: { view: a, refreshedAt: aAt, figure: figureA },
    b: { view: b, refreshedAt: bAt, figure: figureB },
    gap,
    causes,
    unexplained: Math.round((gap - accounted) * 100) / 100,
  }
}
