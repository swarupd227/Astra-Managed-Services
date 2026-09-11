/* ==========================================================================
   Data estate — the sources, pipelines, datasets, semantic models and
   reports under support, the contract each is held to, and the lineage
   between them.

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
   ========================================================================== */

export type DataKind = 'source' | 'pipeline' | 'dataset' | 'semantic_model' | 'report'

export const DATA_KINDS: DataKind[] = ['source', 'pipeline', 'dataset', 'semantic_model', 'report']

export const DATA_KIND_LABEL: Record<DataKind, string> = {
  source: 'Source',
  pipeline: 'Pipeline',
  dataset: 'Dataset',
  semantic_model: 'Semantic model',
  report: 'Report',
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
}

export const DATA_LIFECYCLE: Record<DataKind, DataLifecycle> = {
  source: { recovery: 'Upstream owner', recoveryClass: null, change: 'not ours', contracted: true },
  pipeline: { recovery: 'Redeploy and rerun', recoveryClass: 'AC-12', change: 'reversible', contracted: true },
  dataset: { recovery: 'Backfill', recoveryClass: 'AC-49', change: 'compensable', contracted: true },
  semantic_model: { recovery: 'Refresh', recoveryClass: 'AC-12', change: 'reversible', contracted: true },
  report: { recovery: 'Refresh', recoveryClass: 'AC-12', change: 'reversible', contracted: false },
}

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
  /** Hours since data last landed. Absent without telemetry. */
  lastLandedHrsAgo?: number
  lastRun?: 'succeeded' | 'failed'
  runs30d?: { total: number; late: number; failed: number }
  demandClasses: string[]
}

/* --------------------------------- The seed --------------------------------- */

export const DATA_ITEMS: DataItem[] = [
  // Sources
  {
    id: 'src_hcm_feed', name: 'PeopleSoft HCM feed', kind: 'source', tower: 'twr_dataplat', platform: 'PeopleSoft',
    aliases: ['HCM feed'], appId: 'inv_peoplesoft', owner: 'KNet Applications', steward: 'HR Operations', classification: 'restricted',
    upstream: [], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 5,
    contract: {
      id: 'dc_hcm_feed_v1', version: 'v1', state: 'declared', freshnessHrs: 24,
      checks: [
        { name: 'Schema matches contract', bound: 'v14', observed: 'v15 · hours_minor widened', passed: false },
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
    upstream: [], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 6,
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
    lastLandedHrsAgo: 23, lastRun: 'succeeded', runs30d: { total: 30, late: 1, failed: 0 },
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
    lastLandedHrsAgo: 50, lastRun: 'failed', runs30d: { total: 30, late: 2, failed: 3 },
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
    demandClasses: ['dc_job_cost'],
  },
  {
    id: 'ds_engagement_gold', name: 'engagement_gold', kind: 'dataset', tower: 'twr_dataplat', platform: 'Cloud datamart (Azure SQL)',
    appId: 'inv_cloud_dm', owner: 'KNet Data', steward: 'S. Okafor', classification: 'confidential',
    upstream: ['ds_engagement_silver'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 23,
    contract: {
      id: 'dc_engagement_gold_v1', version: 'v1', state: 'enforced', freshnessHrs: 24,
      checks: [
        { name: 'Null ratio · engagement_code', bound: '≤ 0.5%', observed: '4.1%', passed: false },
        { name: 'Row count against trailing mean', bound: '±5%', observed: '−1.2%', passed: true },
      ],
    },
    demandClasses: ['dc_dq_null_ratio'],
  },
  {
    id: 'ds_client_dim', name: 'client_dim', kind: 'dataset', tower: 'twr_dataplat', platform: 'Cloud datamart (Azure SQL)',
    appId: 'inv_cloud_dm', owner: 'KNet Data', steward: 'Market & Client Development', classification: 'confidential',
    upstream: ['pl_engagement_ingest'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 23,
    contract: {
      id: 'dc_client_dim_v3', version: 'v3', state: 'enforced', freshnessHrs: 24,
      checks: [{ name: 'Referential integrity to engagement_gold', bound: '100%', observed: '100%', passed: true }],
    },
    demandClasses: ['dc_dq_null_ratio'],
  },
  {
    id: 'ds_utilisation_gold', name: 'utilisation_gold', kind: 'dataset', tower: 'twr_dataplat', platform: 'Cloud datamart (Azure SQL)',
    aliases: ['utilization_gold'], appId: 'inv_cloud_dm', owner: 'KNet Data', steward: 'S. Okafor', classification: 'restricted',
    upstream: ['pl_utilisation_load'], lineage: 'mapped', telemetry: true, lastLandedHrsAgo: 50,
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
    lastLandedHrsAgo: 21, lastRun: 'succeeded', runs30d: { total: 30, late: 2, failed: 1 },
    contract: {
      id: 'dc_sm_research_v4', version: 'v4', state: 'enforced', freshnessHrs: 24,
      checks: [
        { name: 'One definition per measure', bound: '1', observed: '2 · net revenue', passed: false },
        { name: 'Refreshed by 07:00 CST', bound: '07:00', observed: '06:31', passed: true },
      ],
    },
    demandClasses: ['dc_bi_semantic', 'dc_bi_refresh'],
  },
  {
    id: 'sm_utilisation', name: 'Utilisation model', kind: 'semantic_model', tower: 'twr_bi', platform: 'Power BI',
    appId: 'inv_powerbi', owner: 'KNet Data', classification: 'restricted',
    upstream: ['ds_utilisation_gold'], lineage: 'mapped', telemetry: true,
    lastLandedHrsAgo: 21, lastRun: 'succeeded', runs30d: { total: 30, late: 0, failed: 0 },
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
]

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

export type OwnState = 'failed' | 'stale' | 'failing' | 'unobserved' | 'uncontracted' | 'healthy'

export const OWN_LABEL: Record<OwnState, string> = {
  failed: 'Run failed',
  stale: 'Stale',
  failing: 'Check failing',
  unobserved: 'No telemetry',
  uncontracted: 'No contract',
  healthy: 'Healthy',
}

export const isBreach = (s: OwnState) => s === 'failed' || s === 'stale' || s === 'failing'

export function ownState(i: DataItem): OwnState {
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
  /** The largest known audience among the reports reached. Readers overlap across reports, so they are not summed. */
  largestAudience: number | null
}

export function impact(id: string): Impact {
  const items = descendants(id)
  const reports = items.filter((i) => i.kind === 'report')
  const audiences = reports.map((r) => r.consumers).filter((c): c is number => c !== undefined)
  return { items, reports, largestAudience: audiences.length ? Math.max(...audiences) : null }
}

/* ------------------------------ Service levels ------------------------------ */

export interface ServiceLevel {
  freshness: { targetHrs: number; landedHrsAgo: number | null } | null
  checks: { passed: number; total: number } | null
  /** The last thirty runs, and how many of them landed on time. */
  runs: { onTime: number; total: number } | null
}

export function serviceLevel(i: DataItem): ServiceLevel {
  const c = i.contract
  return {
    freshness: c?.freshnessHrs !== undefined ? { targetHrs: c.freshnessHrs, landedHrsAgo: i.lastLandedHrsAgo ?? null } : null,
    checks: c && c.checks.length ? { passed: c.checks.filter((k) => k.passed).length, total: c.checks.length } : null,
    runs: i.runs30d?.total ? { onTime: i.runs30d.total - i.runs30d.late - i.runs30d.failed, total: i.runs30d.total } : null,
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
    unverifiable: readings.filter((i) => i.own !== 'unobserved' && !isBreach(i.own) && i.inherited?.state === 'unverifiable').length,
    contracts: {
      eligible: eligible.length,
      enforced: eligible.filter((i) => i.contractState === 'enforced').length,
      declared: eligible.filter((i) => i.contractState === 'declared').length,
    },
    unclassified: readings.filter((i) => !i.classification).length,
    noSteward: readings.filter((i) => !i.steward).length,
    lineageGaps: readings.filter((i) => i.lineage !== 'mapped').length,
    personalData: readings.filter((i) => i.classification === 'restricted').length,
  }
}
