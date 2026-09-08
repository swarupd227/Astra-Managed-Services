import { AGENTS, AGENT_BY_ID, GRAPH_NODES, POLICIES, SKILLS, TOWERS } from './estate'
import { ACTION_CLASSES } from './reference'
import { DEMAND_CLASSES } from './ledgers'
import type { AgentProposal } from './agentRuntime'
import type { EvidenceRecord, ISO, WorkObject } from './types'

/* ==========================================================================
   AI Incident detection.

   Four classes, one detector each, all pure functions over things the
   platform already holds — the proposal, the estate, the evidence chain and
   the work list. Nothing here calls a model: a detector that needed one
   could be fooled by the thing it was checking.
   ========================================================================== */

export type AiIncidentClass = 'fabrication' | 'discriminatory_pattern' | 'security_compromise' | 'oversight_failure'

export interface AiIncidentSignal {
  class: AiIncidentClass
  detector: string
  summary: string
  details: string[]
  /** True when the finding bears on a mutation of the estate — the case the contract cares about. */
  consequential: boolean
}

export interface AiIncident {
  id: string
  class: AiIncidentClass
  severity: 'P1' | 'P2' | 'P3'
  detector: string
  summary: string
  details: string[]
  detectedAt: ISO
  agentId?: string
  systemId?: string
  /** The finding work object raised for it, so it sits in the same queues as any other work. */
  workObjectId?: string
  runRef?: string
  /** Clocks — notification and root-cause analysis. */
  notifyDueAt: ISO
  rcaDueAt: ISO
  state: 'open' | 'notified' | 'rca_published' | 'closed'
  notifiedAt?: ISO
  rcaPublishedAt?: ISO
  rcaSummary?: string
  closedAt?: ISO
  evidenceIds: string[]
}

export const NOTIFY_HOURS = 24
export const RCA_BUSINESS_DAYS = 5

export function addBusinessDays(iso: ISO, days: number): ISO {
  const d = new Date(iso)
  let left = days
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--
  }
  return d.toISOString()
}

export function clocksFor(detectedAt: ISO): { notifyDueAt: ISO; rcaDueAt: ISO } {
  return {
    notifyDueAt: new Date(new Date(detectedAt).getTime() + NOTIFY_HOURS * 3600 * 1000).toISOString(),
    rcaDueAt: addBusinessDays(detectedAt, RCA_BUSINESS_DAYS),
  }
}

export const INCIDENT_CLASS_META: Record<AiIncidentClass, { label: string; clause: string }> = {
  fabrication: { label: 'Fabrication', clause: 'material fabrication in a consequential action' },
  discriminatory_pattern: { label: 'Discriminatory pattern', clause: 'sustained disparity in outcomes across cohorts' },
  security_compromise: { label: 'Security compromise', clause: 'prompt injection, canary leakage or tool misuse' },
  oversight_failure: { label: 'Oversight failure', clause: 'an action executed without the human control the decision required' },
}

/* ------------------------------ Estate identifiers --------------------------- */

export interface EstateIds {
  agents: Set<string>
  skills: Set<string>
  actionClasses: Set<string>
  known: Set<string>
}

/** Every identifier the estate digest hands the model, so a citation can be checked. */
export function estateIds(): EstateIds {
  const agents = new Set(AGENTS.map((a) => a.id))
  const skills = new Set(SKILLS.map((s) => s.id))
  const actionClasses = new Set(ACTION_CLASSES.map((c) => c.id))
  const known = new Set<string>([
    ...agents, ...skills, ...actionClasses,
    ...GRAPH_NODES.map((n) => n.id),
    ...TOWERS.map((t) => t.id),
    ...DEMAND_CLASSES.map((d) => d.id),
    ...POLICIES.map((p) => p.id),
  ])
  return { agents, skills, actionClasses, known }
}

// Identifiers in this estate follow prefix_snake conventions plus AC-nn codes.
const ID_TOKEN = /\b(?:agt|sk|dc|twr|svc|app|db|inf|net|if|rb|ke|da|pipe|pol|es|msn|prp)_[a-z0-9_]+\b|\bAC-\d{2}\b/g

function citedIds(text: string): string[] {
  return [...new Set(text.match(ID_TOKEN) ?? [])]
}

/* --------------------------------- Fabrication ------------------------------ */

/**
 * A proposal that routes to an agent, names a skill, an action class or an
 * estate entity that does not exist, or claims to have relied on more verified
 * knowledge than it retrieved.
 */
export function detectFabrication(p: AgentProposal, ids: EstateIds = estateIds()): AiIncidentSignal | null {
  const details: string[] = []

  if (!ids.agents.has(p.routed_agent)) details.push(`Routed to agent "${p.routed_agent}", which is not on the roster.`)
  if (p.skill && p.skill !== 'none' && !ids.skills.has(p.skill)) details.push(`Names skill "${p.skill}", which is not in the registry.`)
  if (p.action_class && p.action_class !== 'none' && !ids.actionClasses.has(p.action_class)) details.push(`Proposes action class "${p.action_class}", which does not exist.`)
  for (const s of p.steps ?? []) {
    if (s.action_class && s.action_class !== 'none' && !ids.actionClasses.has(s.action_class)) {
      details.push(`Step "${s.label}" carries action class "${s.action_class}", which does not exist.`)
    }
  }

  const cu = p.context_used
  if (cu && cu.human_verified > cu.assertions) {
    details.push(`Claims ${cu.human_verified} human-verified assertions out of ${cu.assertions} retrieved.`)
  }
  // A citation that resolves to nothing is the plainest fabrication there is:
  // the proposal named the record it relied on, and the record is not there.
  const badCitations = (cu?.cited ?? []).filter((id) => !ids.known.has(id))
  if (badCitations.length) details.push(`Cites records that do not exist in the estate: ${badCitations.join(', ')}.`)

  const prose = [p.routing_note, p.finding?.title, p.finding?.detail, ...(p.steps ?? []).map((s) => `${s.label} ${s.compensation}`)].filter(Boolean).join('\n')
  const unresolved = citedIds(prose).filter((id) => !ids.known.has(id))
  if (unresolved.length) details.push(`Cites identifiers that do not resolve in the estate: ${unresolved.join(', ')}.`)

  if (!details.length) return null

  const consequential = Boolean(p.requires_action && p.steps?.length)
  return {
    class: 'fabrication',
    detector: 'groundedness',
    summary: consequential
      ? `Fabrication in a consequential proposal — ${details.length} unresolved reference${details.length === 1 ? '' : 's'}; the plan was refused before the policy engine saw it.`
      : `Unresolved reference${details.length === 1 ? '' : 's'} in a read-only answer — recorded, not escalated.`,
    details,
    consequential,
  }
}

/* ------------------------------- Tool anomaly ------------------------------- */

const DIAGNOSTIC_INTENT = /^(diagnose|analyse|analyze|report|explain|summari[sz]e|review|assess)\b/i

/**
 * Security compromise by tool misuse: a proposal that tries to act on a
 * diagnostic intent, or whose steps use action classes the routed agent was
 * never granted or is prohibited from. A successful injection usually shows
 * up here before it shows up anywhere else.
 */
export function detectToolAnomaly(p: AgentProposal): AiIncidentSignal | null {
  const details: string[] = []
  const agent = AGENT_BY_ID[p.routed_agent]

  if (p.requires_action && DIAGNOSTIC_INTENT.test(p.intent ?? '')) {
    details.push(`Proposes a mutation (${p.action_class}) for a diagnostic intent "${p.intent}".`)
  }
  if (agent) {
    const classes = [p.action_class, ...(p.steps ?? []).map((s) => s.action_class)].filter((c) => c && c !== 'none')
    for (const c of new Set(classes)) {
      if (agent.prohibited.includes(c)) details.push(`Uses ${c}, which ${agent.name} is prohibited from.`)
      else if (!agent.grants[c] && c !== 'AC-05') details.push(`Uses ${c}, which ${agent.name} holds no grant for.`)
    }
  }
  if (!details.length) return null
  return {
    class: 'security_compromise',
    detector: 'tool_anomaly',
    summary: p.requires_action
      ? `Tool misuse in a consequential proposal — ${details.length} anomal${details.length === 1 ? 'y' : 'ies'}; refused before the policy engine saw it.`
      : `Tool anomaly in a read-only answer — recorded, not escalated.`,
    details,
    consequential: Boolean(p.requires_action),
  }
}

/* ------------------------------ Oversight audit ----------------------------- */

export interface OversightFailure {
  evidenceId: string
  workObjectId?: string
  reason: string
}

export interface OversightAudit {
  checked: number
  failures: OversightFailure[]
}

/**
 * Runs on the chain itself, so the runtime cannot bypass it: every executed
 * action whose decision required a human must have that human's approval
 * earlier in the chain, and nothing may execute while the platform brake is on.
 */
export function auditOversight(evidence: EvidenceRecord[], work: Record<string, WorkObject>): OversightAudit {
  const ordered = [...evidence].sort((a, b) => a.seq - b.seq)

  // Platform-wide brake windows, from the records that opened and closed them.
  const windows: { from: number; to: number }[] = []
  let openAt: number | null = null
  for (const r of ordered) {
    if (r.kind !== 'decision') continue
    if (/^Autonomy brake applied — platform-wide/.test(r.summary) && openAt === null) openAt = new Date(r.at).getTime()
    if (/^Autonomy brake released — platform-wide/.test(r.summary) && openAt !== null) { windows.push({ from: openAt, to: new Date(r.at).getTime() }); openAt = null }
  }
  if (openAt !== null) windows.push({ from: openAt, to: Number.POSITIVE_INFINITY })

  const failures: OversightFailure[] = []
  let checked = 0
  for (const r of ordered) {
    if (r.kind !== 'action') continue
    checked++
    const wo = r.workObjectId ? work[r.workObjectId] : undefined
    if (wo?.autonomy?.mode === 'approve_first') {
      const approved = ordered.some((a) => a.kind === 'approval' && a.workObjectId === r.workObjectId && a.seq < r.seq)
      if (!approved) failures.push({ evidenceId: r.id, workObjectId: r.workObjectId, reason: `${wo.ref} executed under an approve-first decision with no approval earlier in the chain.` })
    }
    const t = new Date(r.at).getTime()
    if (windows.some((w) => t >= w.from && t <= w.to)) {
      failures.push({ evidenceId: r.id, workObjectId: r.workObjectId, reason: `${wo?.ref ?? r.id} executed while the platform-wide brake was on.` })
    }
  }
  return { checked, failures }
}

export function oversightSignal(audit: OversightAudit): AiIncidentSignal | null {
  if (!audit.failures.length) return null
  return {
    class: 'oversight_failure',
    detector: 'chain_audit',
    summary: `${audit.failures.length} action${audit.failures.length === 1 ? '' : 's'} in the evidence chain executed without the human control the decision required.`,
    details: audit.failures.map((f) => f.reason),
    consequential: true,
  }
}

/* ------------------------------- Cohort monitor ----------------------------- */

export interface CohortRule {
  id: string
  label: string
  test: RegExp
  /** Example markers the bias suite can plant in prose, e.g. "Singapore office". */
  samples?: string[]
}

export interface CohortStat {
  id: string
  label: string
  n: number
  urgentRate: number
  gatedRate: number
  agentRate: number
  /** Two-proportion z against the rest of the population, per metric. */
  z: { urgent: number; gated: number; agent: number }
  flagged: boolean
}

export interface CohortReport {
  cohorts: CohortStat[]
  overall: { n: number; urgentRate: number; gatedRate: number; agentRate: number }
  threshold: number
  minN: number
}

function zTest(k1: number, n1: number, k2: number, n2: number): number {
  if (!n1 || !n2) return 0
  const p1 = k1 / n1, p2 = k2 / n2, p = (k1 + k2) / (n1 + n2)
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
  return se ? (p1 - p2) / se : 0
}

/**
 * Discriminatory pattern: sustained disparity in how work from different
 * cohorts is prioritised, gated or handed to agents. The cohorts are data —
 * an estate declares them — and a single case never flags; a population does.
 */
export function cohortMonitor(work: WorkObject[], rules: CohortRule[], { threshold = 2.5, minN = 20 } = {}): CohortReport {
  const urgent = (w: WorkObject) => w.priority === 'P1' || w.priority === 'P2'
  const gated = (w: WorkObject) => w.state === 'gated' || w.autonomy?.mode === 'approve_first'
  const agent = (w: WorkObject) => w.assigneeKind === 'agent'
  const count = (list: WorkObject[]) => ({ n: list.length, u: list.filter(urgent).length, g: list.filter(gated).length, a: list.filter(agent).length })

  const all = count(work)
  const cohorts: CohortStat[] = rules.map((rule) => {
    const inC = work.filter((w) => rule.test.test(w.title))
    const rest = work.filter((w) => !rule.test.test(w.title))
    const c = count(inC), r = count(rest)
    const z = { urgent: zTest(c.u, c.n, r.u, r.n), gated: zTest(c.g, c.n, r.g, r.n), agent: zTest(c.a, c.n, r.a, r.n) }
    return {
      id: rule.id, label: rule.label, n: c.n,
      urgentRate: c.n ? c.u / c.n : 0, gatedRate: c.n ? c.g / c.n : 0, agentRate: c.n ? c.a / c.n : 0,
      z,
      flagged: c.n >= minN && Math.max(Math.abs(z.urgent), Math.abs(z.gated), Math.abs(z.agent)) >= threshold,
    }
  })
  return {
    cohorts,
    overall: { n: all.n, urgentRate: all.n ? all.u / all.n : 0, gatedRate: all.n ? all.g / all.n : 0, agentRate: all.n ? all.a / all.n : 0 },
    threshold, minN,
  }
}

export function cohortSignal(report: CohortReport): AiIncidentSignal | null {
  const flagged = report.cohorts.filter((c) => c.flagged)
  if (!flagged.length) return null
  return {
    class: 'discriminatory_pattern',
    detector: 'cohort_monitor',
    summary: `${flagged.length} cohort${flagged.length === 1 ? '' : 's'} show${flagged.length === 1 ? 's' : ''} disparity beyond |z| ≥ ${report.threshold} against the rest of the estate.`,
    details: flagged.map((c) => `${c.label} (n=${c.n}): urgent z=${c.z.urgent.toFixed(2)}, gated z=${c.z.gated.toFixed(2)}, agent-handled z=${c.z.agent.toFixed(2)}.`),
    consequential: false,
  }
}
