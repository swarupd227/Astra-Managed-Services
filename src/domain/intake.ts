import { AGENTS, GRAPH_NODES } from './estate'
import { ENGAGEMENT } from './engagement'
import { SLAS } from './ledgers'
import { AC } from './reference'
import { historyFor } from './ticketHistory'
import type { Priority } from './types'

/* ==========================================================================
   The intake boundary: a ticket arriving from the client's ticketing system.

   Everything on this side of the line is real. What crosses the line is a
   payload, and a payload is the one thing that may be sampled — a connector
   that is not wired yet still has to deliver something shaped like what it
   will deliver. So `INBOUND` below is a connector sample and says so; the
   classification, the routing and the evidence that follow are computed from
   the client's own records every time.

   The platform could not previously take a ticket at all. The queue was
   generated once at start-up and the tick only advanced what was already in
   it, so "triage fires when the ticket lands" was unshowable — the one thing
   the first line of any operations demo has to do.

   Two decisions are made here, and both have to be derived rather than
   asserted, because both are the ones a client will press on.

   Classification is matched against the client's own twelve months of
   history: the sub-category the ticket arrives under, then the phrasing of
   the clusters that recur in their extract, then the theme. The confidence is
   the strength of that match and nothing else. A ticket that matches nothing
   is not classified at a low confidence — it is unclassified, and it stops.

   Routing follows from what the platform actually holds. An attempt is made
   only where a runbook resolves a known error on something the ticket names
   AND an agent holds a grant for what that runbook does. Otherwise the ticket
   goes to a named person with the reason it could not be attempted, which is
   the honest version of "the agent tried".
   ========================================================================== */

/** A ticket as the ticketing system hands it over. */
export interface InboundTicket {
  /** The ticketing system's own reference. */
  externalRef: string
  /** Which system handed it over. */
  system: string
  openedAt: string
  shortDescription: string
  category: string
  subCategory: string
  priority: Priority
  /** Configuration items named on the ticket, by estate id or name. */
  configurationItems: string[]
  reportedBy?: string
}

/* ------------------------------ Classification ------------------------------ */

export interface MatchEvidence {
  on: 'sub_category' | 'phrasing' | 'theme'
  value: string
  /** Arrivals behind the match in the client's extract. */
  incidents?: number
}

export interface Classification {
  demandClass: string | null
  themeId: string | null
  /** Strength of the match against the client's own history, 0–1. */
  confidence: number
  evidence: MatchEvidence[]
  /** Why it could not be classified. Present only when demandClass is null. */
  refusal?: string
}

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'not', 'with', 'at',
  'from', 'by', 'it', 'this', 'that', 'be', 'has', 'have', 'was', 'were', 'after', 'when',
])

const words = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w))

/**
 * What the arriving ticket is, read against what the client has sent before.
 *
 * Deliberately ordered strongest evidence first, and deliberately refuses. A
 * confidence invented for an unmatched ticket is how an agent ends up acting
 * on something nobody has seen before.
 */
export function classify(t: InboundTicket, engagementId = ENGAGEMENT.id): Classification {
  const h = historyFor(engagementId)
  if (!h) {
    return {
      demandClass: null, themeId: null, confidence: 0, evidence: [],
      refusal: 'No ticket history is ingested for this engagement, so there is nothing to classify against.',
    }
  }

  const biggest = Math.max(...h.clusters.map((c) => c.incidents), 1)
  const sub = t.subCategory.trim().toLowerCase()

  // 1. The sub-category the client's own system filed it under.
  const bySub = h.clusters.filter((c) => c.subCategory.trim().toLowerCase() === sub && c.classId)
  if (bySub.length) {
    const best = bySub.sort((a, b) => b.incidents - a.incidents)[0]
    const theme = h.themes.find((x) => x.classIds.includes(best.classId!)) ?? null
    return {
      demandClass: best.classId!,
      themeId: theme?.id ?? null,
      // Dominance of the match, floored so a real sub-category match is never
      // weak and capped below certainty, which no classifier has earned.
      confidence: Math.min(0.95, 0.78 + 0.17 * (best.incidents / biggest)),
      evidence: [{ on: 'sub_category', value: best.subCategory, incidents: bySub.reduce((n, c) => n + c.incidents, 0) }],
      }
  }

  // 2. The phrasing of a cluster that recurs in their extract.
  const tokens = new Set(words(t.shortDescription))
  const scored = h.clusters
    .filter((c) => c.classId)
    .map((c) => {
      const theirs = words(c.example)
      const hit = theirs.filter((w) => tokens.has(w))
      return { c, overlap: theirs.length ? hit.length / theirs.length : 0, hit }
    })
    .filter((x) => x.overlap >= 0.4 && x.hit.length >= 2)
    .sort((a, b) => b.overlap - a.overlap || b.c.incidents - a.c.incidents)

  if (scored.length) {
    const { c, overlap, hit } = scored[0]
    const theme = h.themes.find((x) => x.classIds.includes(c.classId!)) ?? null
    return {
      demandClass: c.classId!,
      themeId: theme?.id ?? null,
      confidence: Math.min(0.88, 0.5 + 0.38 * overlap),
      evidence: [{ on: 'phrasing', value: `${c.example} — matched on ${hit.join(', ')}`, incidents: c.incidents }],
    }
  }

  // 3. The theme, which places it without costing it.
  const themeHit = h.themes.find((x) => {
    const n = words(x.name)
    return n.some((w) => tokens.has(w) || sub.includes(w))
  })
  if (themeHit) {
    const classId = themeHit.classIds[0] ?? null
    return {
      demandClass: classId,
      themeId: themeHit.id,
      // A theme places a ticket but does not identify it. Below the shadow
      // thresholds on purpose: this wants a person's eye.
      confidence: classId ? 0.45 : 0.3,
      evidence: [{ on: 'theme', value: themeHit.name, incidents: themeHit.incidents }],
      ...(classId ? {} : { refusal: `Falls under ${themeHit.name}, which carries no costed class in the ledger.` }),
    }
  }

  return {
    demandClass: null,
    themeId: null,
    confidence: 0,
    evidence: [],
    refusal: `Nothing in ${h.volumes.incidents.toLocaleString('en-GB')} recorded incidents matches "${t.shortDescription}" under ${t.category} / ${t.subCategory}.`,
  }
}

/* --------------------------------- Routing ---------------------------------- */

export type Route =
  | { attempt: true; agentId: string; runbookId: string; actionClasses: string[]; because: string }
  | { attempt: false; toRole: string; because: string }

const BY_ID = new Map(GRAPH_NODES.map((n) => [n.id, n]))

/** Estate nodes a ticket's configuration items resolve to. */
export function resolveItems(cis: string[]): { resolved: string[]; unresolved: string[] } {
  const resolved: string[] = []
  const unresolved: string[] = []
  for (const ci of cis) {
    const direct = BY_ID.has(ci) ? ci : null
    const byName = direct ?? GRAPH_NODES.find((n) => n.name.toLowerCase() === ci.trim().toLowerCase())?.id ?? null
    if (byName) resolved.push(byName)
    else unresolved.push(ci)
  }
  return { resolved: [...new Set(resolved)], unresolved }
}

/**
 * Whether the platform may attempt this itself, and who gets it if not.
 *
 * The bar is deliberately specific: a runbook that resolves a known error on
 * something the ticket names, and an agent holding a grant for every class
 * that runbook uses. Anything short of that is a hand-off with a stated
 * reason — "no runbook for it" and "no agent is graded for it" are different
 * problems and the reason says which.
 */
export function routeFor(
  args: { classification: Classification; runbooks: { id: string; attrs: Record<string, string | number> }[]; tower: string },
): Route {
  const { classification, runbooks } = args

  if (!classification.demandClass) {
    return { attempt: false, toRole: 'resolver', because: classification.refusal ?? 'Unclassified, so no runbook can be selected.' }
  }
  if (classification.confidence < 0.6) {
    return {
      attempt: false,
      toRole: 'resolver',
      because: `Classified at ${Math.round(classification.confidence * 100)}% against the client's history, which is below the bar for acting unattended.`,
    }
  }
  if (!runbooks.length) {
    return { attempt: false, toRole: 'resolver', because: 'No runbook in the graph resolves a known error on what this ticket names.' }
  }

  // A runbook declares the classes it uses; the engine has to know them all.
  const rb = runbooks[0]
  const uses = String(rb.attrs.uses ?? '').split(/[,\s]+/).filter((x) => /^AC-\d+$/.test(x))
  if (!uses.length) {
    return { attempt: false, toRole: 'resolver', because: `${rb.id} names no action classes, so there is nothing it authorises.` }
  }
  const unknown = uses.filter((c) => !AC[c])
  if (unknown.length) {
    return { attempt: false, toRole: 'aieng', because: `${rb.id} uses ${unknown.join(', ')}, which the policy engine does not know.` }
  }

  const agent = AGENTS.find((a) => uses.every((c) => a.grants[c]) && a.towers.includes(args.tower))
  if (!agent) {
    return {
      attempt: false,
      toRole: 'resolver',
      because: `No agent on this tower holds a grant for every class ${rb.id} uses (${uses.join(', ')}).`,
    }
  }

  return {
    attempt: true,
    agentId: agent.id,
    runbookId: rb.id,
    actionClasses: uses,
    because: `${rb.id} resolves a known error on what the ticket names, and ${agent.name} is graded for ${uses.join(', ')}.`,
  }
}

/**
 * The resolution target for a priority, from the contracted service levels.
 *
 * Read from the service-level register rather than restated: the clock a
 * ticket runs against has to be the one the contract will be measured on.
 * Falls back to the platform's own default only where the contract files no
 * level for that priority, and says which by returning `contracted`.
 */
export function targetFor(priority: Priority, tower?: string): { mins: number; contracted: boolean } {
  const resolution = SLAS.filter((s) => s.kind === 'sla' && s.metric === 'resolution_time' && s.targetMins > 0)
  const onTower = tower ? resolution.filter((s) => s.tower === tower) : []
  const named = [...onTower, ...resolution].find((s) => s.name.toUpperCase().includes(priority))
  if (named) return { mins: named.targetMins, contracted: true }
  return { mins: PLATFORM_TARGET[priority], contracted: false }
}

/** Used only where the contract files no resolution level for a priority. */
const PLATFORM_TARGET: Record<Priority, number> = { P1: 60, P2: 240, P3: 480, P4: 1440 }

/**
 * Which tower owns the work, read from the estate rather than assumed.
 *
 * The tower decides the policy that governs the action, so guessing it would
 * guess the gate. Nothing resolved means nothing can be said: the caller gets
 * null and the ticket is held for a person to place.
 */
export function towerForItems(nodeIds: string[]): string | null {
  const towers = nodeIds.map((id) => BY_ID.get(id)?.tower).filter((t): t is string => Boolean(t))
  if (!towers.length) return null
  // Where a ticket spans towers, the one holding the most critical node owns
  // it: that is where the stricter policy lives.
  const byTier = nodeIds
    .map((id) => BY_ID.get(id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .sort((a, b) => a.tier - b.tier)
  return byTier[0].tower
}

/* ---------------------------- Behind the connector --------------------------- */

/**
 * Sample inbound tickets.
 *
 * This is the one thing on this page that is seeded, because it is the one
 * thing that crosses the integration boundary. They are shaped as the
 * ticketing system delivers them — an external reference, a category and
 * sub-category, the configuration items named on the ticket — and they are
 * chosen to exercise each branch rather than to flatter it: one that matches
 * the client's history strongly, one that matches only by phrasing, one whose
 * configuration item is not in the estate at all, and one that matches
 * nothing and must go to a person.
 */
export const INBOUND: InboundTicket[] = [
  {
    externalRef: 'INC0491204', system: 'ServiceNow', openedAt: '2027-02-18T09:12:00.000Z',
    shortDescription: 'IEM login not working — expired password', category: 'Access', subCategory: 'Access IEM',
    priority: 'P3', configurationItems: ['app_iem'], reportedBy: 'J. Alvarez',
  },
  {
    externalRef: 'INC0491205', system: 'ServiceNow', openedAt: '2027-02-18T09:31:00.000Z',
    shortDescription: 'ADF pipeline failed overnight on the customer feed', category: 'Job failure', subCategory: 'Data pipeline',
    priority: 'P2', configurationItems: ['pipe_datamart'], reportedBy: 'Monitoring',
  },
  {
    externalRef: 'INC0491206', system: 'ServiceNow', openedAt: '2027-02-18T09:44:00.000Z',
    shortDescription: 'Endpoint security agents contending for CPU on partner laptops', category: 'Performance', subCategory: 'Slowness',
    priority: 'P2', configurationItems: ['ke_triple_av'], reportedBy: 'R. Castellano',
  },
  {
    externalRef: 'INC0491207', system: 'ServiceNow', openedAt: '2027-02-18T09:58:00.000Z',
    shortDescription: 'Quarterly partner distribution model returning negative allocations', category: 'Application error', subCategory: 'Calculation',
    priority: 'P1', configurationItems: ['app_partner_dist'], reportedBy: 'E. Whitfield',
  },
]
