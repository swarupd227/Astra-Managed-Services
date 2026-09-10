/**
 * Astra core primitives (spec §4).
 * Everything the consoles render is a view over these eight types.
 */

export type ISO = string

/* ---------------------------------- Estate --------------------------------- */

export type TowerState = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6'
export type ServiceLine = 'swpe' | 'data' | 'agentic' | 'cloud'

export interface Tower {
  id: string
  name: string
  /** The contract bundle this tower is delivered under — client-defined, not a platform constant. */
  bundle: string
  line: ServiceLine
  state: TowerState
  concurrentStates: TowerState[]
  criticality: 0 | 1 | 2 | 3
  owner: string
  sdm: string
  entities: number
  assertions: number
  /** % of historical volume covered by human-verified knowledge */
  verificationCoverage: number
  autonomyEligibleVolume: number
  baselineHrsPerQtr: number
  glidepathContracted: number
  glidepathActual: number
  regulatory: string[]
}

export type VerificationState = 'unverified' | 'machine_corroborated' | 'human_verified' | 'stale'
export type AssertionSource = 'code_analysis' | 'telemetry_inference' | 'ticket_mining' | 'human_statement'

export interface GraphNode {
  id: string
  type:
    | 'BusinessService' | 'Application' | 'Component' | 'Interface' | 'InfraResource'
    | 'DataAsset' | 'Pipeline' | 'Runbook' | 'KnownError' | 'Contract' | 'DemandClass' | 'AgentEntity'
  name: string
  tower: string
  tier: 0 | 1 | 2 | 3
  attrs: Record<string, string | number>
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  rel: 'DEPENDS_ON' | 'RUNS_ON' | 'CALLS' | 'READS' | 'WRITES' | 'OWNED_BY' | 'MONITORED_BY' | 'RESOLVES' | 'GOVERNED_BY' | 'CAUSED_BY'
}

export interface Assertion {
  id: string
  subject: string
  predicate: string
  object: string
  tower: string
  source: AssertionSource
  method: string
  confidence: number
  verification: VerificationState
  assertedAt: ISO
  ttlDays: number
  verifiedBy?: string
  conflictsWith?: string
  narrative: string
  tier: 0 | 1 | 2 | 3
  /**
   * Where the claim came from, precisely enough to go and look: the record,
   * the repository path and commit, or the query and window it was inferred
   * from. `contentHash` covers the claim as asserted, so a later edit to the
   * source is detectable rather than assumed away.
   */
  provenance?: { sourceRef: string; retrievedAt: ISO; contentHash: string }
}

/* ----------------------------------- Work ---------------------------------- */

export type WorkType = 'incident' | 'request' | 'change' | 'problem' | 'enhancement' | 'finding'
export type WorkState =
  | 'detected' | 'triaged' | 'planned' | 'gated' | 'executing' | 'verifying' | 'resolved' | 'learned'
export type Priority = 'P1' | 'P2' | 'P3' | 'P4'

export interface RunStep {
  id: string
  kind: 'agent' | 'tool' | 'gate' | 'verify'
  label: string
  agentId?: string
  state: 'pending' | 'running' | 'done' | 'blocked' | 'failed' | 'skipped'
  detail?: string
  compensation?: string
  startedAt?: ISO
  durationMs?: number
  tokensUsd?: number
  /**
   * The agent's working summary for this step, streamed beside it in the Run
   * Theater (Addendum A §A7.2). Absent on seeded historical runs.
   */
  reasoning?: string
  /** Action class, so a step can be read against the policy floor that bound it. */
  actionClass?: string
  /** Gate steps only — who must decide, and what happens if they do not. */
  gate?: { role: string; timeoutSec: number; escalatesTo: string }
}

export interface Run {
  id: string
  workObjectId: string
  skillId: string
  steps: RunStep[]
  state: 'planned' | 'gated' | 'executing' | 'verifying' | 'complete' | 'aborted' | 'compensated'
  startedAt: ISO
  tokensUsd: number
}

export interface AutonomyDecision {
  mode: ExecutionMode
  policyId: string
  policyVersion: string
  actionClasses: string[]
  blastRadius: { services: number; dependents: number; maxTier: number; dataMutation: boolean }
  agentGrades: Record<string, Grade>
  planConfidence: number
  gates: { role: string; timeoutSec: number; escalatesTo: string }[]
  reasons: string[]
  evaluatedInMs: number
  overrides: string[]
}

export interface WorkObject {
  id: string
  ref: string
  type: WorkType
  title: string
  tower: string
  service: string
  affected: string[]
  demandClass: string
  classificationConfidence: number
  priority: Priority
  state: WorkState
  createdAt: ISO
  slaTargetMins: number
  slaElapsedMins: number
  slaPaused: boolean
  pauseReason?: string
  breachProbability: number
  assignee: string | null
  assigneeKind: 'human' | 'agent' | null
  runId?: string
  autonomy?: AutonomyDecision
  economics: {
    estManualMins: number
    actualAgentMins: number
    tokensUsd: number
    attribution: 'automation' | 'elimination' | 'acceleration' | 'avoidance' | 'pending' | 'none'
  }
  evidenceHead: string
  narrative: TimelineEntry[]
  source: { system: string; ref: string }
  awaitingApproval?: boolean
  xla?: { touches: number; reassignments: number; reopened: boolean }
}

export interface TimelineEntry {
  id: string
  at: ISO
  actorKind: 'agent' | 'human' | 'system'
  actor: string
  text: string
  evidenceId?: string
  level?: 'info' | 'warn' | 'crit' | 'ok'
}

/* ---------------------------------- Agents --------------------------------- */

export type Grade = 'A' | 'B' | 'C' | 'D'
export type ExecutionMode = 'manual' | 'advise' | 'approve_first' | 'supervised' | 'autonomous'

export interface AgentIncident {
  id: string
  at: ISO
  summary: string
  actionClass: string
  outcome: string
  demotedDays: number
}

export interface Agent {
  id: string
  name: string
  codename: string
  mission: string
  ownerHuman: string
  nhi: string
  origin: 'artizent' | 'client'
  towers: string[]
  skills: string[]
  prohibited: string[]
  grants: Record<string, Grade>
  ceiling: ExecutionMode
  evaluation: { suiteId: string; score: number; replayN: number; liveSuccess90d: number; lastRun: ISO }
  economics: { costUsd30d: number; costPerWo: number; humanMinsDisplaced30d: number }
  incidents: AgentIncident[]
  state: 'active' | 'suspended' | 'probation' | 'onboarding'
  promotionReview: ISO
  createdAt: ISO
  driftAlarm: boolean
  trend: number[]
}

export interface Skill {
  id: string
  name: string
  version: string
  layer: 'platform' | 'industry' | 'client'
  actionClasses: string[]
  successRate: number
  runs: number
  evalScore: number
  verificationPack: string
  owner: string
  updatedAt: ISO
}

/* --------------------------------- Policy ---------------------------------- */

export type Reversibility = 'read_only' | 'self_healing' | 'reversible' | 'compensable' | 'irreversible' | 'bounded'

export interface ActionClass {
  id: string
  name: string
  reversibility: Reversibility
  floor: ExecutionMode
  tier0Floor?: ExecutionMode
  verificationPack: string
  fourEyes: boolean
  domain: string
}

export interface PolicyRule {
  id: string
  when: string
  require?: string
  mode?: ExecutionMode
  maxMode?: ExecutionMode
  gate?: { approverRole: string; artefacts: string[]; timeoutSec: number; escalatesTo: string }
  notify?: string[]
  abortWindowSec?: number
}

export interface Policy {
  id: string
  name: string
  version: string
  appliesTo: { towers: string[]; envs: string[] }
  rules: PolicyRule[]
  budgets: { tokensUsdPerRun: number; runsPerHour: number }
  evidence: { sealRequired: boolean; exportTo: string[] }
  updatedAt: ISO
  updatedBy: string
  source: string
}

export interface AutonomyScheduleCell {
  tower: string
  actionClass: string
  current: 0 | 1 | 2 | 3 | 4
  target: 0 | 1 | 2 | 3 | 4
  evidence: string
  blocked?: string
}

/* -------------------------------- Evidence --------------------------------- */

export type EvidenceKind =
  | 'observation' | 'decision' | 'approval' | 'action' | 'verification' | 'economic' | 'clock' | 'knowledge'

export interface EvidenceRecord {
  id: string
  seq: number
  at: ISO
  kind: EvidenceKind
  workObjectId?: string
  runId?: string
  agentId?: string
  actionClass?: string
  actor: string
  summary: string
  payload: Record<string, unknown>
  prevHash: string
  hash: string
  sealed: boolean
  tampered?: boolean
}

/* --------------------------------- Ledgers --------------------------------- */

export interface GlidepathEntry {
  id: string
  at: ISO
  tower: string
  demandClass: string
  attribution: 'automation' | 'elimination' | 'acceleration' | 'avoidance'
  hoursSaved: number
  verifiedDays: number
  verificationWindow: number
  state: 'verifying' | 'banked' | 'rejected'
  evidenceId: string
  narrative: string
}

export interface TransformAllocation {
  id: string
  title: string
  /** The objective this spend is for. Credits with no objective are spend without a stated purpose. */
  objectiveId?: string
  credits: number
  approvedIn: string
  state: 'approved' | 'executing' | 'delivered' | 'verifying'
  yieldPromised: number
  yieldRealised?: number
}

export interface TransformLedger {
  tower: string
  quarter: string
  bankedSavingsHrs: number
  reinvestPct: number
  priceReductionPct: number
  creditsAccrued: number
  creditsCarriedIn: number
  allocations: TransformAllocation[]
  creditsConsumed: number
  freezeState: 'none' | 'frozen'
  freezeReason?: string
}

export interface DemandClassRec {
  id: string
  name: string
  tower: string
  volumeYr: number
  hoursYr: number
  trend: number
  cause: string
  eliminationState: 'none' | 'candidate' | 'approved' | 'verifying' | 'eliminated'
  projectedRemoval?: number
  npv36m?: number
  effortDays?: number
  observedDecay?: number
  verifyDay?: number
  proposalType?: 'engineering_fix' | 'automation' | 'self_service' | 'policy_change' | 'modernisation'
  /**
   * Where the volume figure comes from. A population class carries a
   * measured annual volume. A sampled class exists because live work carries
   * it, but only a queue sample has been observed — so its annual volume stays
   * at zero rather than being extrapolated, and the sample size is kept instead.
   */
  volumeBasis?: 'population' | 'sampled'
  sampleCount?: number
}

/* ----------------------------------- SLA ----------------------------------- */

export interface SlaSpec {
  id: string
  tower: string
  name: string
  metric: string
  targetMins: number
  attainmentTarget: number
  attainmentMtd: number
  volumeMtd: number
  breachesMtd: number
  headroom: number
  clock: { start: string; stop: string; pauses: string[]; calendar: string }
  credit: { band: string; pct: number }[]
  earnback: string
  kind: 'sla' | 'xla' | 'ola'
}

/* --------------------------------- TokenOps -------------------------------- */

export interface TokenSeries {
  day: string
  frontierUsd: number
  midUsd: number
  smallUsd: number
  cacheHitPct: number
  displacedUsd: number
}

/* -------------------------------- Governance ------------------------------- */

export interface Decision {
  id: string
  forum: string
  at: ISO
  owner: string
  subject: string
  inputs: string[]
  decision: 'approved' | 'approved_with_condition' | 'rejected' | 'deferred'
  condition?: string
  effective?: string
  evidenceId: string
  followThrough?: { text: string; state: 'green' | 'amber' | 'red'; progress: string }
}

export interface Obligation {
  id: string
  title: string
  owner: string
  dueAt: ISO
  cadence: string
  evidenceRequirement: string
  state: 'green' | 'amber' | 'red' | 'closed'
}

export interface InnovationItem {
  id: string
  title: string
  source: 'artizent' | 'client' | 'agent' | 'council'
  sponsor: string
  valueClass: 'cost' | 'experience' | 'risk' | 'revenue' | 'capability'
  stage: 'idea' | 'assessed' | 'funded' | 'delivered' | 'verified' | 'scaled' | 'retired'
  hypothesis: string
  projectedValueUsd?: number
  realisedValueUsd?: number
  verdict?: 'verified' | 'partial' | 'failed'
  fundingSource?: 'capacity_credits' | 'innovation_allowance' | 'client_funded'
  cycleDays?: number
  reuseCount?: number
}

/* ---------------------------------- Roles ---------------------------------- */

/** Navigation groups follow the engagement lifecycle, plus two cross-cutting ones. */
export type SurfaceId = 'transition' | 'run' | 'transform' | 'governance' | 'platform' | 'workplace'

export interface Role {
  id: string
  title: string
  org: 'client' | 'artizent' | 'consumer'
  person: string
  home: string
  surfaces: SurfaceId[]
  description: string
  canApprove: boolean
  readOnly?: boolean
}

/** A contract bundle: the unit a client buys a group of towers under. */
export interface Bundle {
  id: string
  name: string
}
