import { DATA_LIFECYCLE, dataSummary, isBreach } from './dataEstate'
import { reliabilitySummary } from './dataReliability'
import { GRAPH_NODES } from './estate'
import { INVENTORY } from './inventory'
import { UNATTENDED_BAR } from './intake'
import { releaseSummary } from './releases'
import { BUDGETS } from './tokenOpsSeed'

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
    // Health lives in a different register depending on what kind of thing was
    // acted on, and for one kind it lives nowhere. Saying which is the whole
    // value of the probe: "nothing is in the inventory" sent an operator to
    // look in the wrong place, because an application listing was never going
    // to hold a subnet.
    const kinds = nodeIds.map((id) => ({ id, node: BY_ID.get(id) }))
    const apps = INVENTORY.filter((a) => nodeIds.includes(a.nodeId ?? '') || nodeIds.includes(a.id))
    const data = dataItemsFor(nodeIds)
    const infra = kinds.filter((k) => k.node && ['InfraResource', 'Interface'].includes(k.node.type))
    const unknownToGraph = kinds.filter((k) => !k.node)

    const observedApps = apps.filter((a) => a.observed !== 'not_observed')
    const observedData = data.filter((i) => i.own !== 'unobserved')
    const readable = apps.length + data.length
    const observed = observedApps.length + observedData.length

    const probes: Probe[] = []

    // Infrastructure first, because it is the gap rather than a reading.
    if (infra.length) {
      probes.push({
        what: 'The infrastructure acted on reports its own health',
        outcome: 'unknown',
        readFrom: `${infra.map((k) => k.node!.name).join(', ')} ${infra.length === 1 ? 'is an' : 'are'} ${infra.length === 1 ? 'infrastructure resource' : 'infrastructure resources'}, and the platform holds no health register for infrastructure — only the application inventory and the data estate.`,
      })
    }
    if (unknownToGraph.length) {
      probes.push({
        what: 'Everything acted on is known to the estate',
        outcome: 'unknown',
        readFrom: `${unknownToGraph.map((k) => k.id).join(', ')} ${unknownToGraph.length === 1 ? 'is' : 'are'} not in the graph at all`,
      })
    }
    if (readable) {
      probes.push({
        what: 'What can be observed is reporting',
        outcome: observed === readable ? 'pass' : 'unknown',
        readFrom: `${observed} of ${readable} observable items reporting (${apps.length} in the application inventory, ${data.length} in the data estate)`,
      })
      probes.push({
        what: 'Nothing observed is failing its own checks',
        outcome: !observed ? 'unknown' : observedData.some((i) => isBreach(i.own)) ? 'fail' : 'pass',
        readFrom: observedData.length
          ? `${observedData.filter((i) => isBreach(i.own)).length} of ${observedData.length} observed data items in breach`
          : `${observedApps.length} application${observedApps.length === 1 ? '' : 's'} observable, none recording a failed check`,
      })
    }
    if (!probes.length) {
      probes.push({
        what: 'The thing acted on reports its own health',
        outcome: 'unknown',
        readFrom: 'Nothing was named for this action, so there is nothing to check',
      })
    }
    return probes
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

  release_pack_v9: (nodeIds) => {
    const r = releaseSummary()
    const touched = r.readings.filter((x) => nodeIds.includes(x.release.itemId))
    return [
      {
        what: 'The regression gate on the release passed',
        outcome: !touched.length ? 'unknown' : touched.some((x) => x.gate === 'fail') ? 'fail' : 'pass',
        readFrom: touched.length
          ? `${touched.filter((x) => x.gate === 'fail').length} of ${touched.length} releases on what was acted on have a failing gate`
          : 'No release in the register is against what was acted on, so there is no gate to read',
      },
    ]
  },

  patch_wave_v2: (nodeIds) => {
    const apps = INVENTORY.filter((a) => nodeIds.includes(a.nodeId ?? '') || nodeIds.includes(a.id))
    const baselined = apps.filter((a) => a.config.drift === 'in_baseline')
    return [
      {
        what: 'What was patched is back in its recorded baseline',
        outcome: !apps.length ? 'unknown' : baselined.length === apps.length ? 'pass' : 'fail',
        readFrom: apps.length
          ? `${baselined.length} of ${apps.length} acted-on applications are in baseline (${apps.filter((a) => a.config.drift === 'unknown').length} have no baseline at all)`
          : 'Nothing acted on is in the application inventory, so no baseline can be compared',
      },
    ]
  },

  budget_check_v2: (nodeIds) => {
    const towers = new Set(nodeIds.map((id) => BY_ID.get(id)?.tower).filter(Boolean) as string[])
    const mine = BUDGETS.filter((b) => towers.has(b.scope))
    return [
      {
        what: 'The spend stayed inside its budget',
        outcome: !mine.length ? 'unknown' : mine.some((b) => b.state === 'hard') ? 'fail' : 'pass',
        readFrom: mine.length
          ? mine.map((b) => `${b.scope}: ${b.spent} of ${b.limit} (${b.state})`).join('; ')
          : 'No budget is recorded for the tower this was acted on',
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
 * Packs the contract names and the platform cannot yet run, each with the
 * register that is missing.
 *
 * Kept explicitly rather than falling through to "undefined", because these
 * are not mistakes — they are instrumentation the platform has not built, and
 * the capability watch reads the same gaps as recommendations. A pack listed
 * here holds its work at amber exactly as an unreadable probe does.
 */
const NOT_INSTRUMENTED: Record<string, { what: string; because: string }> = {
  tls_probe_v3: {
    what: 'The rotated certificate or secret is in use and valid',
    because: 'the platform holds no certificate or secret register, so a rotation cannot be confirmed from a record.',
  },
  entitlement_diff_v3: {
    what: 'The entitlement granted is the one that was approved, and nothing else changed',
    because: 'the platform holds no entitlement register, so a before-and-after diff cannot be computed.',
  },
  reachability_v2: {
    what: 'What was reachable before the change is reachable after it',
    because: 'the platform holds no reachability probe results, so connectivity cannot be compared across the change.',
  },
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

  // A pack the platform cannot run because the register behind it does not
  // exist. Naming the missing register is the useful answer — "no probes
  // defined" told an operator nothing, and told the platform team less.
  const missing = NOT_INSTRUMENTED[pack]
  if (missing) {
    return {
      pack,
      probes: [{ what: missing.what, outcome: 'unknown', readFrom: missing.because }],
      result: 'amber',
      failed: [],
      unreadable: [{ what: missing.what, outcome: 'unknown', readFrom: missing.because }],
      summary: `${pack} cannot be run: ${missing.because} Not closed, and the gap is a platform-capability finding rather than a verification.`,
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
      summary: `${pack} has no probes defined and no stated reason, so nothing was proved. An undefined pack is not a pass.`,
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
