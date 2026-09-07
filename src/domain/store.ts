import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { appendRecord, verifyChain, type ChainVerification } from './evidence'
import { EVIDENCE, NOW, RUNS, WORK_OBJECTS } from './workSeed'
import { ASSERTIONS } from './knowledge'
import { AGENTS } from './estate'
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
