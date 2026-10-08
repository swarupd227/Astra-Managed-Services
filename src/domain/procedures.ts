import { AGENT_BY_ID } from './estate'
import { ENGAGEMENT, ENGAGEMENT_BY_ID, type Engagement } from './engagement'
import { ACTION_CLASSES } from './reference'
import { NOW, WORK_OBJECTS } from './workSeed'

/* ==========================================================================
   Procedures — the maintenance procedures and runbooks themselves.

   The contract asks for procedures to be developed, documented, maintained
   and reviewed. Doing the work is elsewhere in the platform; this is the
   register of the procedures, which is what "document and maintain" needs an
   object for, and what "review" needs a clock against.

   Two taxonomies, layered the way service lines already are. The platform
   carries standard areas — what we bring, reusable and comparable across
   clients. The engagement carries the areas its own contract names, in its
   own words, each mapped to a standard area where one fits. Coverage is
   reported against the client's list; reuse is read off ours.

   The client's list is not assumed. Until somebody adopts it against a
   clause reference, the register says so and scores nothing: a coverage
   figure computed against a list nobody filed would be the most flattering
   number here and the least true.

   A procedure is not a document an agent reads. It is the skill, the action
   classes it authorises and the verification pack that proves a run of it
   worked — so execution counts are read from the work the platform actually
   did, and a current procedure nobody has executed is reported as dormant
   rather than quietly counted as coverage.
   ========================================================================== */

export interface StandardArea {
  id: string
  name: string
  /** What a procedure in this area has to cover to be worth having. */
  expects: string
}

/** What the platform offers. An engagement names its own and maps onto these. */
export const STANDARD_AREAS: StandardArea[] = [
  { id: 'sa_triage', name: 'Incident triage', expects: 'How work is classified, enriched and routed, and what happens to anything unrecognised' },
  { id: 'sa_escalation', name: 'Escalation', expects: 'Who an agent escalates to, on what trigger, and the clock that applies to each hop' },
  { id: 'sa_corrective', name: 'Corrective maintenance', expects: 'The repairs that may be made, each with its rollback and the probe that proves it worked' },
  { id: 'sa_problem', name: 'Problem management', expects: 'How recurrence becomes a named cause with an owner, a costed fix and a verification window' },
  { id: 'sa_release', name: 'Release support', expects: 'How a release is gated, what blocks it, and who may override a freeze' },
  { id: 'sa_regression', name: 'Regression testing', expects: 'How a pack is selected or generated for a change, and what a failure stops' },
  { id: 'sa_patching', name: 'Patching', expects: 'Wave composition, canary criteria and the health probe each wave must pass' },
  { id: 'sa_saas', name: 'SaaS coordination', expects: 'How a vendor case is raised and chased against its contracted response, and what is held pending' },
  { id: 'sa_config', name: 'Configuration changes', expects: 'What a baseline is, how drift is detected, and the path back to last-known-good' },
  { id: 'sa_knowledge', name: 'Knowledge capture', expects: 'How a claim becomes a verified assertion with a named verifier and an expiry' },
  { id: 'sa_handoff', name: 'Service handoffs', expects: 'What passes between shifts, teams and providers, and the test each artefact must pass' },
  { id: 'sa_monitoring', name: 'Monitoring and alerting', expects: 'What is watched, the threshold that raises work, and who owns a noisy signal' },
  { id: 'sa_capacity', name: 'Capacity and performance', expects: 'What is measured, the headroom that triggers action, and who approves spend' },
]

export const STANDARD_BY_ID = Object.fromEntries(STANDARD_AREAS.map((a) => [a.id, a])) as Record<string, StandardArea>

/* ------------------------------ The client's areas --------------------------- */

/** An area as one client's contract names it. */
export interface ContractArea {
  id: string
  /** The client's own words, not ours. */
  name: string
  /** The standard area it maps onto. Absent where the platform offers nothing for it. */
  standardId?: string
}

/**
 * The client's list, adopted into the register by a person against a clause.
 * Filed in the contract is not the same as loaded here: one is a document,
 * the other is somebody putting their name to it.
 */
export interface AreaLoad {
  engagementId: string
  at: string
  by: string
  role: string
  /** The clause or attachment the list came from. */
  reference: string
  areas: ContractArea[]
  evidenceId?: string
}

/* -------------------------------- Procedures --------------------------------- */

export type ProcedureState = 'draft' | 'current' | 'retired'

export const PROCEDURE_STATE_LABEL: Record<ProcedureState, string> = {
  draft: 'Draft', current: 'Current', retired: 'Retired',
}

export interface Procedure {
  id: string
  engagementId: string
  /** What it is about, in the platform's taxonomy. The client's area maps to this. */
  standardAreaId: string
  name: string
  version: string
  state: ProcedureState
  /** The role answerable for it. */
  owner: string
  /** Who wrote it: an agent id, or a person. */
  author: string
  lastReviewedAt: string
  /** How often the contract expects it reviewed. */
  reviewEveryDays: number
  /** The agents that execute it. */
  agents: string[]
  /** What it authorises them to do. */
  actionClasses: string[]
  /** What proves a run of it worked. Null for a procedure that decides rather than acts. */
  verificationPack: string | null
  /** Where it is written down. */
  reference: string
}

export interface Review {
  procedureId: string
  at: string
  by: string
  role: string
  /** What changed, or that nothing did. */
  changed: string
  version: string
  evidenceId?: string
}

/**
 * The procedures written for this engagement.
 *
 * The register starts empty. Twelve were listed here — triage, escalation,
 * restart, defect, problem, release, regression, patching, SaaS, config,
 * knowledge and handover — each with a version, an author, a last-reviewed
 * date and a runbook reference like RB-B3-001. The register then reported
 * how much of the client's own filed area list was covered, and the
 * procedures_current commitment was measured against it.
 *
 * A procedure exists when somebody has written it. The client's area list
 * says which ones are owed, which is what the register measures coverage
 * against; writing one is an action with an author, a review date and a
 * reference, and the platform records it when that happens.
 */
export const PROCEDURES: Procedure[] = []

/* --------------------------------- Readings ---------------------------------- */

const DAY = 86_400_000
const KNOWN_CLASS = new Set(ACTION_CLASSES.map((c) => c.id))

export interface ProcedureReading {
  procedure: Procedure
  /** Days until its review is due; negative once overdue. */
  dueInDays: number
  stale: boolean
  /** Times the platform saw its action classes executed in the window. */
  executions: number
  /** Current, and never executed in the window: dead, or being bypassed. */
  dormant: boolean
  reviews: Review[]
  /** Action classes it names that the engine does not know. */
  unknownClasses: string[]
}

export interface AreaReading {
  area: ContractArea
  standard: StandardArea | null
  procedures: ProcedureReading[]
  /** At least one current procedure. */
  covered: boolean
  stale: number
}

export interface ProcedureRegister {
  engagement: Engagement
  /** Null until somebody adopts the client's list against a clause. */
  load: AreaLoad | null
  areas: AreaReading[]
  procedures: ProcedureReading[]
  covered: number
  gaps: AreaReading[]
  staleCount: number
  dormantCount: number
  draftCount: number
  /** Areas the client's contract names that the platform offers nothing for. */
  unmapped: ContractArea[]
  /** Standard areas the client's contract does not name. Ours, not theirs. */
  notInContract: StandardArea[]
  nextReview: ProcedureReading | null
}

/**
 * How many times the platform executed a procedure in the window, read from
 * the work itself: an item whose autonomy decision carried one of the
 * procedure's action classes ran under that procedure.
 */
function executionsOf(p: Procedure, work = WORK_OBJECTS): number {
  if (!p.actionClasses.length) return 0
  return work.filter((w) => w.autonomy?.actionClasses.some((c) => p.actionClasses.includes(c))).length
}

export function readProcedure(p: Procedure, nowMs: number, reviews: Review[]): ProcedureReading {
  const mine = reviews.filter((r) => r.procedureId === p.id).sort((a, b) => b.at.localeCompare(a.at))
  const lastReviewed = Date.parse(mine[0]?.at ?? p.lastReviewedAt)
  const dueInDays = Math.ceil((lastReviewed + p.reviewEveryDays * DAY - nowMs) / DAY)
  const executions = executionsOf(p)
  return {
    procedure: mine[0] ? { ...p, version: mine[0].version, lastReviewedAt: mine[0].at } : p,
    dueInDays,
    stale: p.state === 'current' && dueInDays < 0,
    executions,
    dormant: p.state === 'current' && p.actionClasses.length > 0 && executions === 0,
    reviews: mine,
    unknownClasses: p.actionClasses.filter((c) => !KNOWN_CLASS.has(c)),
  }
}

export function readProcedures(
  opts: { engagementId?: string; loads?: AreaLoad[]; reviews?: Review[]; nowMs?: number } = {},
): ProcedureRegister {
  const engagementId = opts.engagementId ?? ENGAGEMENT.id
  const engagement = ENGAGEMENT_BY_ID[engagementId] ?? ENGAGEMENT
  const nowMs = opts.nowMs ?? NOW.getTime()
  const reviews = opts.reviews ?? []

  const load = [...(opts.loads ?? [])]
    .filter((l) => l.engagementId === engagementId)
    .sort((a, b) => b.at.localeCompare(a.at))[0] ?? null

  const procedures = PROCEDURES
    .filter((p) => p.engagementId === engagementId && p.state !== 'retired')
    .map((p) => readProcedure(p, nowMs, reviews))

  const areas: AreaReading[] = (load?.areas ?? []).map((area) => {
    const mine = procedures.filter((r) => r.procedure.standardAreaId === area.standardId)
    return {
      area,
      standard: area.standardId ? STANDARD_BY_ID[area.standardId] ?? null : null,
      procedures: mine,
      covered: mine.some((r) => r.procedure.state === 'current'),
      stale: mine.filter((r) => r.stale).length,
    }
  })

  const named = new Set((load?.areas ?? []).map((a) => a.standardId).filter(Boolean))
  return {
    engagement,
    load,
    areas,
    procedures,
    covered: areas.filter((a) => a.covered).length,
    gaps: areas.filter((a) => !a.covered),
    staleCount: procedures.filter((r) => r.stale).length,
    dormantCount: procedures.filter((r) => r.dormant).length,
    draftCount: procedures.filter((r) => r.procedure.state === 'draft').length,
    unmapped: (load?.areas ?? []).filter((a) => !a.standardId),
    notInContract: STANDARD_AREAS.filter((s) => !named.has(s.id)),
    nextReview: [...procedures].filter((r) => r.procedure.state === 'current').sort((a, b) => a.dueInDays - b.dueInDays)[0] ?? null,
  }
}

export const agentName = (id: string) => AGENT_BY_ID[id]?.name ?? id

/** Procedures attached to an area, for the refusal that stops a gap being deleted. */
export const proceduresInArea = (engagementId: string, standardId?: string): Procedure[] =>
  standardId ? PROCEDURES.filter((p) => p.engagementId === engagementId && p.standardAreaId === standardId && p.state !== 'retired') : []
