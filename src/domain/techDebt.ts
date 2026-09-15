import { NOW } from './workSeed'
import { DEMAND_CLASSES } from './ledgers'
import { RELEASES } from './releases'
import { WORK_ORDERS, isAuthorised } from './workOrders'
import type { ISO } from './types'

/* ==========================================================================
   Technical debt — what the estate costs to keep as it is, and which of it
   is worth paying down this quarter.

   A debt item names the supported items it lives in and the demand classes
   it causes. Its interest is the effort those classes cost a year, read
   from the demand ledger rather than estimated alongside the debt, so the
   figure cannot be argued up to justify the fix. A class the ledger has
   only sampled has no annual effort, and a debt resting on one has interest
   that is not measured. That is said, not filled in.

   Two debts citing the same class share its interest. Each shows the whole
   of it, since each would relieve it, but the register's total counts every
   class once.

   The quarterly recommendation spends a declared capacity. End of support
   and security debt come first whatever their interest, because the cost
   of those is an exposure the ledger cannot see. The rest is ranked by how
   quickly the fix pays back. Debt with unmeasured interest is never
   recommended on a guess; it is deferred until its interest is measured.
   ========================================================================== */

const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const ahead = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString()
const DAY = 86_400_000

export type DebtCategory = 'operational' | 'architectural' | 'performance' | 'supportability' | 'security'

export const DEBT_CATEGORIES: DebtCategory[] = ['operational', 'architectural', 'performance', 'supportability', 'security']

export const CATEGORY_LABEL: Record<DebtCategory, string> = {
  operational: 'Operational',
  architectural: 'Architectural',
  performance: 'Performance',
  supportability: 'Supportability',
  security: 'Security',
}

export type DebtState = 'open' | 'accepted' | 'scheduled' | 'remediating' | 'retired'

export const DEBT_STATE_LABEL: Record<DebtState, string> = {
  open: 'open',
  accepted: 'accepted',
  scheduled: 'scheduled',
  remediating: 'remediating',
  retired: 'retired',
}

export interface DebtItem {
  id: string
  title: string
  category: DebtCategory
  /** Supported items it lives in — applications or data items. */
  itemIds: string[]
  /** Demand classes it causes. Its interest is read from these. */
  demandClasses: string[]
  raisedBy: string
  raisedAt: ISO
  estimateHrs: number
  endOfSupport?: ISO
  state: DebtState
  acceptance?: { by: string; at: ISO; reviewBy: ISO }
  workOrderId?: string
  releaseId?: string
}

/** Capacity declared for remediation next quarter. A declaration, not a measure. */
export const DEBT_CAPACITY = { quarter: '2027-Q2', hours: 240, declaredBy: 'S. Okafor' }

export const DEBTS: DebtItem[] = [
  {
    id: 'TD-014', title: 'Oracle datamart carries no telemetry', category: 'supportability',
    itemIds: ['ds_oracle_dm', 'pl_oracle_extract'], demandClasses: ['dc_oracle_blindspot'],
    raisedBy: 'agt_archivist', raisedAt: ago(60), estimateHrs: 120, state: 'open',
  },
  {
    id: 'TD-015', title: 'Quality rules authored per report, not per dataset', category: 'architectural',
    itemIds: ['ds_engagement_gold', 'ds_client_dim'], demandClasses: ['dc_dq_null_ratio'],
    raisedBy: 'agt_custodian', raisedAt: ago(44), estimateHrs: 96, state: 'open',
  },
  {
    id: 'TD-016', title: 'HCM feed contract declared, not enforced', category: 'architectural',
    itemIds: ['src_hcm_feed', 'pl_utilisation_load'], demandClasses: ['dc_pipeline_fail', 'dc_schema_drift'],
    raisedBy: 'agt_custodian', raisedAt: ago(38), estimateHrs: 72, state: 'remediating', releaseId: 'REL-2027-039',
  },
  {
    id: 'TD-017', title: 'Two definitions of net revenue', category: 'architectural',
    itemIds: ['sm_research'], demandClasses: ['dc_bi_semantic'],
    raisedBy: 'agt_prospect', raisedAt: ago(30), estimateHrs: 64, state: 'scheduled', workOrderId: 'PWO-0158',
  },
  {
    id: 'TD-018', title: 'Skewed join and runaway autoscale on engagement_silver', category: 'performance',
    itemIds: ['ds_engagement_silver'], demandClasses: ['dc_job_cost'],
    raisedBy: 'agt_bursar', raisedAt: ago(22), estimateHrs: 40, state: 'open',
  },
  {
    id: 'TD-019', title: 'Shared analytics licence pool exhausted by concurrent runs', category: 'operational',
    itemIds: ['inv_alteryx'], demandClasses: ['dc_alteryx_fail'],
    raisedBy: 'agt_prospect', raisedAt: ago(18), estimateHrs: 30, state: 'open',
  },
  {
    id: 'TD-020', title: 'Practice Tableau Server unpatched and unowned', category: 'security',
    itemIds: ['inv_tableau_shadow', 'rp_tableau'], demandClasses: [],
    raisedBy: 'agt_archivist', raisedAt: ago(15), estimateHrs: 60, endOfSupport: ahead(75), state: 'open',
  },
  {
    id: 'TD-021', title: 'Cloud datamart on a service tier leaving support', category: 'supportability',
    itemIds: ['inv_cloud_dm'], demandClasses: [],
    raisedBy: 'agt_bursar', raisedAt: ago(9), estimateHrs: 16, endOfSupport: ahead(140), state: 'open',
  },
  {
    id: 'TD-011', title: 'Legacy Oracle ETL jobs still referenced in runbooks', category: 'operational',
    itemIds: ['pl_oracle_extract'], demandClasses: ['dc_oracle_blindspot', 'dc_lineage_gap'],
    raisedBy: 'agt_archivist', raisedAt: ago(95), estimateHrs: 24, state: 'accepted',
    acceptance: { by: 'S. Okafor', at: ago(70), reviewBy: ago(10) },
  },
  {
    id: 'TD-006', title: 'Nightly load on a single self-hosted integration runtime', category: 'supportability',
    itemIds: ['pl_engagement_ingest'], demandClasses: ['dc_pipeline_fail'],
    raisedBy: 'agt_custodian', raisedAt: ago(140), estimateHrs: 48, state: 'retired',
  },
]

/* ------------------------------- The reading -------------------------------- */

export type DebtFlag = 'past_end_of_support' | 'end_of_support' | 'review_overdue' | 'unauthorised_schedule' | 'interest_unmeasured' | 'interest_partial' | 'shared_interest'

export const DEBT_FLAG_LABEL: Record<DebtFlag, string> = {
  past_end_of_support: 'Past end of support',
  end_of_support: 'End of support ≤ 180 days',
  review_overdue: 'Acceptance review overdue',
  unauthorised_schedule: 'Scheduled without authority',
  interest_unmeasured: 'Interest not measured',
  interest_partial: 'Interest partly measured',
  shared_interest: 'Interest shared',
}

export const DEBT_FLAG_CRIT: Record<DebtFlag, boolean> = {
  past_end_of_support: true, end_of_support: false, review_overdue: true,
  unauthorised_schedule: true, interest_unmeasured: false, interest_partial: false, shared_interest: false,
}

export interface DebtReading {
  debt: DebtItem
  /** Hours a year, from measured classes only. */
  interestHrs: number
  interestBasis: 'measured' | 'partial' | 'unmeasured'
  paybackYrs: number | null
  eosDays: number | null
  mandatory: boolean
  live: boolean
  flags: DebtFlag[]
}

const measured = (id: string) => {
  const d = DEMAND_CLASSES.find((c) => c.id === id)
  return d && d.volumeBasis !== 'sampled' && d.hoursYr > 0 ? d.hoursYr : null
}

const isLive = (d: DebtItem) => d.state !== 'retired'

export function readDebt(d: DebtItem, nowMs = NOW.getTime()): DebtReading {
  const hours = d.demandClasses.map(measured)
  const known = hours.filter((h): h is number => h !== null)
  const interestHrs = known.reduce((s, h) => s + h, 0)
  const interestBasis = !known.length ? 'unmeasured' : known.length < hours.length ? 'partial' : 'measured'
  const eosDays = d.endOfSupport ? Math.round((Date.parse(d.endOfSupport) - nowMs) / DAY) : null
  const live = isLive(d)

  const flags: DebtFlag[] = []
  if (live && eosDays !== null && eosDays < 0) flags.push('past_end_of_support')
  else if (live && eosDays !== null && eosDays <= 180) flags.push('end_of_support')
  if (d.state === 'accepted' && d.acceptance && Date.parse(d.acceptance.reviewBy) < nowMs) flags.push('review_overdue')
  if (d.state === 'scheduled' || d.state === 'remediating') {
    const order = d.workOrderId ? WORK_ORDERS.find((w) => w.id === d.workOrderId) : undefined
    const release = d.releaseId ? RELEASES.find((r) => r.id === d.releaseId) : undefined
    if (!(order && isAuthorised(order)) && !release) flags.push('unauthorised_schedule')
  }
  if (live && interestBasis === 'unmeasured') flags.push('interest_unmeasured')
  if (live && interestBasis === 'partial') flags.push('interest_partial')
  if (live && d.demandClasses.some((c) => DEBTS.some((o) => o.id !== d.id && isLive(o) && o.demandClasses.includes(c)))) flags.push('shared_interest')

  return {
    debt: d,
    interestHrs,
    interestBasis,
    paybackYrs: interestHrs > 0 ? d.estimateHrs / interestHrs : null,
    eosDays,
    mandatory: live && (d.category === 'security' || (eosDays !== null && eosDays <= 180)),
    live,
    flags,
  }
}

export type Deferral = 'exceeds_capacity' | 'interest_unmeasured'

export const DEFERRAL_LABEL: Record<Deferral, string> = {
  exceeds_capacity: 'Exceeds remaining capacity',
  interest_unmeasured: 'Interest not measured',
}

export interface Recommendation {
  recommended: DebtReading[]
  deferred: { reading: DebtReading; reason: Deferral }[]
  hours: number
  /** Measured interest a year the recommended set relieves, each class once. */
  relievedHrs: number
}

export function recommend(readings: DebtReading[], capacity = DEBT_CAPACITY.hours): Recommendation {
  // Only debt nobody has decided about yet competes for capacity.
  const candidates = readings.filter((r) => r.debt.state === 'open')
  const mandatory = candidates.filter((r) => r.mandatory).sort((a, b) => (a.eosDays ?? Infinity) - (b.eosDays ?? Infinity))
  const ranked = candidates.filter((r) => !r.mandatory && r.paybackYrs !== null && r.interestBasis === 'measured')
    .sort((a, b) => a.paybackYrs! - b.paybackYrs!)

  const recommended: DebtReading[] = []
  const deferred: Recommendation['deferred'] = []
  let left = capacity
  for (const r of [...mandatory, ...ranked]) {
    if (r.debt.estimateHrs <= left) { recommended.push(r); left -= r.debt.estimateHrs }
    else deferred.push({ reading: r, reason: 'exceeds_capacity' })
  }
  for (const r of candidates) {
    if (!r.mandatory && r.interestBasis !== 'measured') deferred.push({ reading: r, reason: 'interest_unmeasured' })
  }

  return {
    recommended,
    deferred,
    hours: capacity - left,
    relievedHrs: uniqueInterest(recommended.map((r) => r.debt)),
  }
}

/** Measured annual interest across debts, counting each demand class once. */
export function uniqueInterest(debts: DebtItem[]): number {
  return [...new Set(debts.flatMap((d) => d.demandClasses))].reduce((s, c) => s + (measured(c) ?? 0), 0)
}

export interface DebtSummary {
  readings: DebtReading[]
  live: number
  interestHrs: number
  unmeasured: number
  endOfSupport: number
  reviewOverdue: number
  byCategory: Record<DebtCategory, number>
  recommendation: Recommendation
}

export function debtSummary(nowMs = NOW.getTime()): DebtSummary {
  const readings = DEBTS.map((d) => readDebt(d, nowMs))
  const live = readings.filter((r) => r.live)
  return {
    readings,
    live: live.length,
    interestHrs: uniqueInterest(live.map((r) => r.debt)),
    unmeasured: live.filter((r) => r.interestBasis !== 'measured').length,
    endOfSupport: live.filter((r) => r.flags.includes('end_of_support') || r.flags.includes('past_end_of_support')).length,
    reviewOverdue: live.filter((r) => r.flags.includes('review_overdue')).length,
    byCategory: DEBT_CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: live.filter((r) => r.debt.category === c).length }), {} as Record<DebtCategory, number>),
    recommendation: recommend(readings),
  }
}
