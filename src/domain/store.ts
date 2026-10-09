import type { IncidentNotice, LoggedAction } from './privacy'
import { describeDirective, type Directive } from './clientControl'
import { REMEDY_LABEL, type Remedy } from './commitments'
import type { AreaLoad, Procedure, Review } from './procedures'
import { buildPack, manifestOf, type PackExport } from './successorPack'
import type { Settlement } from './exit'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { appendRecord, sealChain, verifyChain, type ChainVerification } from './evidence'
import { type Experiment } from './experiments'
import { runLoad, type Fault, type LoadResult } from './dataLoad'
import { DATA_ITEM_BY_ID } from './dataEstate'
import { type PublishRecord } from './publication'
import { REPORT_BY_ID } from './finance'
import { classify, handoffFor, resolveItems, routeFor, targetFor, towerForItems, type Classification, type InboundTicket, type Route } from './intake'
import { chainFrom, managerOf } from './escalation'
import { runPack } from './verification'
import { DEMAND_CLASSES } from './ledgers'
import { knowledgeFor, knowledgeSummary, type WorkKnowledge } from './workContext'
import { loadedRecords, recordEngagementId, recordEpoch, setRecordEpoch } from './config'
import { EVIDENCE, NOW, RUNS, WORK_OBJECTS } from './workSeed'
import { ASSERTIONS } from './knowledge'
import { AGENTS, AGENT_BY_ID, TOWER_BY_ID } from './estate'
import { AC, ROLE_BY_ID } from './reference'
import { auditOversight, clocksFor, oversightSignal, type AiIncident, type AiIncidentSignal, type OversightAudit } from './aiIncident'
import type { RedTeamResult } from './redTeam'
import type { BiasResult } from './biasSuite'
import type { ConformanceRun } from './conformance'
import type { Objective } from './objectives'
import { OBJECTIVES } from './objectiveSeed'
import type { CompileResult } from './objectiveCompiler'
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
  /** Privacy actions recorded this session against requests in the register. */
  privacyLog: LoggedAction[]
  /** Incident notices to the client recorded this session. */
  incidentNotices: IncidentNotice[]
  /** Returns and destructions of what the platform holds, recorded this session. */
  exitLog: Settlement[]
  /** What has been decided about commitments that are not being met. */
  commitmentLog: Remedy[]
  /** The client's own directives over the workforce: what it has capped or stopped. */
  clientDirectives: Directive[]
  /** Successor packs produced this session, each with its manifest. */
  packExports: PackExport[]
  /** The client's procedure areas as adopted into the register, newest last. */
  areaLoads: AreaLoad[]
  /** Procedure reviews recorded this session. */
  procedureReviews: Review[]
  /** The procedures written for this engagement. Empty until one is drafted. */
  procedures: Procedure[]
  /** Recommendations funded as experiments, each with the count it was struck against. */
  experiments: Experiment[]
  /** When a report was refreshed on request, and by whom. */
  reportRefreshes: { reportId: string; at: string; by: string; evidenceId?: string }[]
  /** What the publish gate decided about each load it saw. */
  publishLog: PublishRecord[]
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
  /** What the client is buying, and the measures proposed to evidence each one. */
  objectives: Objective[]
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
  /** A named client owner accepts the measures proposed for an objective. Sealed as an approval. */
  acceptObjective: (id: string, by: string) => void
  /** Replaces the objective set with a compiler proposal. Every objective still needs client acceptance. */
  applyCompiledObjectives: (result: CompileResult, by: string) => void
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

  /** Records the return of one holding to the client, with the reference of the handover. */
  recordDataReturn: (holdingId: string, by: string, reference: string) => void
  /** Certifies the destruction of one holding: the method, the person, and the seal. */
  certifyHoldingDestruction: (holdingId: string, by: string, reference: string, method: string) => void

  /** Records what was decided about a commitment that is not being met. */
  recordCommitmentRemedy: (remedy: Omit<Remedy, 'at' | 'evidenceId'>) => void

  /** The client caps, stops or restores an agent. Theirs to set and theirs to lift. */
  setClientAutonomy: (directive: Omit<Directive, 'id' | 'at' | 'evidenceId'>) => Directive

  /** Builds the successor pack and seals its manifest. Returns the production record. */
  produceSuccessorPack: (by: string, reason: string) => PackExport

  /** Adopts the client's procedure areas into the register, against a clause. */
  loadProcedureAreas: (load: Omit<AreaLoad, 'at' | 'evidenceId'>) => AreaLoad
  /** Records a review of one procedure: who, what changed, and the version it leaves it at. */
  reviewProcedure: (review: Omit<Review, 'at' | 'evidenceId'>) => Review

  /** A person records that an external recipient was told of an erasure. The platform does not tell them itself. */
  recordRecipientNotice: (requestId: string, recipientId: string, by: string, reference: string) => void
  /** A person records the notice given to the client of a data incident, which stops the contractual clock. */
  recordIncidentNotice: (incidentId: string, by: string, reference: string) => void
  /**
   * Funds a recommendation as an experiment. Returns the record, or null where
   * that finding has already been funded.
   */
  fundRecommendation: (e: Omit<Experiment, 'id' | 'fundedAt' | 'evidenceId'>) => Experiment | null
  /**
   * Admits a ticket from the client's ticketing system: the integration point.
   * Returns the work object it became, and the reasoning behind it.
   */
  admitTicket: (ticket: InboundTicket) => {
    workObject: WorkObject
    duplicate: boolean
    classification?: Classification
    route?: Route
    knowledge?: WorkKnowledge
  }
  /**
   * Runs one load through the publish gate, optionally with a fault injected
   * into what the source hands over. Returns what ran and what was decided,
   * or null where no such item exists.
   */
  runDataLoad: (itemId: string, fault: Fault | null, by: string) => { load: LoadResult; record: PublishRecord } | null
  /**
   * Refreshes one report so it sees everything booked up to now. Returns the
   * time it now stands at, or null where no such report exists.
   */
  refreshReport: (reportId: string, by: string) => { at: string; evidenceId: string } | null
  /** Writes a drafted procedure into the register, as a draft for review. */
  writeProcedureDraft: (
    p: Omit<Procedure, 'id' | 'state' | 'version' | 'lastReviewedAt'>,
  ) => { procedure: Procedure; evidenceId: string }

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

/* --------------------------- Surviving a refresh ---------------------------- */

/**
 * What a person did here, kept across a reload.
 *
 * The line is drawn at records rather than at state. Everything a person
 * recorded through a confirmed action — a privacy notice, a destruction
 * certificate, a commitment remedy, a client directive, a successor pack, an
 * adopted list of procedure areas, a procedure review — is an append-only
 * register and survives. The simulated estate does not: work items, runs and
 * agents are regenerated from their seeds and change on every tick, so
 * writing them to storage every second would be both wasteful and a lie
 * about what the platform is.
 *
 * The evidence chain is stored as its tail alone and re-sealed against the
 * seeded backbone on load, so the hashes stay arithmetic rather than
 * remembered — a chain that loaded its own hashes from storage could not
 * detect that storage had been edited.
 */
interface SessionRecords {
  privacyLog: LoggedAction[]
  incidentNotices: IncidentNotice[]
  exitLog: Settlement[]
  commitmentLog: Remedy[]
  clientDirectives: Directive[]
  packExports: PackExport[]
  areaLoads: AreaLoad[]
  procedureReviews: Review[]
  procedures: Procedure[]
  experiments: Experiment[]
  /** When a report was refreshed on request, and by whom. */
  reportRefreshes: { reportId: string; at: string; by: string; evidenceId?: string }[]
  /** What the publish gate decided about each load it saw. */
  publishLog: PublishRecord[]
  /** Appended since the seeded backbone, without their hashes. */
  evidenceTail: Omit<EvidenceRecord, 'hash' | 'prevHash' | 'tampered'>[]
}

const EMPTY_SESSION: SessionRecords = {
  privacyLog: [], incidentNotices: [], exitLog: [], commitmentLog: [],
  clientDirectives: [], packExports: [], areaLoads: [], procedureReviews: [], procedures: [], experiments: [],
  reportRefreshes: [], publishLog: [], evidenceTail: [],
}

/**
 * What people have recorded, as the database held it when the application
 * started. Fetched by the bootstrap before the domain is imported, for the
 * same reason the configuration is: every reader below stays synchronous.
 */
const SESSION: SessionRecords = { ...EMPTY_SESSION, ...(loadedRecords() as Partial<SessionRecords>) }

/** The chain as it stands: the seeded backbone, then anything this browser appended. */
const hydratedEvidence = SESSION.evidenceTail.length
  ? sealChain([...PRISTINE_EVIDENCE, ...SESSION.evidenceTail])
  : PRISTINE_EVIDENCE

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
  theme: ((typeof localStorage !== 'undefined' && localStorage.getItem('astra.theme')) as ThemeMode) || 'dark',
  density: ((typeof localStorage !== 'undefined' && localStorage.getItem('astra.density')) as Density) || 'compact',
  simRunning: true,
  tick: 0,
  clockOffsetMins: 0,

  work: byId(WORK_OBJECTS),
  runs: byId(RUNS),
  evidence: hydratedEvidence,
  assertions: ASSERTIONS,
  agents: byId(AGENTS),
  missions: byId(MISSIONS),
  proposals: byId(PROPOSALS),
  privacyLog: SESSION.privacyLog,
  incidentNotices: SESSION.incidentNotices,
  exitLog: SESSION.exitLog,
  commitmentLog: SESSION.commitmentLog,
  clientDirectives: SESSION.clientDirectives,
  packExports: SESSION.packExports,
  areaLoads: SESSION.areaLoads,
  procedureReviews: SESSION.procedureReviews,
  procedures: SESSION.procedures,
  experiments: SESSION.experiments,
  reportRefreshes: SESSION.reportRefreshes,
  publishLog: SESSION.publishLog,
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
  objectives: OBJECTIVES,
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
      // Gates whose timeout elapsed this tick, recorded after the walk so the
      // evidence and the timeline are written once rather than per field.
      const timedOut: { id: string; from: string; to: string; waitedMins: number }[] = []
      // Work whose verification did not pass, so it goes to a person instead
      // of closing. Collected and written once, like the timeouts above.
      const held: { id: string; result: 'amber' | 'red'; summary: string }[] = []
      const open: WorkState[] = ['detected', 'triaged', 'planned', 'gated', 'executing', 'verifying']

      for (const id of Object.keys(work)) {
        const wo = work[id]
        if (!open.includes(wo.state)) continue
        if (wo.slaPaused) continue

        const elapsed = wo.slaElapsedMins + 1
        const burn = elapsed / wo.slaTargetMins
        const bp = Math.min(0.98, Math.max(0.02, burn * (0.7 + (wo.priority === 'P1' ? 0.5 : wo.priority === 'P2' ? 0.3 : 0.1))))
        work[id] = { ...wo, slaElapsedMins: elapsed, breachProbability: bp }

        // A gate carries a timeout. Nothing enforced it, so "escalates after
        // 10 minutes" was a decoration on the card. The workflow moves it
        // itself now, which is the half of an escalation path that does not
        // depend on somebody noticing.
        const gate = work[id].autonomy?.gates[0]
        if (wo.state === 'gated' && gate?.timeoutSec) {
          const waitedSec = (work[id].gateWaitedMins ?? 0) * 60 + 60
          const waitedMins = waitedSec / 60
          if (waitedSec >= gate.timeoutSec) {
            const up = managerOf(gate.role)
            if (up) {
              timedOut.push({ id, from: gate.role, to: up.to.id, waitedMins })
              work[id] = {
                ...work[id],
                gateWaitedMins: 0,
                autonomy: { ...work[id].autonomy!, gates: work[id].autonomy!.gates.map((g, i) => (i === 0 ? { ...g, role: up.to.id, escalatesTo: up.to.escalatesTo ?? '' } : g)) },
              }
            } else {
              // Top of the chain: the clock keeps running and it stays here.
              work[id] = { ...work[id], gateWaitedMins: waitedMins }
            }
          } else {
            work[id] = { ...work[id], gateWaitedMins: waitedMins }
          }
        }
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

        // Leaving verifying is the one transition that has to be earned. The
        // pack runs against the registers behind what was acted on, and a
        // failure sends the work to a person rather than closing it — which is
        // the branch the lifecycle never had, because verification could only
        // ever pass.
        // Already held on a verification: it waits for a person, and the pack
        // is not run again. Re-running it is what wrote the same record over
        // and over.
        if (wo.verificationHeld) continue

        if (wo.state === 'verifying') {
          const classes = wo.autonomy?.actionClasses ?? []
          // A verification exists to catch a bad change. An action that only
          // read something changed nothing, so there is nothing to verify and
          // holding it would be theatre — the first cut of this held every
          // read-only run at amber and would have stalled the whole board.
          const changed = classes.some((c) => AC[c] && AC[c].reversibility !== 'read_only')
          if (changed) {
            const pack = classes.map((c) => AC[c]?.verificationPack).find((p) => p && p !== 'none' && p !== 'n/a')
            const v = runPack(pack, wo.affected, { confidence: wo.classificationConfidence })
            if (v.result !== 'green') {
              held.push({ id: wo.id, result: v.result, summary: v.summary })
              continue
            }
          }
        }

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

      // A timeout escalation is a decision the platform took, so it is sealed
      // and narrated like one a person took. Written here, after the walk, so
      // the chain is appended to once per tick rather than per work object.
      let evidence = s.evidence
      for (const e of timedOut) {
        const wo = work[e.id]
        const from = ROLE_BY_ID[e.from]
        const to = ROLE_BY_ID[e.to]
        const at = nowIso(offset)
        const record = appendRecord(evidence, {
          id: `ev_${digest('gto' + e.id + t).slice(0, 10)}`,
          at, kind: 'decision', workObjectId: e.id, actor: 'Policy engine',
          summary: `Gate timed out after ${Math.round(e.waitedMins)} min — moved from ${from?.title ?? e.from} to ${to?.title ?? e.to}`,
          payload: { from: e.from, to: e.to, waitedMins: Math.round(e.waitedMins), clock: 'continues to run' },
          sealed: true,
        })
        evidence = [...evidence, record]
        work[e.id] = {
          ...wo,
          narrative: [...wo.narrative, {
            id: `t_${t}_gto`, at, actorKind: 'system', actor: 'Policy engine',
            text: `No decision in ${Math.round(e.waitedMins)} minutes, so the gate moved itself: ${to?.title ?? e.to} (${to?.person ?? '—'}) now holds it. The clock continues to run.`,
            evidenceId: record.id, level: 'warn',
          }],
        }
      }

      // A verification that did not pass is a decision too: the work stops
      // where it is, a person takes it, and the failing probe is on the record.
      for (const hd of held) {
        const wo = work[hd.id]
        const at = nowIso(offset)
        const record = appendRecord(evidence, {
          id: `ev_${digest('vfail' + hd.id + t).slice(0, 10)}`,
          at, kind: 'verification', workObjectId: hd.id, runId: wo.runId,
          actionClass: wo.autonomy?.actionClasses[0], actor: 'Verification pack',
          summary: `Verification ${hd.result === 'red' ? 'failed' : 'could not be completed'} — not closed`,
          payload: { result: hd.result, detail: hd.summary }, sealed: true,
        })
        evidence = [...evidence, record]
        work[hd.id] = {
          ...wo,
          state: 'triaged',
          assigneeKind: 'human',
          assignee: ROLE_BY_ID.resolver?.person ?? 'Resolver on shift',
          verificationHeld: { at, result: hd.result, summary: hd.summary },
          narrative: [...wo.narrative, {
            id: `t_${t}_vf`, at, actorKind: 'system', actor: 'Verification pack',
            text: `${hd.summary} Not closed — it goes to a person with the failing probe attached.`,
            evidenceId: record.id, level: hd.result === 'red' ? 'crit' : 'warn',
          }],
        }
        if (wo.runId && runs[wo.runId]) {
          const run = runs[wo.runId]
          runs[wo.runId] = {
            ...run,
            state: 'aborted',
            steps: run.steps.map((st) => (st.kind === 'verify' ? { ...st, state: 'failed' as const, detail: hd.summary } : st)),
          }
        }
      }

      return { tick: t, clockOffsetMins: offset, work, runs, ...(timedOut.length || held.length ? { evidence } : {}) }
    }),

  /* ------------------------------- approvals ------------------------------ */

  approve: (woId, who, note) => {
    const s = get()
    const wo = s.work[woId]
    if (!wo) return
    const at = nowIso(s.clockOffsetMins)

    // Four eyes means two people, and the register already says which classes
    // require it: AC-58 and AC-71. The engine added a second gate for them and
    // nothing checked that a different person cleared it, so one person
    // approving twice satisfied a control that exists to stop exactly that.
    const classes = wo.autonomy?.actionClasses ?? []
    const needsFourEyes = classes.filter((c) => AC[c]?.fourEyes)
    if (needsFourEyes.length) {
      const already = s.evidence.filter((e) => e.kind === 'approval' && e.workObjectId === woId)
      if (already.some((e) => e.actor === who)) {
        get().pushToast({
          title: 'Second approval refused',
          body: `${needsFourEyes.join(', ')} requires four eyes, and ${who} has already approved this. It needs a different approver.`,
          tone: 'crit',
        })
        return
      }
    }

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
      work: { ...s.work, [woId]: { ...wo, state: 'triaged', awaitingApproval: false, assigneeKind: 'human', assignee: who, verificationHeld: undefined, narrative: [...wo.narrative, entry] } },
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

    // The gate's own role, not the person who happens to be looking at it.
    const gate = wo.autonomy?.gates[0]
    const holder = gate?.role ?? s.roleId
    const up = managerOf(holder)

    if (!up) {
      // An escalation of last resort. Refusing is the honest answer: writing a
      // record that reads like a hand-off, which is what this used to do, left
      // everyone believing somebody else had it.
      const record = appendRecord(s.evidence, {
        id: `ev_${digest(woId + 'escnone' + s.tick).slice(0, 10)}`,
        at, kind: 'decision', workObjectId: woId, actor: who,
        summary: `Escalation refused — nothing above ${ROLE_BY_ID[holder]?.title ?? holder} holds an approval right`,
        payload: { from: holder, chain: chainFrom(holder).map((r) => r.id) }, sealed: true,
      })
      const entry: TimelineEntry = {
        id: `t_${s.tick}_e0`, at, actorKind: 'human', actor: who,
        text: `Not escalated: ${ROLE_BY_ID[holder]?.title ?? holder} is the end of the approval chain, so there is nobody above to take it. The gate stays here and the clock keeps running.`,
        evidenceId: record.id, level: 'crit',
      }
      set({ evidence: [...s.evidence, record], work: { ...s.work, [woId]: { ...wo, narrative: [...wo.narrative, entry] } } })
      get().pushToast({ title: 'Escalation refused', body: `${wo.ref} · ${ROLE_BY_ID[holder]?.title ?? holder} is the end of the chain`, tone: 'crit', evidenceId: record.id })
      return
    }

    const skipped = up.skipped.length
      ? ` ${up.skipped.map((r) => r.title).join(' and ')} ${up.skipped.length === 1 ? 'was' : 'were'} passed over, holding no approval right.`
      : ''
    const record = appendRecord(s.evidence, {
      id: `ev_${digest(woId + 'esc' + s.tick).slice(0, 10)}`,
      at, kind: 'decision', workObjectId: woId, actor: who,
      summary: `Approval moved from ${up.from.title} to ${up.to.title} (${up.to.person})`,
      payload: { from: up.from.id, to: up.to.id, skipped: up.skipped.map((r) => r.id), clock: 'continues to run' },
      sealed: true,
    })
    const entry: TimelineEntry = {
      id: `t_${s.tick}_e`, at, actorKind: 'human', actor: who,
      text: `Escalated to ${up.to.title} — ${up.to.person} now holds the gate.${skipped} The clock continues to run.`,
      evidenceId: record.id, level: 'warn',
    }

    // The gate moves. That is the whole difference: the approver changes, so
    // the inbox it appears in changes with it.
    const gates = (wo.autonomy?.gates ?? []).map((g, i) => (i === 0 ? { ...g, role: up.to.id, escalatesTo: up.to.escalatesTo ?? '' } : g))
    set({
      evidence: [...s.evidence, record],
      work: {
        ...s.work,
        [woId]: {
          ...wo,
          ...(wo.autonomy ? { autonomy: { ...wo.autonomy, gates } } : {}),
          narrative: [...wo.narrative, entry],
        },
      },
    })
    get().pushToast({ title: `Escalated to ${up.to.title}`, body: `${wo.ref} · ${up.to.person} holds the gate; the clock keeps running`, tone: 'warn', evidenceId: record.id })
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

  /* -------------------------------- objectives ---------------------------- */

  /**
   * The mapping from an objective to the measures that evidence it is a
   * proposal until a named client owner accepts it. Accepting it is a
   * decision about what will count as progress, so it is sealed like one —
   * including the gaps, which the client is accepting as unmeasured.
   */
  acceptObjective: (id, by) => {
    const s = get()
    const o = s.objectives.find((x) => x.id === id)
    if (!o || o.state === 'accepted') return
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('obj' + id + s.tick).slice(0, 10)}`,
      at, kind: 'approval', actor: by,
      summary: `Objective accepted — ${o.statement.split(':')[0]}`,
      payload: {
        objective: id,
        source: o.source,
        measures: o.measures.map((m) => ({ id: m.id, label: m.label, kind: m.source.kind, proxy: Boolean(m.proxy) })),
        proxiesAccepted: o.measures.filter((m) => m.proxy).map((m) => m.label),
        gapsAccepted: o.gaps,
      },
      sealed: true,
    })
    set({
      evidence: [...s.evidence, record],
      objectives: s.objectives.map((x) => (x.id === id ? { ...x, state: 'accepted', acceptedBy: by, acceptedAt: at } : x)),
    })
    get().pushToast({
      title: 'Objective accepted',
      body: o.gaps.length
        ? `${o.gaps.length} gap${o.gaps.length === 1 ? '' : 's'} accepted as unmeasured — recorded with the acceptance.`
        : 'Every measure behind this objective resolves to a governed figure.',
      tone: o.gaps.length ? 'warn' : 'ok',
      evidenceId: record.id,
    })
  },

  /**
   * The compiler proposes; this records the proposal as the working set.
   * Nothing is accepted by applying it — every objective arrives proposed and
   * still needs its client owner. What the compiler tried to invent is sealed
   * alongside what it got right, because a proposal whose failures are
   * invisible is worth less than one that shows them.
   */
  applyCompiledObjectives: (result, by) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const record = appendRecord(s.evidence, {
      id: `ev_${digest('objcompile' + s.tick + s.evidence.length).slice(0, 10)}`,
      at, kind: 'decision', actor: by,
      summary: `Objective set compiled — ${result.objectives.length} proposed, ${result.rejections.length} measure${result.rejections.length === 1 ? '' : 's'} rejected`,
      payload: {
        note: result.note,
        proposed: result.objectives.map((o) => ({
          id: o.id,
          statement: o.statement,
          measures: o.measures.map((m) => ({ label: m.label, kind: m.source.kind, proxy: Boolean(m.proxy) })),
          unmeasured: o.measures.filter((m) => m.source.kind === 'none').length,
          gaps: o.gaps,
        })),
        rejected: result.rejections,
        replaced: s.objectives.map((o) => ({ id: o.id, state: o.state })),
        note2: 'Applying a compilation accepts nothing. Each objective requires its client owner.',
      },
      sealed: true,
    })
    set({ evidence: [...s.evidence, record], objectives: result.objectives })
    get().pushToast({
      title: `${result.objectives.length} objectives proposed`,
      body: result.rejections.length
        ? `${result.rejections.length} proposed measure${result.rejections.length === 1 ? '' : 's'} did not resolve and ${result.rejections.length === 1 ? 'was' : 'were'} dropped. Each objective still needs its client owner.`
        : 'Every proposed measure resolved. Each objective still needs its client owner.',
      tone: result.rejections.length ? 'warn' : 'ok',
      evidenceId: record.id,
    })
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

  recordDataReturn: (holdingId, by, reference) => {
    const s = get()
    if (s.exitLog.some((x) => x.holdingId === holdingId && x.action === 'returned')) return
    const at = nowIso(s.clockOffsetMins)
    get().logEvidence('action', by, `Client data returned — ${holdingId}`, { holdingId, reference })
    set({ exitLog: [...get().exitLog, { holdingId, action: 'returned', at, by, reference }] })
  },

  certifyHoldingDestruction: (holdingId, by, reference, method) => {
    const s = get()
    if (s.exitLog.some((x) => x.holdingId === holdingId && x.action === 'destroyed')) return
    const at = nowIso(s.clockOffsetMins)
    get().logEvidence('approval', by, `Destruction certified — ${holdingId}`, { holdingId, reference, method })
    set({ exitLog: [...get().exitLog, { holdingId, action: 'destroyed', at, by, reference, method }] })
  },

  loadProcedureAreas: (load) => {
    const at = nowIso(get().clockOffsetMins)
    const evidenceId = get().logEvidence(
      'knowledge',
      load.by,
      `Procedure areas adopted — ${load.areas.length} from ${load.reference}`,
      { engagementId: load.engagementId, reference: load.reference, role: load.role, areas: load.areas.map((a) => a.name) },
    )
    const row: AreaLoad = { ...load, at, evidenceId }
    set({ areaLoads: [...get().areaLoads, row] })
    return row
  },

  reviewProcedure: (review) => {
    const at = nowIso(get().clockOffsetMins)
    const evidenceId = get().logEvidence(
      'verification',
      review.by,
      `Procedure reviewed — ${review.procedureId} at ${review.version}`,
      { procedureId: review.procedureId, version: review.version, changed: review.changed, role: review.role },
    )
    const row: Review = { ...review, at, evidenceId }
    set({ procedureReviews: [...get().procedureReviews, row] })
    return row
  },

  produceSuccessorPack: (by, reason) => {
    const at = nowIso(get().clockOffsetMins)
    // The content is built here, so the manifest covers what was actually
    // emitted rather than what the register says it would emit.
    const manifest = manifestOf(buildPack(), at, by)
    const id = `pex_${digest(manifest.digest).slice(0, 8)}`
    const evidenceId = get().logEvidence(
      'knowledge',
      by,
      `Successor pack produced — ${manifest.parts.length} parts, ${manifest.rows} records`,
      { reason, digest: manifest.digest, bytes: manifest.bytes, parts: manifest.parts.map((p) => ({ id: p.id, rows: p.rows, digest: p.digest })) },
    )
    const row: PackExport = { id, at, by, reason, manifest, evidenceId }
    set({ packExports: [...get().packExports, row] })
    return row
  },

  setClientAutonomy: (directive) => {
    const at = nowIso(get().clockOffsetMins)
    const id = `cd_${digest(`${directive.scope}${directive.targetId}${directive.kind}${at}`).slice(0, 8)}`
    // Sealed as the client's decision, with the role they hold: the supplier is
    // not in the path and the record has to show that.
    const evidenceId = get().logEvidence(
      'decision',
      directive.by,
      `${describeDirective(directive)} — by the client`,
      { scope: directive.scope, target: directive.targetId, kind: directive.kind, cap: directive.cap, reason: directive.reason, role: directive.role },
    )
    const row: Directive = { ...directive, id, at, evidenceId }
    set({ clientDirectives: [...get().clientDirectives, row] })
    return row
  },

  recordCommitmentRemedy: (remedy) => {
    const at = nowIso(get().clockOffsetMins)
    const evidenceId = get().logEvidence(
      remedy.kind === 'apply_consequence' ? 'approval' : 'decision',
      remedy.by,
      `${REMEDY_LABEL[remedy.kind]} — ${remedy.commitmentId}`,
      { commitmentId: remedy.commitmentId, kind: remedy.kind, detail: remedy.detail, reference: remedy.reference, dueAt: remedy.dueAt },
    )
    set({ commitmentLog: [...get().commitmentLog, { ...remedy, at, evidenceId }] })
  },

  recordRecipientNotice: (requestId, recipientId, by, reference) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const evidenceId = get().logEvidence('action', by, `Recipient ${recipientId} told of erasure ${requestId}`, { requestId, recipientId, reference })
    set({ privacyLog: [...get().privacyLog, { requestId, itemId: recipientId, outcome: 'notified', by, at, evidenceId }] })
  },

  /**
   * Refreshes one report, so it can see what has been booked since it last
   * looked.
   *
   * A fix somebody chose, not one the platform applied on their behalf: it
   * runs when they ask for it and it is recorded with their name, because a
   * figure that moved needs somebody to have moved it.
   */
  refreshReport: (reportId: string, by: string) => {
    const view = REPORT_BY_ID[reportId]
    if (!view) return null
    const at = nowIso(get().clockOffsetMins)
    const evidenceId = get().logEvidence('action', by, `${view.name} refreshed`, { reportId, refreshedTo: at })
    set({ reportRefreshes: [...get().reportRefreshes, { reportId, at, by, evidenceId }] })
    return { at, evidenceId }
  },

  /**
   * Runs one load through the publish gate and records what it decided.
   *
   * The fault, where there is one, changes what the source hands over. Nothing
   * after that is scripted: the totals are counted, reconciled against what
   * the source declared, and the decision follows. A load whose totals agree
   * publishes; one whose totals disagree, or which landed nothing at all, is
   * held and the consumer keeps reading the last set that did agree.
   *
   * A held load raises exactly one ticket, through the same intake any other
   * ticket comes through — duplicate suppression included, so a retry of the
   * same load on the same day does not raise a second.
   */
  runDataLoad: (itemId, fault, by) => {
    const s = get()
    const item = DATA_ITEM_BY_ID[itemId]
    if (!item) return null
    const startedAt = nowIso(s.clockOffsetMins)
    const load = runLoad(itemId, startedAt, fault)

    // No declared totals is not a pass. The gate cannot stand behind a load it
    // has nothing to check, and says so rather than publishing it quietly.
    const unreconcilable = load.expected === null
    const held = load.outcome === 'failed' || unreconcilable || load.reconciliation?.matches === false
    const reason = load.outcome === 'failed'
      ? load.error
      : unreconcilable
        ? 'The feed declares no control totals, so nothing could be reconciled against it'
        : `${load.reconciliation?.breaks.length} measure${load.reconciliation?.breaks.length === 1 ? '' : 's'} did not reconcile against the source's declared totals`

    const evidenceId = get().logEvidence(
      held ? 'decision' : 'verification',
      by,
      held ? `Load held: ${item.name}` : `Load published: ${item.name}`,
      {
        itemId, fault, outcome: load.outcome, durationMins: load.durationMins, retried: load.retried,
        expected: load.expected, observed: load.observed, breaks: load.reconciliation?.breaks ?? [], reason: held ? reason : undefined,
      },
    )

    let workObjectId: string | undefined
    if (held) {
      // One ticket per load per day, through the ordinary intake so it is
      // classified, routed and deduplicated like anything else.
      const admitted = get().admitTicket({
        externalRef: `DL-${itemId}-${startedAt.slice(0, 10)}`,
        system: 'Azure Data Factory',
        openedAt: startedAt,
        shortDescription: `${item.name}: load held — ${reason}`,
        category: 'Data',
        subCategory: fault === 'schema_change' ? 'Schema change' : fault === 'late' ? 'Late arrival' : 'Pipeline failure',
        priority: 'P2',
        configurationItems: [item.id],
      })
      workObjectId = admitted.workObject.id
    }

    const record: PublishRecord = {
      id: `pub_${digest(itemId + startedAt).slice(0, 8)}`,
      itemId, at: startedAt, by,
      state: held ? 'held' : 'published',
      ...(held ? { reason } : {}),
      expected: load.expected ?? { rows: 0, measures: {} },
      observed: load.observed ?? { rows: 0, measures: {} },
      breaks: load.reconciliation?.breaks ?? [],
      workObjectId, evidenceId,
    }
    set({ publishLog: [...get().publishLog, record] })
    return { load, record }
  },

  /**
   * Funds a recommendation as an experiment.
   *
   * The count the condition currently holds for is recorded with it, because
   * that is the only thing the outcome can later be measured against. Funding
   * the same finding twice is refused rather than duplicated: the second
   * record would have a baseline already moved by the first.
   */
  /**
   * Admits a ticket from the client's ticketing system.
   *
   * This is the integration point. The payload crosses it; everything after
   * is computed here and now — the configuration items resolved against the
   * estate graph, the class matched against the client's own history, the
   * blast radius walked, the knowledge pack assembled, and the routing
   * decided from what the platform actually holds.
   *
   * The work object lands triaged with that reasoning on its timeline and the
   * classification sealed, or it lands with a named person on it and the
   * reason it could not be attempted. Nothing is written twice: a ticket the
   * platform has already admitted is returned rather than duplicated.
   */
  admitTicket: (ticket) => {
    const s = get()
    const already = Object.values(s.work).find((w) => w.source?.ref === ticket.externalRef)
    if (already) return { workObject: already, duplicate: true }

    const at = nowIso(s.clockOffsetMins)
    const { resolved, unresolved } = resolveItems(ticket.configurationItems)
    const classification = classify(ticket)
    // Placed from the estate where the configuration items resolve, and from
    // the costed class where they do not. Both are read; neither is assumed.
    // A ticket that resolves to neither is admitted unplaced rather than
    // dropped — it arrived, and losing it would be worse than holding it.
    const classTower = classification.demandClass
      ? DEMAND_CLASSES.find((d) => d.id === classification.demandClass)?.tower ?? null
      : null
    const tower = towerForItems(resolved) ?? classTower
    const woId = `wo_${digest(ticket.externalRef).slice(0, 8)}`

    const base: WorkObject = {
      id: woId,
      ref: ticket.externalRef,
      type: 'incident',
      title: ticket.shortDescription,
      tower: tower ?? '',
      service: tower ? TOWER_BY_ID[tower]?.name ?? tower : 'Not placed — nothing on the ticket resolved to the estate',
      affected: resolved,
      demandClass: classification.demandClass ?? 'unclassified',
      classificationConfidence: classification.confidence,
      priority: ticket.priority,
      state: 'detected',
      createdAt: ticket.openedAt,
      slaTargetMins: targetFor(ticket.priority, tower ?? undefined).mins,
      slaElapsedMins: Math.max(0, Math.round((Date.parse(at) - Date.parse(ticket.openedAt)) / 60_000)),
      slaPaused: false,
      breachProbability: 0,
      assignee: null,
      assigneeKind: null,
      economics: { estManualMins: 0, actualAgentMins: 0, tokensUsd: 0, attribution: 'pending' },
      evidenceHead: '',
      narrative: [],
      source: { system: ticket.system, ref: ticket.externalRef },
      awaitingApproval: false,
    }

    const knowledge = knowledgeFor(base)
    const route = routeFor({ classification, runbooks: knowledge.runbooks, tower: tower ?? '' })

    const arrival = appendRecord(s.evidence, {
      id: `ev_${digest('rx' + ticket.externalRef).slice(0, 10)}`,
      at, kind: 'observation', actor: ticket.system,
      summary: `Ticket ${ticket.externalRef} received from ${ticket.system}`,
      payload: { category: ticket.category, subCategory: ticket.subCategory, priority: ticket.priority, configurationItems: ticket.configurationItems, unresolved },
      sealed: true,
    })
    // Who does each part of the intake, read from the grants on this tower
    // rather than named. Attributing a classification to an agent that is not
    // deployed there is a fabricated audit trail.
    const handoff = handoffFor(tower ?? '', route.attempt ? [route.agentId] : [])
    const [triage, diagnosis] = handoff
    const named = (id: string | null, fallback: string) => (id ? AGENT_BY_ID[id]?.name ?? id : fallback)

    const classified = appendRecord([...s.evidence, arrival], {
      id: `ev_${digest('cls' + ticket.externalRef).slice(0, 10)}`,
      at, kind: 'observation',
      ...(triage.agentId ? { agentId: triage.agentId } : {}),
      actor: named(triage.agentId, 'Resolver on shift'),
      summary: classification.demandClass
        ? `Classified ${ticket.externalRef} as ${classification.demandClass} at ${Math.round(classification.confidence * 100)}%`
        : `${ticket.externalRef} could not be classified against the ingested history`,
      payload: {
        classification,
        blastRadius: knowledge.blast.dependents,
        mostCriticalTier: knowledge.blast.maxTier,
        route,
        handoff: handoff.map((h) => ({ did: h.did, needs: h.needs, by: h.agentId ?? 'a person', because: h.because })),
      },
      sealed: true,
    })

    let seq = 0
    const entry = (
      actorKind: TimelineEntry['actorKind'], actor: string, text: string, evidenceId?: string,
    ): TimelineEntry => ({
      id: `tl_${digest(ticket.externalRef + ++seq).slice(0, 8)}`,
      at, actorKind, actor, text, ...(evidenceId ? { evidenceId } : {}),
    })

    const wo: WorkObject = {
      ...base,
      state: 'triaged',
      assignee: route.attempt ? route.agentId : ROLE_BY_ID[route.toRole]?.person ?? route.toRole,
      assigneeKind: route.attempt ? 'agent' : 'human',
      evidenceHead: classified.id,
      // Three hands on it before anybody decides anything, each attributed to
      // whatever actually holds the grant on this tower.
      narrative: [
        entry('system', ticket.system, `Signal received from ${ticket.system} · ${ticket.externalRef}`, arrival.id),
        entry(triage.agentId ? 'agent' : 'human', named(triage.agentId, 'Resolver on shift'), classification.demandClass
          ? `Classified as ${classification.demandClass} at ${Math.round(classification.confidence * 100)}% — matched on ${classification.evidence.map((e) => e.on.replace(/_/g, '-')).join(' and ')} in the client's own history. ${triage.because}.`
          : `Could not classify: ${classification.refusal} Held for a person rather than guessed.`, classified.id),
        entry(diagnosis.agentId ? 'agent' : 'human', named(diagnosis.agentId, 'Resolver on shift'),
          `${knowledgeSummary(knowledge)} Blast radius walked from the graph: ${knowledge.blast.dependents} dependent${knowledge.blast.dependents === 1 ? '' : 's'}, most critical tier ${knowledge.blast.maxTier}. ${diagnosis.because}.`,
          classified.id),
        entry(triage.agentId ? 'agent' : 'human', named(triage.agentId, 'Resolver on shift'), route.attempt
          ? `Handed to ${AGENT_BY_ID[route.agentId]?.name ?? route.agentId}: ${route.because}`
          : `Handed to a person: ${route.because}`, classified.id),
        ...(unresolved.length
          ? [entry(diagnosis.agentId ? 'agent' : 'human', named(diagnosis.agentId, 'Resolver on shift'), `${unresolved.join(', ')} ${unresolved.length === 1 ? 'is' : 'are'} not in the estate graph, so nothing downstream of ${unresolved.length === 1 ? 'it' : 'them'} could be assessed.`)]
          : []),
      ],
    }

    set({ evidence: [...s.evidence, arrival, classified], work: { ...s.work, [woId]: wo } })
    get().pushToast({
      title: `${ticket.externalRef} received`,
      body: route.attempt
        ? `Classified ${wo.demandClass} at ${Math.round(classification.confidence * 100)}% and routed to an agent.`
        : `Routed to a person — ${route.because}`,
      tone: route.attempt ? 'ok' : 'warn',
      evidenceId: classified.id,
    })
    return { workObject: wo, duplicate: false, classification, route, knowledge }
  },

  writeProcedureDraft: (p) => {
    const s = get()
    const at = nowIso(s.clockOffsetMins)
    const id = `pr_${digest(p.standardAreaId + p.engagementId + at).slice(0, 8)}`
    const evidenceId = get().logEvidence(
      'knowledge', p.author,
      `Procedure drafted for ${p.standardAreaId}: ${p.name}`,
      { standardAreaId: p.standardAreaId, actionClasses: p.actionClasses, verificationPack: p.verificationPack, reference: p.reference },
    )
    // It lands as a draft, never as current: the platform assembled it from
    // the records, and somebody still has to put their name to it. That is the
    // distinction the contract's develop / document / maintain / review rests
    // on, and making a draft current is a review, recorded as one.
    const record: Procedure = { ...p, id, lastReviewedAt: at, state: 'draft', version: '0.1' }
    set({ procedures: [...s.procedures, record] })
    return { procedure: record, evidenceId }
  },

  fundRecommendation: (e) => {
    const s = get()
    if (s.experiments.some((x) => x.findingId === e.findingId)) return null
    const at = nowIso(s.clockOffsetMins)
    const id = `exp_${digest(e.findingId + at).slice(0, 8)}`
    const evidenceId = get().logEvidence(
      'decision', e.fundedBy,
      `Experiment ${id} funded against ${e.findingId}`,
      { findingId: e.findingId, baselineCount: e.baselineCount, windowDays: e.windowDays, fundingSource: e.fundingSource, successCriterion: e.successCriterion },
    )
    const record: Experiment = { ...e, id, fundedAt: at, evidenceId }
    set({ experiments: [...s.experiments, record] })
    return record
  },

  recordIncidentNotice: (incidentId, by, reference) => {
    const s = get()
    if (s.incidentNotices.some((n) => n.incidentId === incidentId)) return
    const at = nowIso(s.clockOffsetMins)
    get().logEvidence('clock', by, `Client notified of data incident ${incidentId}`, { incidentId, reference })
    set({ incidentNotices: [...get().incidentNotices, { incidentId, at, by, reference }] })
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

/* ---------------------------- Saving what was done --------------------------- */

/**
 * The registers are written back whenever one of them changes. They change on
 * a confirmed action and at no other time, so this costs nothing on a tick:
 * the identity check below is what keeps the simulation's own churn out of
 * storage entirely.
 */
const SAVED_KEYS = [
  'privacyLog', 'incidentNotices', 'exitLog', 'commitmentLog',
  'clientDirectives', 'packExports', 'areaLoads', 'procedureReviews', 'procedures', 'experiments', 'publishLog', 'reportRefreshes',
] as const

let lastSaved: Record<string, unknown> = Object.fromEntries(
  SAVED_KEYS.map((k) => [k, useAstra.getState()[k]]),
)
let lastEvidenceLength = useAstra.getState().evidence.length

/** Everything the chain has gained since the seeded backbone, without its hashes. */
function evidenceTail(evidence: EvidenceRecord[]) {
  return evidence.slice(PRISTINE_EVIDENCE.length).map(({ hash, prevHash, tampered, ...rest }) => rest)
}

/**
 * Anything new is sent to the database. The subscription fires only when a
 * register changes, which happens on a confirmed action and never on a tick,
 * so the simulation's churn costs nothing here.
 *
 * The write is append-only on the server: it sends everything this browser
 * holds, the rows already there are left alone, and whatever is new is added.
 * Two people recording at once therefore keep both sets rather than the last
 * one to save winning.
 */
let saving: Promise<void> = Promise.resolve()

/**
 * Someone reset this engagement while this browser was holding records.
 *
 * The records go, because writing them back is exactly what the generation
 * exists to prevent — but the person is told, because a screen that empties
 * itself with no explanation is worse than the bug this fixes. Their own
 * unsaved work is gone either way; the honest thing is to say so rather than
 * let them discover it from a figure that moved.
 */
function adoptReset(epoch?: number) {
  if (typeof epoch === 'number') setRecordEpoch(epoch)
  lastSaved = Object.fromEntries(SAVED_KEYS.map((k) => [k, [] as unknown]))
  lastEvidenceLength = PRISTINE_EVIDENCE.length
  useAstra.setState({
    privacyLog: [], incidentNotices: [], exitLog: [], commitmentLog: [],
    clientDirectives: [], packExports: [], areaLoads: [], procedureReviews: [], procedures: [], experiments: [],
    reportRefreshes: [], publishLog: [],
    evidence: PRISTINE_EVIDENCE,
  })
  useAstra.getState().pushToast({
    tone: 'warn',
    title: 'The records were reset elsewhere',
    body: 'Another session cleared this engagement. What this one was holding has been dropped rather than written back over the reset.',
  })
}

function persist(state: State) {
  const registers = {
    ...Object.fromEntries(SAVED_KEYS.map((k) => [k, state[k]])),
    evidenceTail: evidenceTail(state.evidence),
  }
  const role = ROLE_BY_ID[state.roleId]
  saving = saving
    .then(() => fetch('/api/records', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        engagement: recordEngagementId(),
        registers,
        by: role?.person ?? 'unknown',
        role: state.roleId,
        // Which generation these records came from. A save from before a
        // reset is refused rather than merged back over it.
        epoch: recordEpoch(),
      }),
    }))
    .then(async (res) => {
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { epoch?: number }
        return adoptReset(body.epoch)
      }
      if (!res.ok) throw new Error(`the gateway answered ${res.status}`)
    })
    .catch((err: unknown) => {
      // Loud rather than silent: a record the person believes is sealed and
      // is only in memory is worse than a visible failure.
      console.error('A record could not be written to the database:', err)
      useAstra.getState().pushToast({
        tone: 'crit',
        title: 'A record was not written to the database',
        body: 'It exists in this session only. The action itself stands; its record does not.',
      })
    })
}

useAstra.subscribe((state) => {
  const changed = SAVED_KEYS.some((k) => state[k] !== lastSaved[k]) || state.evidence.length !== lastEvidenceLength
  if (!changed) return
  lastSaved = Object.fromEntries(SAVED_KEYS.map((k) => [k, state[k]]))
  lastEvidenceLength = state.evidence.length
  persist(state)
})

/**
 * Forgets what was recorded, leaving the seeded estate as it was.
 *
 * The database is cleared first and the memory only if that succeeded. The
 * other order would report a reset that the next reload undid, which is the
 * one failure a reset must never have.
 */
export async function clearSessionRecords(): Promise<number> {
  const res = await fetch('/api/records/clear', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ engagement: recordEngagementId() }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? body.error ?? `the gateway answered ${res.status}`)
  }
  // The clear moved the generation on. This browser adopts it immediately,
  // or its own next save would be refused as stale against a reset it asked
  // for itself.
  const { removed, epoch } = (await res.json()) as { removed: number; epoch?: number }
  if (typeof epoch === 'number') setRecordEpoch(epoch)

  lastSaved = Object.fromEntries(SAVED_KEYS.map((k) => [k, [] as unknown]))
  lastEvidenceLength = PRISTINE_EVIDENCE.length
  useAstra.setState({
    privacyLog: [], incidentNotices: [], exitLog: [], commitmentLog: [],
    clientDirectives: [], packExports: [], areaLoads: [], procedureReviews: [], procedures: [], experiments: [],
    reportRefreshes: [], publishLog: [],
    evidence: PRISTINE_EVIDENCE,
  })
  return removed
}
