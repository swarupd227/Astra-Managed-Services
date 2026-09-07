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
    claim: 'Raise AC-41 from L2 Approve-first to L3 Supervised on the Application Development & Integration estate',
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
      scope: 'Application Development & Integration estate only — no change requested on tier-0 nodes',
      conditions: '8-week enhanced sampling; automatic demotion on any Sev-attributable error',
      simulation: 'Replayed against 284 historical runs: 0 decisions would have differed under L3 with the abort window.',
    },
  },
  {
    id: 'prp_mulesoft_runbook',
    kind: 'risk',
    from: 'agt_prospect',
    to: 'Service governance board',
    claim: 'Formalise a backup-maintainer runbook for the Mulesoft integration hub before the bus-factor-of-one becomes an outage',
    detail:
      'All Salesforce↔SAP integration traffic depends on one named user with undocumented, tribal knowledge of the Anypoint deployment. A failover runbook exists for the pipeline itself, but nothing lets a second engineer maintain or extend it. The bridge has already gone unmonitored three times when that one person was unavailable.',
    evidence: [
      { label: 'ke_mulesoft_soleowner — 3 occurrences since first seen 2026-06-02', ref: 'ev_dd41c1' },
      { label: 'app_mulesoft — 1 named user on prod-centralus, no documented deployment runbook', ref: 'ev_dd41c2' },
      { label: 'rb_mulesoft_failover covers pipeline recovery only, not maintainer onboarding', ref: 'ev_dd41c3' },
    ],
    value: { note: 'Removes a single-point-of-failure risk rather than treating another outage after the fact' },
    requestedDecision: 'Fund a knowledge-capture engagement and name a backup maintainer',
    raisedAt: days(-23),
    expiresAt: days(-2),
    state: 'open',
  },
  {
    id: 'prp_endpoint_dedupe',
    kind: 'risk',
    from: 'agt_warden',
    to: 'R. Venkatesh',
    claim: 'Consolidate the three concurrent endpoint-security stacks contending for CPU on Digital Workplace endpoints',
    detail:
      'Three endpoint-security agents run in parallel across the fleet, each installed under a different prior vendor engagement and never rationalised. The contention between them is now driving support volume, not just wasting license spend.',
    evidence: [
      { label: 'ke_triple_av — 41 occurrences since first seen 2025-09-11', ref: 'ev_dd41d1' },
      { label: 'rb_endpoint_dedupe human-verified, 87.0% success — treats symptom only', ref: 'ev_dd41d2' },
      { label: 'Infrastructure — Security (twr_secops) carries 9,718 of 28,028 incidents/yr, the largest single category', ref: 'ev_dd41d3' },
    ],
    value: { note: 'Removes the contention rather than triaging its symptoms endpoint by endpoint' },
    requestedDecision: 'Approve consolidation onto the single retained stack under AC-52 canaried waves',
    raisedAt: days(-4),
    expiresAt: days(2),
    state: 'open',
  },
  {
    id: 'prp_router_mix',
    kind: 'cost',
    from: 'agt_bursar',
    to: 'J. Whitcombe',
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
    decidedBy: 'R. Castellano (Client Service Owner)',
    decidedNote: 'Approved — 380 credits allocated, kickoff 2027-02-24',
  },
  {
    id: 'prp_cmdb_reconcile',
    kind: 'risk',
    from: 'agt_archivist',
    to: 'M. Osei (IT Operations / CMDB Owner)',
    claim: 'Reconcile the 55 shadow-IT applications outside Attachment C.4 into the CMDB',
    detail:
      'Every one of these apps already generates incident volume the platform has to route blind — with no CI record there is no owner, no service mapping, and no graph assertion to verify a fix against. The reconciliation gap between the SOW-scoped inventory and total incident volume tracks the shadow estate almost exactly.',
    evidence: [
      { label: 'da_cmdb_gap — 55 apps outside Attachment C.4', ref: 'ev_dd41g1' },
      { label: '1,979 incidents/yr against unmapped apps — 13,134 of 28,028 incidents/yr reconciled to date', ref: 'ev_dd41g2' },
    ],
    value: { note: 'Unblocks accurate blast-radius and SLA attribution once the 55 apps are mapped' },
    requestedDecision: 'Assign a service-mapping sprint and a target completion date',
    raisedAt: days(-8),
    expiresAt: days(12),
    state: 'open',
  },
]
