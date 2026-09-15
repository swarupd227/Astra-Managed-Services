import { NOW } from './workSeed'
import { AGENT_BY_ID } from './estate'
import { DATA_ITEMS, DATA_ITEM_BY_ID, STORES, descendants, type DataItem } from './dataEstate'
import type { ISO } from './types'

/* ==========================================================================
   Privacy requests, holds and retention — what a person may ask of the data
   held about them, and what stops the answer being simply yes.

   A request is only as complete as the search behind it. The places a
   person's data can be are the stores that hold personal or confidential
   records, plus every store nobody has classified, since nothing says those
   do not. A search that found nothing in a classified store with mapped
   lineage is an answer. A search that found nothing in an unclassified
   store, or one whose lineage is only partly known, proves nothing, and the
   request cannot be called complete while one remains.

   Erasure has three things standing in its way, and each is reported as
   itself rather than as a failure. A hold — legal or retention — on the
   store and the person means the record must be kept, and deleting it
   anyway is the worst outcome on the page. A record found in one store has
   usually been copied into the stores that read from it, so a deletion that
   stops at the first store leaves the copies. And a record deleted from a
   store survives in its backups until they expire, which is a date, not a
   defect.

   Deletion is irreversible and is never executed by an agent. Agents
   locate; people delete, under the client's approval, with evidence.
   ========================================================================== */

const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const ahead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()
const DAY = 86_400_000

/* ------------------------------ The regime ---------------------------------- */

/** The statutory clock requests run against. Seed data — another client configures its own. */
export const REGIME = { name: 'GDPR', responseDays: 30, extensionDays: 60 }

/* --------------------------------- Holds ------------------------------------ */

export type HoldKind = 'legal' | 'retention'

export const HOLD_KIND_LABEL: Record<HoldKind, string> = { legal: 'Legal hold', retention: 'Retention hold' }

export interface Hold {
  id: string
  kind: HoldKind
  matter: string
  itemIds: string[]
  /** The people it covers. Absent means every record in the stores. */
  subjects?: string[]
  placedAt: ISO
  placedBy: string
  reviewBy: ISO
  releasedAt?: ISO
}

export const HOLDS: Hold[] = [
  {
    id: 'LH-2027-002', kind: 'legal', matter: 'Employment claim · matter M-2027-004',
    itemIds: ['ds_utilisation_gold', 'sm_utilisation'], subjects: ['DS-0226', 'DS-0229'],
    placedAt: ago(48), placedBy: 'General Counsel', reviewBy: ago(5),
  },
  {
    id: 'RH-2027-001', kind: 'retention', matter: 'Billing records kept seven years for audit',
    itemIds: ['src_focus_extract', 'ds_engagement_gold'],
    placedAt: ago(210), placedBy: 'Finance Operations', reviewBy: ahead(300),
  },
  {
    id: 'LH-2026-009', kind: 'legal', matter: 'Supplier dispute · matter M-2026-017',
    itemIds: ['ds_client_dim'], subjects: ['DS-0187'],
    placedAt: ago(160), placedBy: 'General Counsel', reviewBy: ago(30), releasedAt: ago(20),
  },
]

const isActive = (h: Hold) => !h.releasedAt

/** Active holds on a store, for one person or for anyone. */
export function holdsOn(itemId: string, subject?: string): Hold[] {
  return HOLDS.filter((h) => isActive(h) && h.itemIds.includes(itemId) && (!h.subjects || !subject || h.subjects.includes(subject)))
}

/* -------------------------------- Requests ---------------------------------- */

export type RequestKind = 'access' | 'erasure' | 'retrieval'

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  access: 'Access',
  erasure: 'Erasure',
  retrieval: 'Retrieval',
}

export type RequestState = 'verifying_identity' | 'locating' | 'awaiting_approval' | 'fulfilling' | 'closed' | 'refused'

export const REQUEST_STATE_LABEL: Record<RequestState, string> = {
  verifying_identity: 'verifying identity',
  locating: 'locating',
  awaiting_approval: 'awaiting approval',
  fulfilling: 'fulfilling',
  closed: 'closed',
  refused: 'refused',
}

export type SubjectType = 'employee' | 'former_employee' | 'contractor' | 'client_contact' | 'matter'

export const SUBJECT_LABEL: Record<SubjectType, string> = {
  employee: 'Employee',
  former_employee: 'Former employee',
  contractor: 'Contractor',
  client_contact: 'Client contact',
  matter: 'Legal matter',
}

export interface Search {
  itemId: string
  records: number
  /** The agent or person who ran it. */
  by: string
}

export type Outcome = 'exported' | 'deleted' | 'retained'

export interface RequestAction {
  itemId: string
  outcome: Outcome
  by: string
  at: ISO
  evidenceId?: string
}

export interface PrivacyRequest {
  id: string
  kind: RequestKind
  /** A pseudonymous reference. The register never holds the person's name. */
  subject: string
  subjectType: SubjectType
  receivedAt: ISO
  extended?: boolean
  state: RequestState
  approvedBy?: string
  searches: Search[]
  actions: RequestAction[]
  closedAt?: ISO
  refusal?: string
}

export const REQUESTS: PrivacyRequest[] = [
  {
    id: 'PR-0231', kind: 'access', subject: 'DS-0231', subjectType: 'employee', receivedAt: ago(12), state: 'fulfilling',
    searches: [
      { itemId: 'src_hcm_feed', records: 1, by: 'agt_archivist' },
      { itemId: 'src_customer_feed', records: 0, by: 'agt_archivist' },
      { itemId: 'src_focus_extract', records: 412, by: 'agt_archivist' },
      { itemId: 'ds_engagement_silver', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_engagement_gold', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_client_dim', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_utilisation_gold', records: 214, by: 'agt_archivist' },
      { itemId: 'ds_oracle_dm', records: 0, by: 'agt_archivist' },
      { itemId: 'sm_research', records: 0, by: 'agt_archivist' },
      { itemId: 'sm_utilisation', records: 214, by: 'agt_archivist' },
    ],
    actions: [
      { itemId: 'src_hcm_feed', outcome: 'exported', by: 'HR Operations', at: ago(3), evidenceId: 'ev_pr_0231_1' },
      { itemId: 'ds_utilisation_gold', outcome: 'exported', by: 'S. Okafor', at: ago(2), evidenceId: 'ev_pr_0231_2' },
    ],
  },
  {
    id: 'PR-0226', kind: 'erasure', subject: 'DS-0226', subjectType: 'former_employee', receivedAt: ago(26), state: 'fulfilling',
    approvedBy: 'Privacy Office',
    searches: [
      { itemId: 'src_hcm_feed', records: 1, by: 'agt_archivist' },
      { itemId: 'src_focus_extract', records: 380, by: 'agt_archivist' },
      { itemId: 'ds_engagement_silver', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_engagement_gold', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_client_dim', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_utilisation_gold', records: 96, by: 'agt_archivist' },
      { itemId: 'ds_oracle_dm', records: 0, by: 'agt_archivist' },
      { itemId: 'src_customer_feed', records: 0, by: 'agt_archivist' },
      { itemId: 'sm_research', records: 0, by: 'agt_archivist' },
    ],
    actions: [
      { itemId: 'src_hcm_feed', outcome: 'deleted', by: 'HR Operations', at: ago(6), evidenceId: 'ev_pr_0226_1' },
      { itemId: 'ds_utilisation_gold', outcome: 'retained', by: 'S. Okafor', at: ago(6), evidenceId: 'ev_pr_0226_2' },
      { itemId: 'src_focus_extract', outcome: 'retained', by: 'Finance Operations', at: ago(6), evidenceId: 'ev_pr_0226_3' },
    ],
  },
  {
    id: 'PR-0219', kind: 'erasure', subject: 'DS-0219', subjectType: 'client_contact', receivedAt: ago(41), extended: true, state: 'closed',
    approvedBy: 'Privacy Office', closedAt: ago(4),
    searches: [
      { itemId: 'src_customer_feed', records: 2, by: 'agt_archivist' },
      { itemId: 'src_hcm_feed', records: 0, by: 'agt_archivist' },
      { itemId: 'src_focus_extract', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_utilisation_gold', records: 0, by: 'agt_archivist' },
      { itemId: 'sm_utilisation', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_engagement_silver', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_client_dim', records: 2, by: 'agt_archivist' },
      { itemId: 'ds_engagement_gold', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_oracle_dm', records: 0, by: 'agt_archivist' },
      { itemId: 'sm_research', records: 2, by: 'agt_archivist' },
    ],
    actions: [
      { itemId: 'src_customer_feed', outcome: 'deleted', by: 'Market & Client Development', at: ago(9), evidenceId: 'ev_pr_0219_1' },
      { itemId: 'ds_client_dim', outcome: 'deleted', by: 'S. Okafor', at: ago(8) },
      { itemId: 'sm_research', outcome: 'deleted', by: 'S. Okafor', at: ago(7), evidenceId: 'ev_pr_0219_3' },
    ],
  },
  {
    id: 'PR-0229', kind: 'erasure', subject: 'DS-0229', subjectType: 'former_employee', receivedAt: ago(15), state: 'refused',
    approvedBy: 'Privacy Office', closedAt: ago(9),
    refusal: 'Every record found is under legal hold LH-2027-002',
    searches: [
      { itemId: 'ds_utilisation_gold', records: 58, by: 'agt_archivist' },
      { itemId: 'sm_utilisation', records: 58, by: 'agt_archivist' },
    ],
    actions: [
      { itemId: 'ds_utilisation_gold', outcome: 'retained', by: 'S. Okafor', at: ago(9), evidenceId: 'ev_pr_0229_1' },
      { itemId: 'sm_utilisation', outcome: 'retained', by: 'S. Okafor', at: ago(9), evidenceId: 'ev_pr_0229_2' },
    ],
  },
  {
    id: 'PR-0234', kind: 'retrieval', subject: 'M-2027-004', subjectType: 'matter', receivedAt: ago(3), state: 'locating',
    searches: [
      { itemId: 'ds_utilisation_gold', records: 1860, by: 'agt_archivist' },
    ],
    actions: [],
  },
  {
    id: 'PR-0236', kind: 'access', subject: 'DS-0236', subjectType: 'contractor', receivedAt: ago(1), state: 'verifying_identity',
    searches: [], actions: [],
  },
  {
    id: 'PR-0212', kind: 'access', subject: 'DS-0212', subjectType: 'employee', receivedAt: ago(58), state: 'closed', closedAt: ago(35),
    searches: [
      { itemId: 'src_hcm_feed', records: 1, by: 'agt_archivist' },
      { itemId: 'src_customer_feed', records: 0, by: 'agt_archivist' },
      { itemId: 'src_focus_extract', records: 206, by: 'agt_archivist' },
      { itemId: 'ds_engagement_silver', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_engagement_gold', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_client_dim', records: 0, by: 'agt_archivist' },
      { itemId: 'ds_utilisation_gold', records: 88, by: 'agt_archivist' },
      { itemId: 'ds_oracle_dm', records: 0, by: 'agt_archivist' },
      { itemId: 'sm_research', records: 0, by: 'agt_archivist' },
      { itemId: 'sm_utilisation', records: 88, by: 'agt_archivist' },
    ],
    actions: [
      { itemId: 'src_hcm_feed', outcome: 'exported', by: 'HR Operations', at: ago(37), evidenceId: 'ev_pr_0212_1' },
      { itemId: 'src_focus_extract', outcome: 'exported', by: 'Finance Operations', at: ago(37), evidenceId: 'ev_pr_0212_2' },
      { itemId: 'ds_utilisation_gold', outcome: 'exported', by: 'S. Okafor', at: ago(36), evidenceId: 'ev_pr_0212_3' },
      { itemId: 'sm_utilisation', outcome: 'exported', by: 'S. Okafor', at: ago(36), evidenceId: 'ev_pr_0212_4' },
    ],
  },
]

/* ------------------------------- The reading -------------------------------- */

/** Stores a person's data could be in: personal or confidential, or not classified at all. */
export const inScope = (): DataItem[] =>
  DATA_ITEMS.filter((i) => STORES.includes(i.kind) && (!i.classification || i.classification === 'restricted' || i.classification === 'confidential'))

/** Whether a search that found nothing in this store can be believed. */
export const vouched = (i: DataItem) => Boolean(i.classification) && i.lineage === 'mapped'

export type SearchVerdict = 'found' | 'none' | 'unvouched' | 'not_searched'

export const SEARCH_LABEL: Record<SearchVerdict, string> = {
  found: 'Found',
  none: 'None held',
  unvouched: 'None found · unverifiable',
  not_searched: 'Not searched',
}

export type RequestFlag =
  | 'deleted_under_hold' | 'agent_deleted' | 'unapproved_erasure' | 'no_evidence'
  | 'overdue' | 'due_soon' | 'search_gaps' | 'copies_downstream' | 'pending_action' | 'closed_with_gaps'

export const REQUEST_FLAG_LABEL: Record<RequestFlag, string> = {
  deleted_under_hold: 'Deleted under hold',
  agent_deleted: 'Deleted by an agent',
  unapproved_erasure: 'Deleted without approval',
  no_evidence: 'Action without evidence',
  overdue: 'Overdue',
  due_soon: 'Due within 7 days',
  search_gaps: 'Search incomplete',
  copies_downstream: 'Copies downstream unsearched',
  pending_action: 'Found, no action',
  closed_with_gaps: 'Closed with gaps',
}

/** Flags that are a breach of the process rather than a state of it. */
export const REQUEST_FLAG_CRIT: Record<RequestFlag, boolean> = {
  deleted_under_hold: true, agent_deleted: true, unapproved_erasure: true, no_evidence: true,
  overdue: true, closed_with_gaps: true,
  due_soon: false, search_gaps: false, copies_downstream: false, pending_action: false,
}

export interface ItemReading {
  item: DataItem
  verdict: SearchVerdict
  records: number
  holds: Hold[]
  action?: RequestAction
  /** Deleted records surviving in backups until this date. */
  residualUntil?: ISO
}

export interface RequestReading {
  request: PrivacyRequest
  dueAt: ISO
  daysLeft: number
  items: ItemReading[]
  gaps: DataItem[]
  flags: RequestFlag[]
  open: boolean
}

export function readRequest(r: PrivacyRequest, nowMs = NOW.getTime()): RequestReading {
  const dueMs = Date.parse(r.receivedAt) + (REGIME.responseDays + (r.extended ? REGIME.extensionDays : 0)) * DAY
  const endMs = r.closedAt ? Date.parse(r.closedAt) : nowMs
  const open = !['closed', 'refused'].includes(r.state)

  // Searched stores outside the scope still appear, so nothing done is hidden.
  const scope = new Map(inScope().map((i) => [i.id, i]))
  for (const s of r.searches) if (DATA_ITEM_BY_ID[s.itemId]) scope.set(s.itemId, DATA_ITEM_BY_ID[s.itemId])

  // A matter is not a person: a retrieval for one is not searched store by store.
  const exhaustive = r.kind !== 'retrieval'

  const items: ItemReading[] = [...scope.values()]
    .filter((i) => (exhaustive && r.state !== 'refused') || r.searches.some((s) => s.itemId === i.id))
    .map((item) => {
      const s = r.searches.find((x) => x.itemId === item.id)
      const verdict: SearchVerdict = !s ? 'not_searched' : s.records > 0 ? 'found' : vouched(item) ? 'none' : 'unvouched'
      const action = r.actions.find((a) => a.itemId === item.id)
      return {
        item,
        verdict,
        records: s?.records ?? 0,
        holds: holdsOn(item.id, r.subject),
        action,
        residualUntil: action?.outcome === 'deleted' && item.backupRetentionDays
          ? new Date(Date.parse(action.at) + item.backupRetentionDays * DAY).toISOString()
          : undefined,
      }
    })

  // Nothing is searched before identity is verified, and a refused request
  // is not searched further, so neither has a gap.
  const gaps = r.state === 'verifying_identity' || r.state === 'refused' ? [] : items.filter((i) => i.verdict === 'not_searched' || i.verdict === 'unvouched').map((i) => i.item)

  const flags: RequestFlag[] = []
  const deletions = r.actions.filter((a) => a.outcome === 'deleted')
  if (deletions.some((a) => holdsOn(a.itemId, r.subject).length)) flags.push('deleted_under_hold')
  if (deletions.some((a) => AGENT_BY_ID[a.by])) flags.push('agent_deleted')
  if (deletions.length && !r.approvedBy) flags.push('unapproved_erasure')
  if (r.actions.some((a) => !a.evidenceId)) flags.push('no_evidence')
  if (endMs > dueMs && (open || r.closedAt)) flags.push('overdue')
  if (open && dueMs >= nowMs && dueMs - nowMs <= 7 * DAY) flags.push('due_soon')
  if (open && gaps.length && r.state !== 'locating') flags.push('search_gaps')
  if (r.kind === 'erasure') {
    const searched = new Set(r.searches.map((s) => s.itemId))
    const found = r.searches.filter((s) => s.records > 0).map((s) => s.itemId)
    const copies = found.flatMap((id) => descendants(id)).filter((d) => STORES.includes(d.kind) && !searched.has(d.id))
    if (copies.length) flags.push('copies_downstream')
  }
  if (open && ['fulfilling', 'awaiting_approval'].includes(r.state) && items.some((i) => i.verdict === 'found' && !i.action)) flags.push('pending_action')
  if (r.state === 'closed' && gaps.length) flags.push('closed_with_gaps')

  return { request: r, dueAt: new Date(dueMs).toISOString(), daysLeft: Math.ceil((dueMs - nowMs) / DAY), items, gaps, flags, open }
}

/* -------------------------------- Retention --------------------------------- */

export type RetentionState = 'within' | 'past' | 'held' | 'unscheduled'

export const RETENTION_LABEL: Record<RetentionState, string> = {
  within: 'Within schedule',
  past: 'Past schedule',
  held: 'Past schedule · held',
  unscheduled: 'No schedule',
}

export interface RetentionReading {
  item: DataItem
  state: RetentionState
  /** Days of records beyond the schedule. */
  overDays: number
  holds: Hold[]
}

export function readRetention(i: DataItem): RetentionReading {
  const holds = holdsOn(i.id)
  if (!i.retentionDays) return { item: i, state: 'unscheduled', overDays: 0, holds }
  const over = Math.max(0, (i.oldestRecordDays ?? 0) - i.retentionDays)
  return { item: i, state: over === 0 ? 'within' : holds.length ? 'held' : 'past', overDays: over, holds }
}

/* --------------------------------- Summary ---------------------------------- */

export interface PrivacySummary {
  readings: RequestReading[]
  open: number
  dueSoon: number
  overdue: number
  withGaps: number
  /** Process breaches: deletion under hold, by an agent, without approval or without evidence. */
  breaches: number
  holds: { active: number; reviewOverdue: number; items: number }
  retention: RetentionReading[]
}

export function privacySummary(nowMs = NOW.getTime()): PrivacySummary {
  const readings = REQUESTS.map((r) => readRequest(r, nowMs)).sort((a, b) => Number(b.open) - Number(a.open) || a.daysLeft - b.daysLeft)
  const active = HOLDS.filter(isActive)
  const breachFlags: RequestFlag[] = ['deleted_under_hold', 'agent_deleted', 'unapproved_erasure', 'no_evidence']
  return {
    readings,
    open: readings.filter((r) => r.open).length,
    dueSoon: readings.filter((r) => r.flags.includes('due_soon')).length,
    overdue: readings.filter((r) => r.flags.includes('overdue')).length,
    withGaps: readings.filter((r) => r.flags.includes('search_gaps') || r.flags.includes('closed_with_gaps')).length,
    breaches: readings.filter((r) => r.flags.some((f) => breachFlags.includes(f))).length,
    holds: {
      active: active.length,
      reviewOverdue: active.filter((h) => Date.parse(h.reviewBy) < nowMs).length,
      items: new Set(active.flatMap((h) => h.itemIds)).size,
    },
    retention: inScope().map(readRetention),
  }
}
