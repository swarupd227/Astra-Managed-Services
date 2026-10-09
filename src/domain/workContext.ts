import { blastRadius, type BlastReading } from './blastRadius'
import { GRAPH_EDGES, GRAPH_NODES } from './estate'
import { ASSERTIONS } from './knowledge'
import { DEMAND_CLASSES } from './ledgers'
import { ENGAGEMENT } from './engagement'
import { historyFor } from './ticketHistory'
import type { Assertion, DemandClassRec, GraphNode, VerificationState, WorkObject } from './types'

/* ==========================================================================
   What the platform knows about one piece of work.

   This is the knowledge agent's actual job, and until now it was a sentence.
   The work-object pane read "27 assertions (11 human-verified), 2 runbooks,
   3 prior incidents" — the same three numbers on every ticket in the estate,
   written into the component. The registers they described were all real and
   sitting one function call away; nothing joined them to a ticket.

   So this joins them, by the two keys a ticket actually carries: the estate
   nodes it affects, and the demand class it was classified into.

     assertions   subject or object is a node in play
     known errors a KnownError with a CAUSED_BY edge to a node in play
     runbooks     a Runbook with a RESOLVES edge to one of those known errors
     priors       recurring clusters in the ingested history for its class

   The confidence floor is the weakest verification state among the assertions
   the pack would be assembled from, because a pack is only as good as its
   worst claim. A pack with nothing behind it says so: an agent asked to act
   on an unmapped component should be told the estate has nothing on it rather
   than handed a reassuring count.
   ========================================================================== */

const BY_ID = new Map(GRAPH_NODES.map((n) => [n.id, n]))

/** Weakest first: the floor a pack can honestly claim. */
const FLOOR_ORDER: VerificationState[] = ['unverified', 'stale', 'machine_corroborated', 'human_verified']

export interface WorkKnowledge {
  /** The estate nodes the work names, and what the graph holds on them. */
  inPlay: GraphNode[]
  /** Named in the work but absent from the graph. */
  unmapped: string[]
  assertions: Assertion[]
  humanVerified: number
  /** Assertions that contradict another claim in the graph. */
  contradicted: Assertion[]
  knownErrors: GraphNode[]
  runbooks: GraphNode[]
  /**
   * Those of them that resolve a known error carrying this work's class. A
   * runbook on the component is context; only one of these may be attempted.
   */
  runbooksForClass: GraphNode[]
  /** The class it was classified into, where the ledger has costed one. */
  demandClass: DemandClassRec | null
  /** Prior arrivals of the same phrasing, from the client's own extract. */
  priors: { example: string; incidents: number; months: number }[]
  /** Incidents a year the class accounts for, where it is costed. */
  priorsPerYear: number | null
  /** The weakest verification state in the pack, or null where it is empty. */
  floor: VerificationState | null
  blast: BlastReading
}

/** Edges that say "this known error is caused by that node". */
const causedBy = (nodeIds: Set<string>) =>
  GRAPH_EDGES.filter((e) => e.rel === 'CAUSED_BY' && nodeIds.has(e.to)).map((e) => e.from)

/** Edges that say "this runbook resolves that known error". */
const resolves = (errorIds: Set<string>) =>
  GRAPH_EDGES.filter((e) => e.rel === 'RESOLVES' && errorIds.has(e.to)).map((e) => e.from)

/**
 * The known error a runbook resolves, and the class that error carries.
 *
 * The distinction this draws is the difference between a runbook that is
 * nearby and a runbook that applies. A component usually has more than one
 * known error against it, and a runbook resolving one of them resolves that
 * one — not whatever else happens to land on the same component.
 *
 * It took real arrivals to make this visible. The Zero-Trust client and the
 * endpoint-security stack both sit on the secure edge, so every one of the
 * client's 1,879 Zero-Trust tickets would have been offered the runbook that
 * de-duplicates antivirus agents: a confident attempt, on the right
 * component, with the wrong procedure. Everything on the component is still
 * assembled as context, because a resolver wants to know what else is known
 * there. Only the class-matched ones may be acted on.
 */
const resolvesClass = (runbookId: string, demandClass: string) =>
  GRAPH_EDGES.some((e) => {
    if (e.rel !== 'RESOLVES' || e.from !== runbookId) return false
    return BY_ID.get(e.to)?.attrs.class === demandClass
  })

/**
 * Takes only the two fields it reads, so a caller with a ticket in hand and
 * no work object yet can ask the same question without a cast that pretends
 * to be one.
 */
export type Classifiable = Pick<WorkObject, 'affected' | 'demandClass'>

export function knowledgeFor(wo: Classifiable, engagementId = ENGAGEMENT.id): WorkKnowledge {
  const named = wo.affected ?? []
  const inPlayIds = new Set(named.filter((id) => BY_ID.has(id)))
  const unmapped = named.filter((id) => !BY_ID.has(id))

  // A claim is in play if either end of it is: an assertion about what a
  // component depends on matters as much as one about the component itself.
  const assertions = ASSERTIONS.filter((a) => inPlayIds.has(a.subject) || inPlayIds.has(a.object))

  const errorIds = new Set(causedBy(inPlayIds))
  // A known error named directly in the work counts too — the hero path
  // attaches one rather than the component under it.
  for (const id of inPlayIds) if (BY_ID.get(id)?.type === 'KnownError') errorIds.add(id)
  const runbookIds = new Set(resolves(errorIds))

  const h = historyFor(engagementId)
  const priors = (h?.clusters ?? [])
    .filter((c) => c.classId === wo.demandClass)
    .map((c) => ({ example: c.example, incidents: c.incidents, months: c.months }))
    .sort((a, b) => b.incidents - a.incidents)

  const dc = DEMAND_CLASSES.find((d) => d.id === wo.demandClass) ?? null

  const states = assertions.map((a) => a.verification)
  const floor = states.length
    ? FLOOR_ORDER.find((s) => states.includes(s)) ?? null
    : null

  return {
    inPlay: [...inPlayIds].map((id) => BY_ID.get(id)!),
    unmapped,
    assertions,
    humanVerified: assertions.filter((a) => a.verification === 'human_verified').length,
    contradicted: assertions.filter((a) => a.conflictsWith),
    knownErrors: [...errorIds].map((id) => BY_ID.get(id)).filter((n): n is GraphNode => Boolean(n)),
    runbooks: [...runbookIds].map((id) => BY_ID.get(id)).filter((n): n is GraphNode => Boolean(n)),
    // The subset that resolves a known error carrying this work's class, which
    // is the only subset the routing may attempt.
    runbooksForClass: [...runbookIds]
      .filter((id) => resolvesClass(id, wo.demandClass))
      .map((id) => BY_ID.get(id))
      .filter((n): n is GraphNode => Boolean(n)),
    demandClass: dc,
    priors,
    priorsPerYear: dc && dc.volumeBasis !== 'sampled' ? dc.volumeYr : null,
    floor,
    blast: blastRadius(named),
  }
}

/**
 * The pack in one line, for a surface that has room for a sentence.
 *
 * Says what is missing when something is: "nothing in the graph" is a finding
 * an operator needs, and it is what the hard-coded version could never say.
 */
export function knowledgeSummary(k: WorkKnowledge): string {
  if (!k.assertions.length && !k.runbooks.length && !k.priors.length) {
    return k.unmapped.length
      ? `Nothing assembled: ${k.unmapped.join(', ')} ${k.unmapped.length === 1 ? 'is' : 'are'} not in the graph, so there is no context to retrieve.`
      : 'Nothing assembled: the graph holds no claims, runbooks or prior arrivals for what this work names.'
  }
  const parts = [
    `${k.assertions.length} assertion${k.assertions.length === 1 ? '' : 's'} (${k.humanVerified} human-verified)`,
    `${k.runbooks.length} runbook${k.runbooks.length === 1 ? '' : 's'}`,
    k.priors.length
      ? `${k.priors.reduce((n, p) => n + p.incidents, 0)} prior arrivals of this phrasing`
      : 'no prior arrivals of this class in the extract',
  ]
  const floor = k.floor ? ` at a ${k.floor.replace(/_/g, '-')} floor` : ''
  const contra = k.contradicted.length ? `, ${k.contradicted.length} contradicted and excluded from the floor` : ''
  return `${parts.join(', ')}${floor}${contra}.`
}
