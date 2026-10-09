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

/**
 * How well an arriving ticket must match the client's own history before the
 * platform will act on it unattended.
 *
 * One definition, used by the routing that decides whether to attempt and by
 * the verification that checks the classification afterwards — the two must
 * not be able to disagree about what "confident enough" means.
 */
export const UNATTENDED_BAR = 0.6

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
  if (classification.confidence < UNATTENDED_BAR) {
    return {
      attempt: false,
      toRole: 'resolver',
      because: `Classified at ${Math.round(classification.confidence * 100)}% against the client's history, which is below the bar for acting unattended.`,
    }
  }
  if (!runbooks.length) {
    return { attempt: false, toRole: 'resolver', because: 'No runbook in the graph resolves a known error on what this ticket names.' }
  }

  // Every runbook on the thing, not just the first one found. Taking only the
  // first meant a component with two runbooks could be refused because the
  // arbitrary one happened to need a grant nobody holds, while the other was
  // runnable — a refusal that would have been impossible to explain.
  const blocked: string[] = []
  for (const rb of runbooks) {
    const uses = String(rb.attrs.uses ?? '').split(/[,\s]+/).filter((x) => /^AC-\d+$/.test(x))
    if (!uses.length) {
      blocked.push(`${rb.id} names no action classes, so there is nothing it authorises`)
      continue
    }
    const unknown = uses.filter((c) => !AC[c])
    if (unknown.length) {
      blocked.push(`${rb.id} uses ${unknown.join(', ')}, which the policy engine does not know`)
      continue
    }
    const agent = AGENTS.find((a) => uses.every((c) => a.grants[c]) && a.towers.includes(args.tower))
    if (!agent) {
      blocked.push(`no agent on this tower holds a grant for every class ${rb.id} uses (${uses.join(', ')})`)
      continue
    }
    // The floor the policy engine will apply to the strictest class in it, so
    // the narrative can say whether this will run or stop at a gate.
    const floor = uses.map((c) => AC[c].floor).sort((a, b) => FLOOR_RANK.indexOf(a) - FLOOR_RANK.indexOf(b))[0]
    return {
      attempt: true,
      agentId: agent.id,
      runbookId: rb.id,
      actionClasses: uses,
      because: `${rb.id} resolves a known error on what the ticket names, ${agent.name} is graded for ${uses.join(', ')}, and the strictest of those is floored at ${floor.replace(/_/g, '-')}.`,
    }
  }

  // Every runbook was blocked, and the reasons are different problems: a
  // missing grant is a governance gap, an unknown class is a configuration
  // error, and saying which is the whole point.
  return {
    attempt: false,
    toRole: blocked.some((b) => b.includes('does not know')) ? 'aieng' : 'resolver',
    because: blocked.length === 1 ? `Not attempted: ${blocked[0]}.` : `Not attempted — ${blocked.join('; ')}.`,
  }
}

/** Strictest first. */
const FLOOR_RANK = ['advise', 'approve_first', 'supervised', 'autonomous']

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

/* ------------------------------- The handoff -------------------------------- */

/**
 * Which agent does each part of taking a ticket in, read from the grants.
 *
 * Three agents touch a ticket before anybody decides anything, and which
 * three depends entirely on the tower: an agent can only classify where it
 * holds the classification grant and is deployed. The intake named Sentinel
 * directly, which is right on seven towers and wrong on the rest — there is no
 * Sentinel on security operations, and attributing a classification to an
 * agent that is not there is a fabricated audit trail.
 *
 * Where no agent on the tower holds the grant, the step is a person's. Saying
 * so is the point: a tower where nothing can be classified unattended is a
 * coverage gap, and it should read as one rather than quietly borrowing an
 * agent from somewhere else.
 */
export interface HandoffStep {
  /** What this part of the intake does. */
  did: string
  /** The action class it needs. */
  needs: string
  /** The agent that holds it on this tower, or null where none does. */
  agentId: string | null
  /** Why this agent, or why nobody. */
  because: string
}

export function handoffFor(tower: string, exclude: string[] = []): HandoffStep[] {
  const holder = (ac: string, not: string[]) =>
    AGENTS.find((a) => a.grants[ac] && a.towers.includes(tower) && !not.includes(a.id)) ?? null

  const classifier = holder('AC-08', [])
  // Deliberately a different agent where one exists: the plan is assembled by
  // something other than the thing that classified, so a misclassification is
  // not confirmed by its own author.
  const diagnoser = holder('AC-05', [...exclude, ...(classifier ? [classifier.id] : [])]) ?? holder('AC-05', exclude)

  return [
    {
      did: 'Correlate the signals and classify the ticket',
      needs: 'AC-08',
      agentId: classifier?.id ?? null,
      because: classifier
        ? `${classifier.name} holds AC-08 at grade ${classifier.grants['AC-08']} on this tower`
        : `No agent deployed on this tower holds AC-08, so a person classifies it`,
    },
    {
      did: 'Assemble the decision context and scope the blast radius',
      needs: 'AC-05',
      agentId: diagnoser?.id ?? null,
      because: diagnoser
        ? `${diagnoser.name} holds AC-05 on this tower${classifier && diagnoser.id !== classifier.id ? ', and is not the agent that classified it' : ''}`
        : 'No agent deployed on this tower holds AC-05, so a person assembles it',
    },
  ]
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
  // Matches the client's largest recurring cluster by phrasing, lands on a
  // component with a known error whose runbook uses AC-66 — floored at
  // autonomous, so it runs. The whole path, unattended.
  {
    externalRef: 'INC0491208', system: 'ServiceNow', openedAt: '2027-02-18T09:06:00.000Z',
    shortDescription: 'Expired login password after MFA re-enrolment — account locked', category: 'Access', subCategory: 'Lockout',
    priority: 'P3', configurationItems: ['euc_entra'], reportedBy: 'T. Berglund',
  },
  // Matches by phrasing, and its runbook uses AC-49, which the policy engine
  // floors at approve-first: it is attempted and then stops at a gate.
  {
    externalRef: 'INC0491205', system: 'ServiceNow', openedAt: '2027-02-18T09:31:00.000Z',
    shortDescription: 'ADF failed pipelines overnight on the customer feed', category: 'Job failure', subCategory: 'Data pipeline',
    priority: 'P2', configurationItems: ['pipe_datamart'], reportedBy: 'Monitoring',
  },
  // Classifies strongly, and its runbook decides rather than acts: AC-05 and
  // AC-08 read and classify, so the attempt produces an answer, not a change.
  {
    externalRef: 'INC0491204', system: 'ServiceNow', openedAt: '2027-02-18T09:12:00.000Z',
    shortDescription: 'IEM login not working — expired password', category: 'Access', subCategory: 'Access IEM',
    priority: 'P3', configurationItems: ['app_iem'], reportedBy: 'J. Alvarez',
  },
  // A known error and a runbook both exist, but the phrasing only reaches the
  // theme, so the match sits below the bar for acting unattended. Held for a
  // person on confidence alone, which is the bar doing its job.
  {
    externalRef: 'INC0491206', system: 'ServiceNow', openedAt: '2027-02-18T09:44:00.000Z',
    shortDescription: 'Endpoint security agents contending for CPU on partner laptops', category: 'Performance', subCategory: 'Slowness',
    priority: 'P2', configurationItems: ['ke_triple_av'], reportedBy: 'R. Castellano',
  },
  // A P1 the platform refuses to touch: nothing in the client's recorded
  // history matches it and its application is not in the estate at all. The
  // most credible thing here, and deliberately left unresolvable.
  {
    externalRef: 'INC0491207', system: 'ServiceNow', openedAt: '2027-02-18T09:58:00.000Z',
    shortDescription: 'Quarterly partner distribution model returning negative allocations', category: 'Application error', subCategory: 'Calculation',
    priority: 'P1', configurationItems: ['app_partner_dist'], reportedBy: 'E. Whitfield',
  },
]
