/* ==========================================================================
   The ticket history ingested for an engagement.

   Before a commitment can be made, somebody has to say what the work looks
   like today — and that statement has to come from the client's own records
   rather than from a bid team's instinct. This file holds what one extract
   yielded: how much work arrived, how it divides into themes, which phrasings
   repeat, and how concentrated the whole book is.

   Two things make it platform code rather than one client's spreadsheet.
   A history belongs to an engagement, so a second client loads its own and
   nothing here changes. And every history carries what its extract will not
   support: a field left at a default, a timestamp nobody supplied. A measure
   that needs one of those is refused rather than estimated, which is why
   `cannot` is as load-bearing as the counts above it.
   ========================================================================== */

/** What an extract can be asked for. A history says which of these it supports. */
export type Derivable =
  | 'volume'
  | 'recurrence'
  | 'arrival'
  | 'theme'
  | 'inventory_match'
  | 'problem_coverage'
  | 'priority'
  | 'handling_time'

export const DERIVABLE_LABEL: Record<Derivable, string> = {
  volume: 'How much work arrives',
  recurrence: 'What repeats',
  arrival: 'When it arrives',
  theme: 'What it is about',
  inventory_match: 'Whether the application is on the client’s list',
  problem_coverage: 'Whether a cause was ever raised',
  priority: 'How urgent the client said it was',
  handling_time: 'How long it took to resolve',
}

/** A theme of demand, and the costed classes that stand against it. */
export interface DemandTheme {
  id: string
  name: string
  incidents: number
  pctOfInScope: number
  /**
   * The demand classes in the elimination ledger that answer this theme.
   * Named here rather than inferred, so a removal figure can be audited back
   * to the classes it was read from.
   */
  classIds: string[]
}

/** A phrasing that keeps coming back, as the extract spells it. */
export interface Cluster {
  id: string
  /** The example the extract carries, verbatim. */
  example: string
  subCategory: string
  incidents: number
  /** Distinct months it was seen in. A cluster seen once is noise. */
  months: number
  /** The demand class carrying its cause, where one exists. */
  classId?: string
}

export interface TicketHistory {
  engagementId: string
  source: string
  period: { from: string; to: string; months: number }
  /** Everything in the extract, before scope is applied. */
  volumes: { incidents: number; requests: number; problems: number; catalogueTasks: number }
  scope: {
    rule: string
    inScope: number
    inScopePct: number
    byLine: { id: string; name: string; incidents: number }[]
  }
  themes: DemandTheme[]
  clusters: Cluster[]
  shape: {
    subCategories: number
    top5Pct: number
    top16Pct: number
    singletons: number
    /** Share of in-scope incidents arriving outside 08:00–18:00 local. */
    outOfHoursPct: number
    weekendPct: number
    /** Share of in-scope incidents whose phrasing has been seen before. */
    repeatPct: number
    clustersOverTen: number
    clusterSharePct: number
    /** Raised by a person rather than by monitoring. */
    humanRaisedPct: number
    stillOpenPct: number
    /** Applications seen in tickets but absent from the client's own list. */
    offInventoryPct: number
    offInventory: number
  }
  problems: { records: number; open: number; inScopeWithoutProblemPct: number }
  /** Request growth across the extract's two halves. */
  growth: { firstHalf: number; secondHalf: number; pct: number }
  cannot: { what: Derivable; because: string }[]
}

/* ------------------------------- The extracts ------------------------------- */

/**
 * Kearney, from the RFP data request: the incident and request extract as
 * supplied, scoped to Application Management and Data Management by a rule
 * on ServiceNow category and sub-category that the client can audit or
 * correct.
 */
const KEARNEY: TicketHistory = {
  engagementId: 'eng_kearney',
  source: 'Attachment C.3 — Volumes.xlsx, tabs I1–I4, as supplied',
  period: { from: '2025-06-01', to: '2026-06-05', months: 12.2 },
  volumes: { incidents: 28_028, requests: 63_350, problems: 49, catalogueTasks: 3_195 },
  scope: {
    rule: 'ServiceNow category and sub-category, applied in order, reversible',
    inScope: 2_721,
    inScopePct: 9.7,
    byLine: [
      { id: 'B3', name: 'Application Management', incidents: 2_128 },
      { id: 'B4', name: 'Data Management', incidents: 593 },
    ],
  },
  themes: [
    { id: 'th_access', name: 'Access, login, permission, password', incidents: 1_354, pctOfInScope: 49.8, classIds: ['dc_pwd_reset', 'dc_access_recert'] },
    { id: 'th_availability', name: 'Down, inaccessible, crashed', incidents: 295, pctOfInScope: 10.8, classIds: ['dc_iem_ghost', 'dc_node_pressure'] },
    { id: 'th_pipeline', name: 'Job, batch, pipeline or interface failure', incidents: 173, pctOfInScope: 6.4, classIds: ['dc_pipeline_fail', 'dc_batch_overrun', 'dc_mq_depth'] },
    { id: 'th_apperror', name: 'Error raised by the application', incidents: 98, pctOfInScope: 3.6, classIds: [] },
    { id: 'th_monitoring', name: 'Routine monitoring or maintenance task', incidents: 94, pctOfInScope: 3.5, classIds: ['dc_oracle_blindspot'] },
    { id: 'th_dataquality', name: 'Data or report incorrect or missing', incidents: 87, pctOfInScope: 3.2, classIds: ['dc_dq_null_ratio'] },
    { id: 'th_config', name: 'Configuration, setup or change', incidents: 62, pctOfInScope: 2.3, classIds: ['dc_tf_drift'] },
    { id: 'th_performance', name: 'Performance and slowness', incidents: 29, pctOfInScope: 1.1, classIds: ['dc_triple_av'] },
  ],
  // Every cluster the extract shows ten or more times. The platform's own
  // threshold for a problem record, so this list is the work list.
  clusters: [
    { id: 'cl_iem_access', example: 'IEM access issue', subCategory: 'IEM', incidents: 194, months: 13, classId: 'dc_iem_ghost' },
    { id: 'cl_iem_login', example: 'IEM Login Issue', subCategory: 'IEM', incidents: 94, months: 13, classId: 'dc_iem_ghost' },
    { id: 'cl_iem_issue', example: 'IEM Issue', subCategory: 'IEM', incidents: 59, months: 12, classId: 'dc_iem_ghost' },
    { id: 'cl_oracle_daily', example: 'Daily Oracle DB Monitoring', subCategory: 'Servers - Oracle', incidents: 49, months: 4, classId: 'dc_oracle_blindspot' },
    { id: 'cl_loga_access', example: 'Unable to access Loga3', subCategory: 'HR/ESS', incidents: 38, months: 10 },
    { id: 'cl_crs_access', example: 'Unable to access CRS', subCategory: 'CRS — Career Roadmap System', incidents: 38, months: 9 },
    { id: 'cl_thinkcell', example: 'Thinkcell issue', subCategory: 'think-cell', incidents: 32, months: 10 },
    { id: 'cl_mylearning_access', example: 'MyLearning access issue', subCategory: 'MyLearning — SuccessFactors', incidents: 26, months: 8 },
    { id: 'cl_thinkcell_alt', example: 'Think-cell issue', subCategory: 'think-cell', incidents: 20, months: 8 },
    { id: 'cl_sap_login', example: 'SAP login issue', subCategory: 'FOCUS/SAP-HANA', incidents: 19, months: 9 },
    { id: 'cl_hriscams_tomcat', example: 'HRISCAMS was inaccessible — Tomcat restarted', subCategory: 'HRIS-CAMS Interface', incidents: 19, months: 8 },
    { id: 'cl_iem_down', example: 'IEM is down', subCategory: 'IEM', incidents: 15, months: 8, classId: 'dc_iem_ghost' },
    { id: 'cl_sap_access', example: 'SAP access issue', subCategory: 'FOCUS/SAP-HANA', incidents: 15, months: 8 },
    { id: 'cl_iem_pwd_expired', example: 'IEM Login Issue: password expired', subCategory: 'IEM', incidents: 15, months: 7, classId: 'dc_pwd_reset' },
    { id: 'cl_iem_inaccessible', example: 'IEM inaccessible', subCategory: 'IEM', incidents: 14, months: 7, classId: 'dc_iem_ghost' },
    { id: 'cl_adf_failed', example: 'ADF pipelines failed', subCategory: 'Azure Apps (Solutions Factory)', incidents: 13, months: 2, classId: 'dc_pipeline_fail' },
    { id: 'cl_kearney_macros', example: 'Kearney Macros issue', subCategory: 'Kearney Office Add-Ins/Templates', incidents: 12, months: 5 },
    { id: 'cl_sap_issue', example: 'SAP issue', subCategory: 'FOCUS/SAP-HANA', incidents: 11, months: 8 },
    { id: 'cl_crs_issue', example: 'CRS issue', subCategory: 'Career Roadmap', incidents: 11, months: 8 },
    { id: 'cl_iem_not_working', example: 'IEM not working', subCategory: 'IEM', incidents: 11, months: 8, classId: 'dc_iem_ghost' },
    { id: 'cl_xmhost_port', example: 'Port 7001 — xmhost app server on EGV-VMINFORXM2 is CRITICAL', subCategory: 'IEM', incidents: 10, months: 4 },
    { id: 'cl_hriscams_inc', example: 'HRISCAMS inaccessible — Tomcat restarted', subCategory: 'HRIS-CAMS Interface', incidents: 10, months: 6 },
  ],
  shape: {
    subCategories: 80,
    top5Pct: 50.3,
    top16Pct: 81.8,
    singletons: 24,
    outOfHoursPct: 50.9,
    weekendPct: 10.9,
    repeatPct: 52.4,
    clustersOverTen: 22,
    clusterSharePct: 26.6,
    humanRaisedPct: 96.4,
    stillOpenPct: 5,
    offInventoryPct: 61.7,
    offInventory: 1_679,
  },
  problems: { records: 49, open: 16, inScopeWithoutProblemPct: 42.1 },
  growth: { firstHalf: 25_551, secondHalf: 34_367, pct: 35 },
  cannot: [
    { what: 'handling_time', because: 'No resolution or close timestamp is supplied, so time to resolve cannot be derived from this extract' },
    { what: 'priority', because: '26,249 of 28,028 records carry the default priority, so urgency cannot be read from the field' },
  ],
}

/**
 * Harbour Mutual, at the bid: a contract is loaded and no extract is. Every
 * figure below is absent rather than borrowed, and each measure that needs
 * one says so.
 */
const HARBOUR: TicketHistory = {
  engagementId: 'eng_harbour',
  source: 'Not ingested',
  period: { from: '', to: '', months: 0 },
  volumes: { incidents: 0, requests: 0, problems: 0, catalogueTasks: 0 },
  scope: { rule: 'Not applied', inScope: 0, inScopePct: 0, byLine: [] },
  themes: [],
  clusters: [],
  shape: {
    subCategories: 0, top5Pct: 0, top16Pct: 0, singletons: 0, outOfHoursPct: 0, weekendPct: 0,
    repeatPct: 0, clustersOverTen: 0, clusterSharePct: 0, humanRaisedPct: 0, stillOpenPct: 0,
    offInventoryPct: 0, offInventory: 0,
  },
  problems: { records: 0, open: 0, inScopeWithoutProblemPct: 0 },
  growth: { firstHalf: 0, secondHalf: 0, pct: 0 },
  cannot: [
    { what: 'volume', because: 'No ticket extract has been ingested for this engagement' },
    { what: 'recurrence', because: 'No ticket extract has been ingested for this engagement' },
    { what: 'theme', because: 'No ticket extract has been ingested for this engagement' },
    { what: 'arrival', because: 'No ticket extract has been ingested for this engagement' },
    { what: 'inventory_match', because: 'No ticket extract has been ingested for this engagement' },
    { what: 'problem_coverage', because: 'No ticket extract has been ingested for this engagement' },
    { what: 'priority', because: 'No ticket extract has been ingested for this engagement' },
    { what: 'handling_time', because: 'No ticket extract has been ingested for this engagement' },
  ],
}

export const TICKET_HISTORIES: TicketHistory[] = [KEARNEY, HARBOUR]

export const historyFor = (engagementId: string): TicketHistory | null =>
  TICKET_HISTORIES.find((h) => h.engagementId === engagementId) ?? null

/** Why a derivation is refused, or null where the extract supports it. */
export const refusal = (h: TicketHistory, what: Derivable): string | null =>
  h.cannot.find((c) => c.what === what)?.because ?? null

export const themeOf = (h: TicketHistory, id: string): DemandTheme | null => h.themes.find((t) => t.id === id) ?? null

/** Clusters at or above the threshold a problem record is expected at. */
export const recurring = (h: TicketHistory, atLeast = 10): Cluster[] => h.clusters.filter((c) => c.incidents >= atLeast)

/** Clusters whose cause is carried by a costed demand class. */
export const clustersWithCause = (h: TicketHistory, atLeast = 10): Cluster[] =>
  recurring(h, atLeast).filter((c) => Boolean(c.classId))
