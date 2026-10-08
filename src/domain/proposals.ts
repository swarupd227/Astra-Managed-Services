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
  /** The improvement dimension it serves, where somebody has said which. */
  dimension?: string
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
export function initiativeShare(proposals: Proposal[]): { share: number | null; agentOriginated: number; total: number } {
  const agentOriginated = proposals.filter((p) => p.state !== 'expired').length
  const total = DECISIONS.length + agentOriginated
  // Nothing in front of the board is not a nil share of it.
  return { share: total ? agentOriginated / total : null, agentOriginated, total }
}

/* -------------------------------- The stream -------------------------------- */

/**
 * What the agents have raised and nobody has decided yet.
 *
 * It starts empty. Six proposals were written here — a permission request
 * with 284 replayed runs behind it, an elimination with a costed class, a
 * cost proposal, two accepted with a named client owner's note, one expired
 * unanswered — and the surface counted them as the platform's initiative
 * share. An agent that has not run cannot have raised anything, and a
 * proposal is precisely a thing an agent did.
 *
 * Executors write to this stream when an agent originates work, so the
 * ageing, the expiry and the initiative share all mean something the moment
 * the first one lands.
 */
export const PROPOSALS: Proposal[] = []
