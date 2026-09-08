import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { appendRecord, verifyChain, type ChainVerification } from './evidence'
import { EVIDENCE, NOW, RUNS, WORK_OBJECTS } from './workSeed'
import { ASSERTIONS } from './knowledge'
import { AGENTS, TOWER_BY_ID } from './estate'
import { ROLE_BY_ID } from './reference'
import { auditOversight, clocksFor, oversightSignal, type AiIncident, type AiIncidentSignal, type OversightAudit } from './aiIncident'
import type { RedTeamResult } from './redTeam'
import type { BiasResult } from './biasSuite'
import type { ConformanceRun } from './conformance'
import { driftReport, type DriftReport } from './drift'
import { modelChangeClocks, type ModelChange } from './changeLog'
import { deletionManifest, manifestHash, nextAttestationDue, type Attestation, type DeletionCertificate } from './dataHandling'
import { ATTESTATIONS } from './dataHandlingSeed'
import { BUDGET_WARN, MISSIONS, budgetExhausted, budgetUse, type Mission } from './missions'
import { PROPOSALS, type Proposal, type ProposalState } from './proposals'
import { absorbedText, assertionReach, planReach, type Lesson, type LessonKind } from './teaching'
import { digest } from './rng'
import { brakeOf, type Suspension, type SuspensionScope } from './suspensions'
import type {
  Agent, Assertion, EvidenceRecord, Run, TimelineEntry, WorkObject, WorkState,
} from './types'

export type ThemeMode = 'dark' | 'light'
export type Density = 'compact' | 'comfortable'

export interface Toast {
  id: string
  title: string
  body?: string
  tone: 'ok' | 'warn' | 'crit' | 'info'
  evidenceId?: string
}

interface MajorIncident {
  active: boolean
  declaredAt: string | null
  declaredBy: string | null
  workObjectId: string | null
  title: string
  timeline: TimelineEntry[]
  roles: { role: string; person: string }[]
  actions: { id: string; text: string; owner: string; dueMins: number; done: boolean }[]
}

interface State {
  /* preferences */
  roleId: string
  theme: ThemeMode
  density: Density
  simRunning: boolean
  tick: number
  clockOffsetMins: number

  /* domain */
  work: Record<string, WorkObject>
  runs: Record<string, Run>
  evidence: EvidenceRecord[]
  assertions: Assertion[]
  agents: Record<string, Agent>
  missions: Record<string, Mission>
  proposals: Record<string, Proposal>
  /** Newest first. What the workforce has been taught, and what each lesson reached. */
  lessons: Lesson[]

  /* control */
  /** Derived from `suspensions` — kept so every existing reader of the brake keeps working. */
  brake: { global: boolean; towers: string[] }
  /** The record: every suspension in force, with who directed it and why. */
  suspensions: Suspension[]
  /** Detected AI Incidents with their notification and RCA clocks. */
  aiIncidents: AiIncident[]
  /** The last oversight audit of the chain, if one has been run. */
  oversightAudit: (OversightAudit & { at: string }) | null
  /** The last red-team run against the live controls. */
  redTeam: { at: string; results: RedTeamResult[] } | null
  /** The last matched-pair bias suite over the decision path. */
  bias: BiasResult | null
  /** The last contract-conformance run — the auditor's golden set. */
  conformance: ConformanceRun | null
  /** The last drift computation — the source of every agent's driftAlarm. */
  drift: DriftReport | null
  /** Served-model changes the currency check has opened, with their notice clocks. */
  modelChanges: ModelChange[]
  /** Training-exclusion attestations, newest first. */
  attestations: Attestation[]
  /** Deletion certificates, newest first. */
  deletions: DeletionCertificate[]
  mi: MajorIncident
  toasts: Toast[]
  verification: ChainVerification | null

  /* actions */
  setRole: (id: string) => void
  setTheme: (t: ThemeMode) => void
  setDensity: (d: Density) => void
  toggleSim: () => void
  advance: () => void

  approve: (woId: string, who: string, note?: string) => void
  reject: (woId: string, who: string, reason: string) => void
  escalate: (woId: string, who: string) => void
  modifyPlan: (woId: string, who: string, param: string, value: string) => void
  abortRun: (woId: string, who: string) => void

  verifyAssertion: (id: string, verdict: 'verify' | 'correct' | 'reject', by: string, correction?: string) => void

  declareMi: (woId: string, by: string) => void
  closeMi: (by: string) => void
  toggleMiAction: (id: string) => void

  setBrake: (scope: 'global' | string, on: boolean, by: string) => void
  /** Suspend by scope — platform, tower, action class or AI function. Returns the suspension id. */
  suspend: (scope: SuspensionScope, target: string, by: string, reason: string, opts?: { directedByCustomer?: boolean; tower?: string }) => string
  release: (id: string, by: string) => void
  /** Records a detected AI Incident, opens its finding and starts both clocks. Returns the incident. */
  raiseAiIncident: (signal: AiIncidentSignal, refs?: { agentId?: string; systemId?: string; runRef?: string }) => AiIncident
  notifyAiIncident: (id: string, by: string) => void
  publishRca: (id: string, by: string, summary: string) => void
  closeAiIncident: (id: string, by: string) => void
  /** Audits the chain for actions that lacked the human control their decision required. */
  runOversightAudit: (by: string) => OversightAudit
  /** Demonstration control: appends an unapproved action so the audit has something to catch. */
  simulateOversightFailure: (by: string) => void
  /** Records a red-team run as a verification record and keeps the results for the Evaluation Center. */
  recordRedTeam: (results: RedTeamResult[], by: string) => void
  /** Records a bias-suite run — pairs tested, disparities found — as a verification record. */
  recordBias: (result: BiasResult, by: string) => void
  /** Records a contract-conformance run. Available to read-only roles: it asserts nothing and changes nothing. */
  recordConformance: (run: ConformanceRun, by: string) => void
  /** Recomputes drift for every agent; raises or clears alarms with evidence, and returns the report. */
  runDriftMonitor: (by: string) => DriftReport
  /** Opens a model-change notice when the served model differs from the registered one (idempotent per system + served id). */
  recordModelChange: (systemId: string, registered: string, served: string) => ModelChange | null
  notifyModelChange: (id: string, by: string) => void
  acceptModelChange: (id: string, by: string) => void
  /** Demonstration control: records a served model that differs from the registered one for a system. */
  simulateModelChange: (systemId: string) => void
  /** Records a training-exclusion attestation as a knowledge record and restarts the cadence. */
  attestTrainingExclusion: (by: string, vendorRef: string, scope: string) => void
  /** Deletes closed work, its runs and stale assertions for a tower under four-eyes, and seals the certificate. */
  certifyDeletion: (tower: string, by: string, secondControl: string, reason: string) => DeletionCertificate | null
  suspendAgent: (agentId: string, by: string, reason: string) => void
  reinstateAgent: (agentId: string, by: string) => void

  delegateMission: (m: Omit<Mission, 'id' | 'state' | 'consumed' | 'createdAt'>, by: string) => string
  chargeMission: (missionId: string, spendUsd: number, runs?: number) => void
  setMissionState: (missionId: string, state: Mission['state'], by: string) => void

  decideProposal: (id: string, verdict: Exclude<ProposalState, 'open'>, by: string, note?: string) => void

  /** D8 — record a correction and compute what it reaches. Returns the lesson. */
  teach: (kind: LessonKind, targetId: string, by: string, correction: string) => Lesson | null

  logEvidence: (kind: EvidenceRecord['kind'], actor: string, summary: string, payload?: Record<string, unknown>, refs?: { workObjectId?: string; agentId?: string; actionClass?: string }) => string

  runChainVerification: () => void
  tamperEvidence: (id: string) => void
  restoreEvidence: () => void

  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

const byId = <T extends { id: string }>(arr: T[]) =>
  Object.fromEntries(arr.map((x) => [x.id, x])) as Record<string, T>

const PRISTINE_EVIDENCE = EVIDENCE

function nowIso(offsetMins: number) {
  return new Date(NOW.getTime() + offsetMins * 60000).toISOString()
}

/** Advances a work object one lifecycle step. Used by the simulation. */
const NEXT_STATE: Partial<Record<WorkState, WorkState>> = {
  detected: 'triaged',
  triaged: 'planned',
  planned: 'executing',
  executing: 'verifying',
  verifying: 'resolved',
  resolved: 'learned',
}

/**
 * What the workforce says as it moves a work object on.
 *
 * The estate has always ticked, but silently — the boards changed while the
 * activity feed stayed frozen on its seeded entries. Addendum A's idle test
 * (§A1.2, AG-7) is exactly this gap: work happening with nothing narrating it.
 */
const TRANSITION_NARRATIVE: Partial<Record<WorkState, (wo: WorkObject) => string>> = {
  triaged: (wo) => `Classified against ${wo.demandClass} at ${Math.round(wo.classificationConfidence * 100)}% confidence; graph neighbourhood for ${wo.service} attached`,
  planned: (wo) => `Plan assembled from the runbook for ${wo.demandClass}; blast radius scoped to ${wo.affected.length} component${wo.affected.length === 1 ? '' : 's'}`,
  executing: () => 'Plan cleared its policy floor — executing the first step',
  verifying: (wo) => `Steps complete on ${wo.service}; running the verification pack rather than trusting the absence of an alarm`,
  resolved: (wo) => `Objective recovered and verified; evidence sealed to ${wo.ref}`,
  learned: (wo) => `Outcome folded back into ${wo.demandClass} — the class is now one occurrence better understood`,
}

/**
 * Which agent's charter covers each transition. AG-4 requires every visible
 * work item to name the agent responsible — a lifecycle step attributed to
 * "the system" is precisely the anonymous text the addendum bans.
 */
const TRANSITION_ACTOR: Partial<Record<WorkState, string>> = {
  triaged: 'agt_sentinel',
  planned: 'agt_diagnost',
  executing: 'agt_remedian',
  verifying: 'agt_remedian',
  resolved: 'agt_herald',
  learned: 'agt_prospect',
}

function transitionEntry(wo: WorkObject, next: WorkState, at: string, seq: number): TimelineEntry {
  const write = TRANSITION_NARRATIVE[next]
  // The assigned agent owns the step where one is assigned; otherwise it falls
  // to the agent whose charter covers that stage.
  const actor =
    next === 'executing' && wo.assigneeKind === 'agent' && wo.assignee
      ? wo.assignee
      : TRANSITION_ACTOR[next]
  return {
    id: `tl_${seq}_${next}`,
    at,
    actorKind: actor ? 'agent' : 'system',
    actor: actor ?? 'Astra',
    text: write ? write(wo) : `Moved to ${next}`,
    level: next === 'resolved' || next === 'learned' ? 'ok' : 'info',
  }
}

export const useAstra = create<State>((set, get) => ({
  roleId: (typeof localStorage !== 'undefined' && localStorage.getItem('astra.role')) || 'sdm',
  theme: ((typeof localStorage !== 'undefined' && localStorage.getItem('astra.theme')) as ThemeMode) || 'light',
  density: ((typeof localStorage !== 'undefined' && localStorage.getItem('astra.density')) as Density) || 'compact',
  simRunning: true,
  tick: 0,
  clockOffsetMins: 0,

  work: byId(WORK_OBJECTS),
  runs: byId(RUNS),
  evidence: PRISTINE_EVIDENCE,
  assertions: ASSERTIONS,
  agents: byId(AGENTS),
  missions: byId(MISSIONS),
  proposals: byId(PROPOSALS),
  lessons: [],

  brake: { global: false, towers: [] },
  suspensions: [],
  aiIncidents: [],
  oversightAudit: null,
  redTeam: null,
  bias: null,
  conformance: null,
  drift: null,
  modelChanges: [],
  attestations: ATTESTATIONS,
  deletions: [],
  mi: {
    active: false, declaredAt: null, declaredBy: null, workObjectId: null, title: '',
    timeline: [], roles: [], actions: [],
  },
  toasts: [],
  verification: null,

  /* ------------------------------ preferences ----------------------------- */

  setRole: (id) => {
    localStorage.setItem('astra.role', id)
    set({ roleId: id })
  },
  setTheme: (t) => {
    localStorage.setItem('astra.theme', t)
    document.documentElement.setAttribute('data-theme', t)
    set({ theme: t })
  },
  setDensity: (d) => {
    localStorage.setItem('astra.density', d)
    document.documentElement.setAttribute('data-density', d)
    set({ density: d })
  },
  toggleSim: () => set((s) => ({ simRunning: !s.simRunning })),

  /* ------------------------------- simulation ----------------------------- */

  /**
   * One simulation step ≈ one minute of estate time. SLA clocks advance,
   * breach probability is recomputed, and a small number of work objects move
   * through their lifecycle so the boards are genuinely live.
   */
  advance: () =>
    set((s) => {
      const t = s.tick + 1
      const offset = s.clockOffsetMins + 1
      const work = { ...s.work }
      const runs = { ...s.runs }
      const open: WorkState[] = ['detected', 'triaged', 'planned', 'gated', 'executing', 'verifying']

      for (const id of Object.keys(work)) {
        const wo = work[id]
        if (!open.includes(wo.state)) continue
        if (wo.slaPaused) continue

        const elapsed = wo.slaElapsedMins + 1
        const burn = elapsed / wo.slaTargetMins
        const bp = Math.min(0.98, Math.max(0.02, burn * (0.7 + (wo.priority === 'P1' ? 0.5 : wo.priority === 'P2' ? 0.3 : 0.1))))
        work[id] = { ...wo, slaElapsedMins: elapsed, breachProbability: bp }
      }

      // Advance a deterministic slice of non-gated work each tick.
      const advanceable = Object.values(work).filter(
        (w) => open.includes(w.state) && w.state !== 'gated' && !w.slaPaused,
      )
      const chosen = advanceable.filter((_, i) => (i + t) % 26 === 0).slice(0, 3)
      for (const wo of chosen) {
        // The global brake and an open major incident stop autonomous progress.
        if (s.brake.global || s.brake.towers.includes(wo.tower)) continue
        if (s.mi.active && ['planned', 'executing'].includes(wo.state)) continue
        const next = NEXT_STATE[wo.state]
        if (!next) continue
        work[wo.id] = {
          ...wo,
          state: next,
          // Every transition narrates itself, so the activity stream is a
          // record of work being done rather than a seeded backlog.
          narrative: [...wo.narrative, transitionEntry(wo, next, nowIso(offset), t)],
          economics:
            next === 'resolved'
              ? { ...wo.economics, actualAgentMins: Math.max(1.4, wo.economics.estManualMins * 0.14), attribution: 'automation' }
              : wo.economics,
        }
        if (wo.runId && runs[wo.runId]) {
          const run = runs[wo.runId]
          const idx = run.steps.findIndex((st) => st.state === 'pending' || st.state === 'running')
          if (idx >= 0) {
            const steps = run.steps.map((st, i) =>
              i < idx ? { ...st, state: 'done' as const } : i === idx ? { ...st, state: 'done' as const } : st,
            )
            const nextIdx = steps.findIndex((st) => st.state === 'pending')
            if (nextIdx >= 0) steps[nextIdx] = { ...steps[nextIdx], state: 'running' }
            runs[run.id] = { ...run, steps, state: next === 'resolved' ? 'complete' : run.state }
          }
        }
      }

      return { tick: t, clockOffsetMins: offset, work, runs }
    }),

  /* ------------------------------- approvals ------------------------------ */

  approve: (woId, who, note) => {
    const s = get()
    const wo = s.work[woId]
    if (!wo) return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(woId + 'approve' + s.tick).slice(0, 10)}`,
      at,
      kind: 'approval',
      workObjectId: woId,
      runId: wo.runId,
      actionClass: wo.autonomy?.actionClasses[0],
      actor: who,
      summary: `Gated action approved — ${wo.autonomy?.actionClasses.join(' + ')} on ${wo.service}`,
      payload: {
        shown: ['what', 'why', 'blast_radius', 'rollback', 'agent_record', 'policy'],
        policy: `${wo.autonomy?.policyId} ${wo.autonomy?.policyVersion}`,
        note: note ?? null,
        channel: 'console',
      },
      sealed: true,
    })

    const entry: TimelineEntry = {
      id: `t_${s.tick}_a`,
      at,
      actorKind: 'human',
      actor: who,
      text: `Approved${note ? ` — ${note}` : ''}. Plan, blast radius and rollback reviewed.`,
      evidenceId: record.id,
      level: 'ok',
    }

    const run = wo.runId ? s.runs[wo.runId] : undefined
    const nextRun = run
      ? {
          ...run,
          state: 'executing' as const,
          steps: run.steps.map((st) =>
            st.kind === 'gate' && st.state === 'blocked'
              ? { ...st, state: 'done' as const, detail: `approved by ${who}` }
              : st.state === 'pending' && st.kind === 'tool'
                ? { ...st, state: 'running' as const }
                : st,
          ),
        }
      : undefined

    set({
      evidence: [...s.evidence, record],
      work: {
        ...s.work,
        [woId]: { ...wo, state: 'executing', awaitingApproval: false, narrative: [...wo.narrative, entry], assigneeKind: 'agent', assignee: wo.assignee ?? 'agt_remedian' },
      },
      runs: nextRun ? { ...s.runs, [nextRun.id]: nextRun } : s.runs,
    })
    get().pushToast({ title: 'Approved — execution started', body: `${wo.ref} · rollback held ready · evidence ${record.id}`, tone: 'ok', evidenceId: record.id })
  },

  reject: (woId, who, reason) => {
    const s = get()
    const wo = s.work[woId]
    if (!wo) return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(woId + 'reject' + s.tick).slice(0, 10)}`,
      at, kind: 'decision', workObjectId: woId, runId: wo.runId,
      actionClass: wo.autonomy?.actionClasses[0], actor: who,
      summary: 'Gated action rejected by approver',
      payload: { reason, policy: `${wo.autonomy?.policyId} ${wo.autonomy?.policyVersion}` },
      sealed: true,
    })
    const entry: TimelineEntry = {
      id: `t_${s.tick}_r`, at, actorKind: 'human', actor: who,
      text: `Rejected — ${reason}. Work object returned to the human queue; the agent proposal is retained for evaluation scoring.`,
      evidenceId: record.id, level: 'warn',
    }
    set({
      evidence: [...s.evidence, record],
      work: { ...s.work, [woId]: { ...wo, state: 'triaged', awaitingApproval: false, assigneeKind: 'human', assignee: who, narrative: [...wo.narrative, entry] } },
    })
    // Rejecting a plan is teaching (D8) — the lesson replaces the generic
    // toast, because what the correction reaches is the useful half.
    get().teach('plan_rejected', woId, who, `${wo.ref} plan rejected — ${reason}`)
  },

  escalate: (woId, who) => {
    const s = get()
    const wo = s.work[woId]
    if (!wo) return
    const at = nowIso(s.clockOffsetMins)
    const to = wo.autonomy?.gates[0]?.escalatesTo ?? 'duty manager'
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(woId + 'esc' + s.tick).slice(0, 10)}`,
      at, kind: 'decision', workObjectId: woId, actor: who,
      summary: `Approval escalated to ${to}`, payload: { from: who, to }, sealed: true,
    })
    const entry: TimelineEntry = {
      id: `t_${s.tick}_e`, at, actorKind: 'human', actor: who,
      text: `Escalated to ${to}. Gate remains open; the clock continues to run.`, evidenceId: record.id, level: 'warn',
    }
    set({ evidence: [...s.evidence, record], work: { ...s.work, [woId]: { ...wo, narrative: [...wo.narrative, entry] } } })
    get().pushToast({ title: `Escalated to ${to}`, body: `${wo.ref} · response-time commitment applies`, tone: 'warn', evidenceId: record.id })
  },

  modifyPlan: (woId, who, param, value) => {
    const s = get()
    const wo = s.work[woId]
    if (!wo) return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(woId + 'mod' + s.tick + param).slice(0, 10)}`,
      at, kind: 'decision', workObjectId: woId, runId: wo.runId, actor: who,
      summary: `Plan modified within policy bounds — ${param} set to ${value}`,
      payload: { param, value, reEvaluated: true, note: 'Free-text override is not possible; the changed plan re-entered policy evaluation.' },
      sealed: true,
    })
    const entry: TimelineEntry = {
      id: `t_${s.tick}_m`, at, actorKind: 'human', actor: who,
      text: `Modified ${param} → ${value}. Plan re-entered policy evaluation and returned the same execution mode.`,
      evidenceId: record.id, level: 'info',
    }
    set({ evidence: [...s.evidence, record], work: { ...s.work, [woId]: { ...wo, narrative: [...wo.narrative, entry] } } })
    get().teach('plan_modified', woId, who, `${wo.ref} plan modified — ${param} → ${value}`)
  },

  abortRun: (woId, who) => {
    const s = get()
    const wo = s.work[woId]
    if (!wo?.runId) return
    const run = s.runs[wo.runId]
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(woId + 'abort' + s.tick).slice(0, 10)}`,
      at, kind: 'action', workObjectId: woId, runId: run.id, actor: who,
      summary: 'Run aborted by human — compensation executed',
      payload: { compensatedSteps: run.steps.filter((x) => x.compensation).map((x) => x.compensation) },
      sealed: true,
    })
    const entry: TimelineEntry = {
      id: `t_${s.tick}_ab`, at, actorKind: 'human', actor: who,
      text: 'Run aborted. The orchestrator unwound completed mutating steps using their declared compensations.',
      evidenceId: record.id, level: 'crit',
    }
    set({
      evidence: [...s.evidence, record],
      runs: { ...s.runs, [run.id]: { ...run, state: 'compensated', steps: run.steps.map((st) => (st.state === 'running' ? { ...st, state: 'skipped' } : st)) } },
      work: { ...s.work, [woId]: { ...wo, state: 'triaged', assigneeKind: 'human', assignee: who, narrative: [...wo.narrative, entry] } },
    })
    get().pushToast({ title: 'Run aborted and compensated', body: `${wo.ref} · estate returned to its prior state`, tone: 'crit', evidenceId: record.id })
  },

  /* ------------------------------ verification ---------------------------- */

  verifyAssertion: (id, verdict, by, correction) => {
    const s = get()
    const a = s.assertions.find((x) => x.id === id)
    // An assertion already ruled on cannot be ruled on again — otherwise a
    // double submit teaches the same lesson twice and inflates the record.
    if (!a || a.verification === 'human_verified' || a.verification === 'stale') return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(id + verdict + s.tick).slice(0, 10)}`,
      at, kind: 'knowledge', actor: by,
      summary: `Assertion ${id} ${verdict === 'verify' ? 'human-verified' : verdict === 'correct' ? 'corrected and verified' : 'rejected'}`,
      payload: { subject: a.subject, predicate: a.predicate, object: correction ?? a.object, source: a.source, priorConfidence: a.confidence },
      sealed: true,
    })
    set({
      evidence: [...s.evidence, record],
      assertions: s.assertions.map((x) =>
        x.id === id
          ? verdict === 'reject'
            ? { ...x, verification: 'stale', verifiedBy: by, confidence: 0 }
            : { ...x, verification: 'human_verified', verifiedBy: by, object: correction ?? x.object, confidence: 1, conflictsWith: undefined }
          : x,
      ),
    })
    // A correction is a teaching moment; a plain verification is agreement and
    // teaches nothing. Only the former earns a lesson (D8).
    if (verdict === 'correct' || verdict === 'reject') {
      get().teach(
        verdict === 'correct' ? 'assertion_corrected' : 'assertion_rejected',
        id,
        by,
        verdict === 'correct'
          ? `${a.subject} ${a.predicate} corrected to "${correction ?? a.object}"`
          : `${a.subject} ${a.predicate} ${a.object} rejected`,
      )
      return
    }

    const remaining = get().assertions.filter((x) => x.verification !== 'human_verified' && x.verification !== 'stale').length
    get().pushToast({
      title: 'Assertion verified',
      body: `${remaining} left in queue · verified knowledge raises autonomy-eligible volume (coupling F1)`,
      tone: 'ok',
      evidenceId: record.id,
    })
  },

  /* -------------------------------- teaching ------------------------------- */

  /**
   * The visible half of D8. The correction is already recorded by the caller;
   * this computes what else it reaches, seals that reasoning to the chain, and
   * hands the operator a sentence they can check against the store.
   */
  teach: (kind, targetId, by, correction) => {
    const s = get()

    const reach =
      kind === 'assertion_corrected' || kind === 'assertion_rejected'
        ? (() => {
            const a = s.assertions.find((x) => x.id === targetId)
            return a ? assertionReach(a, s.assertions) : null
          })()
        : (() => {
            const wo = s.work[targetId]
            return wo ? planReach(wo, Object.values(s.work)) : null
          })()

    if (!reach) return null

    const wo = s.work[targetId]
    const agentId = wo?.assigneeKind === 'agent' && wo.assignee ? wo.assignee : 'agt_archivist'
    const absorbed = absorbedText(kind, reach)

    const evidenceId = get().logEvidence(
      'knowledge',
      by,
      `Lesson absorbed — ${correction}`,
      { kind, correction, absorbed, basis: reach.basis, reached: reach.ids, reachCount: reach.ids.length },
      { agentId, workObjectId: reach.kind === 'work' ? targetId : undefined },
    )

    const lesson: Lesson = {
      id: `lsn_${digest(targetId + kind + s.tick).slice(0, 10)}`,
      at: nowIso(s.clockOffsetMins),
      kind, agentId, taughtBy: by, correction, absorbed, reach, evidenceId,
    }

    set({ lessons: [lesson, ...get().lessons] })

    get().pushToast({
      title: 'Learned',
      body: absorbed,
      tone: 'ok',
      evidenceId,
    })

    return lesson
  },

  /* --------------------------- major incident mode ------------------------ */

  declareMi: (woId, by) => {
    const s = get()
    const wo = s.work[woId]
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('mi' + woId + s.tick).slice(0, 10)}`,
      at, kind: 'decision', workObjectId: woId, actor: by,
      summary: 'Major incident declared — autonomy capped at Advise across all towers',
      payload: { trigger: wo?.ref ?? 'manual', policyOverride: 'incident.major_active == true → max_mode: advise' },
      sealed: true,
    })
    set({
      evidence: [...s.evidence, record],
      mi: {
        active: true,
        declaredAt: at,
        declaredBy: by,
        workObjectId: woId,
        title: wo?.title ?? 'Declared major incident',
        roles: [
          { role: 'Incident Commander', person: by },
          { role: 'Technical Lead', person: 'A. Fernandes' },
          { role: 'Communications', person: 'Herald (drafts) · M. Okonkwo (approves)' },
          { role: 'Scribe', person: 'Evidence Chain (automatic)' },
        ],
        timeline: [
          { id: 'mi1', at, actorKind: 'human', actor: by, text: `Major incident declared on ${wo?.ref ?? 'the estate'}. Autonomy brake applied automatically by policy.`, evidenceId: record.id, level: 'crit' },
          { id: 'mi2', at, actorKind: 'system', actor: 'Autonomy Policy Engine', text: 'Global override active: incident.major_active == true → max_mode advise. 3 in-flight supervised runs paused at their next checkpoint.', level: 'warn' },
        ],
        actions: [
          { id: 'a1', text: 'Confirm blast radius from the Service Graph', owner: 'A. Fernandes', dueMins: 10, done: false },
          { id: 'a2', text: 'Publish first status-page update', owner: 'M. Okonkwo', dueMins: 15, done: false },
          { id: 'a3', text: 'Brief executive sponsor', owner: by, dueMins: 30, done: false },
          { id: 'a4', text: 'Stand up reverse-shadow with the incumbent', owner: 'S. Iyer', dueMins: 45, done: false },
        ],
      },
    })
    get().pushToast({ title: 'Major incident declared', body: 'Autonomy capped at Advise platform-wide. Every brake action is evidenced.', tone: 'crit', evidenceId: record.id })
  },

  closeMi: (by) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('miclose' + s.tick).slice(0, 10)}`,
      at, kind: 'decision', actor: by,
      summary: 'Major incident closed — autonomy restored to the standing schedule',
      payload: { pirPackGenerated: true, actionsOpen: s.mi.actions.filter((a) => !a.done).length },
      sealed: true,
    })
    set({
      evidence: [...s.evidence, record],
      mi: { active: false, declaredAt: null, declaredBy: null, workObjectId: null, title: '', timeline: [], roles: [], actions: [] },
    })
    get().pushToast({ title: 'Major incident closed', body: 'Post-incident review pack assembled from the evidence chain.', tone: 'ok', evidenceId: record.id })
  },

  toggleMiAction: (id) =>
    set((s) => ({ mi: { ...s.mi, actions: s.mi.actions.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) } })),

  /* --------------------------------- brakes -------------------------------- */

  /**
   * One suspension record per directive. The gateway is told about function
   * suspensions so they are enforced before a model call, not only in policy.
   */
  suspend: (scope, target, by, reason, opts = {}) => {
    const s = get()
    if (scope === 'agent') {
      get().suspendAgent(target, by, reason)
      return ''
    }
    const existing = s.suspensions.find((x) => x.scope === scope && x.target === target && (x.tower ?? null) === (opts.tower ?? null))
    if (existing) return existing.id

    const at = nowIso(s.clockOffsetMins)
    const id = `sus_${digest(scope + target + (opts.tower ?? '') + s.tick).slice(0, 8)}`
    const suspension: Suspension = { id, scope, target, tower: opts.tower, by, at, reason, directedByCustomer: Boolean(opts.directedByCustomer) }
    const where = scope === 'global' ? 'platform-wide' : scope === 'tower' ? target : scope === 'actionClass' ? `${target}${opts.tower ? ` on ${opts.tower}` : ' everywhere'}` : `function ${target}`
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('brake' + id).slice(0, 10)}`,
      at, kind: 'decision', actor: by,
      actionClass: scope === 'actionClass' ? target : undefined,
      summary: `Autonomy brake applied — ${where}`,
      payload: { suspension, directedByCustomer: suspension.directedByCustomer, effect: scope === 'function' ? 'gateway refuses the function before any model call' : 'policy caps affected actions at Advise' },
      sealed: true,
    })
    const suspensions = [...s.suspensions, suspension]
    set({ evidence: [...s.evidence, record], suspensions, brake: brakeOf(suspensions) })

    if (scope === 'function') {
      void fetch('/api/agent/suspend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ function: target, on: true }) }).catch(() => {})
    }
    get().pushToast({
      title: 'Autonomy brake applied',
      body: scope === 'global'
        ? 'All agents drop to Advise. Work continues through humans via the mirrored ITSM.'
        : scope === 'function'
          ? `${target} will be refused at the gateway until released.`
          : `${where} capped at Advise.`,
      tone: 'crit',
      evidenceId: record.id,
    })
    return id
  },

  release: (id, by) => {
    const s = get()
    const suspension = s.suspensions.find((x) => x.id === id)
    if (!suspension) return
    const at = nowIso(s.clockOffsetMins)
    const where = suspension.scope === 'global' ? 'platform-wide' : suspension.scope === 'function' ? `function ${suspension.target}` : suspension.target
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('release' + id + s.tick).slice(0, 10)}`,
      at, kind: 'decision', actor: by,
      actionClass: suspension.scope === 'actionClass' ? suspension.target : undefined,
      summary: `Autonomy brake released — ${where}`,
      payload: { suspension }, sealed: true,
    })
    const suspensions = s.suspensions.filter((x) => x.id !== id)
    set({ evidence: [...s.evidence, record], suspensions, brake: brakeOf(suspensions) })
    if (suspension.scope === 'function') {
      void fetch('/api/agent/suspend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ function: suspension.target, on: false }) }).catch(() => {})
    }
    get().pushToast({ title: 'Autonomy brake released', body: `${where} returns to the standing schedule.`, tone: 'ok', evidenceId: record.id })
  },

  /* ------------------------------ AI incidents ---------------------------- */

  /**
   * An AI Incident is a finding like any other work — it opens a work object
   * on the governance tower so it sits in the same queues — plus two clocks
   * the contract sets: notification and root-cause analysis. A consequential
   * incident also puts the agent on probation.
   */
  raiseAiIncident: (signal, refs = {}) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const id = `air_${digest(signal.class + signal.detector + signal.summary + s.tick + s.aiIncidents.length).slice(0, 6)}`
    const clocks = clocksFor(at)
    const severity: AiIncident['severity'] = signal.consequential ? 'P1' : signal.class === 'oversight_failure' ? 'P2' : 'P3'
    const owner = ROLE_BY_ID.aieng?.person ?? 'AI / Platform Engineer'
    const woId = `wo_${digest('air' + id).slice(0, 6)}`

    const record = appendRecord(s.evidence, {
      id: `ev_${digest('air' + id).slice(0, 10)}`,
      at, kind: 'observation', actor: 'AI Incident detector', agentId: refs.agentId, workObjectId: woId,
      summary: `AI Incident ${id} — ${signal.class.replace(/_/g, ' ')} (${signal.detector})`,
      payload: { summary: signal.summary, details: signal.details, consequential: signal.consequential, severity, systemId: refs.systemId ?? null, runRef: refs.runRef ?? null, ...clocks },
      sealed: true,
    })

    const entry: TimelineEntry = {
      id: `t_${s.tick}_air`, at, actorKind: 'system', actor: 'AI Incident detector',
      text: `${signal.summary} Notification due ${clocks.notifyDueAt.slice(0, 16).replace('T', ' ')}; RCA due ${clocks.rcaDueAt.slice(0, 10)}.`,
      evidenceId: record.id, level: signal.consequential ? 'crit' : 'warn',
    }
    const wo: WorkObject = {
      id: woId,
      ref: `AIR0${483200 + s.aiIncidents.length}`,
      type: 'finding',
      title: `AI Incident — ${signal.class.replace(/_/g, ' ')} (${signal.detector})`,
      tower: 'twr_agentops',
      service: TOWER_BY_ID.twr_agentops?.name ?? 'AI & Automation Governance',
      affected: [],
      demandClass: `dc_ai_${signal.class}`,
      classificationConfidence: 1,
      priority: severity,
      state: 'triaged',
      createdAt: at,
      slaTargetMins: 24 * 60,
      slaElapsedMins: 0,
      slaPaused: false,
      breachProbability: 0.05,
      assignee: owner,
      assigneeKind: 'human',
      economics: { estManualMins: 180, actualAgentMins: 0, tokensUsd: 0, attribution: 'none' },
      evidenceHead: record.id,
      narrative: [entry],
      source: { system: 'AI Incident detector', ref: id },
      awaitingApproval: false,
    }

    const incident: AiIncident = {
      id, class: signal.class, severity, detector: signal.detector, summary: signal.summary, details: signal.details,
      detectedAt: at, agentId: refs.agentId, systemId: refs.systemId, workObjectId: woId, runRef: refs.runRef,
      ...clocks, state: 'open', evidenceIds: [record.id],
    }

    let evidence = [...s.evidence, record]
    let agents = s.agents
    if (signal.consequential && refs.agentId && s.agents[refs.agentId] && s.agents[refs.agentId].state === 'active') {
      const agent = s.agents[refs.agentId]
      const prob = appendRecord(evidence, {
        id: `ev_${digest('airprob' + id).slice(0, 10)}`,
        at, kind: 'decision', agentId: refs.agentId, actor: 'AI Incident detector',
        summary: `Agent ${agent.name} placed on probation — AI Incident ${id}`,
        payload: { incident: id, restoration: 'RCA published and the class re-passed in evaluation' }, sealed: true,
      })
      evidence = [...evidence, prob]
      agents = { ...s.agents, [refs.agentId]: { ...agent, state: 'probation' } }
      incident.evidenceIds.push(prob.id)
    }

    set({ evidence, agents, aiIncidents: [incident, ...s.aiIncidents], work: { ...s.work, [woId]: wo }, verification: null })
    get().pushToast({
      title: `AI Incident ${id} — ${signal.class.replace(/_/g, ' ')}`,
      body: `${signal.summary} Notification clock started (24h).`,
      tone: signal.consequential ? 'crit' : 'warn',
      evidenceId: record.id,
    })
    return incident
  },

  notifyAiIncident: (id, by) => {
    const s = get()
    const inc = s.aiIncidents.find((x) => x.id === id)
    if (!inc || inc.state !== 'open') return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('airnotify' + id + s.tick).slice(0, 10)}`,
      at, kind: 'action', actor: by, workObjectId: inc.workObjectId,
      summary: `AI Incident ${id} — customer notified`,
      payload: { class: inc.class, notifyDueAt: inc.notifyDueAt, onTime: new Date(at) <= new Date(inc.notifyDueAt), channel: 'incident register + email' }, sealed: true,
    })
    set({
      evidence: [...s.evidence, record],
      aiIncidents: s.aiIncidents.map((x) => (x.id === id ? { ...x, state: 'notified', notifiedAt: at, evidenceIds: [...x.evidenceIds, record.id] } : x)),
    })
    get().pushToast({ title: `${id} notified`, body: new Date(at) <= new Date(inc.notifyDueAt) ? 'Inside the 24-hour window.' : 'Outside the 24-hour window — recorded as late.', tone: 'ok', evidenceId: record.id })
  },

  publishRca: (id, by, summary) => {
    const s = get()
    const inc = s.aiIncidents.find((x) => x.id === id)
    if (!inc || inc.state === 'closed' || inc.state === 'rca_published') return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('airrca' + id + s.tick).slice(0, 10)}`,
      at, kind: 'knowledge', actor: by, workObjectId: inc.workObjectId,
      summary: `AI Incident ${id} — root-cause analysis published`,
      payload: { class: inc.class, rcaDueAt: inc.rcaDueAt, onTime: new Date(at) <= new Date(inc.rcaDueAt), summary }, sealed: true,
    })
    set({
      evidence: [...s.evidence, record],
      aiIncidents: s.aiIncidents.map((x) => (x.id === id ? { ...x, state: 'rca_published', rcaPublishedAt: at, rcaSummary: summary, evidenceIds: [...x.evidenceIds, record.id] } : x)),
    })
    get().pushToast({ title: `${id} RCA published`, body: summary, tone: 'ok', evidenceId: record.id })
  },

  closeAiIncident: (id, by) => {
    const s = get()
    const inc = s.aiIncidents.find((x) => x.id === id)
    if (!inc || inc.state !== 'rca_published') return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('airclose' + id + s.tick).slice(0, 10)}`,
      at, kind: 'decision', actor: by, workObjectId: inc.workObjectId,
      summary: `AI Incident ${id} — closed`, payload: { class: inc.class, corrective: inc.rcaSummary ?? null }, sealed: true,
    })
    const wo = inc.workObjectId ? s.work[inc.workObjectId] : undefined
    set({
      evidence: [...s.evidence, record],
      aiIncidents: s.aiIncidents.map((x) => (x.id === id ? { ...x, state: 'closed', closedAt: at, evidenceIds: [...x.evidenceIds, record.id] } : x)),
      work: wo ? { ...s.work, [wo.id]: { ...wo, state: 'resolved' } } : s.work,
    })
    get().pushToast({ title: `${id} closed`, body: 'Closed with its RCA on the record.', tone: 'ok', evidenceId: record.id })
  },

  runOversightAudit: (by) => {
    const s = get()
    const audit = auditOversight(s.evidence, s.work)
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('audit' + s.tick + s.evidence.length).slice(0, 10)}`,
      at, kind: 'verification', actor: by,
      summary: `Oversight audit — ${audit.checked} actions checked, ${audit.failures.length} failure${audit.failures.length === 1 ? '' : 's'}`,
      payload: { checked: audit.checked, failures: audit.failures }, sealed: true,
    })
    set({ evidence: [...s.evidence, record], oversightAudit: { ...audit, at } })
    const signal = oversightSignal(audit)
    const alreadyOpen = get().aiIncidents.some((x) => x.class === 'oversight_failure' && x.state !== 'closed')
    if (signal && !alreadyOpen) get().raiseAiIncident(signal, { runRef: record.id })
    else get().pushToast({ title: 'Oversight audit complete', body: `${audit.checked} actions checked — ${audit.failures.length ? `${audit.failures.length} failures, already under an open incident` : 'every approve-first action had its approval'}.`, tone: audit.failures.length ? 'warn' : 'ok', evidenceId: record.id })
    return audit
  },

  simulateOversightFailure: (by) => {
    const s = get()
    const gated = Object.values(s.work).find((w) => w.autonomy?.mode === 'approve_first' && w.state === 'gated')
    if (!gated) return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('simact' + gated.id + s.tick).slice(0, 10)}`,
      at, kind: 'action', workObjectId: gated.id, runId: gated.runId, actionClass: gated.autonomy?.actionClasses[0], agentId: 'agt_remedian', actor: 'Remedian',
      summary: `${gated.autonomy?.actionClasses[0]} executed (demonstration — no approval preceded this record)`,
      payload: { simulated: true, by, note: 'Demonstration control: an action record appended without its approval so the chain audit has something to catch.' }, sealed: true,
    })
    set({ evidence: [...s.evidence, record] })
    get().runOversightAudit(by)
  },

  recordRedTeam: (results, by) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const failed = results.filter((r) => !r.pass)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('redteam' + s.tick + s.evidence.length).slice(0, 10)}`,
      at, kind: 'verification', actor: by,
      summary: `Red-team run — ${results.length - failed.length} of ${results.length} controls held`,
      payload: {
        cases: results.length,
        failed: failed.map((f) => ({ id: f.caseId, vector: f.vector, expected: f.expected, observed: f.observed, detail: f.detail })),
      },
      sealed: true,
    })
    set({ evidence: [...s.evidence, record], redTeam: { at, results } })
    get().pushToast({
      title: failed.length ? `Red team: ${failed.length} control${failed.length === 1 ? '' : 's'} failed` : 'Red team: every control held',
      body: `${results.length} cases against the live gateway, detectors and policy engine.`,
      tone: failed.length ? 'crit' : 'ok',
      evidenceId: record.id,
    })
  },

  recordBias: (result, by) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('bias' + s.tick + s.evidence.length).slice(0, 10)}`,
      at, kind: 'verification', actor: by,
      summary: `Bias suite — ${result.pairs} matched pairs, ${result.disparities.length} disparit${result.disparities.length === 1 ? 'y' : 'ies'}`,
      payload: { cohorts: result.cohorts, pairs: result.pairs, disparities: result.disparities, invariant: result.invariant },
      sealed: true,
    })
    set({ evidence: [...s.evidence, record], bias: { ...result, at } })
    get().pushToast({
      title: result.invariant ? 'Bias suite: decision path is cohort-blind' : `Bias suite: ${result.disparities.length} disparities`,
      body: `${result.pairs} matched pairs across ${result.cohorts.length} cohorts — mode, gates, floor and detectors compared.`,
      tone: result.invariant ? 'ok' : 'crit',
      evidenceId: record.id,
    })
  },

  recordConformance: (run, by) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const failed = run.results.filter((r) => !r.holds)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('conf' + s.tick + s.evidence.length).slice(0, 10)}`,
      at, kind: 'verification', actor: by,
      summary: `Contract conformance — ${run.held} of ${run.total} commitments held`,
      payload: {
        held: run.held, total: run.total,
        failed: failed.map((f) => ({ id: f.caseId, commitment: f.commitment, clause: f.clause, expected: f.expected, observed: f.observed })),
        runBy: by,
      },
      sealed: true,
    })
    set({ evidence: [...s.evidence, record], conformance: { ...run, at } })
    get().pushToast({
      title: failed.length ? `Conformance: ${failed.length} commitment${failed.length === 1 ? '' : 's'} not held` : 'Conformance: every commitment held',
      body: `${run.total} cases against the live policy engine. The run is a verification record in the chain.`,
      tone: failed.length ? 'crit' : 'ok',
      evidenceId: record.id,
    })
  },

  /**
   * Drift is computed, never seeded. Each alarm that changes state is its own
   * evidence record; the cap it triggers is rule r0d, readable in any policy.
   */
  runDriftMonitor: (by) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const report = { ...driftReport(Object.values(s.agents)), at }
    let evidence = s.evidence
    const agents = { ...s.agents }
    let raised = 0, cleared = 0

    for (const w of report.windows) {
      const agent = agents[w.agentId]
      if (!agent || agent.driftAlarm === w.alarm) continue
      const record = appendRecord(evidence, {
        id: `ev_${digest('drift' + w.agentId + String(w.alarm) + s.tick).slice(0, 10)}`,
        at, kind: 'decision', agentId: w.agentId, actor: 'Drift monitor',
        summary: w.alarm ? `Drift alarm raised — ${agent.name}` : `Drift alarm cleared — ${agent.name}`,
        payload: { window: w, effect: w.alarm ? 'rule r0d caps the agent at Supervised until cleared' : 'cap lifted' },
        sealed: true,
      })
      evidence = [...evidence, record]
      agents[w.agentId] = { ...agent, driftAlarm: w.alarm }
      if (w.alarm) raised++
      else cleared++
    }

    const summary = appendRecord(evidence, {
      id: `ev_${digest('driftrun' + s.tick + evidence.length).slice(0, 10)}`,
      at, kind: 'verification', actor: by,
      summary: `Drift monitor — ${report.windows.filter((w) => w.alarm).length} of ${report.windows.length} agents drifting`,
      payload: { minDrop: report.minDrop, alarms: report.windows.filter((w) => w.alarm).map((w) => ({ agentId: w.agentId, dropFromPeak: w.dropFromPeak, slope: w.slope })) },
      sealed: true,
    })
    set({ evidence: [...evidence, summary], agents, drift: report })
    get().pushToast({
      title: 'Drift monitor run',
      body: `${report.windows.filter((w) => w.alarm).length} drifting · ${raised} raised, ${cleared} cleared this run.`,
      tone: report.windows.some((w) => w.alarm) ? 'warn' : 'ok',
      evidenceId: summary.id,
    })
    return report
  },

  /* ------------------------------ model changes --------------------------- */

  /**
   * The vendor served something other than what the registry approved. The
   * record starts the notice clock; until a named human accepts the change,
   * rule r0e caps every run on that system at Advise.
   */
  recordModelChange: (systemId, registered, served) => {
    const s = get()
    if (s.modelChanges.some((m) => m.systemId === systemId && m.served === served && m.state !== 'accepted')) return null
    const at = nowIso(s.clockOffsetMins)
    const id = `mch_${digest(systemId + served + s.tick).slice(0, 6)}`
    const clocks = modelChangeClocks(at)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('mch' + id).slice(0, 10)}`,
      at, kind: 'observation', actor: 'AI-system registry',
      summary: `Served model differs from the registered system — ${systemId}`,
      payload: { system: systemId, registered, served, noticeDueAt: clocks.noticeDueAt, effect: 'rule r0e caps runs on this system at Advise until the change is accepted' },
      sealed: true,
    })
    const change: ModelChange = { id, systemId, registered, served, detectedAt: at, ...clocks, state: 'detected', evidenceIds: [record.id] }
    set({ evidence: [...s.evidence, record], modelChanges: [change, ...s.modelChanges] })
    get().pushToast({ title: `Model change detected — ${systemId}`, body: `Served ${served}, registered ${registered}. Notice due ${clocks.noticeDueAt.slice(0, 10)}; runs on this system capped at Advise until accepted.`, tone: 'warn', evidenceId: record.id })
    return change
  },

  notifyModelChange: (id, by) => {
    const s = get()
    const m = s.modelChanges.find((x) => x.id === id)
    if (!m || m.state !== 'detected') return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('mchnotify' + id + s.tick).slice(0, 10)}`,
      at, kind: 'action', actor: by,
      summary: `Model-change notice sent — ${m.systemId}`,
      payload: { change: id, served: m.served, registered: m.registered, onTime: new Date(at) <= new Date(m.noticeDueAt) }, sealed: true,
    })
    set({ evidence: [...s.evidence, record], modelChanges: s.modelChanges.map((x) => (x.id === id ? { ...x, state: 'notified', notifiedAt: at, evidenceIds: [...x.evidenceIds, record.id] } : x)) })
    get().pushToast({ title: `Notice sent — ${m.systemId}`, body: new Date(at) <= new Date(m.noticeDueAt) ? 'Inside the notice period.' : 'Outside the notice period — recorded as late.', tone: 'ok', evidenceId: record.id })
  },

  acceptModelChange: (id, by) => {
    const s = get()
    const m = s.modelChanges.find((x) => x.id === id)
    if (!m || m.state === 'accepted') return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('mchaccept' + id + s.tick).slice(0, 10)}`,
      at, kind: 'decision', actor: by,
      summary: `Model change accepted — ${m.systemId} now ${m.served}`,
      payload: { change: id, from: m.registered, to: m.served, condition: 'regression suites re-run on the served version; routing cap lifted' }, sealed: true,
    })
    set({ evidence: [...s.evidence, record], modelChanges: s.modelChanges.map((x) => (x.id === id ? { ...x, state: 'accepted', acceptedAt: at, evidenceIds: [...x.evidenceIds, record.id] } : x)) })
    get().pushToast({ title: `Accepted — ${m.systemId}`, body: `${m.served} is now the version of record for this system; the Advise cap is lifted.`, tone: 'ok', evidenceId: record.id })
  },

  simulateModelChange: (systemId) => {
    // The registered id is whatever the registry says; a simulated vendor
    // update appends a snapshot date, which is exactly how vendors do it.
    void fetch('/api/agent/registry')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const sys = j?.systems?.find((x: { id: string; model: string }) => x.id === systemId)
        if (sys) get().recordModelChange(sys.id, sys.model, `${sys.model}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`)
      })
      .catch(() => {})
  },

  /* ------------------------------ data handling --------------------------- */

  attestTrainingExclusion: (by, vendorRef, scope) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const id = `att_${String(s.attestations.length + 1).padStart(3, '0')}`
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('attest' + id + s.tick).slice(0, 10)}`,
      at, kind: 'knowledge', actor: by,
      summary: 'Training-exclusion attestation — no customer data trains, tunes, evaluates or improves a model for another party',
      payload: { attestation: id, vendorRef, scope, nextDueAt: nextAttestationDue(at) }, sealed: true,
    })
    const attestation: Attestation = { id, at, by, vendorRef, scope, nextDueAt: nextAttestationDue(at), evidenceId: record.id }
    set({ evidence: [...s.evidence, record], attestations: [attestation, ...s.attestations] })
    get().pushToast({ title: 'Attestation recorded', body: `Next due ${attestation.nextDueAt.slice(0, 10)}.`, tone: 'ok', evidenceId: record.id })
  },

  /**
   * The one irreversible act the platform performs on customer data. It runs
   * as AC-71 demands: two named humans, never an agent. The chain keeps its
   * hashes — the certificate records the root at the moment of deletion, and
   * is itself the next sealed record, so an auditor can prove the sequence.
   */
  certifyDeletion: (tower, by, secondControl, reason) => {
    const s = get()
    if (!secondControl.trim() || secondControl.trim().toLowerCase() === by.toLowerCase()) {
      get().pushToast({ title: 'Deletion refused', body: 'Four-eyes: the second control must be a different named human.', tone: 'crit' })
      return null
    }
    const manifest = deletionManifest(Object.values(s.work), Object.values(s.runs), s.assertions, tower)
    if (!manifest.workIds.length && !manifest.assertionIds.length) {
      get().pushToast({ title: 'Nothing to delete', body: 'No closed work or stale assertions in scope for that tower.', tone: 'info' })
      return null
    }
    const at = nowIso(s.clockOffsetMins)
    const preRootHash = verifyChain(s.evidence).rootHash
    const id = `del_${digest(tower + at + s.tick).slice(0, 6)}`
    const label = TOWER_BY_ID[tower]?.name ?? tower

    const approval = appendRecord(s.evidence, {
      id: `ev_${digest('delapprove' + id).slice(0, 10)}`,
      at, kind: 'approval', actor: secondControl, actionClass: 'AC-71',
      summary: `Deletion approved by second control — ${label}`,
      payload: { deletion: id, requestedBy: by, scope: { kind: 'tower', target: tower }, manifestHash: manifestHash(manifest), counts: { workObjects: manifest.workIds.length, runs: manifest.runIds.length, assertions: manifest.assertionIds.length } },
      sealed: true,
    })
    const certificate: DeletionCertificate = {
      id, scope: { kind: 'tower', target: tower, label }, requestedBy: by, secondControl, at,
      counts: { workObjects: manifest.workIds.length, runs: manifest.runIds.length, assertions: manifest.assertionIds.length },
      preRootHash, manifestHash: manifestHash(manifest), reason, evidenceIds: [approval.id],
    }
    const action = appendRecord([...s.evidence, approval], {
      id: `ev_${digest('delaction' + id).slice(0, 10)}`,
      at, kind: 'action', actor: by, actionClass: 'AC-71',
      summary: `Certified deletion — ${label}: ${certificate.counts.workObjects} work objects, ${certificate.counts.runs} runs, ${certificate.counts.assertions} stale assertions`,
      payload: { certificate: { ...certificate, evidenceIds: [approval.id] }, manifest, executedBy: 'human — AC-71 is never agent-executed' },
      sealed: true,
    })
    certificate.evidenceIds.push(action.id)

    const drop = new Set(manifest.workIds)
    const dropRuns = new Set(manifest.runIds)
    const dropAssertions = new Set(manifest.assertionIds)
    const work = Object.fromEntries(Object.entries(s.work).filter(([k]) => !drop.has(k)))
    const runs = Object.fromEntries(Object.entries(s.runs).filter(([k]) => !dropRuns.has(k)))
    const assertions = s.assertions.filter((a) => !dropAssertions.has(a.id))

    set({ evidence: [...s.evidence, approval, action], work, runs, assertions, deletions: [certificate, ...s.deletions], verification: null })
    get().pushToast({ title: `Deletion certified — ${id}`, body: `${certificate.counts.workObjects} work objects and ${certificate.counts.assertions} stale assertions removed from ${label}; certificate sealed with the pre-deletion root hash.`, tone: 'ok', evidenceId: action.id })
    return certificate
  },

  /** The original two-scope brake, now a thin wrapper over suspensions. */
  setBrake: (scope, on, by) => {
    const s = get()
    const kind = scope === 'global' ? 'global' : 'tower'
    if (on) {
      get().suspend(kind, scope, by, scope === 'global' ? 'Global autonomy brake' : 'Tower brake')
    } else {
      const existing = s.suspensions.find((x) => x.scope === kind && x.target === scope)
      if (existing) get().release(existing.id, by)
    }
  },

  suspendAgent: (agentId, by, reason) => {
    const s = get()
    const agent = s.agents[agentId]
    if (!agent) return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('susp' + agentId + s.tick).slice(0, 10)}`,
      at, kind: 'decision', agentId, actor: by,
      summary: `Agent ${agent.name} suspended`, payload: { reason, restoration: 'root cause + re-pass stage gates' }, sealed: true,
    })
    set({ evidence: [...s.evidence, record], agents: { ...s.agents, [agentId]: { ...agent, state: 'suspended' } } })
    get().pushToast({ title: `${agent.name} suspended`, body: 'Client-visible. Restoration requires root cause and re-passing the stage gates.', tone: 'crit', evidenceId: record.id })
  },

  /* -------------------------------- missions ------------------------------- */

  delegateMission: (m, by) => {
    const s = get()
    const id = `msn_${digest(m.name + s.tick).slice(0, 8)}`
    const at = nowIso(s.clockOffsetMins)
    const mission: Mission = { ...m, id, state: 'active', consumed: { spendUsd: 0, runs: 0 }, createdAt: at }
    set({ missions: { ...s.missions, [id]: mission } })
    get().logEvidence(
      'decision',
      by,
      `Mission delegated — ${m.name}`,
      {
        goal: m.goal,
        workforce: m.workforce,
        constraints: m.constraints,
        // The engine remains the ceiling; the mission only narrows (§A4.2).
        ceiling: 'Autonomy Policy Engine — mission cannot widen it',
      },
    )
    get().pushToast({ title: 'Mission active', body: `${m.name} — the workforce is pursuing it now.`, tone: 'ok' })
    return id
  },

  /**
   * The budget accumulator. Without this a spend ceiling is a number on a
   * slide — §A4.2 makes budgets the guardrail that lets a client sign for
   * autonomy, so exhaustion has to actually bite.
   */
  chargeMission: (missionId, spendUsd, runs = 0) => {
    const s = get()
    const m = s.missions[missionId]
    if (!m || m.state !== 'active') return

    const before = budgetUse(m)
    const charged: Mission = {
      ...m,
      consumed: { spendUsd: m.consumed.spendUsd + spendUsd, runs: m.consumed.runs + runs },
    }
    const after = budgetUse(charged)

    if (budgetExhausted(charged)) charged.state = 'exhausted'
    set({ missions: { ...s.missions, [missionId]: charged } })

    if (charged.state === 'exhausted') {
      get().logEvidence('decision', 'Mission service', `Mission ${m.name} exhausted its budget — degraded to advise`, {
        spendUsd: charged.consumed.spendUsd,
        spendBudgetUsd: m.constraints.spendBudgetUsd,
        runs: charged.consumed.runs,
        runBudget: m.constraints.runBudget,
      })
      get().pushToast({
        title: 'Mission budget exhausted',
        body: `${m.name} has degraded to advise. Nothing runs unattended until you raise the budget.`,
        tone: 'warn',
      })
    } else if (before.worst < BUDGET_WARN && after.worst >= BUDGET_WARN) {
      // §A4.1 escalation: page the owner at 80%, before exhaustion surprises them.
      get().pushToast({
        title: 'Mission at 80% of budget',
        body: `${m.name} — ${m.escalation.pageRole} paged, per the mission's escalation clause.`,
        tone: 'warn',
      })
    }
  },

  setMissionState: (missionId, state, by) => {
    const s = get()
    const m = s.missions[missionId]
    if (!m) return
    set({ missions: { ...s.missions, [missionId]: { ...m, state } } })
    get().logEvidence('decision', by, `Mission ${m.name} set to ${state}`, { from: m.state, to: state })
  },

  /* ------------------------------- proposals ------------------------------- */

  /**
   * A proposal decided is a decision item originated by an agent — which is
   * what AG-3 counts. Recorded to the chain either way: a rejected proposal is
   * evidence about the agent's judgement, not something to discard.
   */
  decideProposal: (id, verdict, by, note) => {
    const s = get()
    const p = s.proposals[id]
    if (!p || p.state !== 'open') return

    set({ proposals: { ...s.proposals, [id]: { ...p, state: verdict, decidedBy: by, decidedNote: note } } })

    get().logEvidence(
      'decision',
      by,
      `Proposal ${verdict} — ${p.claim}`,
      { kind: p.kind, from: p.from, requested: p.requestedDecision, evidence: p.evidence.map((e) => e.label), note: note ?? null },
      { agentId: p.from, actionClass: p.permission?.actionClass },
    )

    get().pushToast({
      title: verdict === 'accepted' ? 'Proposal accepted' : 'Proposal rejected',
      body: verdict === 'accepted'
        ? 'Recorded in the decision register and fed back to the agent.'
        : 'The disagreement feeds the evaluation service.',
      tone: verdict === 'accepted' ? 'ok' : 'warn',
    })
  },

  reinstateAgent: (agentId, by) => {
    const s = get()
    const agent = s.agents[agentId]
    if (!agent) return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('reins' + agentId + s.tick).slice(0, 10)}`,
      at, kind: 'decision', agentId, actor: by,
      summary: `Agent ${agent.name} reinstated at probation`, payload: { gatesRepassed: ['replay', 'shadow'] }, sealed: true,
    })
    set({ evidence: [...s.evidence, record], agents: { ...s.agents, [agentId]: { ...agent, state: 'probation' } } })
    get().pushToast({ title: `${agent.name} reinstated`, body: 'Returns at probation with sampled review at double the standard rate.', tone: 'ok', evidenceId: record.id })
  },

  /**
   * Generic append for surfaces that produce evidence outside the work-object
   * lifecycle — the copilot's routed intents, denials and sealed executions.
   */
  logEvidence: (kind, actor, summary, payload, refs) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(summary + s.evidence.length + s.tick).slice(0, 10)}`,
      at,
      kind,
      actor,
      summary,
      payload: payload ?? {},
      workObjectId: refs?.workObjectId,
      agentId: refs?.agentId,
      actionClass: refs?.actionClass,
      sealed: true,
    })
    set({ evidence: [...s.evidence, record], verification: null })
    return record.id
  },

  /* ------------------------------ evidence chain --------------------------- */

  runChainVerification: () => set({ verification: verifyChain(get().evidence) }),

  /**
   * Demonstration control for the audit walkthrough: edits one sealed record's
   * payload in place. The chain verifier detects it and every downstream record.
   */
  tamperEvidence: (id) => {
    const s = get()
    set({
      evidence: s.evidence.map((r) =>
        r.id === id ? { ...r, payload: { ...r.payload, __edited: 'value altered outside the platform' }, tampered: true } : r,
      ),
      verification: null,
    })
    get().pushToast({ title: 'Record altered outside the platform', body: 'Run chain verification to see the break propagate.', tone: 'warn' })
  },

  restoreEvidence: () => {
    const s = get()
    set({ evidence: s.evidence.map((r) => (r.tampered ? { ...r, payload: Object.fromEntries(Object.entries(r.payload).filter(([k]) => k !== '__edited')), tampered: false } : r)), verification: null })
    get().pushToast({ title: 'Record restored', body: 'The chain will verify clean again.', tone: 'ok' })
  },

  /* --------------------------------- toasts -------------------------------- */

  pushToast: (t) => {
    const id = `tst_${Math.random().toString(36).slice(2, 9)}`
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => get().dismissToast(id), 6500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/* --------------------------------- selectors -------------------------------

   Derived collections go through useShallow: a selector that builds a fresh
   array on every call would otherwise fail zustand's snapshot identity check
   and re-render without end.
   -------------------------------------------------------------------------- */

export const useWorkList = () => useAstra(useShallow((s) => Object.values(s.work)))

export const useApprovals = () =>
  useAstra(
    useShallow((s) =>
      Object.values(s.work)
        .filter((w) => w.state === 'gated')
        .sort((a, b) => b.slaElapsedMins / b.slaTargetMins - a.slaElapsedMins / a.slaTargetMins),
    ),
  )

export const useApprovalCount = () =>
  useAstra((s) => Object.values(s.work).reduce((n, w) => n + (w.state === 'gated' ? 1 : 0), 0))

export const useOpenWork = () =>
  useAstra(useShallow((s) => Object.values(s.work).filter((w) => !['resolved', 'learned'].includes(w.state))))
