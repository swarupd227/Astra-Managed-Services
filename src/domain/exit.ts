import { DATA_ITEMS } from './dataEstate'
import { ENGAGEMENT } from './engagement'
import { INVENTORY } from './inventory'
import { ASSERTIONS, HANDOVER } from './knowledge'
import { DEMAND_CLASSES, SLAS, bankedHours } from './ledgers'
import { HISTORY, verifiedVolumeCoverage } from './metrics'
import { EVIDENCE, NOW } from './workSeed'
import type { ISO } from './types'

/* ==========================================================================
   Renew or exit — the end of an engagement, which the platform has to be
   able to face as squarely as the beginning.

   Three obligations sit here, and the platform is on the hook for all of
   them. A benchmark asks whether the price is still market, and is answered
   from the ledger the whole term was measured in rather than a pack
   reconstructed by hand. The client's data must come back and the copies
   must go, and that includes what the platform itself holds: the evidence
   chain, the work records, the knowledge, the transcripts of what agents
   were told. And the successor needs what was learned, or the client pays
   for the same discovery twice.

   What the platform holds of a client is stated here store by store, with
   what may be returned, what may be destroyed, and what must be kept
   because the law or the contract says so — a residual holding named is
   honest; a residual holding hidden is the thing exit disputes are made of.
   ========================================================================== */

export type HoldingKind = 'record' | 'knowledge' | 'telemetry' | 'derived' | 'backup'

export const HOLDING_KIND_LABEL: Record<HoldingKind, string> = {
  record: 'Service record', knowledge: 'Knowledge', telemetry: 'Telemetry', derived: 'Derived', backup: 'Backup',
}

export type HoldingState = 'held' | 'returned' | 'destroyed'

export const HOLDING_STATE_LABEL: Record<HoldingState, string> = { held: 'Held', returned: 'Returned', destroyed: 'Destroyed' }

export interface Holding {
  id: string
  name: string
  kind: HoldingKind
  /** What it contains, in the client's terms. */
  what: string
  /** Where it is processed. */
  location: string
  /** How many records, where the platform can count them. */
  count: () => number | null
  /** Whether it can be handed back in a usable form. */
  returnable: boolean
  /** Absent means it may be destroyed on instruction. Present is the reason it may not. */
  mustKeep?: { reason: string; until: string }
  /** Recorded in the register. Session actions are passed in. */
  settled?: Settlement
}

export interface Settlement {
  holdingId: string
  action: 'returned' | 'destroyed'
  at: ISO
  by: string
  reference: string
  /** How destruction was carried out, for the certificate. */
  method?: string
}

const countDataItems = () => DATA_ITEMS.length

export const HOLDINGS: Holding[] = [
  {
    id: 'hold_evidence', name: 'Evidence chain', kind: 'record',
    what: 'Every action, decision, approval and clock event of the term, sealed and hash-linked',
    location: 'EU West', count: () => EVIDENCE.length, returnable: true,
    mustKeep: { reason: 'Supplier audit obligation', until: '7 years after term' },
  },
  {
    id: 'hold_work', name: 'Work records', kind: 'record',
    what: 'Incidents, requests, problems and changes with their timelines and agent narratives',
    location: 'EU West', count: () => null, returnable: true,
  },
  {
    id: 'hold_knowledge', name: 'Estate knowledge', kind: 'knowledge',
    what: 'Verified assertions about the estate, runbooks and known errors',
    location: 'EU West', count: () => ASSERTIONS.length, returnable: true,
  },
  {
    id: 'hold_registers', name: 'Estate and demand registers', kind: 'knowledge',
    what: 'The data estate, application portfolio and demand classes as the platform holds them',
    location: 'EU West', count: () => countDataItems() + INVENTORY.length + DEMAND_CLASSES.length, returnable: true,
  },
  {
    id: 'hold_transcripts', name: 'Agent transcripts', kind: 'record',
    what: 'What each agent was told, retrieved and proposed, per run',
    location: 'EU West', count: () => null, returnable: true,
  },
  {
    id: 'hold_context', name: 'Context store', kind: 'derived',
    what: 'Indexed and embedded copies of client material, assembled for retrieval',
    location: 'EU West', count: () => null, returnable: false,
  },
  {
    id: 'hold_telemetry', name: 'Run and pipeline telemetry', kind: 'telemetry',
    what: 'Run histories, durations and outcomes read from the client’s platforms',
    location: 'EU West', count: () => null, returnable: true,
  },
  {
    id: 'hold_reports', name: 'Reports and signed extracts', kind: 'derived',
    what: 'Governance packs and extracts issued during the term',
    location: 'EU West', count: () => null, returnable: true,
  },
  {
    id: 'hold_backups', name: 'Platform backups', kind: 'backup',
    what: 'Backups of everything above, on a rolling window',
    location: 'EU West', count: () => null, returnable: false,
    mustKeep: { reason: 'Backup cycle must expire before destruction can be certified', until: '35 days after the last write' },
  },
]

/* ------------------------------- Obligations -------------------------------- */

export type ObligationState = 'not_started' | 'ready' | 'done'

export const EXIT_STATE_LABEL: Record<ObligationState, string> = { not_started: 'Not started', ready: 'Ready', done: 'Done' }

export interface ExitObligation {
  id: string
  clause: string
  obligation: string
  owner: string
  /** What has to be true before it can be called ready. */
  test: (r: ExitReading) => { ready: boolean; note: string }
}

export const EXIT_OBLIGATIONS: ExitObligation[] = [
  {
    id: 'ex_return', clause: 'MSA 15.2.2', obligation: 'Return the client’s data in a usable form', owner: 'Service Delivery Manager',
    test: (r) => {
      const outstanding = r.holdings.filter((h) => h.returnable && !h.returnRecord)
      return { ready: outstanding.length === 0, note: outstanding.length ? `${outstanding.length} holdings not yet returned` : 'Every returnable holding returned' }
    },
  },
  {
    id: 'ex_destroy', clause: 'MSA 15.2.2', obligation: 'Destroy remaining copies, backups included, and certify it', owner: 'Service Delivery Manager',
    test: (r) => {
      const left = r.holdings.filter((h) => !h.mustKeep && !h.destroyRecord)
      return { ready: left.length === 0, note: left.length ? `${left.length} holdings destroyable and not yet destroyed` : `${r.residual.length} holdings retained under a stated reason` }
    },
  },
  {
    id: 'ex_knowledge', clause: 'Schedule F', obligation: 'Hand the verified knowledge to the successor', owner: 'Transition Lead',
    test: (r) => ({
      ready: r.reverse.totalAssertions > 0,
      note: `${r.reverse.totalAssertions} assertions covering ${r.reverse.verifiedVolumePct}% of volume, ${r.reverse.runbooks} handover artefacts`,
    }),
  },
  {
    id: 'ex_benchmark', clause: 'Schedule H', obligation: 'Supply measured data to the benchmarker', owner: 'Commercial Manager',
    test: (r) => ({ ready: r.benchmark.quarters.length > 0, note: `${r.benchmark.quarters.length} quarters of measured effort, volume and attainment` }),
  },
  {
    id: 'ex_residual', clause: 'DPA', obligation: 'State what is retained, why, and until when', owner: 'Privacy Office',
    test: (r) => ({ ready: r.residual.every((h) => Boolean(h.mustKeep)), note: `${r.residual.length} holdings retained, each with a stated reason` }),
  },
]

/* --------------------------------- Readings --------------------------------- */

export interface HoldingReading {
  holding: Holding
  count: number | null
  state: HoldingState
  /** The latest settlement, which decides the state. */
  settlement?: Settlement
  /** A holding can be returned and then destroyed; both stay on the record. */
  returnRecord?: Settlement
  destroyRecord?: Settlement
  mustKeep?: Holding['mustKeep']
  returnable: boolean
}

export interface BenchmarkPack {
  /** Quarters the platform can evidence from its own ledger. */
  quarters: { quarter: string; contractedPct: number; actualPct: number }[]
  baselineHrsPerYear: number | null
  serviceLevels: { id: string; name: string; attainmentMtd: number; target: number }[]
  bankedHrs: number
}

export interface ReversePack {
  verifiedAssertions: number
  totalAssertions: number
  /** Share of historical volume covered by verified knowledge. */
  verifiedVolumePct: number
  demandClasses: number
  estateItems: number
  applications: number
  runbooks: number
  evidenceRecords: number
}

export interface ExitReading {
  holdings: HoldingReading[]
  returned: number
  destroyed: number
  /** Holdings that stay, each with the reason it stays. */
  residual: HoldingReading[]
  obligations: { obligation: ExitObligation; state: ObligationState; note: string }[]
  benchmark: BenchmarkPack
  reverse: ReversePack
  /** Months until the term ends. */
  monthsLeft: number
}

function benchmarkPack(): BenchmarkPack {
  return {
    quarters: HISTORY.quarters.map((quarter, i) => ({
      quarter, contractedPct: HISTORY.glidepathContracted[i], actualPct: HISTORY.glidepathActual[i],
    })),
    baselineHrsPerYear: ENGAGEMENT.contract.baselineHrsPerYear,
    serviceLevels: SLAS.map((s) => ({ id: s.id, name: s.name, attainmentMtd: s.attainmentMtd, target: s.attainmentTarget })),
    bankedHrs: Math.round(bankedHours()),
  }
}

function reversePack(verified?: number): ReversePack {
  return {
    // Verification happens as the service runs, so the live count is passed in where there is one.
    verifiedAssertions: verified ?? ASSERTIONS.filter((a) => a.verification === 'human_verified').length,
    totalAssertions: ASSERTIONS.length,
    verifiedVolumePct: Math.round(verifiedVolumeCoverage() * 10) / 10,
    demandClasses: DEMAND_CLASSES.length,
    estateItems: DATA_ITEMS.length,
    applications: INVENTORY.length,
    runbooks: HANDOVER.length,
    evidenceRecords: EVIDENCE.length,
  }
}

export function readExit(settlements: Settlement[] = [], verifiedAssertions?: number): ExitReading {
  const holdings: HoldingReading[] = HOLDINGS.map((h) => {
    const mine = [...settlements.filter((s) => s.holdingId === h.id), ...(h.settled ? [h.settled] : [])]
    const returnRecord = mine.find((s) => s.action === 'returned')
    const destroyRecord = mine.find((s) => s.action === 'destroyed')
    return {
      holding: h,
      count: h.count(),
      state: destroyRecord ? 'destroyed' : returnRecord ? 'returned' : 'held',
      settlement: destroyRecord ?? returnRecord,
      returnRecord,
      destroyRecord,
      mustKeep: h.mustKeep,
      returnable: h.returnable,
    }
  })
  const start = Date.parse(ENGAGEMENT.contract.startsAt)
  const endMs = new Date(new Date(start).setMonth(new Date(start).getMonth() + ENGAGEMENT.contract.termMonths)).getTime()

  const base: ExitReading = {
    holdings,
    returned: holdings.filter((h) => h.returnRecord).length,
    destroyed: holdings.filter((h) => h.destroyRecord).length,
    residual: holdings.filter((h) => h.mustKeep),
    obligations: [],
    benchmark: benchmarkPack(),
    reverse: reversePack(verifiedAssertions),
    monthsLeft: Math.max(0, Math.round((endMs - NOW.getTime()) / (30 * 86_400_000))),
  }
  base.obligations = EXIT_OBLIGATIONS.map((o) => {
    const { ready, note } = o.test(base)
    const done = o.id === 'ex_return'
      ? holdings.filter((h) => h.returnable).every((h) => h.returnRecord)
      : o.id === 'ex_destroy'
        ? holdings.filter((h) => !h.mustKeep).every((h) => h.destroyRecord)
        : false
    return { obligation: o, state: done ? 'done' : ready ? 'ready' : 'not_started', note }
  })
  return base
}
