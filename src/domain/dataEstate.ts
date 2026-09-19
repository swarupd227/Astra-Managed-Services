/* ==========================================================================
   Data estate — the sources, feeds, pipelines, workflows, datasets,
   semantic models, reports, applications and external recipients under
   support, the contract each is held to, and the lineage between them.

   The kind of an item decides how a bad state is put right, and that is the
   part that carries to any client. A source belongs to the system that emits
   it: we can detect a breach in it, but only its owner can fix it. A pipeline
   is code we deploy, so it can be redeployed and rerun. A dataset cannot be
   rolled back once rows are written, only compensated by a backfill, which
   is why a backfill needs a contract to be verified against. A semantic
   model or a report is rebuilt by refreshing it.

   Health is read two ways and never merged. An item's own state is judged
   against its own contract. Its inherited state is whatever reaches it
   through lineage: a report whose model refreshed cleanly is still wrong if
   a table two hops upstream went stale. An item with no telemetry is not
   healthy, it is unobserved, and everything that reads from it cannot be
   vouched for either.

   A contract is enforced when a breach stops publication, and declared when
   it is written and monitored but the data moves regardless. The policy
   engine treats only an enforced contract as something to verify against.

   The estate does not end at a report. Operational applications read from
   it and write back into it, so an application can sit both upstream and
   downstream of the same dataset and lineage has to tolerate the loop.
   Feeds carry data between systems and out to other organisations;
   self-service workflows are built and owned by the business on a platform
   the service runs; and an external recipient is a party outside the
   estate that holds a copy. Each kind declares whether it holds records,
   whether the platform should expect a signal from it, and how it is put
   right, so a new kind needs a row in DATA_LIFECYCLE, not new logic.
   ========================================================================== */

import { completedRuns, isOnTime } from './dataRuns'
import { NOW } from './workSeed'

export type DataKind =
  | 'source' | 'feed' | 'pipeline' | 'workflow' | 'dataset' | 'semantic_model' | 'report' | 'application' | 'recipient'

/** Left to right as data usually flows; applications sit with the consumers, though they also emit. */
export const DATA_KINDS: DataKind[] = ['source', 'feed', 'pipeline', 'workflow', 'dataset', 'semantic_model', 'report', 'application', 'recipient']

export const DATA_KIND_LABEL: Record<DataKind, string> = {
  source: 'Source',
  feed: 'Feed',
  pipeline: 'Pipeline',
  workflow: 'Workflow',
  dataset: 'Dataset',
  semantic_model: 'Semantic model',
  report: 'Report',
  application: 'Application',
  recipient: 'External recipient',
}

export interface DataLifecycle {
  /** How a bad state is put right. */
  recovery: string
  /** The action class that performs the recovery. Null where only the upstream owner can. */
  recoveryClass: string | null
  /** Whether a change can be reversed, only compensated, or is not ours to make. */
  change: 'reversible' | 'compensable' | 'not ours'
  /** Whether the kind is held to a contract of its own rather than inheriting its upstream's. */
  contracted: boolean
  /** Whether it keeps records, and so can hold a person's data and must be searched for it. */
  holdsRecords: boolean
  /** Whether the platform should expect a signal from it. A party outside the estate sends none. */
  observed: boolean
}

export const DATA_LIFECYCLE: Record<DataKind, DataLifecycle> = {
  source: { recovery: 'Upstream owner', recoveryClass: null, change: 'not ours', contracted: true, holdsRecords: true, observed: true },
  // A transfer already received cannot be recalled; sending it again can duplicate at the other end.
  feed: { recovery: 'Replay the transfer', recoveryClass: 'AC-49', change: 'compensable', contracted: true, holdsRecords: false, observed: true },
  pipeline: { recovery: 'Redeploy and rerun', recoveryClass: 'AC-12', change: 'reversible', contracted: true, holdsRecords: false, observed: true },
  // Built and run by the business; the service keeps the platform up, not the logic.
  workflow: { recovery: 'Owner reruns', recoveryClass: null, change: 'not ours', contracted: false, holdsRecords: false, observed: true },
  dataset: { recovery: 'Backfill', recoveryClass: 'AC-49', change: 'compensable', contracted: true, holdsRecords: true, observed: true },
  semantic_model: { recovery: 'Refresh', recoveryClass: 'AC-12', change: 'reversible', contracted: true, holdsRecords: true, observed: true },
  report: { recovery: 'Refresh', recoveryClass: 'AC-12', change: 'reversible', contracted: false, holdsRecords: false, observed: true },
  application: { recovery: 'Application support', recoveryClass: null, change: 'not ours', contracted: false, holdsRecords: true, observed: true },
  recipient: { recovery: 'Notify the recipient', recoveryClass: null, change: 'not ours', contracted: false, holdsRecords: false, observed: false },
}

/** What an external recipient receives. */
export type DataCategory = 'identity' | 'contact' | 'employment' | 'compensation' | 'bank' | 'tax' | 'health' | 'dependants' | 'immigration'

export const CATEGORY_LABEL: Record<DataCategory, string> = {
  identity: 'Identity', contact: 'Contact', employment: 'Employment', compensation: 'Compensation', bank: 'Bank details',
  tax: 'Tax', health: 'Health', dependants: 'Dependants', immigration: 'Immigration',
}

/** Categories the law treats as special: they carry stricter conditions wherever they go. */
export const SPECIAL_CATEGORIES: DataCategory[] = ['health']

export type Classification = 'public' | 'internal' | 'confidential' | 'restricted'

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
}

const CLASS_RANK: Record<Classification, number> = { public: 0, internal: 1, confidential: 2, restricted: 3 }

export interface ContractCheck {
  name: string
  bound: string
  observed: string
  passed: boolean
  /**
   * When a failing check on the data itself began. Timeliness checks carry
   * none: whether data landed on time is read from the run history.
   */
  failingSince?: string
}

export interface DataContract {
  id: string
  version: string
  state: 'enforced' | 'declared'
  /** Hours within which fresh data must land. */
  freshnessHrs?: number
  checks: ContractCheck[]
}

export type Lineage = 'mapped' | 'partial' | 'unknown'

export const LINEAGE_LABEL: Record<Lineage, string> = { mapped: 'Mapped', partial: 'Partial', unknown: 'Unknown' }

export interface DataItem {
  id: string
  name: string
  kind: DataKind
  tower: string
  platform: string
  /** Other names it goes by in tickets, plans and code. */
  aliases?: string[]
  /** The estate graph node, where one exists. */
  nodeId?: string
  /** The portfolio application it runs on. */
  appId?: string
  owner: string
  steward?: string
  /** Absent means nobody has classified it. */
  classification?: Classification
  /** The items it reads from. */
  upstream: string[]
  lineage: Lineage
  /** Whether the platform receives any signal from it at all. */
  telemetry: boolean
  /** People who read it, where known. */
  consumers?: number
  contract?: DataContract
  /** Hours since data last landed. Absent without telemetry; read from the run history for scheduled items. */
  lastLandedHrsAgo?: number
  /** The last finished run. Read from the run history for scheduled items. */
  lastRun?: 'succeeded' | 'failed'
  /** Days a record may be kept. Absent means no retention schedule. */
  retentionDays?: number
  /** Age in days of the oldest record held. */
  oldestRecordDays?: number
  /** Days a deleted record survives in backups. */
  backupRetentionDays?: number
  demandClasses: string[]
  /** External recipients: the organisation that receives it. */
  party?: string
  /** External recipients: what they receive. */
  categories?: DataCategory[]
  /** Feeds and recipients: how often data moves. */
  transfer?: string
  /** When the platform first registered it. Absent: held from the start. */
  discoveredAt?: string
}

/** Kinds that hold records, and so can hold a person's data. Pipelines and feeds move it; reports render it. */
export const STORES: DataKind[] = DATA_KINDS.filter((k) => DATA_LIFECYCLE[k].holdsRecords)

/** Whether an item received anything the law treats as a special category. */
export const carriesSpecial = (i: DataItem) => (i.categories ?? []).some((c) => SPECIAL_CATEGORIES.includes(c))

/* --------------------------------- The seed --------------------------------- */

/** When discovery registered the items it found beyond the original register. */
const DISCOVERED = '2027-02-15T00:00:00.000Z'

export const DATA_ITEMS: DataItem[] = [
  // Sources
  {
    id: 'src_hcm_feed', name: 'PeopleSoft HCM feed', kind: 'source', tower: 'twr_dataplat', platform: 'PeopleSoft',
    aliases: ['HCM feed'], appId: 'inv_peoplesoft', owner: 'KNet Applications', steward: 'HR Operations', classification: 'restricted',
    upstream: [], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 5,
    contract: {
      id: 'dc_hcm_feed_v1', version: 'v1', state: 'declared', freshnessHrs: 24,
      checks: [
        { name: 'Schema matches contract', bound: 'v14', observed: 'v15 · hours_minor widened', passed: false, failingSince: '2027-02-17T09:14:00.000Z' },
        { name: 'Row count against trailing mean', bound: '±5%', observed: '+0.8%', passed: true },
      ],
    },
    demandClasses: ['dc_schema_drift'],
  },
  {
    id: 'src_customer_feed', name: 'Salesforce customer feed', kind: 'source', tower: 'twr_dataplat', platform: 'Salesforce',
    aliases: ['customer feed'], owner: 'KNet Applications', steward: 'Market & Client Development', classification: 'confidential',
    upstream: [], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 6,
    contract: {
      id: 'dc_customer_feed_v2', version: 'v2', state: 'declared', freshnessHrs: 24,
      checks: [{ name: 'Schema matches contract', bound: 'v8', observed: 'v8', passed: true }],
    },
    demandClasses: ['dc_pipeline_fail'],
  },
  {
    id: 'src_focus_extract', name: 'FOCUS time & billing extract', kind: 'source', tower: 'twr_dataplat', platform: 'SAP HANA',
    aliases: ['FOCUS extract', 'FOCUS/SAP-HANA nightly load'], appId: 'inv_focus', owner: 'KNet Finance Systems', steward: 'Finance Operations', classification: 'restricted',
    upstream: ['ap_sap'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 6,
    contract: {
      id: 'dc_focus_extract_v3', version: 'v3', state: 'enforced', freshnessHrs: 24,
      checks: [
        { name: 'Schema matches contract', bound: 'v3', observed: 'v3', passed: true },
        { name: 'Billing periods complete', bound: '100%', observed: '100%', passed: true },
      ],
    },
    demandClasses: ['dc_focus_stall'],
  },

  // Pipelines
  {
    id: 'pl_engagement_ingest', name: 'Engagement ingest', kind: 'pipeline', tower: 'twr_dataplat', platform: 'Azure Data Factory',
    aliases: ['adf_engagement_ingest', 'nightly datamart refresh', 'ADF nightly load'], nodeId: 'pipe_datamart', appId: 'inv_adf',
    owner: 'KNet Data', steward: 'S. Okafor', classification: 'restricted',
    upstream: ['src_customer_feed', 'src_focus_extract'], lineage: 'mapped', telemetry: true,
    contract: {
      id: 'dc_datamart_v2', version: 'v2', state: 'enforced', freshnessHrs: 24,
      checks: [{ name: 'Delivered by 05:00 CST', bound: '05:00', observed: '04:42', passed: true }],
    },
    demandClasses: ['dc_pipeline_fail', 'dc_job_cost'],
  },
  {
    id: 'pl_utilisation_load', name: 'Utilisation load', kind: 'pipeline', tower: 'twr_dataplat', platform: 'Azure Data Factory',
    aliases: ['utilization load'], appId: 'inv_adf', owner: 'KNet Data', steward: 'S. Okafor', classification: 'restricted',
    upstream: ['src_hcm_feed', 'src_focus_extract'], lineage: 'mapped', telemetry: true,
    contract: {
      id: 'dc_utilisation_load_v1', version: 'v1', state: 'enforced', freshnessHrs: 24,
      checks: [{ name: 'Delivered by 05:30 CST', bound: '05:30', observed: 'not delivered', passed: false }],
    },
    demandClasses: ['dc_pipeline_fail'],
  },
  {
    id: 'pl_oracle_extract', name: 'Oracle datamart extract', kind: 'pipeline', tower: 'twr_dataplat', platform: 'Oracle scheduled jobs',
    owner: 'KNet Data', upstream: [], lineage: 'unknown', telemetry: false,
    demandClasses: ['dc_lineage_gap'],
  },

  // Datasets
  {
    id: 'ds_engagement_silver', name: 'engagement_silver', kind: 'dataset', tower: 'twr_dataplat', platform: 'Cloud datamart (Azure SQL)',
    appId: 'inv_cloud_dm', owner: 'KNet Data', classification: 'confidential',
    upstream: ['pl_engagement_ingest'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 23,
    retentionDays: 730, oldestRecordDays: 912, backupRetentionDays: 35,
    demandClasses: ['dc_job_cost'],
  },
  {
    id: 'ds_engagement_gold', name: 'engagement_gold', kind: 'dataset', tower: 'twr_dataplat', platform: 'Cloud datamart (Azure SQL)',
    appId: 'inv_cloud_dm', owner: 'KNet Data', steward: 'S. Okafor', classification: 'confidential',
    upstream: ['ds_engagement_silver'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 23,
    retentionDays: 730, oldestRecordDays: 1104, backupRetentionDays: 35,
    contract: {
      id: 'dc_engagement_gold_v1', version: 'v1', state: 'enforced', freshnessHrs: 24,
      checks: [
        { name: 'Null ratio · engagement_code', bound: '≤ 0.5%', observed: '4.1%', passed: false, failingSince: '2027-02-14T12:00:00.000Z' },
        { name: 'Row count against trailing mean', bound: '±5%', observed: '−1.2%', passed: true },
      ],
    },
    demandClasses: ['dc_dq_null_ratio'],
  },
  {
    id: 'ds_client_dim', name: 'client_dim', kind: 'dataset', tower: 'twr_dataplat', platform: 'Cloud datamart (Azure SQL)',
    appId: 'inv_cloud_dm', owner: 'KNet Data', steward: 'Market & Client Development', classification: 'confidential',
    upstream: ['pl_engagement_ingest'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 23,
    retentionDays: 1825, oldestRecordDays: 1460, backupRetentionDays: 35,
    contract: {
      id: 'dc_client_dim_v3', version: 'v3', state: 'enforced', freshnessHrs: 24,
      checks: [{ name: 'Referential integrity to engagement_gold', bound: '100%', observed: '100%', passed: true }],
    },
    demandClasses: ['dc_dq_null_ratio'],
  },
  {
    id: 'ds_utilisation_gold', name: 'utilisation_gold', kind: 'dataset', tower: 'twr_dataplat', platform: 'Cloud datamart (Azure SQL)',
    aliases: ['utilization_gold'], appId: 'inv_cloud_dm', owner: 'KNet Data', steward: 'S. Okafor', classification: 'restricted',
    upstream: ['pl_utilisation_load'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 48,
    retentionDays: 1095, oldestRecordDays: 1240, backupRetentionDays: 35,
    contract: {
      id: 'dc_utilisation_gold_v2', version: 'v2', state: 'enforced', freshnessHrs: 24,
      checks: [{ name: 'Row count against trailing mean', bound: '±5%', observed: '+0.4%', passed: true }],
    },
    demandClasses: ['dc_bi_stale'],
  },
  {
    id: 'ds_oracle_dm', name: 'Oracle datamart', kind: 'dataset', tower: 'twr_dataplat', platform: 'Oracle 19c',
    nodeId: 'da_oracle_dm', appId: 'inv_oracle_dm', owner: 'KNet Data',
    upstream: ['pl_oracle_extract'], lineage: 'partial', telemetry: false, consumers: 7000,
    demandClasses: ['dc_oracle_blindspot'],
  },

  // Semantic models
  {
    id: 'sm_research', name: 'Research & Analytics model', kind: 'semantic_model', tower: 'twr_bi', platform: 'Power BI',
    aliases: ['sem_model_research', 'Research & Analytics semantic model'], appId: 'inv_powerbi', owner: 'KNet Data', steward: 'S. Okafor', classification: 'confidential',
    upstream: ['ds_engagement_gold', 'ds_client_dim', 'ds_oracle_dm'], lineage: 'mapped', telemetry: true,
    contract: {
      id: 'dc_sm_research_v4', version: 'v4', state: 'enforced', freshnessHrs: 24,
      checks: [
        { name: 'One definition per measure', bound: '1', observed: '2 · net revenue', passed: false, failingSince: '2027-02-16T13:00:00.000Z' },
        { name: 'Refreshed by 07:00 CST', bound: '07:00', observed: '06:31', passed: true },
      ],
    },
    demandClasses: ['dc_bi_semantic', 'dc_bi_refresh'],
  },
  {
    id: 'sm_utilisation', name: 'Utilisation model', kind: 'semantic_model', tower: 'twr_bi', platform: 'Power BI',
    appId: 'inv_powerbi', owner: 'KNet Data', classification: 'restricted',
    upstream: ['ds_utilisation_gold'], lineage: 'mapped', telemetry: true,
    demandClasses: ['dc_bi_refresh'],
  },

  // Reports
  {
    id: 'rp_leadership', name: 'Leadership pack', kind: 'report', tower: 'twr_bi', platform: 'Power BI',
    appId: 'inv_powerbi', owner: 'KNet Data', steward: 'S. Okafor', classification: 'confidential',
    upstream: ['sm_research'], lineage: 'mapped', telemetry: true, consumers: 40, lastLandedHrsAgo: 21,
    demandClasses: ['dc_bi_refresh'],
  },
  {
    id: 'rp_utilisation', name: 'Utilisation dashboard', kind: 'report', tower: 'twr_bi', platform: 'Power BI',
    aliases: ['utilization dashboard'], appId: 'inv_powerbi', owner: 'KNet Data', steward: 'S. Okafor', classification: 'restricted',
    upstream: ['sm_utilisation'], lineage: 'mapped', telemetry: true, consumers: 210, lastLandedHrsAgo: 21,
    demandClasses: ['dc_bi_stale'],
  },
  {
    id: 'rp_practice', name: 'Practice performance pack', kind: 'report', tower: 'twr_bi', platform: 'Power BI',
    appId: 'inv_powerbi', owner: 'KNet Data', steward: 'S. Okafor', classification: 'confidential',
    upstream: ['sm_research', 'sm_utilisation'], lineage: 'mapped', telemetry: true, consumers: 120, lastLandedHrsAgo: 21,
    demandClasses: ['dc_bi_stale'],
  },
  {
    id: 'rp_tableau', name: 'Practice Tableau workbooks', kind: 'report', tower: 'twr_bi', platform: 'Tableau Server',
    appId: 'inv_tableau_shadow', owner: 'unassigned',
    upstream: ['ds_oracle_dm'], lineage: 'partial', telemetry: false,
    demandClasses: ['dc_shadow_app'],
  },

  // Registered by discovery rather than held from the start. The seed follows
  // one client's landscape; the kinds are the platform's.
  // Applications — systems of record that read from the estate, and write back into it.
  {
    id: 'ap_sap', name: 'SAP S/4HANA', kind: 'application', tower: 'twr_dataplat', platform: 'SAP',
    aliases: ['SAP'], nodeId: 'db_sap_prod', appId: 'inv_sap', owner: 'KNet Finance Systems', steward: 'Finance Operations', classification: 'restricted',
    upstream: ['fd_datamart_sap'], lineage: 'mapped', telemetry: true, discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'ap_iem', name: 'IEM time and expenses', kind: 'application', tower: 'twr_dataplat', platform: 'KNet custom',
    aliases: ['IEM'], appId: 'inv_iem', owner: 'KNet Applications', classification: 'restricted',
    upstream: ['ds_oracle_dm'], lineage: 'partial', telemetry: true, discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'ap_gbart', name: 'GBART', kind: 'application', tower: 'twr_dataplat', platform: 'KNet custom',
    owner: 'KNet Applications', classification: 'confidential',
    upstream: ['ds_oracle_dm'], lineage: 'partial', telemetry: true, discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'ap_finance_reporting', name: 'Finance Reporting', kind: 'application', tower: 'twr_dataplat', platform: 'KNet custom',
    owner: 'KNet Finance Systems', classification: 'confidential',
    upstream: ['ds_oracle_dm'], lineage: 'partial', telemetry: false, discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'ap_trackit', name: 'TrackIT', kind: 'application', tower: 'twr_dataplat', platform: 'KNet custom',
    owner: 'KNet Applications', classification: 'internal',
    upstream: ['ds_oracle_dm'], lineage: 'partial', telemetry: true, discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'ap_anaplan', name: 'Anaplan workforce planning', kind: 'application', tower: 'twr_dataplat', platform: 'Anaplan',
    aliases: ['Anaplan'], owner: 'FP&A', classification: 'confidential',
    upstream: ['wf_workforce_prep'], lineage: 'partial', telemetry: true, discoveredAt: DISCOVERED, demandClasses: [],
  },

  // Feeds — transfers between systems, and out to other organisations.
  {
    id: 'fd_datamart_sap', name: 'Client master sync to SAP', kind: 'feed', tower: 'twr_dataplat', platform: 'MuleSoft',
    appId: 'inv_mulesoft', owner: 'KNet Integration', classification: 'confidential',
    upstream: ['ds_client_dim'], lineage: 'mapped', telemetry: true, lastRun: 'succeeded', lastLandedHrsAgo: 22, transfer: 'Daily',
    contract: { id: 'dc_client_sync_v1', version: 'v1', state: 'declared', freshnessHrs: 24, checks: [{ name: 'Records rejected by SAP', bound: '0', observed: '0', passed: true }] },
    discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'fd_hcm_payroll', name: 'Payroll master data file', kind: 'feed', tower: 'twr_dataplat', platform: 'MuleSoft',
    appId: 'inv_mulesoft', owner: 'HR Operations', classification: 'restricted',
    upstream: ['src_hcm_feed'], lineage: 'mapped', telemetry: true, lastRun: 'succeeded', lastLandedHrsAgo: 20, transfer: 'Each pay cycle',
    contract: { id: 'dc_payroll_file_v3', version: 'v3', state: 'declared', freshnessHrs: 24, checks: [{ name: 'Schema matches contract', bound: 'v14', observed: 'v14', passed: true }] },
    discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'fd_hcm_benefits', name: 'Benefits eligibility file', kind: 'feed', tower: 'twr_dataplat', platform: 'SFTP',
    owner: 'HR Operations', classification: 'restricted',
    upstream: ['src_hcm_feed'], lineage: 'mapped', telemetry: false, transfer: 'Daily',
    discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'fd_hcm_immigration', name: 'Immigration case file', kind: 'feed', tower: 'twr_dataplat', platform: 'SFTP',
    owner: 'HR Operations', classification: 'restricted',
    upstream: ['src_hcm_feed'], lineage: 'mapped', telemetry: false, transfer: 'Daily or as needed',
    discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'fd_hcm_equity', name: 'Equity participant sync', kind: 'feed', tower: 'twr_dataplat', platform: 'Workato',
    owner: 'HR Operations', classification: 'restricted',
    upstream: ['src_hcm_feed'], lineage: 'mapped', telemetry: true, lastRun: 'failed', lastLandedHrsAgo: 31, transfer: 'Monthly',
    discoveredAt: DISCOVERED, demandClasses: [],
  },

  // Workflows — built and owned by the business on a platform the service runs.
  {
    id: 'wf_workforce_prep', name: 'Workforce planning prep', kind: 'workflow', tower: 'twr_dataplat', platform: 'KNIME',
    aliases: ['KNIME workflow'], owner: 'FP&A analyst',
    upstream: ['src_hcm_feed', 'ds_utilisation_gold'], lineage: 'partial', telemetry: false,
    discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'wf_practice_margin', name: 'Practice margin workflow', kind: 'workflow', tower: 'twr_bi', platform: 'Alteryx',
    aliases: ['Alteryx workflow'], appId: 'inv_alteryx', owner: 'Practice finance analyst',
    upstream: ['ds_oracle_dm'], lineage: 'partial', telemetry: false,
    discoveredAt: DISCOVERED, demandClasses: [],
  },

  // External recipients — parties outside the estate that hold a copy.
  {
    id: 'rc_payroll', name: 'Payroll provider', kind: 'recipient', tower: 'twr_dataplat', platform: 'ADP',
    party: 'ADP', owner: 'HR Operations', classification: 'restricted',
    upstream: ['fd_hcm_payroll'], lineage: 'mapped', telemetry: false, transfer: 'Each pay cycle',
    categories: ['identity', 'employment', 'compensation', 'bank', 'tax'], discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'rc_health', name: 'Health insurer', kind: 'recipient', tower: 'twr_dataplat', platform: 'Cigna',
    party: 'Cigna', owner: 'HR Operations', classification: 'restricted',
    upstream: ['fd_hcm_benefits'], lineage: 'mapped', telemetry: false, transfer: 'Daily',
    categories: ['identity', 'contact', 'health', 'dependants'], discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'rc_immigration', name: 'Immigration counsel', kind: 'recipient', tower: 'twr_dataplat', platform: 'Fragomen',
    party: 'Fragomen', owner: 'HR Operations', classification: 'restricted',
    upstream: ['fd_hcm_immigration'], lineage: 'mapped', telemetry: false, transfer: 'Daily or as needed',
    categories: ['identity', 'immigration', 'dependants'], discoveredAt: DISCOVERED, demandClasses: [],
  },
  {
    id: 'rc_equity', name: 'Equity plan administrator', kind: 'recipient', tower: 'twr_dataplat', platform: 'Ledgy',
    party: 'Ledgy', owner: 'HR Operations', classification: 'restricted',
    upstream: ['fd_hcm_equity'], lineage: 'mapped', telemetry: false, transfer: 'Monthly',
    categories: ['identity', 'employment', 'compensation'], discoveredAt: DISCOVERED, demandClasses: [],
  },
]

// A scheduled item's last run and last landing come from its run history, so
// the register and the reliability readings cannot disagree about them.
for (const i of DATA_ITEMS) {
  const done = completedRuns(i.id)
  const last = done[done.length - 1]
  if (!last) continue
  i.lastRun = last.path === 'open' ? 'failed' : 'succeeded'
  const landed = [...done].reverse().find((r) => r.landedAt)?.landedAt
  if (landed) i.lastLandedHrsAgo = Math.round((NOW.getTime() - Date.parse(landed)) / 3_600_000)
}

export const DATA_ITEM_BY_ID = Object.fromEntries(DATA_ITEMS.map((i) => [i.id, i])) as Record<string, DataItem>

/* --------------------------------- Lineage ---------------------------------- */

const READERS: Record<string, string[]> = {}
for (const i of DATA_ITEMS) for (const u of i.upstream) (READERS[u] ??= []).push(i.id)

function walk(start: string, next: (i: DataItem) => string[]): DataItem[] {
  const seen = new Set([start])
  const out: DataItem[] = []
  let frontier = [start]
  while (frontier.length) {
    const following: string[] = []
    for (const id of frontier) {
      const item = DATA_ITEM_BY_ID[id]
      if (!item) continue
      for (const n of next(item)) {
        if (seen.has(n) || !DATA_ITEM_BY_ID[n]) continue
        seen.add(n)
        out.push(DATA_ITEM_BY_ID[n])
        following.push(n)
      }
    }
    frontier = following
  }
  return out
}

/** Everything it reads from, nearest first. */
export const ancestors = (id: string) => walk(id, (i) => i.upstream)

/** Everything that reads from it, directly or not, nearest first. */
export const descendants = (id: string) => walk(id, (i) => READERS[i.id] ?? [])

/* ---------------------------------- State ----------------------------------- */

export type ContractState = 'enforced' | 'declared' | 'none'

export const contractState = (i: DataItem): ContractState => i.contract?.state ?? 'none'

export type OwnState = 'failed' | 'stale' | 'failing' | 'unobserved' | 'uncontracted' | 'healthy' | 'outside'

export const OWN_LABEL: Record<OwnState, string> = {
  failed: 'Run failed',
  stale: 'Stale',
  failing: 'Check failing',
  unobserved: 'No telemetry',
  uncontracted: 'No contract',
  healthy: 'Healthy',
  outside: 'Outside the estate',
}

export const isBreach = (s: OwnState) => s === 'failed' || s === 'stale' || s === 'failing'

export function ownState(i: DataItem): OwnState {
  if (!DATA_LIFECYCLE[i.kind].observed) return 'outside'
  if (!i.telemetry) return 'unobserved'
  if (i.lastRun === 'failed') return 'failed'
  const fresh = i.contract?.freshnessHrs
  if (fresh !== undefined && i.lastLandedHrsAgo !== undefined && i.lastLandedHrsAgo > fresh) return 'stale'
  if (i.contract?.checks.some((c) => !c.passed)) return 'failing'
  if (!i.contract && DATA_LIFECYCLE[i.kind].contracted) return 'uncontracted'
  return 'healthy'
}

export interface Inherited {
  /** Exposed: a breach upstream reaches it. Unverifiable: something upstream cannot be observed. */
  state: 'exposed' | 'unverifiable'
  via: DataItem
}

/** The nearest upstream breach, or failing that the nearest upstream blind spot. */
export function inherited(id: string): Inherited | null {
  const up = ancestors(id)
  const breach = up.find((u) => isBreach(ownState(u)))
  if (breach) return { state: 'exposed', via: breach }
  const blind = up.find((u) => ownState(u) === 'unobserved')
  return blind ? { state: 'unverifiable', via: blind } : null
}

export interface Impact {
  items: DataItem[]
  reports: DataItem[]
  applications: DataItem[]
  recipients: DataItem[]
  /** Everything a person or another system acts on: reports, applications and external recipients. */
  consumers: DataItem[]
  /** The largest known audience among the reports reached. Readers overlap across reports, so they are not summed. */
  largestAudience: number | null
}

export function impact(id: string): Impact {
  const items = descendants(id)
  const reports = items.filter((i) => i.kind === 'report')
  const applications = items.filter((i) => i.kind === 'application')
  const recipients = items.filter((i) => i.kind === 'recipient')
  const audiences = reports.map((r) => r.consumers).filter((c): c is number => c !== undefined)
  return { items, reports, applications, recipients, consumers: [...reports, ...applications, ...recipients], largestAudience: audiences.length ? Math.max(...audiences) : null }
}

/* ------------------------------ Service levels ------------------------------ */

export interface ServiceLevel {
  freshness: { targetHrs: number; landedHrsAgo: number | null } | null
  checks: { passed: number; total: number } | null
  /** The last thirty finished runs, and how many landed by their due time, retries included. */
  runs: { onTime: number; total: number } | null
}

export function serviceLevel(i: DataItem): ServiceLevel {
  const c = i.contract
  const done = completedRuns(i.id)
  return {
    freshness: c?.freshnessHrs !== undefined ? { targetHrs: c.freshnessHrs, landedHrsAgo: i.lastLandedHrsAgo ?? null } : null,
    checks: c && c.checks.length ? { passed: c.checks.filter((k) => k.passed).length, total: c.checks.length } : null,
    runs: done.length ? { onTime: done.filter(isOnTime).length, total: done.length } : null,
  }
}

/* ------------------------------ Policy context ------------------------------ */

/**
 * What the policy engine sees of the items a plan touches. The weakest item
 * governs: one without an enforced contract leaves the whole plan with
 * nothing to verify against, and the most sensitive classification applies
 * to all of it. An unclassified item is read as restricted, since nothing
 * says it is not.
 */
export function policyAsset(items: DataItem[]): { contract: string | null; pii: Classification } {
  const contract = items.length && items.every((i) => contractState(i) === 'enforced')
    ? items.map((i) => i.contract!.id).join('+')
    : null
  const pii = items.reduce<Classification>((worst, i) => {
    const c = i.classification ?? 'restricted'
    return CLASS_RANK[c] > CLASS_RANK[worst] ? c : worst
  }, 'public')
  return { contract, pii }
}

/**
 * The register items a piece of text names, by id, graph node, name or alias.
 * Longer names are matched first and consumed, so "Oracle datamart extract"
 * is not also read as the "Oracle datamart" it contains.
 */
export function itemsNamedIn(text: string): DataItem[] {
  let rest = text.toLowerCase()
  const names = DATA_ITEMS
    .flatMap((i) => [i.id, i.nodeId, i.name, ...(i.aliases ?? [])].filter((n): n is string => Boolean(n)).map((n) => ({ n: n.toLowerCase(), i })))
    .sort((a, b) => b.n.length - a.n.length)
  const found = new Map<string, DataItem>()
  for (const { n, i } of names) {
    if (!rest.includes(n)) continue
    found.set(i.id, i)
    rest = rest.split(n).join(' ')
  }
  return [...found.values()]
}

/** Items held to a contract of their own that have no enforced one. */
export const withoutContract = () =>
  DATA_ITEMS.filter((i) => DATA_LIFECYCLE[i.kind].contracted && contractState(i) !== 'enforced')

/* --------------------------------- Summary ---------------------------------- */

export interface DataReading extends DataItem {
  own: OwnState
  inherited: Inherited | null
  contractState: ContractState
  level: ServiceLevel
}

export interface DataSummary {
  items: DataReading[]
  breaches: number
  /** Sound in themselves, with a breach upstream. */
  exposed: number
  unobserved: number
  /** Observed, with a blind spot upstream. */
  unverifiable: number
  contracts: { eligible: number; enforced: number; declared: number }
  unclassified: number
  noSteward: number
  lineageGaps: number
  personalData: number
  recipients: number
  /** External recipients sent a special category of personal data. */
  specialRecipients: number
}

export function dataSummary(items: DataItem[] = DATA_ITEMS): DataSummary {
  const readings: DataReading[] = items.map((i) => ({
    ...i, own: ownState(i), inherited: inherited(i.id), contractState: contractState(i), level: serviceLevel(i),
  }))
  const eligible = readings.filter((i) => DATA_LIFECYCLE[i.kind].contracted)
  return {
    items: readings,
    breaches: readings.filter((i) => isBreach(i.own)).length,
    exposed: readings.filter((i) => !isBreach(i.own) && i.inherited?.state === 'exposed').length,
    unobserved: readings.filter((i) => i.own === 'unobserved').length,
    unverifiable: readings.filter((i) => i.own !== 'unobserved' && i.own !== 'outside' && !isBreach(i.own) && i.inherited?.state === 'unverifiable').length,
    contracts: {
      eligible: eligible.length,
      enforced: eligible.filter((i) => i.contractState === 'enforced').length,
      declared: eligible.filter((i) => i.contractState === 'declared').length,
    },
    unclassified: readings.filter((i) => !i.classification).length,
    noSteward: readings.filter((i) => !i.steward).length,
    lineageGaps: readings.filter((i) => i.lineage !== 'mapped').length,
    personalData: readings.filter((i) => i.classification === 'restricted').length,
    recipients: readings.filter((i) => i.kind === 'recipient').length,
    specialRecipients: readings.filter((i) => i.kind === 'recipient' && carriesSpecial(i)).length,
  }
}
