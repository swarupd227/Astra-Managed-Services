import { DEMAND_CLASSES } from './ledgers'
import { PROGRAMMES } from './programmes'

/* ==========================================================================
   Application portfolio — what is in support, who supplies it, what state
   its configuration is in, and whether it embeds a model.

   Two columns sit at the heart of it: what the client's own record says and
   what the platform observes. The client's record here is demonstrably
   wrong about its own estate, so a count on its own would have been the
   wrong answer, and where the two disagree the disagreement is the finding.

   The kind of an application decides its lifecycle, and that is the part
   that carries to any client. A SaaS product's code is released by its
   vendor and cannot be rolled back by anyone else; its tenant configuration
   is ours. A commercial product's versions come from its vendor but we
   deploy them and can roll them back. A custom application is ours end to
   end. An integration is coupled to both of the things it joins. Release,
   vendor and configuration rules all key off this, rather than off a list
   of named products.
   ========================================================================== */

/** What the client's own record — CMDB and application inventory — says. */
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

/** The four ways the two columns can disagree. */
export type Reconciliation = 'reconciled' | 'ghost' | 'unrecorded' | 'orphan' | 'invisible'

export const RECONCILIATION_LABEL: Record<Reconciliation, string> = {
  reconciled: 'Agrees',
  ghost: 'Retired on paper, live in fact',
  unrecorded: 'Live but not in the record',
  orphan: 'Supported but never seen',
  invisible: 'Supported and unmeasurable',
}

export const RECONCILIATION_MEANING: Record<Reconciliation, string> = {
  reconciled: 'The record and the platform agree.',
  ghost: 'The client believes this is gone and is not planning around it, while it continues to generate work and to carry risk nobody has assigned.',
  unrecorded: 'Work is arriving from something the record does not contain. It cannot be budgeted, patched or retired, because on paper it does not exist.',
  orphan: 'The record says this is supported and no demand has arrived against it. Either it is genuinely unused and is a retirement candidate, or it is used and failing silently.',
  invisible: 'Supported, and carrying no telemetry at all. Its own retirement could never be evidenced by observation, so a decommission here needs a record rather than an absence.',
}

/* ------------------------------ Kind and lifecycle -------------------------- */

export type AppKind = 'saas' | 'commercial' | 'custom' | 'integration'

export const KIND_LABEL: Record<AppKind, string> = {
  saas: 'SaaS',
  commercial: 'Commercial',
  custom: 'Custom',
  integration: 'Integration',
}

export interface Lifecycle {
  /** Who ships the application's code. */
  codeReleasedBy: 'vendor' | 'us' | 'both'
  /** Whether a code release can be reversed by us. SaaS code cannot. */
  canRollBackCode: boolean
  /** How central the vendor is to keeping the application running. */
  vendorRole: 'primary' | 'secondary' | 'none'
  /** What "configuration" means for this kind — the thing a baseline records. */
  configScope: 'tenant' | 'instance' | 'codebase' | 'interface contract' | 'schema' | 'model definition' | 'report definition'
  /** Where a change cannot be reversed, whether it can at least be compensated. */
  compensable?: boolean
}

export const LIFECYCLE: Record<AppKind, Lifecycle> = {
  saas: { codeReleasedBy: 'vendor', canRollBackCode: false, vendorRole: 'primary', configScope: 'tenant' },
  commercial: { codeReleasedBy: 'vendor', canRollBackCode: true, vendorRole: 'secondary', configScope: 'instance' },
  custom: { codeReleasedBy: 'us', canRollBackCode: true, vendorRole: 'none', configScope: 'codebase' },
  integration: { codeReleasedBy: 'both', canRollBackCode: true, vendorRole: 'secondary', configScope: 'interface contract' },
}

/* ------------------------------- Configuration ------------------------------ */

export type ConfigDrift = 'in_baseline' | 'drifted' | 'unknown'

export const DRIFT_LABEL: Record<ConfigDrift, string> = {
  in_baseline: 'In baseline',
  drifted: 'Drifted',
  unknown: 'No baseline',
}

export interface ConfigBaseline {
  /** The recorded baseline — a version, a tag or a tenant snapshot, by kind. */
  baseline: string
  /** The last configuration known to work. Revert-to-known-good needs this to exist. */
  knownGood: string
  drift: ConfigDrift
}

/* --------------------------------- The item --------------------------------- */

export interface InventoryItem {
  id: string
  name: string
  /** The estate graph node, where one exists. */
  nodeId?: string
  kind: AppKind
  /** Who supplies it. Absent for custom applications. */
  vendorId?: string
  tier: number
  owner: string
  clientRecord: ClientRecord
  observed: Observed
  /** Incidents a year attributable to it, where the ledger carries them. */
  annualIncidents: number
  demandClasses: string[]
  config: ConfigBaseline
  /** Whether the application embeds a model. */
  aiEnabled?: boolean
  /** The AI-system registry entry governing that model. Missing means ungoverned. */
  aiSystemId?: string
  /** Scope item in a programme, where it is being retired. */
  scopeItemId?: string
  note: string
}

/* --------------------------------- The seed --------------------------------- */

export const INVENTORY: InventoryItem[] = [
  {
    id: 'inv_iem', name: 'IEM (legacy time entry)', nodeId: 'app_iem', kind: 'custom', tier: 2, owner: 'KNet Applications',
    clientRecord: 'retired', observed: 'live', annualIncidents: 658, demandClasses: ['dc_iem_ghost'],
    config: { baseline: 'iem-2019.4', knownGood: 'iem-2019.4', drift: 'unknown' },
    scopeItemId: 'psi_iem',
    note: 'Attachment C.4 lists this as superseded by Concur. Consultants still submit time through it and it is the highest-volume live application in its tower.',
  },
  {
    id: 'inv_peoplesoft', name: 'PeopleSoft HCM', nodeId: 'app_hcm', kind: 'commercial', vendorId: 'ven_oracle', tier: 1, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 84, demandClasses: ['dc_workday_migration'],
    config: { baseline: 'PeopleTools 8.60 · PUM 47', knownGood: 'PUM 47', drift: 'in_baseline' },
    scopeItemId: 'psi_peoplesoft',
    note: 'Retires August 2027 on the Workday cutover. Record and observation agree.',
  },
  {
    id: 'inv_workday', name: 'Workday HCM', kind: 'saas', vendorId: 'ven_workday', tier: 1, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: ['dc_workday_migration'],
    config: { baseline: 'Tenant snapshot 2027-02-01', knownGood: 'Tenant snapshot 2027-02-01', drift: 'in_baseline' },
    note: 'The destination of the HCM migration. Its own defects are recorded against the migration class rather than against it.',
  },
  {
    id: 'inv_sap', name: 'SAP S/4HANA', nodeId: 'db_sap_prod', kind: 'commercial', vendorId: 'ven_sap', tier: 0, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 62, demandClasses: ['dc_batch_overrun', 'dc_sap_capacity'],
    config: { baseline: 'S/4HANA 2023 FPS02', knownGood: 'FPS02', drift: 'in_baseline' },
    note: 'Core finance. Month-end close contends with the migration extract window.',
  },
  {
    id: 'inv_mulesoft', name: 'Mulesoft (Salesforce ↔ SAP bridge)', nodeId: 'app_mulesoft', kind: 'integration', vendorId: 'ven_salesforce', tier: 1, owner: 'KNet Applications',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 49, demandClasses: ['dc_mulesoft_soleowner', 'dc_cert_expiry', 'dc_api_5xx', 'dc_sfdc_gap'],
    config: { baseline: 'Anypoint 4.5.2', knownGood: 'Anypoint 4.5.2', drift: 'drifted' },
    scopeItemId: 'psi_mulesoft_bridge',
    note: 'One named owner for the entire bridge. Replacement rather than retirement — the integration has to land somewhere.',
  },
  {
    id: 'inv_oracle_dm', name: 'Oracle datamart', kind: 'commercial', vendorId: 'ven_oracle', tier: 1, owner: 'KNet Data',
    clientRecord: 'in_support', observed: 'not_observed', annualIncidents: 40, demandClasses: ['dc_oracle_blindspot'],
    config: { baseline: '19c · schema v212', knownGood: '', drift: 'unknown' },
    scopeItemId: 'psi_oracle_datamart',
    note: 'Tier 1 and seven thousand users, with zero incident telemetry. The forty incidents a year are reported by people, not detected.',
  },
  {
    id: 'inv_adf', name: 'Azure Data Factory / R&A Hub', kind: 'saas', vendorId: 'ven_microsoft', tier: 1, owner: 'KNet Data',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 14, demandClasses: ['dc_pipeline_fail', 'dc_schema_drift', 'dc_job_cost', 'dc_lineage_gap'],
    config: { baseline: 'Factory template 2027.02', knownGood: '2027.02', drift: 'in_baseline' },
    note: 'Runs the engagement ingest and the utilisation load.',
  },
  {
    id: 'inv_cloud_dm', name: 'Cloud datamart (Azure SQL)', kind: 'saas', vendorId: 'ven_microsoft', tier: 1, owner: 'KNet Data',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 1, demandClasses: ['dc_dq_null_ratio'],
    config: { baseline: 'Schema v88', knownGood: 'Schema v88', drift: 'in_baseline' },
    note: 'Holds the engagement, client and utilisation tables.',
  },
  {
    id: 'inv_powerbi', name: 'Microsoft Power BI', kind: 'saas', vendorId: 'ven_microsoft', tier: 1, owner: 'KNet Data',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 58, demandClasses: ['dc_bi_refresh', 'dc_bi_stale', 'dc_bi_semantic'],
    config: { baseline: 'Tenant snapshot 2027-02-01', knownGood: 'Tenant snapshot 2027-02-01', drift: 'in_baseline' },
    note: 'Leadership, utilisation and practice reporting.',
  },
  {
    id: 'inv_servicenow', name: 'ServiceNow', kind: 'saas', vendorId: 'ven_servicenow', tier: 0, owner: 'KNet Service Management',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: ['dc_snow_catalog', 'dc_cmdb_accuracy'],
    config: { baseline: 'Washington DC · patch 3', knownGood: 'Patch 3', drift: 'drifted' },
    note: 'The system of record for the service itself.',
  },
  {
    id: 'inv_focus', name: 'FOCUS (engagement billing)', nodeId: 'app_focus', kind: 'custom', tier: 2, owner: 'KNet Finance Systems',
    clientRecord: 'in_support', observed: 'quiet', annualIncidents: 0, demandClasses: ['dc_focus_stall', 'dc_recon_break'],
    config: { baseline: 'focus-24.11.2', knownGood: 'focus-24.11.2', drift: 'in_baseline' },
    note: 'Listed as supported and nothing has arrived against it this period. Either it is genuinely idle and a retirement candidate, or it is failing quietly for the few who still use it.',
  },
  {
    id: 'inv_concur', name: 'Concur', kind: 'saas', vendorId: 'ven_sap', tier: 2, owner: 'KNet Finance Systems',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: [],
    config: { baseline: 'Tenant snapshot 2027-01-15', knownGood: 'Tenant snapshot 2027-01-15', drift: 'in_baseline' },
    note: 'The system IEM was supposed to have been replaced by.',
  },
  {
    id: 'inv_m365', name: 'Microsoft 365 / OneDrive', kind: 'saas', vendorId: 'ven_microsoft', tier: 0, owner: 'KNet Digital Workplace',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 926, demandClasses: ['dc_onedrive_sync', 'dc_copilot_anomaly'],
    config: { baseline: 'Monthly Enterprise Channel 2501', knownGood: 'Channel 2501', drift: 'in_baseline' },
    aiEnabled: true,
    note: 'Copilot is licensed across the tenant. The embedded model is not entered in the AI-system registry.',
  },
  {
    id: 'inv_alteryx', name: 'Alteryx Designer', kind: 'commercial', vendorId: 'ven_alteryx', tier: 2, owner: 'KNet Data',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 659, demandClasses: ['dc_alteryx_fail'],
    config: { baseline: '', knownGood: '', drift: 'unknown' },
    note: 'Listed in Attachment C.4 at 659 incidents a year. The shared licence pool running out mid-workflow is the commonest cause.',
  },
  {
    id: 'inv_tableau_shadow', name: 'Tableau Server (practice-managed)', kind: 'commercial', vendorId: 'ven_salesforce', tier: 2, owner: 'unassigned',
    clientRecord: 'absent', observed: 'live', annualIncidents: 0, demandClasses: ['dc_shadow_app'],
    config: { baseline: '', knownGood: '', drift: 'unknown' },
    note: 'Stood up by a practice against the datamart. No owner in the record, no patching schedule.',
  },
  {
    id: 'inv_teams', name: 'Microsoft Teams', kind: 'saas', vendorId: 'ven_microsoft', tier: 0, owner: 'KNet Digital Workplace',
    clientRecord: 'in_support', observed: 'live', annualIncidents: 0, demandClasses: ['dc_teams_quality'],
    config: { baseline: 'Tenant snapshot 2027-02-01', knownGood: 'Tenant snapshot 2027-02-01', drift: 'in_baseline' },
    note: 'Call quality incidents are recorded against the conference-room estate rather than the application.',
  },
  {
    id: 'inv_iem_reporting', name: 'IEM reporting extracts', kind: 'custom', tier: 3, owner: 'unassigned',
    clientRecord: 'absent', observed: 'live', annualIncidents: 0, demandClasses: ['dc_shadow_app'],
    config: { baseline: '', knownGood: '', drift: 'unknown' },
    note: 'A reporting layer built on the application the record says was retired.',
  },
]

/* ------------------------------- The reading -------------------------------- */

export function reconcile(item: InventoryItem): Reconciliation {
  if (item.clientRecord === 'retired') return item.observed === 'live' ? 'ghost' : 'reconciled'
  if (item.clientRecord === 'absent') return item.observed === 'live' ? 'unrecorded' : 'reconciled'
  if (item.observed === 'not_observed') return 'invisible'
  if (item.observed === 'quiet') return 'orphan'
  return 'reconciled'
}

/** An application that embeds a model with no registry entry governing it. */
export const ungovernedAi = (i: InventoryItem) => Boolean(i.aiEnabled) && !i.aiSystemId

export interface InventorySummary {
  items: (InventoryItem & { reconciliation: Reconciliation })[]
  recordedInSupport: number
  observedLive: number
  /** Everything the client supports plus everything found that they do not list. A floor. */
  denominator: number
  byReconciliation: Record<Reconciliation, number>
  reconciledShare: number
  disputedIncidents: number
  inProgramme: number
  byKind: Record<AppKind, number>
  /** Configuration away from its baseline, or with no baseline at all. */
  drifted: number
  noBaseline: number
  aiEnabled: number
  ungovernedAi: number
  caveats: string[]
}

export function inventorySummary(items: InventoryItem[] = INVENTORY): InventorySummary {
  const withRec = items.map((i) => ({ ...i, reconciliation: reconcile(i) }))

  const byReconciliation = withRec.reduce((acc, i) => {
    acc[i.reconciliation] = (acc[i.reconciliation] ?? 0) + 1
    return acc
  }, { reconciled: 0, ghost: 0, unrecorded: 0, orphan: 0, invisible: 0 } as Record<Reconciliation, number>)

  const byKind = withRec.reduce((acc, i) => {
    acc[i.kind] = (acc[i.kind] ?? 0) + 1
    return acc
  }, { saas: 0, commercial: 0, custom: 0, integration: 0 } as Record<AppKind, number>)

  const recordedInSupport = withRec.filter((i) => i.clientRecord === 'in_support').length
  const unrecordedLive = withRec.filter((i) => i.reconciliation === 'unrecorded').length
  const ghosts = withRec.filter((i) => i.reconciliation === 'ghost')

  const shadowVolume = DEMAND_CLASSES.find((d) => d.id === 'dc_shadow_app')?.volumeYr ?? 0
  const scopeIds = new Set(PROGRAMMES.flatMap((p) => p.items.map((i) => i.id)))

  const caveats = [
    `This count is a floor, not a total. ${unrecordedLive} applications here were found rather than declared, and ${shadowVolume.toLocaleString('en-GB')} reconciliation incidents a year say there is more of it.`,
    `${ghosts.length ? `${ghosts.length} application${ghosts.length === 1 ? ' is' : 's are'} recorded as retired and still carrying work` : 'No application is recorded as retired while still live'}.`,
  ]

  return {
    items: withRec,
    recordedInSupport,
    observedLive: withRec.filter((i) => i.observed === 'live').length,
    denominator: recordedInSupport + unrecordedLive,
    byReconciliation,
    reconciledShare: withRec.length ? byReconciliation.reconciled / withRec.length : 0,
    disputedIncidents: withRec.filter((i) => i.reconciliation !== 'reconciled').reduce((s, i) => s + i.annualIncidents, 0),
    inProgramme: withRec.filter((i) => i.scopeItemId && scopeIds.has(i.scopeItemId)).length,
    byKind,
    drifted: withRec.filter((i) => i.config.drift === 'drifted').length,
    noBaseline: withRec.filter((i) => i.config.drift === 'unknown').length,
    aiEnabled: withRec.filter((i) => i.aiEnabled).length,
    ungovernedAi: withRec.filter(ungovernedAi).length,
    caveats,
  }
}
