import { ENGAGEMENT } from './engagement'
import type { InboundTicket } from './intake'
import { feedFor, volumeFor } from './ticketFeed'
import type { Priority } from './types'

/* ==========================================================================
   The client's own arrivals, asked for a page at a time.

   The intake used to be shown five invented tickets, because there was no
   arrival anywhere in the platform to show it instead. There are now
   twenty-eight thousand of the client's own, which is exactly why they are
   not in the bootstrap: a browser does not need all of them and should never
   be handed all of them. The queue is a page, and a specific reference is a
   lookup.

   One derivation happens here and it is the reason the sub-category
   declaration exists. A dump carries no configuration items — the client's
   export has a category and a sub-category and no estate identifiers at all —
   so what a ticket names is read from the declaration against its
   sub-category. That is the join between the client's filing and our estate,
   and without it every real ticket would resolve to nothing and be held
   unplaced.
   ========================================================================== */

/** A ticket the feed cannot present, and why. */
export interface WithheldTicket {
  externalRef: string
  because: string
}

export interface TicketPage {
  /** Arrivals matching the query, which is usually far more than were returned. */
  total: number
  tickets: InboundTicket[]
  withheld: WithheldTicket[]
}

/** As the paged endpoint returns a row. */
interface Row {
  externalRef: string
  shortDescription: string
  category: string
  subCategory: string
  state: string
  priorityRaw: string
  priority: string | null
  assignmentGroup: string
  reportedBy?: string
  openedAt: string
}

const PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4']

/**
 * A row as the intake takes a ticket.
 *
 * Returns the reason instead where the row cannot be presented as an arrival.
 * A ticket whose priority the feed does not translate is the case that
 * matters: the platform has four levels, the client's scheme may have more or
 * other ones, and an arrival with no level cannot be given a resolution
 * target. Defaulting it to the middle would put a clock on it that nobody
 * agreed, so it is withheld and counted and the queue says how many.
 */
function asInbound(row: Row, system: string): InboundTicket | WithheldTicket {
  if (!row.priority || !PRIORITIES.includes(row.priority as Priority)) {
    return {
      externalRef: row.externalRef,
      because: row.priorityRaw
        ? `the feed does not translate "${row.priorityRaw}" to one of the platform's four levels, so no resolution target can be set`
        : 'it carries no priority at all, so no resolution target can be set',
    }
  }
  return {
    externalRef: row.externalRef,
    system,
    openedAt: row.openedAt,
    shortDescription: row.shortDescription,
    category: row.category,
    subCategory: row.subCategory,
    priority: row.priority as Priority,
    // The join between the client's filing and our estate. Empty where their
    // sub-category has no declaration, which leaves the ticket to be placed
    // from its costed class or held — both of which are honest outcomes.
    configurationItems: volumeFor(row.category, row.subCategory)?.nodeIds ?? [],
    ...(row.reportedBy ? { reportedBy: row.reportedBy } : {}),
  }
}

function split(rows: Row[], system: string): { tickets: InboundTicket[]; withheld: WithheldTicket[] } {
  const tickets: InboundTicket[] = []
  const withheld: WithheldTicket[] = []
  for (const r of rows) {
    const t = asInbound(r, system)
    if ('because' in t) withheld.push(t)
    else tickets.push(t)
  }
  return { tickets, withheld }
}

async function get(params: Record<string, string | number | undefined>): Promise<{ total: number; tickets: Row[] }> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  const res = await fetch(`/api/tickets?${q}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? body.error ?? `/api/tickets answered ${res.status}`)
  }
  return res.json()
}

/**
 * A page of arrivals, most recent first.
 *
 * `excludeRefs` are the ones already admitted: a queue that kept offering a
 * ticket somebody has already taken in would be asking them to admit it
 * twice. The page is over-fetched and filtered rather than filtered in SQL,
 * because what has been admitted lives in this browser's records and not in
 * the client's dump.
 */
export async function fetchInbound(args: {
  limit?: number
  subCategory?: string
  q?: string
  priority?: Priority
  excludeRefs?: Set<string>
  engagementId?: string
} = {}): Promise<TicketPage> {
  const { limit = 12, subCategory, q, priority, excludeRefs = new Set(), engagementId = ENGAGEMENT.id } = args
  const feed = feedFor(engagementId)
  if (!feed) {
    throw new Error('No incident feed is configured for this engagement, so there is nothing waiting to come in.')
  }

  const page = await get({
    engagement: engagementId,
    // Over-fetched so that filtering out what is already admitted still
    // leaves a queue rather than an empty one.
    limit: Math.min(500, limit + excludeRefs.size + 20),
    sub: subCategory,
    q,
    priority,
  })

  const fresh = page.tickets.filter((r) => !excludeRefs.has(r.externalRef))
  const { tickets, withheld } = split(fresh, feed.system)
  return { total: page.total, tickets: tickets.slice(0, limit), withheld }
}

/** One arrival by the client's own reference, from anywhere in the dump. */
export async function fetchTicketByRef(
  ref: string,
  engagementId = ENGAGEMENT.id,
): Promise<{ ticket: InboundTicket | null; withheld: WithheldTicket | null }> {
  const feed = feedFor(engagementId)
  if (!feed) return { ticket: null, withheld: null }
  // Matched on the description search, which the endpoint also applies to the
  // reference by looking it up exactly first.
  const page = await get({ engagement: engagementId, limit: 1, ref: ref.trim() })
  const row = page.tickets[0]
  if (!row) return { ticket: null, withheld: null }
  const t = asInbound(row, feed.system)
  return 'because' in t ? { ticket: null, withheld: t } : { ticket: t, withheld: null }
}
