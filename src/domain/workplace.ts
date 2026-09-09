import { GRAPH_NODES, TOWERS } from './estate'
import { DEMAND_CLASSES, SLAS } from './ledgers'
import { WORK_OBJECTS } from './workSeed'
import type { WorkObject } from './types'

/* ==========================================================================
   The workplace — the first surface in this platform that faces the person
   the service is actually for.

   Every other screen serves the provider or the client's IT function. The
   consultant whose laptop is slow, whose file will not sync, who cannot get
   into the deck an hour before a steering committee, appears here only as a
   ticket volume and an XLA score. The platform measures their experience
   and has never been part of it.

   Two things make this more than a portal, and both are constraints rather
   than features.

   The first is what it must not claim. Everything shown here is derived
   from the same ledgers the provider reads — there is no second set of
   numbers for the end user, because a service that tells its customer a
   different story from the one it tells itself has two stories and no
   truth. Where a figure is about people like them rather than about them,
   it says so: an XLA is a population measure and reads as one.

   The second is what happens when an agent answers a consultant directly.
   Everywhere else an operator sits between the model and the person acting
   on what it said, and that operator is the last place a fabrication is
   caught. Here there is nobody. So an end-user-facing answer carries a
   higher verification floor than the same answer shown to an engineer —
   enforced in the policy engine as r0f, not as a convention on this page.
   ========================================================================== */

export interface Consumer {
  id: string
  name: string
  title: string
  office: string
  /**
   * The estate this person depends on. Their issues are matched through it
   * rather than through a requester field, which is also how it works in
   * life: you are affected by an outage on a system you use, whether or not
   * you were the one who reported it.
   */
  dependsOn: string[]
  /** Demand classes this person has raised in the period, from their own record. */
  raised: { demandClass: string; count: number }[]
  /** The tower whose experience instrument covers them. */
  homeTower: string
}

/**
 * A named Kearney consultant. One is enough: this surface exists to prove
 * the platform can face an end user at all, and a directory of invented
 * people would add volume without adding an answer.
 */
export const CONSUMER: Consumer = {
  id: 'usr_dalgleish',
  name: 'H. Dalgleish',
  title: 'Principal, Operations Practice',
  office: 'Chicago',
  /*
   * Endpoint and application level only. Shared production infrastructure is
   * deliberately not on this list: a consultant does not depend on the prod
   * compute cluster in any sense they could act on, and putting it here made
   * them "affected by" most of the estate — seventy-one open items, which is
   * a wall of noise rather than a page that helps anyone.
   */
  dependsOn: ['app_iem', 'net_sase_edge', 'ke_triple_av'],
  raised: [
    { demandClass: 'dc_pwd_reset', count: 3 },
    { demandClass: 'dc_sw_provision', count: 2 },
    { demandClass: 'dc_onedrive_sync', count: 2 },
    { demandClass: 'dc_triple_av', count: 1 },
    { demandClass: 'dc_zta_sync_break', count: 2 },
  ],
  homeTower: 'twr_euc',
}

/* ------------------------------ What they see ------------------------------- */

export interface AffectingIssue {
  work: WorkObject
  /** Which of their dependencies this touches. */
  via: string[]
  viaNames: string[]
}

/** Towers whose work is felt by the people using the service, not just by IT. */
const END_USER_TOWERS = ['twr_euc', 'twr_network', 'twr_secops']

/**
 * Adjacency is not relevance. Several of this person's dependencies are
 * shared — a global network edge carries everything routed through it — so
 * matching on the dependency alone surfaced finance reports and BI pipeline
 * failures as things "affecting" a consultant. They touch the same node and
 * they are not their problem.
 *
 * An item earns a place here only if it is also the kind of thing an end
 * user feels: work in a tower that serves them directly, or work in a class
 * they have themselves raised.
 */
function isRelevantToConsumer(w: WorkObject, c: Consumer): boolean {
  return END_USER_TOWERS.includes(w.tower) || c.raised.some((r) => r.demandClass === w.demandClass)
}

/**
 * Open work touching something this person depends on. Not "their tickets" —
 * the point of showing it is that a consultant about to raise a duplicate
 * can see the thing is already known, which is where deflection actually
 * happens.
 */
export function issuesAffecting(c: Consumer = CONSUMER): AffectingIssue[] {
  return WORK_OBJECTS
    .filter((w) => !['resolved', 'learned'].includes(w.state) && w.affected.some((a) => c.dependsOn.includes(a)) && isRelevantToConsumer(w, c))
    .map((w) => {
      const via = w.affected.filter((a) => c.dependsOn.includes(a))
      return {
        work: w,
        via,
        viaNames: via.map((id) => GRAPH_NODES.find((n) => n.id === id)?.name ?? id),
      }
    })
    .sort((a, b) => b.work.breachProbability - a.work.breachProbability)
}

export interface SelfServeOffer {
  demandClass: string
  name: string
  /** How many times this person has raised it. */
  raisedByThem: number
  /** Whether an elimination is far enough along to offer a route. */
  available: boolean
  /** Why not, where it is not. */
  unavailableReason: string | null
  state: string
  projectedRemoval: number | null
}

/**
 * Self-service routes for the things this person actually raises. An offer
 * is only made where the elimination behind it is genuinely moving —
 * offering a route that does not exist yet is how a portal teaches people
 * to stop trusting it.
 */
export function selfServeOffers(c: Consumer = CONSUMER): SelfServeOffer[] {
  return c.raised.map((r) => {
    const dc = DEMAND_CLASSES.find((d) => d.id === r.demandClass)
    const moving = dc ? ['approved', 'verifying', 'eliminated'].includes(dc.eliminationState) : false
    const isSelfService = dc?.proposalType === 'self_service'
    const available = moving && Boolean(dc)
    return {
      demandClass: r.demandClass,
      name: dc?.name ?? r.demandClass,
      raisedByThem: r.count,
      available,
      unavailableReason: available
        ? null
        : dc
          ? `The fix for this is ${dc.eliminationState.replace(/_/g, ' ')}${isSelfService ? ' and will be a self-service route when it lands' : ''}. Until it is verified there is no route to offer, so this still needs a person.`
          : 'No elimination is recorded against this class.',
      state: dc?.eliminationState ?? 'none',
      projectedRemoval: dc?.projectedRemoval ?? null,
    }
  })
}

export interface CohortExperience {
  slaId: string
  name: string
  metric: string
  attainment: number
  target: number
  meeting: boolean
  volumeMtd: number
}

/**
 * The experience instruments covering this person's tower. These are cohort
 * figures and the surface must never let them read as personal: a service
 * that hit its XLA across nine thousand endpoints has said nothing about
 * whether this particular week was any good.
 */
export function cohortExperience(c: Consumer = CONSUMER): CohortExperience[] {
  return SLAS
    .filter((s) => s.tower === c.homeTower)
    .map((s) => ({
      slaId: s.id,
      name: s.name,
      metric: s.metric,
      attainment: s.attainmentMtd,
      target: s.attainmentTarget,
      meeting: s.attainmentMtd >= s.attainmentTarget,
      volumeMtd: s.volumeMtd,
    }))
}

/**
 * What this surface deliberately will not tell the person looking at it.
 * Written out rather than left implicit, because the absences are not
 * oversights and a consultant is entitled to know the shape of what they
 * are being shown.
 */
export function workplaceLimits(c: Consumer = CONSUMER): string[] {
  const tower = TOWERS.find((t) => t.id === c.homeTower)
  return [
    'Nothing here is a measure of your week. The experience figures are for everyone this service covers, and a good cohort number and a bad fortnight of your own are entirely compatible.',
    'Issues are matched to you through the systems you depend on, not through a record of what you personally reported. You will see things affecting you that somebody else raised, and you will not see something you reported against a system not on your list.',
    `The queue position and target times shown come from the same ledger the provider is measured against${tower ? ` for ${tower.name}` : ''}. There is no second set of figures for this page.`,
    'An answer written for you by an agent has no engineer between it and you. The platform holds such answers to a higher verification floor than the same answer shown to an engineer, and where the knowledge behind one is not human-verified it will not be given autonomously at all.',
  ]
}
