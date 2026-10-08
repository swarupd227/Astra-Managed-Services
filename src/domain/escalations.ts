import { AGENTS } from './estate'
import { NOW } from './workSeed'
import type { ISO } from './types'

/* ==========================================================================
   Escalations — what an agent handed back to a person, and why.

   The design decision the whole model rests on is that an agent escalates
   rather than guesses. A missing runbook, an error signature it has not seen,
   an item with no recorded owner, a class of data it has not been approved
   for, or a confidence below its own bar all end the same way: the agent
   stops and a named person picks it up.

   That costs automation rate, deliberately. It is also the number a client
   will ask for, so it is measured rather than asserted: how often each agent
   escalated, for which reason, how long it waited to be picked up, and how
   much of its work that represents. The reason mix is the useful part — a
   fleet escalating on missing runbooks has a knowledge gap, one escalating on
   unapproved data classes has a governance gap, and the two want different
   work.
   ========================================================================== */

export type EscalationReason =
  | 'missing_runbook' | 'unknown_signature' | 'no_owner' | 'unapproved_data' | 'low_confidence' | 'outside_class'

export const REASON_LABEL: Record<EscalationReason, string> = {
  missing_runbook: 'No runbook for it',
  unknown_signature: 'Error signature not seen before',
  no_owner: 'No recorded owner',
  unapproved_data: 'Data class it may not touch',
  low_confidence: 'Below its own confidence bar',
  outside_class: 'Outside its action classes',
}

/** What each reason says needs fixing, in the platform's own terms. */
export const REASON_FIX: Record<EscalationReason, string> = {
  missing_runbook: 'Write the runbook and verify it',
  unknown_signature: 'Add the signature to the context pack',
  no_owner: 'Record an owner in the register',
  unapproved_data: 'Approve the class or leave it with people',
  low_confidence: 'Evaluate and retrain the routing, or accept the escalation',
  outside_class: 'Grant the class, or route it elsewhere',
}

export interface Escalation {
  id: string
  agentId: string
  at: ISO
  reason: EscalationReason
  /** What it was working on. */
  about: string
  /** Who picked it up. Absent while it is still waiting. */
  pickedUpBy?: string
  /** Minutes from escalation to pick-up. Absent while it is still waiting. */
  pickupMins?: number
}

/* -------------------------------- The register -------------------------------- */

/**
 * Runs each agent took in the window, and the hand-backs themselves.
 *
 * Both start empty, and both are filled by the runtime: an agent that runs
 * writes a run, and an agent that stops writes an escalation. There was a
 * profile here — a per-agent escalation rate multiplied by an invented run
 * count — which produced 764 hand-backs across 43,256 runs, each with a
 * reason, a named picker-up and a pick-up time. Not one had happened. The
 * reason mix is the most diagnostic figure the fleet produces, so inventing
 * it taught a client to read a knowledge gap or a governance gap that was
 * nothing but a seed.
 *
 * The vocabulary above stays: the reasons an agent may stop, and what each
 * one says needs fixing, are platform design rather than observation.
 */
export const RUNS_30D: Record<string, number> = {}

export const ESCALATIONS: Escalation[] = []

/* --------------------------------- Readings --------------------------------- */

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}

export interface EscalationReading {
  agentId: string
  count: number
  runs: number
  /** Escalations as a percentage of runs. Null where the agent has not run. */
  ratePct: number | null
  /** Still waiting for a person. */
  waiting: number
  medianPickupMins: number | null
  /** Longest wait among those still open, in minutes. */
  oldestWaitingMins: number | null
  byReason: { reason: EscalationReason; count: number }[]
}

export function readEscalations(agentId: string, nowMs = NOW.getTime()): EscalationReading {
  const mine = ESCALATIONS.filter((e) => e.agentId === agentId)
  const runs = RUNS_30D[agentId] ?? 0
  const waiting = mine.filter((e) => !e.pickedUpBy)
  const counts = new Map<EscalationReason, number>()
  for (const e of mine) counts.set(e.reason, (counts.get(e.reason) ?? 0) + 1)
  return {
    agentId,
    count: mine.length,
    runs,
    ratePct: runs ? Math.round((mine.length / runs) * 1000) / 10 : null,
    waiting: waiting.length,
    medianPickupMins: median(mine.filter((e) => e.pickupMins !== undefined).map((e) => e.pickupMins!)),
    oldestWaitingMins: waiting.length ? Math.max(...waiting.map((e) => Math.round((nowMs - Date.parse(e.at)) / 60_000))) : null,
    byReason: [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  }
}

export interface FleetEscalations {
  total: number
  runs: number
  /** Null until the fleet has run: no runs is not a zero rate. */
  ratePct: number | null
  waiting: number
  medianPickupMins: number | null
  byReason: { reason: EscalationReason; count: number; agents: number; fix: string }[]
  /** Agents escalating most, as a share of their own runs. */
  heaviest: EscalationReading[]
}

export function escalationSummary(nowMs = NOW.getTime()): FleetEscalations {
  const readings = AGENTS.map((a) => readEscalations(a.id, nowMs)).filter((r) => r.runs > 0)
  const runs = readings.reduce((n, r) => n + r.runs, 0)
  const total = readings.reduce((n, r) => n + r.count, 0)
  const counts = new Map<EscalationReason, { count: number; agents: Set<string> }>()
  for (const e of ESCALATIONS) {
    const seen = counts.get(e.reason) ?? { count: 0, agents: new Set<string>() }
    seen.count++
    seen.agents.add(e.agentId)
    counts.set(e.reason, seen)
  }
  return {
    total,
    runs,
    ratePct: runs ? Math.round((total / runs) * 1000) / 10 : null,
    waiting: ESCALATIONS.filter((e) => !e.pickedUpBy).length,
    medianPickupMins: median(ESCALATIONS.filter((e) => e.pickupMins !== undefined).map((e) => e.pickupMins!)),
    byReason: [...counts.entries()]
      .map(([reason, v]) => ({ reason, count: v.count, agents: v.agents.size, fix: REASON_FIX[reason] }))
      .sort((a, b) => b.count - a.count),
    heaviest: [...readings].sort((a, b) => (b.ratePct ?? 0) - (a.ratePct ?? 0)).slice(0, 5),
  }
}
