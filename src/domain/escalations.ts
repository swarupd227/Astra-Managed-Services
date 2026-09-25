import { AGENTS } from './estate'
import { Rng } from './rng'
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

/* --------------------------------- The seed --------------------------------- */

/** Runs each agent took in the window, so an escalation rate means something. */
export const RUNS_30D: Record<string, number> = {
  agt_sentinel: 13_400, agt_diagnost: 6_010, agt_remedian: 1_670, agt_forge: 444,
  agt_sentryq: 402, agt_custodian: 1_544, agt_prospect: 2_695, agt_bursar: 772,
  agt_warden: 2_314, agt_archivist: 2_366, agt_herald: 823, agt_concierge: 10_680,
  agt_cl_procure: 136, agt_cl_kyc: 0,
}

/** How often each agent escalates, and what it escalates about. */
const PROFILE: Record<string, { rate: number; reasons: EscalationReason[]; about: string[] }> = {
  agt_sentinel: { rate: 0.004, reasons: ['unknown_signature', 'low_confidence'], about: ['an alert pattern with no match', 'a record with no usable description'] },
  agt_diagnost: { rate: 0.012, reasons: ['unknown_signature', 'no_owner', 'low_confidence'], about: ['a failure signature first seen this month', 'a component with no recorded owner'] },
  agt_remedian: { rate: 0.031, reasons: ['missing_runbook', 'outside_class'], about: ['a host outside its named runbooks', 'a restart on an unlisted service'] },
  agt_forge: { rate: 0.058, reasons: ['missing_runbook', 'low_confidence'], about: ['a change with no test pattern', 'a specification it could not resolve'] },
  agt_sentryq: { rate: 0.042, reasons: ['missing_runbook', 'unknown_signature'], about: ['a vendor release with no regression pack', 'a failing case it could not classify'] },
  agt_custodian: { rate: 0.047, reasons: ['missing_runbook', 'no_owner', 'unapproved_data'], about: ['a pipeline with no recorded owner', 'a dataset with no contract to verify against', 'a store holding personal data it may not read'] },
  agt_prospect: { rate: 0.009, reasons: ['low_confidence', 'no_owner'], about: ['a cluster it could not attribute', 'a demand class with no owner'] },
  agt_bursar: { rate: 0.018, reasons: ['no_owner', 'low_confidence'], about: ['a workload with no cost owner', 'a spend change it could not explain'] },
  agt_warden: { rate: 0.021, reasons: ['outside_class', 'missing_runbook'], about: ['a patch wave outside its window', 'an endpoint with no rollback procedure'] },
  agt_archivist: { rate: 0.036, reasons: ['no_owner', 'unapproved_data'], about: ['a workspace nobody claims', 'a store it has no approval to index'] },
  agt_herald: { rate: 0.006, reasons: ['low_confidence'], about: ['a figure it could not resolve to a source'] },
  agt_concierge: { rate: 0.026, reasons: ['outside_class', 'unapproved_data', 'low_confidence'], about: ['a request with no entitlement rule', 'a licence request for an unapproved tool', 'an approver it could not identify'] },
  agt_cl_procure: { rate: 0.11, reasons: ['no_owner', 'outside_class'], about: ['a submission with no named owner', 'an action it has no class for'] },
  agt_cl_kyc: { rate: 0, reasons: ['low_confidence'], about: [] },
}

const PICKUP_BY: Record<string, string> = {
  agt_sentinel: 'Shift lead', agt_diagnost: 'Resolver on shift', agt_remedian: 'Resolver on shift',
  agt_forge: 'Application lead', agt_sentryq: 'Application lead', agt_custodian: 'Data platform engineer',
  agt_prospect: 'Service delivery manager', agt_bursar: 'Commercial manager', agt_warden: 'Security lead',
  agt_archivist: 'Transition lead', agt_herald: 'Service delivery manager', agt_concierge: 'Service desk lead',
  agt_cl_procure: 'Finance Operations', agt_cl_kyc: 'Marketing Operations',
}

function build(): Escalation[] {
  const rng = new Rng(9_310)
  const out: Escalation[] = []
  for (const a of AGENTS) {
    const p = PROFILE[a.id]
    const runs = RUNS_30D[a.id] ?? 0
    if (!p || !runs || !p.about.length) continue
    const n = Math.max(0, Math.round(runs * p.rate))
    for (let i = 0; i < n; i++) {
      const minsAgo = rng.int(20, 30 * 24 * 60)
      // The most recent few are still waiting; a queue with nothing open would be a fiction.
      const waiting = minsAgo < 240 && rng.next() < 0.5
      const pickup = rng.int(3, 180)
      out.push({
        id: `esc_${a.id.slice(4)}_${i}`,
        agentId: a.id,
        at: new Date(NOW.getTime() - minsAgo * 60_000).toISOString(),
        reason: p.reasons[rng.int(0, p.reasons.length - 1)],
        about: p.about[rng.int(0, p.about.length - 1)],
        pickedUpBy: waiting ? undefined : PICKUP_BY[a.id],
        pickupMins: waiting ? undefined : pickup,
      })
    }
  }
  return out.sort((x, y) => Date.parse(y.at) - Date.parse(x.at))
}

export const ESCALATIONS: Escalation[] = build()

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
  ratePct: number
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
    ratePct: runs ? Math.round((total / runs) * 1000) / 10 : 0,
    waiting: ESCALATIONS.filter((e) => !e.pickedUpBy).length,
    medianPickupMins: median(ESCALATIONS.filter((e) => e.pickupMins !== undefined).map((e) => e.pickupMins!)),
    byReason: [...counts.entries()]
      .map(([reason, v]) => ({ reason, count: v.count, agents: v.agents.size, fix: REASON_FIX[reason] }))
      .sort((a, b) => b.count - a.count),
    heaviest: [...readings].sort((a, b) => (b.ratePct ?? 0) - (a.ratePct ?? 0)).slice(0, 5),
  }
}
