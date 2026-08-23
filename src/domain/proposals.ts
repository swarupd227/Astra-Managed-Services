import { NOW } from './workSeed'
import { DECISIONS, DEMAND_CLASSES } from './ledgers'
import type { ExecutionMode, ISO } from './types'

/* ==========================================================================
   The Proposal stream (Addendum A §A5).

   Agents originate work, not only execute it. Before this, unprompted agent
   output was scattered across the surface that happened to display it —
   elimination candidates in one screen, promotion requests in another,
   transform items in a third. None of them were the same object, so
   "initiative share" (AG-3) had no denominator to measure against.

   One governed object now carries all of it: claim, evidence, projected
   value, requested decision, expiry. Unactioned proposals age visibly — the
   platform is allowed to say "I raised this three weeks ago", politely, with
   the evidence attached.
   ========================================================================== */

export type ProposalKind = 'elimination' | 'risk' | 'transform' | 'permission' | 'cost'
export type ProposalState = 'open' | 'accepted' | 'rejected' | 'expired'

export interface ProposalEvidence {
  label: string
  ref?: string
}

/** §A5.2 — an agent making its own case for more autonomy. */
export interface PermissionRequest {
  actionClass: string
  from: ExecutionMode
  to: ExecutionMode
  scope: string
  conditions: string
  simulation: string
}

/**
 * What the proposal is about, where that thing is already a record elsewhere.
 *
 * A proposal must not restate its source's figures. Before this link existed,
 * the certificate proposal claimed 18 hours a year against a demand class that
 * records 47 — two numbers for one fact, drifting apart silently. The value is
 * now read from the source and only the argument lives here.
 */
export interface ProposalSource {
  kind: 'demand_class' | 'action_class' | 'transform_item' | 'innovation'
  id: string
}

export interface Proposal {
  id: string
  kind: ProposalKind
  /** Agent id. Every proposal has an author; none are anonymous (D4). */
  from: string
  to: string
  claim: string
  detail: string
  evidence: ProposalEvidence[]
  /**
   * Only stated where there is no source record to read it from. Use
   * `proposalValue()` rather than this field — it prefers the source.
   */
  value: { projectedUsd?: number; hoursYr?: number; note: string }
  source?: ProposalSource
  requestedDecision: string
  raisedAt: ISO
  expiresAt: ISO
  state: ProposalState
  decidedBy?: string
  decidedNote?: string
  permission?: PermissionRequest
}

/**
 * The proposal's value, taken from its source record where it has one.
 *
 * The source is the authority. A proposal about a demand class cannot claim a
 * different annual cost than the class it is about.
 */
export function proposalValue(p: Proposal): { projectedUsd?: number; hoursYr?: number; note: string } {
  if (p.source?.kind === 'demand_class') {
    const dc = DEMAND_CLASSES.find((d) => d.id === p.source!.id)
    if (dc) return { hoursYr: dc.hoursYr, projectedUsd: dc.npv36m, note: p.value.note }
  }
  return p.value
}

/** The proposal currently open about a given record, if any. */
export function proposalFor(proposals: Proposal[], kind: ProposalSource['kind'], id: string): Proposal | undefined {
  return proposals.find((p) => p.source?.kind === kind && p.source.id === id && p.state === 'open')
}

export const PROPOSAL_KIND_META: Record<ProposalKind, { label: string; tone: 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent' }> = {
  elimination: { label: 'Elimination', tone: 'ok' },
  risk: { label: 'Risk', tone: 'crit' },
  transform: { label: 'Transform', tone: 'brand' },
  permission: { label: 'Permission', tone: 'agent' },
  cost: { label: 'Cost', tone: 'info' },
}

/* --------------------------------- Ageing ---------------------------------- */

/** 0 at raise, 1 at expiry. Past 1 the proposal has aged out. */
export function proposalAge(p: Proposal, nowMs = NOW.getTime()): number {
  const from = new Date(p.raisedAt).getTime()
  const to = new Date(p.expiresAt).getTime()
  if (to <= from) return 1
  return Math.max(0, Math.min(1.2, (nowMs - from) / (to - from)))
}

export function daysOpen(p: Proposal, nowMs = NOW.getTime()): number {
  return Math.max(0, Math.round((nowMs - new Date(p.raisedAt).getTime()) / 86_400_000))
}

/**
 * AG-3: the share of governance decision items that an agent originated.
 *
 * Denominator is every decision item in front of the board — the standing
 * register plus the open proposals competing for the same attention.
 */
export function initiativeShare(proposals: Proposal[]): { share: number; agentOriginated: number; total: number } {
  const agentOriginated = proposals.filter((p) => p.state !== 'expired').length
  const total = DECISIONS.length + agentOriginated
  return { share: total ? agentOriginated / total : 0, agentOriginated, total }
}

/* ---------------------------------- Seed ------------------------------------ */

const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString()

export const PROPOSALS: Proposal[] = [
  {
    // Deliberately NOT AC-31. The promotion register already records pr_88
    // granting AC-31 L2→L3 four days ago, and decision dec_2027_014 approving
    // it — an open request for the same thing would have the platform asking
    // for something it had already been given.
    id: 'prp_ac41_l3',
    kind: 'permission',
    from: 'agt_remedian',
    to: 'Service governance board',
    claim: 'Raise AC-41 from L2 Approve-first to L3 Supervised on the payments estate',
    detail:
      'Approval latency on certificate rotation is now the dominant term in its MTTR. The evidence base is large enough, and stable enough, that the gate is costing more than it is catching.',
    evidence: [
      { label: '284 runs on sk_cert_rotate_v3 at 98.8% success, 0 incidents', ref: 'ev_dd41b1' },
      { label: 'Median approval latency 9m 4s on this class', ref: 'ev_dd41b2' },
      { label: 'Rotation is reversible and carries the tls_probe_v3 verification pack', ref: 'ev_dd41b3' },
      { label: 'Policy simulation attached — 284 historical runs replayed', ref: 'ev_dd41b4' },
    ],
    value: { note: 'Projected MTTR improvement on this class under a 120s abort window' },
    source: { kind: 'action_class', id: 'AC-41' },
    requestedDecision: 'Promote with an 8-week enhanced sampling condition',
    raisedAt: days(-19),
    expiresAt: days(9),
    state: 'open',
    permission: {
      actionClass: 'AC-41',
      from: 'approve_first',
      to: 'supervised',
      scope: 'payments estate only — no change requested on tier-0 nodes',
      conditions: '8-week enhanced sampling; automatic demotion on any Sev-attributable error',
      simulation: 'Replayed against 284 historical runs: 0 decisions would have differed under L3 with the abort window.',
    },
  },
  {
    id: 'prp_pool_iac',
    kind: 'elimination',
    from: 'agt_prospect',
    to: 'Service governance board',
    claim: 'Guard-rail connection-pool sizing in IaC to eliminate dc_conn_pool_exhaustion',
    detail:
      'This class has recurred eight times. Every occurrence traces to a pool ceiling changed outside the pipeline. Reverting treats the occurrence; a policy check in CI removes the class.',
    evidence: [
      { label: 'dc_conn_pool_exhaustion — 44/yr, 70 hrs/yr', ref: 'ev_dd41c1' },
      { label: 'Eight occurrences, all correlated to chg_5511 pattern', ref: 'ev_dd41c2' },
      { label: 'rb_dbpool human-verified, 98.4% success — treats symptom only', ref: 'ev_dd41c3' },
    ],
    value: { note: 'Removes the class rather than the instance' },
    source: { kind: 'demand_class', id: 'dc_conn_pool_exhaustion' },
    requestedDecision: 'Allocate transform capacity to ta_041',
    raisedAt: days(-23),
    expiresAt: days(-2),
    state: 'open',
  },
  {
    id: 'prp_cert_class',
    kind: 'risk',
    from: 'agt_warden',
    to: 'R. Venkatesh',
    claim: 'Certificate expiry is a demand class, not a series of incidents',
    detail:
      'pmt-gw edge listener expires in 6 days. Three further certificates expire inside 45 days with no owner recorded against any of them.',
    evidence: [
      { label: 'dc_cert_expiry — 31/yr, 47 hrs/yr, currently unmanaged', ref: 'ev_dd41d1' },
      { label: '4 certificates inside 45 days, 0 with a recorded owner', ref: 'ev_dd41d2' },
    ],
    value: { note: 'Prevents a P1 pattern rather than resolving it faster' },
    source: { kind: 'demand_class', id: 'dc_cert_expiry' },
    requestedDecision: 'Approve automated rotation under AC-41 with canary verification',
    raisedAt: days(-4),
    expiresAt: days(2),
    state: 'open',
  },
  {
    id: 'prp_router_mix',
    kind: 'cost',
    from: 'agt_bursar',
    to: 'C. Duval',
    claim: 'Route classification and extraction steps to the cheapest tier',
    detail:
      'Opus is carrying steps that Haiku resolves at equal agreement. The routing frontier has moved since these skills were authored.',
    evidence: [
      { label: 'Agreement parity on 2,140 replayed classification steps', ref: 'ev_dd41e1' },
      { label: 'Current mix: 74% Opus on steps below the reasoning bar', ref: 'ev_dd41e2' },
    ],
    value: { projectedUsd: 18_900, note: 'Annualised, at current volume, with no measured quality change' },
    requestedDecision: 'Approve routing change and re-baseline the unit-cost ceiling',
    raisedAt: days(-11),
    expiresAt: days(17),
    state: 'open',
  },
  {
    id: 'prp_ftp_deprecate',
    kind: 'transform',
    from: 'agt_prospect',
    to: 'Service governance board',
    claim: 'Complete ta_007 — deprecate the legacy FTP batch interface',
    detail: 'The demand class is already eliminated in practice. The interface remains, and with it the failure mode.',
    evidence: [
      { label: 'dc_ftp_stall — eliminated, 0 occurrences in 90 days', ref: 'ev_dd41f1' },
      { label: 'Run simplification score 0.71', ref: 'ev_dd41f2' },
    ],
    value: { note: 'Retires the interface and its runbook together' },
    source: { kind: 'transform_item', id: 'ta_007' },
    requestedDecision: 'Confirm decommission window',
    raisedAt: days(-31),
    expiresAt: days(-6),
    state: 'accepted',
    decidedBy: 'T. Bergmann (Client Service Owner)',
    decidedNote: 'Approved — 380 credits allocated, kickoff 2027-02-24',
  },
  {
    id: 'prp_claims_contract',
    kind: 'risk',
    from: 'agt_custodian',
    to: 'A. Sørensen (Data Owner)',
    claim: 'Author a data contract for claims_gold',
    detail:
      'Without a contract there is nothing to verify a backfill against, so every pipeline mutation on this asset is capped at Advise. The cap is correct; the absence of the contract is not.',
    evidence: [
      { label: 'Backfill refused — no contract on asset', ref: 'ev_dd41g1' },
      { label: 'Disagreement dis_04 — cap confirmed correct by human review', ref: 'ev_dd41g2' },
    ],
    value: { note: 'Unblocks AC-49 automation on the claims estate' },
    source: { kind: 'action_class', id: 'AC-49' },
    requestedDecision: 'Assign a data steward and target date',
    raisedAt: days(-8),
    expiresAt: days(12),
    state: 'open',
  },
]
