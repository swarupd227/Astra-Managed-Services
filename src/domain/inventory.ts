import { DEMAND_CLASSES } from './ledgers'
import { PROGRAMMES } from './programmes'

/* ==========================================================================
   Application inventory — the denominator modernisation never had.

   "Reduce the number of systems under support" was unmeasurable here for a
   plain reason: there was no count of systems. The programme burn-down could
   say eight things were in scope and could not say what fraction of the
   estate that was.

   A count on its own would have been the easy and wrong answer, because this
   client's own record is demonstrably incorrect. Their application inventory
   lists the legacy time-entry system as replaced, and it is the
   highest-volume live application in its tower. So an inventory here is two
   columns, not one: what the client's record says, and what the platform
   observes. Where they disagree the disagreement is the finding, and the
   four ways they can disagree each mean something different.

   The count is also a floor rather than a total, and says so. Shadow IT is
   by definition the applications nobody has found; a denominator built from
   what we can see understates the estate by an unknown amount, and a
   modernisation percentage computed against it is flattered by exactly that
   unknown.
   ========================================================================== */

/** What the client's own record — CMDB and Attachment C.4 — says. */
export type ClientRecord = 'in_support' | 'retired' | 'absent'
/** What the platform can see of it. */
export type Observed = 'live' | 'quiet' | 'not_observed'

export const RECORD_LABEL: Record<ClientRecord, string> = {
  in_support: 'Listed in support',
  retired: 'Listed as retired',
  absent: 'Not in the record',
}

export const OBSERVED_LABEL: Record<Observed, string> = {
  live: 'Carrying demand',
  quiet: 'No demand this period',
  not_observed: 'No telemetry at all',
}

/** The four ways the two columns can disagree, and what each one means. */
export type Reconciliation = 'reconciled' | 'ghost' | 'unrecorded' | 'orphan' | 'invisible'

export const RECONCILIATION_LABEL: Record<Reconciliation, string> = {
  reconciled: 'Agrees',
  ghost: 'Retired on paper, live in fact',
  unrecorded: 'Live but not in the record',
  orphan: 'Supported but never seen',
  invisible: 'Supported and unmeasurable',
}

export const RECONCILIATION_MEANING: Record<Reconciliation, string> = {
  reconciled: 'The record and the platform agree. Nothing to do.',
  ghost: 'The client believes this is gone and is not planning around it, while it continues to generate work and to carry risk nobody has assigned.',
  unrecorded: 'Work is arriving from something the record does not contain. It cannot be budgeted, patched or retired, because on paper it does not exist.',
  orphan: 'The record says this is supported and no demand has arrived against it. Either it is genuinely unused and is a retirement candidate, or it is used and failing silently.',
  invisible: 'Supported, and carrying no telemetry at all. Its own retirement could never be evidenced by observation, so a decommission here needs a record rather than an absence.',
}

export interface InventoryItem {
  id: string
  name: string
  /** The estate graph node, where one exists. */
  nodeId?: string
  tier: number
  owner: string
  clientRecord: ClientRecord
  observed: Observed
  /** Incidents a year attributable to it, where the ledger carries them. */
  annualIncidents: number
  demandClasses: string[]
  /** Scope item in a programme, where it is being retired. */
  scopeItemId?: string
  note: string
}

/* --------------------------------- The seed --------------------------------- */

export const INVENTORY: InventoryItem[] = [
  {
    id: 'inv_iem', name: 'IEM (legacy time entry)', nodeId: 'app_iem', tier: 2, owner: 'KNet Applications',
    clientRecord: 'retired', observed: 'live', annualIncidents: 658, demandClasses: ['dc_iem_ghost'],
    scopeItemId: 'psi_iem',
    note: 'Attachment C.4 lists this as superseded by Concur. Consultants still submit time through it and it is the highest-volume live application in its tower.',
  },
  {
    id: 'inv_peoplesoft', name: 'PeopleSoft HCM', tier: 1, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 84, demandClasses: ['dc_workday_migration'],
    scopeItemId: 'psi_peoplesoft',
    note: 'Retires August 2027 on the Workday cutover. Record and observation agree.',
  },
  {
    id: 'inv_workday', name: 'Workday HCM', tier: 1, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: [],
    note: 'The destination of the HCM migration. Its own defects are recorded against the migration class rather than against it.',
  },
  {
    id: 'inv_sap', name: 'SAP S/4HANA', nodeId: 'db_sap_prod', tier: 0, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 62, demandClasses: ['dc_batch_overrun'],
    note: 'Core finance. Month-end close contends with the migration extract window.',
  },
  {
    id: 'inv_mulesoft', name: 'Mulesoft (Salesforce ↔ SAP bridge)', nodeId: 'app_mulesoft', tier: 1, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 49, demandClasses: ['dc_mulesoft_soleowner', 'dc_cert_expiry'],
    scopeItemId: 'psi_mulesoft_bridge',
    note: 'One named owner for the entire bridge. Replacement rather than retirement — the integration has to land somewhere.',
  },
  {
    id: 'inv_oracle_dm', name: 'Oracle datamart', tier: 1, owner: 'KNet Data',
    clientRecord: 'in_support', observed: 'not_observed', annualIncidents: 40, demandClasses: ['dc_oracle_blindspot'],
    scopeItemId: 'psi_oracle_datamart',
    note: 'Tier 1 and seven thousand users, with zero incident telemetry. The forty incidents a year are reported by people, not detected — and its own retirement could never be evidenced by an absence of traffic.',
  },
  {
    id: 'inv_servicenow', name: 'ServiceNow', tier: 0, owner: 'KNet Service Management',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: [],
    note: 'The system of record for the service itself.',
  },
  {
    id: 'inv_focus', name: 'FOCUS (legacy engagement billing)', nodeId: 'app_focus', tier: 2, owner: 'KNet Finance Systems',
    clientRecord: 'in_support', observed: 'quiet', annualIncidents: 0, demandClasses: [],
    note: 'Listed as supported and nothing has arrived against it this period. Either it is genuinely idle and a retirement candidate, or it is failing quietly for the few who still use it.',
  },
  {
    id: 'inv_concur', name: 'Concur', tier: 2, owner: 'KNet Finance Systems',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: [],
    note: 'The system IEM was supposed to have been replaced by.',
  },
  {
    id: 'inv_m365', name: 'Microsoft 365 / OneDrive', tier: 0, owner: 'KNet Digital Workplace',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 926, demandClasses: ['dc_onedrive_sync'],
    note: 'Sync breaks following Zero-Trust enrolment. The single most-felt application in the estate.',
  },
  {
    id: 'inv_alteryx', name: 'Alteryx Designer', tier: 2, owner: 'KNet Data',
    clientRecord: 'absent', observed: 'live', annualIncidents: 0, demandClasses: ['dc_shadow_app'],
    note: 'Provisioned through the software catalogue and absent from the application record. It is licensed, installed and generating requests, and on paper it does not exist.',
  },
  {
    id: 'inv_tableau_shadow', name: 'Tableau Server (practice-managed)', tier: 2, owner: 'unassigned',
    clientRecord: 'absent', observed: 'live', annualIncidents: 0, demandClasses: ['dc_shadow_app'],
    note: 'Stood up by a practice against the datamart. No owner in the record, no patching schedule, and analytics the firm acts on.',
  },
  {
    id: 'inv_teams', name: 'Microsoft Teams', tier: 0, owner: 'KNet Digital Workplace',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: [],
    note: 'Call quality incidents are recorded against the conference-room estate rather than the application.',
  },
  {
    id: 'inv_iem_reporting', name: 'IEM reporting extracts', tier: 3, owner: 'unassigned',
    clientRecord: 'absent', observed: 'live', annualIncidents: 0, demandClasses: ['dc_shadow_app'],
    note: 'A reporting layer built on the application the record says was retired. Absent from the inventory for the same reason its parent is mis-stated.',
  },
]

/* ------------------------------- The reading -------------------------------- */

export function reconcile(item: InventoryItem): Reconciliation {
  if (item.clientRecord === 'retired') return item.observed === 'live' ? 'ghost' : 'reconciled'
  if (item.clientRecord === 'absent') return item.observed === 'live' ? 'unrecorded' : 'reconciled'
  // Listed in support.
  if (item.observed === 'not_observed') return 'invisible'
  if (item.observed === 'quiet') return 'orphan'
  return 'reconciled'
}

export interface InventorySummary {
  items: (InventoryItem & { reconciliation: Reconciliation })[]
  /** Applications the client's own record lists as supported. */
  recordedInSupport: number
  /** Applications the platform can see carrying or capable of demand. */
  observedLive: number
  /**
   * The count modernisation is measured against: everything the client
   * supports plus everything we found that they do not list. A floor.
   */
  denominator: number
  byReconciliation: Record<Reconciliation, number>
  reconciledShare: number
  /** Annual incidents attached to items whose record disagrees with reality. */
  disputedIncidents: number
  /** Scope items in programmes that map to an inventory entry. */
  inProgramme: number
  caveats: string[]
}

export function inventorySummary(items: InventoryItem[] = INVENTORY): InventorySummary {
  const withRec = items.map((i) => ({ ...i, reconciliation: reconcile(i) }))

  const byReconciliation = withRec.reduce((acc, i) => {
    acc[i.reconciliation] = (acc[i.reconciliation] ?? 0) + 1
    return acc
  }, { reconciled: 0, ghost: 0, unrecorded: 0, orphan: 0, invisible: 0 } as Record<Reconciliation, number>)

  const recordedInSupport = withRec.filter((i) => i.clientRecord === 'in_support').length
  const unrecordedLive = withRec.filter((i) => i.reconciliation === 'unrecorded').length
  const ghosts = withRec.filter((i) => i.reconciliation === 'ghost')

  const shadowVolume = DEMAND_CLASSES.find((d) => d.id === 'dc_shadow_app')?.volumeYr ?? 0
  const scopeIds = new Set(PROGRAMMES.flatMap((p) => p.items.map((i) => i.id)))

  const caveats = [
    `This count is a floor, not a total. ${unrecordedLive} applications here were found rather than declared, and shadow IT is by definition what has not been found — ${shadowVolume.toLocaleString('en-GB')} reconciliation incidents a year say there is more of it. A modernisation percentage against this denominator is flattered by an unknown amount.`,
    `${ghosts.length ? `${ghosts.length} application${ghosts.length === 1 ? ' is' : 's are'} recorded as retired and still carrying work` : 'No application is recorded as retired while still live'}. Where the record and the platform disagree, this page reports the disagreement rather than choosing a side.`,
    'An application observed quiet is not an application confirmed unused. It may be idle and ready to retire, or failing silently for the few people who still depend on it, and nothing here separates the two.',
    'Incident counts are attributed to the application the ledger names. Work caused by one system and recorded against another — a sync failure caused by a network rollout, say — sits with the name on the ticket.',
  ]

  return {
    items: withRec,
    recordedInSupport,
    observedLive: withRec.filter((i) => i.observed === 'live').length,
    denominator: recordedInSupport + unrecordedLive,
    byReconciliation,
    reconciledShare: withRec.length ? byReconciliation.reconciled / withRec.length : 0,
    disputedIncidents: withRec
      .filter((i) => i.reconciliation !== 'reconciled')
      .reduce((s, i) => s + i.annualIncidents, 0),
    inProgramme: withRec.filter((i) => i.scopeItemId && scopeIds.has(i.scopeItemId)).length,
    caveats,
  }
}
