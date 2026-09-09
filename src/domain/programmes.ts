import { NOW } from './workSeed'
import { DEMAND_CLASSES } from './ledgers'
import type { ISO } from './types'

/* ==========================================================================
   Programmes — a target end state with something to burn down against.

   The platform observes modernisation pressure well: the legacy demand
   classes are all here, with their causes and their cost. What it has never
   held is the programme itself. "PeopleSoft retires August 2027" lived as a
   sentence inside a demand class's cause string, which means you could ask
   what a legacy system costs you and could not ask whether the estate is
   getting simpler on schedule.

   The distinction this module is built around is between a scope item
   somebody has declared finished and one the platform can evidence is gone.
   They are two separate facts and a burn-down that conflates them is a
   burn-down of optimism: demand falling to nothing is strong evidence that a
   decommission has happened, and it is not the decommission. Both curves are
   computed and both are shown.
   ========================================================================== */

export type ScopeState = 'in_scope' | 'in_flight' | 'asserted_done' | 'evidenced_done' | 'descoped'

export const SCOPE_LABEL: Record<ScopeState, string> = {
  in_scope: 'in scope',
  in_flight: 'in flight',
  asserted_done: 'declared done',
  evidenced_done: 'evidenced done',
  descoped: 'descoped',
}

/** What would actually prove a system is gone, as opposed to quiet. */
export type EvidenceKind = 'decommission_record' | 'contract_terminated' | 'cmdb_removed' | 'traffic_zero'

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  decommission_record: 'Decommission record',
  contract_terminated: 'Vendor contract terminated',
  cmdb_removed: 'Removed from the CMDB',
  traffic_zero: 'No traffic observed',
}

/**
 * Whether a kind of evidence actually settles the question. Zero traffic is
 * the one that does not: a system nobody used this quarter is not a system
 * that has been switched off, and treating it as one is how estates end up
 * with servers that no team admits to owning.
 */
export const EVIDENCE_IS_CONCLUSIVE: Record<EvidenceKind, boolean> = {
  decommission_record: true,
  contract_terminated: true,
  cmdb_removed: true,
  traffic_zero: false,
}

export interface ScopeItem {
  id: string
  name: string
  /** The estate node this refers to, where the graph holds one. */
  nodeId?: string
  /** Demand classes that exist because this item does. */
  demandClasses: string[]
  targetDate: ISO
  state: ScopeState
  evidence?: { kind: EvidenceKind; ref: string; at: ISO }
  note: string
}

export interface Programme {
  id: string
  name: string
  /** The objective this programme serves, where one has been stated. */
  objectiveId?: string
  owner: string
  startedAt: ISO
  targetEndAt: ISO
  items: ScopeItem[]
}

/* --------------------------------- The seed --------------------------------- */

const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const ahead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()

/**
 * Kearney's estate simplification programme, built from the legacy items the
 * RFP and the demand ledger already name. Two items are declared done and
 * only one of those is evidenced — which is the point of the distinction.
 */
export const PROGRAMMES: Programme[] = [
  {
    id: 'prg_estate_simplification',
    name: 'Estate simplification',
    objectiveId: 'obj_modernization',
    owner: 'S. Raghunathan (KNet Apps Lead)',
    startedAt: ago(96),
    targetEndAt: ahead(640),
    items: [
      {
        id: 'psi_iem', name: 'IEM (legacy time entry)', nodeId: 'app_iem',
        demandClasses: ['dc_iem_ghost'], targetDate: ahead(120), state: 'in_flight',
        note: 'Listed as replaced by Concur in the client\'s own application inventory, and still the highest-volume live application in the tower at 658 incidents a year. The inventory has been wrong about this for longer than the contract has existed.',
      },
      {
        id: 'psi_peoplesoft', name: 'PeopleSoft HCM', nodeId: undefined,
        demandClasses: ['dc_workday_migration', 'dc_batch_overrun'], targetDate: ahead(160), state: 'in_flight',
        note: 'Retires August 2027 on the Workday cutover. Mapping defects surface on every wave; the batch window contention is the same system seen from the other side.',
      },
      {
        id: 'psi_oracle_datamart', name: 'Oracle datamart', nodeId: undefined,
        demandClasses: ['dc_oracle_blindspot'], targetDate: ahead(300), state: 'in_scope',
        note: 'Tier 1, 7,000 users, zero incident telemetry. Consolidation target, not yet started — and until it carries telemetry, its own retirement cannot be evidenced by traffic either.',
      },
      {
        id: 'psi_mulesoft_bridge', name: 'Mulesoft Salesforce ↔ SAP bridge', nodeId: undefined,
        demandClasses: ['dc_mulesoft_soleowner', 'dc_cert_expiry'], targetDate: ahead(220), state: 'in_scope',
        note: 'One named owner for the whole bridge. Replacement rather than retirement — the integration has to land somewhere.',
      },
      {
        id: 'psi_chicago_dc', name: 'Chicago data centre', nodeId: 'inf_azure_compute',
        demandClasses: ['dc_node_pressure', 'dc_tf_drift'], targetDate: ahead(400), state: 'in_flight',
        note: 'Year 3 exit target. 437 VMs still in migration; the autoscaling and drift classes are both artefacts of running mid-move.',
      },
      {
        id: 'psi_thirdav', name: 'Third endpoint EDR agent', nodeId: undefined,
        demandClasses: ['dc_triple_av'], targetDate: ago(20), state: 'asserted_done',
        evidence: { kind: 'traffic_zero', ref: 'No agent check-ins observed since 2027-01-09', at: ago(18) },
        note: 'Security declared this removed at the January change board. The only evidence is an absence of check-ins, which is consistent with removal and equally consistent with an agent that has stopped reporting.',
      },
      {
        id: 'psi_legacy_vpn', name: 'Legacy VPN concentrator estate', nodeId: undefined,
        demandClasses: [], targetDate: ago(45), state: 'evidenced_done',
        evidence: { kind: 'decommission_record', ref: 'CHG0041882 — 6 concentrators decommissioned, assets disposed', at: ago(41) },
        note: 'Superseded by the Cisco Zero-Trust rollout. Decommission record with asset disposal, so this one is settled.',
      },
      {
        id: 'psi_fileshares', name: 'On-premises departmental file shares', nodeId: undefined,
        demandClasses: ['dc_onedrive_sync'], targetDate: ahead(90), state: 'descoped',
        note: 'Descoped in January: the OneDrive sync failures made the client unwilling to move the remaining shares until Zero-Trust enrolment is stable. Descoped, not done — it comes back.',
      },
    ],
  },
]

/* ------------------------------- The reading -------------------------------- */

export interface BurnDown {
  programme: Programme
  /** Items in scope at the start — descoped items included, since they were. */
  total: number
  /** Remaining if a declaration is taken at face value. */
  remainingAsserted: number
  /** Remaining if only evidenced completion counts. The one to quote. */
  remainingEvidenced: number
  /** Declared finished but not evidenced. The gap between the two curves. */
  assertedOnly: ScopeItem[]
  descoped: ScopeItem[]
  /** Past their target date and not evidenced done. */
  overdue: ScopeItem[]
  /** Evidenced completions per 30 days since the programme started. */
  ratePer30d: number
  /**
   * When the remaining evidenced items would be finished at the observed
   * rate. Null where the rate is zero — an infinite projection is not a
   * forecast, and printing a date implied by one completion is worse.
   */
  projectedEndAt: ISO | null
  onSchedule: boolean | null
  /** Annual hours of demand still attached to items not yet evidenced done. */
  demandHoursRemaining: number
}

export function burnDown(p: Programme, nowMs = NOW.getTime()): BurnDown {
  const live = p.items.filter((i) => i.state !== 'descoped')
  const descoped = p.items.filter((i) => i.state === 'descoped')
  const evidencedDone = live.filter((i) => i.state === 'evidenced_done')
  const assertedDone = live.filter((i) => i.state === 'asserted_done' || i.state === 'evidenced_done')
  const assertedOnly = live.filter((i) => i.state === 'asserted_done')
  const notEvidenced = live.filter((i) => i.state !== 'evidenced_done')

  const elapsedDays = Math.max(1, (nowMs - Date.parse(p.startedAt)) / 86_400_000)
  const ratePer30d = (evidencedDone.length / elapsedDays) * 30
  const remainingEvidenced = notEvidenced.length

  const projectedEndAt = ratePer30d > 0
    ? new Date(nowMs + (remainingEvidenced / ratePer30d) * 30 * 86_400_000).toISOString()
    : null

  return {
    programme: p,
    total: p.items.length,
    remainingAsserted: live.length - assertedDone.length,
    remainingEvidenced,
    assertedOnly,
    descoped,
    overdue: notEvidenced.filter((i) => Date.parse(i.targetDate) < nowMs),
    ratePer30d,
    projectedEndAt,
    onSchedule: projectedEndAt === null ? null : Date.parse(projectedEndAt) <= Date.parse(p.targetEndAt),
    demandHoursRemaining: notEvidenced
      .flatMap((i) => i.demandClasses)
      .reduce((s, id) => s + (DEMAND_CLASSES.find((d) => d.id === id)?.hoursYr ?? 0), 0),
  }
}

/** Every programme's burn-down, in seed order. */
export function allBurnDowns(programmes: Programme[] = PROGRAMMES, nowMs = NOW.getTime()): BurnDown[] {
  return programmes.map((p) => burnDown(p, nowMs))
}
