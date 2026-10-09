import { DATA_LIFECYCLE, dataSummary, isBreach } from './dataEstate'
import { reliabilitySummary } from './dataReliability'
import { GRAPH_NODES } from './estate'
import { UNATTENDED_BAR } from './intake'

/* ==========================================================================
   Running a verification pack, and letting it fail.

   Every action class names the pack that proves a run of it worked, and the
   packs were enforced everywhere except in the one place they mattered: the
   run itself reported `result: 'green'` with three fixed probe strings,
   whatever had happened. An agent could restart the wrong thing and the
   verification would still pass, which makes the whole evidence chain a
   record of assertions rather than of outcomes.

   A probe now reads a register and returns one of three things, and the third
   is the important one.

     pass     the register says the objective holds
     fail     the register says it does not
     unknown  the register cannot say

   `unknown` is not a pass. An item with no telemetry cannot be verified, and
   a pack that treats silence as success is worse than no pack: it certifies
   exactly the things nobody is watching. So a pack with an unreadable probe
   comes back amber and names what could not be read, and the work does not
   close on it.
   ========================================================================== */

export type ProbeOutcome = 'pass' | 'fail' | 'unknown'

export interface Probe {
  /** What is being checked. */
  what: string
  outcome: ProbeOutcome
  /** What the register said, so the result can be checked. */
  readFrom: string
}

export interface PackResult {
  pack: string
  probes: Probe[]
  /** Green only where every probe passed. */
  result: 'green' | 'amber' | 'red'
  /** The probes that did not pass, in the order they were run. */
  failed: Probe[]
  unreadable: Probe[]
  /** One line for the timeline. */
  summary: string
}

const BY_ID = new Map(GRAPH_NODES.map((n) => [n.id, n]))

/** Estate data items the acted-on nodes correspond to, by id or by name. */
function dataItemsFor(nodeIds: string[]) {
  const s = dataSummary()
  const names = new Set(nodeIds.map((id) => BY_ID.get(id)?.name.toLowerCase()).filter(Boolean) as string[])
  return s.items.filter((i) => nodeIds.includes(i.id) || names.has(i.name.toLowerCase()))
}

/* --------------------------------- The packs -------------------------------- */

/**
 * What each pack checks, and against what.
 *
 * The probes are the platform's design — a pack is a definition of proof — but
 * every one of them resolves to a register read. A pack with no probes defined
 * returns unknown rather than green, because an undefined pack proves nothing.
 */
const PACKS: Record<string, (nodeIds: string[], context: { confidence?: number; engagementId?: string }) => Probe[]> = {
  health_probe_v4: (nodeIds) => {
    const items = dataItemsFor(nodeIds)
    const observed = items.filter((i) => i.own !== 'unobserved')
    return [
      {
        what: 'The thing acted on reports its own health',
        outcome: !items.length ? 'unknown' : observed.length === items.length ? 'pass' : 'unknown',
        readFrom: items.length
          ? `${observed.length} of ${items.length} acted-on items report telemetry`
          : 'No acted-on item is in the estate register, so no health signal can be read',
      },
      {
        what: 'No item acted on is failing its own checks',
        outcome: !observed.length ? 'unknown' : observed.some((i) => isBreach(i.own)) ? 'fail' : 'pass',
        readFrom: observed.length
          ? `${observed.filter((i) => isBreach(i.own)).length} of ${observed.length} observed items in breach`
          : 'Nothing observed to check',
      },
    ]
  },

  euc_checkin_v1: (nodeIds) => {
    const known = nodeIds.filter((id) => BY_ID.has(id))
    return [
      {
        what: 'The device or profile acted on is known to the estate',
        outcome: known.length === nodeIds.length && known.length > 0 ? 'pass' : known.length ? 'unknown' : 'fail',
        readFrom: `${known.length} of ${nodeIds.length} named items are in the graph`,
      },
      {
        what: 'The identity service behind it is observable',
        outcome: known.some((id) => BY_ID.get(id)?.type === 'InfraResource') ? 'pass' : 'unknown',
        readFrom: known.length ? known.map((id) => `${id} is a ${BY_ID.get(id)!.type}`).join('; ') : 'Nothing resolved',
      },
    ]
  },

  dq_contract_v5: (nodeIds) => {
    const items = dataItemsFor(nodeIds)
    const eligible = items.filter((i) => DATA_LIFECYCLE[i.kind].contracted)
    const enforced = eligible.filter((i) => i.contractState === 'enforced')
    return [
      {
        what: 'A data contract is enforced on what was written',
        outcome: !eligible.length ? 'unknown' : enforced.length === eligible.length ? 'pass' : 'fail',
        readFrom: eligible.length
          ? `${enforced.length} of ${eligible.length} contractable items have an enforced contract`
          : 'Nothing acted on can carry a data contract',
      },
      {
        what: 'Nothing written is breaching its contract now',
        outcome: !eligible.length ? 'unknown' : eligible.some((i) => isBreach(i.own)) ? 'fail' : 'pass',
        readFrom: `${eligible.filter((i) => isBreach(i.own)).length} in breach after the run`,
      },
    ]
  },

  capacity_probe_v2: (nodeIds) => {
    const r = reliabilitySummary()
    const touched = r.services.filter((s) => s.chain.some((i) => nodeIds.includes(i.id)))
    const measured = touched.filter((s) => s.measured)
    return [
      {
        what: 'The service has headroom left in its error budget',
        outcome: !measured.length ? 'unknown' : measured.some((s) => s.budget.state === 'exhausted') ? 'fail' : 'pass',
        readFrom: measured.length
          ? `${measured.filter((s) => s.budget.state === 'exhausted').length} of ${measured.length} affected services have spent their budget`
          : touched.length
            ? 'The affected services cannot be measured — something in their chain is unobserved'
            : 'No measured data service depends on what was acted on',
      },
    ]
  },

  canary_slo_v6: (nodeIds) => {
    const r = reliabilitySummary()
    const touched = r.services.filter((s) => s.chain.some((i) => nodeIds.includes(i.id)))
    return [
      {
        what: 'No outage is open on anything downstream',
        outcome: !touched.length ? 'unknown' : touched.some((s) => s.open) ? 'fail' : 'pass',
        readFrom: touched.length ? `${touched.filter((s) => s.open).length} of ${touched.length} affected services have an open outage` : 'Nothing downstream is measured',
      },
      {
        what: 'Availability is still meeting target where it can be read',
        outcome: (() => {
          const m = touched.filter((s) => s.meetsTarget !== null)
          return !m.length ? 'unknown' : m.some((s) => s.meetsTarget === false) ? 'fail' : 'pass'
        })(),
        readFrom: `${touched.filter((s) => s.meetsTarget === false).length} affected services below target`,
      },
    ]
  },

  classification_agreement: (_nodeIds, ctx) => [
    {
      what: 'The classification is confident enough to stand',
      // The same bar the routing used to decide whether to attempt at all, so
      // the two cannot disagree about what confident enough means.
      outcome: ctx.confidence === undefined ? 'unknown' : ctx.confidence >= UNATTENDED_BAR ? 'pass' : 'fail',
      readFrom: ctx.confidence === undefined
        ? 'No classification confidence was recorded for this run'
        : `Classified at ${Math.round(ctx.confidence * 100)}% against a ${Math.round(UNATTENDED_BAR * 100)}% bar`,
    },
  ],
}

/**
 * Runs a pack. Unknown packs and unreadable probes both come back amber.
 *
 * `none` and `n/a` are not failures: some action classes decide rather than
 * act, and there is no run for a pack to verify. They are reported as such.
 */
export function runPack(
  pack: string | null | undefined,
  nodeIds: string[],
  context: { confidence?: number; engagementId?: string } = {},
): PackResult {
  if (!pack || pack === 'none' || pack === 'n/a') {
    return {
      pack: pack ?? 'none',
      probes: [],
      result: 'amber',
      failed: [],
      unreadable: [],
      summary: 'No verification pack applies: this class decides rather than acts, so there is no run to verify.',
    }
  }

  const build = PACKS[pack]
  if (!build) {
    return {
      pack,
      probes: [],
      result: 'amber',
      failed: [],
      unreadable: [],
      summary: `${pack} has no probes defined, so nothing was proved. An undefined pack is not a pass.`,
    }
  }

  const probes = build(nodeIds, context)
  const failed = probes.filter((p) => p.outcome === 'fail')
  const unreadable = probes.filter((p) => p.outcome === 'unknown')
  const result = failed.length ? 'red' : unreadable.length ? 'amber' : 'green'

  const summary = failed.length
    ? `${pack} failed: ${failed.map((p) => p.what.toLowerCase()).join('; ')}.`
    : unreadable.length
      ? `${pack} could not be completed: ${unreadable.map((p) => p.readFrom).join('; ')}. Silence is not a pass, so this is not closed.`
      : `${pack} passed on ${probes.length} probe${probes.length === 1 ? '' : 's'}, each read from the register.`

  return { pack, probes, result, failed, unreadable, summary }
}
