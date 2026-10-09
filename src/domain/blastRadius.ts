import { GRAPH_EDGES, GRAPH_NODES } from './estate'
import type { GraphEdge, GraphNode } from './types'

/* ==========================================================================
   What else breaks if this breaks.

   Blast radius decides how tightly an action is gated — the policy engine
   raises the floor to approve-first when a tier-0 service is in reach — so it
   has to be computed from the dependency graph rather than asserted. It was
   asserted: a seeded work object carried `dependents: rng.int(0, 6)`, and a
   two-hop traversal existed but was trapped inside the service-graph screen
   where nothing else could reach it.

   Direction matters and is easy to get backwards. An edge reads
   `app_mulesoft DEPENDS_ON db_sap_prod` — Mulesoft needs SAP. So the things
   put at risk by SAP failing are the ones with an edge *into* it, and the
   traversal walks edges in reverse.

   Two hops, not transitive closure. Beyond two the set grows to most of the
   estate and stops discriminating between a change that is safe and one that
   is not, which is the only thing the number is for.
   ========================================================================== */

/** Relations that carry failure from the thing depended on to the depender. */
const CARRIES_FAILURE: GraphEdge['rel'][] = ['DEPENDS_ON', 'CALLS', 'READS', 'WRITES', 'RUNS_ON']

/** Action classes that change stored data rather than the thing running it. */
const MUTATES_DATA = ['AC-44', 'AC-49', 'AC-71']

const BY_ID = new Map(GRAPH_NODES.map((n) => [n.id, n]))

/** One hop inward: everything that would feel these nodes failing. */
function dependers(ids: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const e of GRAPH_EDGES) {
    if (CARRIES_FAILURE.includes(e.rel) && ids.has(e.to) && !ids.has(e.from)) out.add(e.from)
  }
  return out
}

export interface BlastReading {
  /** The nodes acted on that the graph knows about. */
  acted: GraphNode[]
  /** Directly dependent on something acted on. */
  hop1: GraphNode[]
  /** Dependent on a hop-1 node. */
  hop2: GraphNode[]
  /** Distinct business services in reach, the acted-on ones included. */
  services: number
  /** Distinct nodes downstream of the action. */
  dependents: number
  /**
   * The most critical tier in reach. Tier 0 is the most critical, so this is
   * the lowest number — the policy engine raises the floor when it is 0.
   */
  maxTier: 0 | 1 | 2 | 3
  /** Nodes named in the action that the graph does not hold. */
  unknown: string[]
}

/**
 * The blast radius of acting on a set of estate nodes.
 *
 * Nodes the graph does not hold are reported rather than ignored: acting on
 * something undiscovered is riskier than acting on something mapped, and a
 * traversal that silently skipped them would say the opposite.
 */
export function blastRadius(nodeIds: string[]): BlastReading {
  const known = nodeIds.filter((id) => BY_ID.has(id))
  const unknown = nodeIds.filter((id) => !BY_ID.has(id))
  const acted = new Set(known)

  const hop1 = dependers(acted)
  const hop2 = dependers(new Set([...acted, ...hop1]))

  const node = (id: string) => BY_ID.get(id)!
  const all = [...acted, ...hop1, ...hop2].map(node)
  const services = new Set(all.filter((n) => n.type === 'BusinessService').map((n) => n.id)).size

  // Most critical wins. With nothing known, the tier cannot be read from the
  // graph and the least critical is assumed rather than the most: claiming
  // tier 0 on no evidence would gate everything.
  const maxTier = (all.length ? Math.min(...all.map((n) => n.tier)) : 3) as 0 | 1 | 2 | 3

  return {
    acted: [...acted].map(node),
    hop1: [...hop1].map(node),
    hop2: [...hop2].map(node),
    services,
    dependents: hop1.size + hop2.size,
    maxTier,
    unknown,
  }
}

/** The shape the policy engine and the work object's autonomy decision expect. */
export function blastRadiusFor(nodeIds: string[], actionClasses: string[]) {
  const r = blastRadius(nodeIds)
  return {
    services: r.services,
    dependents: r.dependents,
    maxTier: r.maxTier,
    dataMutation: actionClasses.some((c) => MUTATES_DATA.includes(c)),
  }
}
