import { ACTION_CLASSES } from './reference'
import { AGENTS, GRAPH_NODES, POLICIES, SKILLS, TOWERS } from './estate'
import { OBLIGATIONS } from './ledgers'
import { SUITES } from './evaluationSeed'
import { RED_TEAM_CASES } from './redTeamSeed'
import { CONFORMANCE_CASES } from './conformance'
import { BIAS_CASES } from './biasSuite'
import type { Assertion, EvidenceRecord } from './types'
import type { ChainVerification } from './evidence'
import type { AiIncident } from './aiIncident'
import type { ModelChange } from './changeLog'
import type { Attestation, DeletionCertificate } from './dataHandling'
import type { Suspension } from './suspensions'
import type { DriftReport } from './drift'
import type { BiasResult } from './biasSuite'
import type { ConformanceRun } from './conformance'
import type { RedTeamResult } from './redTeam'

/* ==========================================================================
   The AI governance evidence pack.

   A mapping from the frameworks a certification body works in — NIST AI RMF
   functions and ISO/IEC 42001 clauses — to the records this platform holds.
   Every row carries a live figure read from those records, and a row whose
   control exists but has not been exercised says so rather than claiming it.
   An evidence pack that cannot be contradicted by its own system is not
   evidence; it is a brochure.
   ========================================================================== */

export type RmfFunction = 'GOVERN' | 'MAP' | 'MEASURE' | 'MANAGE'
export type ControlState = 'evidenced' | 'partial' | 'not_exercised' | 'gap'

export interface PackControl {
  id: string
  fn: RmfFunction
  iso: string
  control: string
  evidence: string
  figure: string
  state: ControlState
  href?: string
}

export interface PackContext {
  evidence: EvidenceRecord[]
  assertions: Assertion[]
  verification: ChainVerification | null
  suspensions: Suspension[]
  aiIncidents: AiIncident[]
  modelChanges: ModelChange[]
  attestations: Attestation[]
  deletions: DeletionCertificate[]
  redTeam: { at: string; results: RedTeamResult[] } | null
  bias: BiasResult | null
  drift: DriftReport | null
  conformance: ConformanceRun | null
  registry: { exhibit?: string; version?: number; systems?: { status?: string; attestations?: { noTrainingOnCustomerData?: boolean } }[]; residency?: { allowedRegions?: string[] } | null } | null
  now: Date
}

const kinds = (e: EvidenceRecord[], kind: EvidenceRecord['kind']) => e.filter((r) => r.kind === kind).length

export function buildPack(ctx: PackContext): PackControl[] {
  const approvedSystems = (ctx.registry?.systems ?? []).filter((s) => s.status === 'approved')
  const openIncidents = ctx.aiIncidents.filter((i) => i.state !== 'closed')
  const lastAttestation = ctx.attestations[0]
  const attestationCurrent = lastAttestation ? new Date(lastAttestation.nextDueAt) >= ctx.now : false
  const openChanges = ctx.modelChanges.filter((m) => m.state !== 'accepted')
  const humanVerified = ctx.assertions.filter((a) => a.verification === 'human_verified').length
  const withProvenance = ctx.assertions.filter((a) => a.provenance).length
  const driftAlarms = ctx.drift?.windows.filter((w) => w.alarm).length ?? 0

  return [
    /* ------------------------------- GOVERN ------------------------------- */
    {
      id: 'gv_policy', fn: 'GOVERN', iso: '42001 §6.2 · objectives and policy',
      control: 'Autonomy is decided by versioned policy-as-code, not by the agent or the operator.',
      evidence: 'Policy register with version and source; every decision sealed with its full input vector.',
      figure: `${POLICIES.length} policies · ${POLICIES.reduce((n, p) => n + p.rules.length, 0)} rules · ${kinds(ctx.evidence, 'decision').toLocaleString()} decision records`,
      state: 'evidenced', href: '/atlas/policy',
    },
    {
      id: 'gv_registry', fn: 'GOVERN', iso: '42001 §8.3 · third-party and supplier control',
      control: 'Only AI systems on the approved register may be called; the gateway refuses anything else before a request is made.',
      evidence: `Exhibit ${ctx.registry?.exhibit ?? 'O-1'} register with per-system revision history, enforced at the only egress.`,
      figure: ctx.registry ? `v${ctx.registry.version} · ${approvedSystems.length} approved of ${(ctx.registry.systems ?? []).length}` : 'registry unavailable',
      state: ctx.registry ? 'evidenced' : 'gap', href: '/atlas/systems',
    },
    {
      id: 'gv_suspension', fn: 'GOVERN', iso: '42001 §5.3 · roles and authority',
      control: 'The customer may suspend the platform, a tower, an action class or a single AI function, and the record says who directed it.',
      evidence: 'Suspension records carrying scope, reason and a customer-directed flag.',
      figure: ctx.suspensions.length ? `${ctx.suspensions.length} in force · ${ctx.suspensions.filter((s) => s.directedByCustomer).length} customer-directed` : 'none in force',
      state: 'evidenced', href: '/governance/autonomy',
    },
    {
      id: 'gv_obligations', fn: 'GOVERN', iso: '42001 §9.1 · monitoring of obligations',
      control: 'Regulatory and contractual obligations are tracked as objects with owners, cadence and required evidence.',
      evidence: 'Obligations register with state and due dates.',
      figure: `${OBLIGATIONS.length} obligations · ${OBLIGATIONS.filter((o) => o.state === 'green').length} green, ${OBLIGATIONS.filter((o) => o.state !== 'green' && o.state !== 'closed').length} needing attention`,
      state: 'evidenced', href: '/governance/registers',
    },

    /* --------------------------------- MAP -------------------------------- */
    {
      id: 'mp_estate', fn: 'MAP', iso: '42001 §6.1 · risk and impact identification',
      control: 'The estate the agents reason over is a typed graph with confidence and verification state on every assertion.',
      evidence: 'Service graph and knowledge assertions with source, method, TTL and provenance.',
      figure: `${GRAPH_NODES.length} graph nodes · ${ctx.assertions.length} assertions · ${humanVerified} human-verified`,
      state: 'evidenced', href: '/operate/graph',
    },
    {
      id: 'mp_provenance', fn: 'MAP', iso: '42001 §7.5 · documented information',
      control: 'Every assertion records where it came from precisely enough to go and look, plus a hash of the claim as asserted.',
      evidence: 'Provenance pointer and content hash on each assertion.',
      figure: `${withProvenance} of ${ctx.assertions.length} assertions carry provenance`,
      state: withProvenance === ctx.assertions.length ? 'evidenced' : withProvenance ? 'partial' : 'gap',
      href: '/transition/verify',
    },
    {
      id: 'mp_actionclass', fn: 'MAP', iso: '42001 §6.1.2 · impact assessment',
      control: 'Every action an agent can take is classified by reversibility, with a platform floor no policy can loosen.',
      evidence: 'Action-class taxonomy with floors, four-eyes flags and verification packs.',
      figure: `${ACTION_CLASSES.length} classes · ${ACTION_CLASSES.filter((a) => a.fourEyes).length} four-eyes · ${ACTION_CLASSES.filter((a) => a.reversibility === 'irreversible').length} never agent-executed`,
      state: 'evidenced', href: '/governance/autonomy',
    },
    {
      id: 'mp_bom', fn: 'MAP', iso: '42001 §8.2 · AI system lifecycle',
      control: 'Each agent and each AI system has a card generated from stored records — purpose, scope, evaluation, incidents, data handling.',
      evidence: 'Model cards assembled at view time; no field without a record behind it.',
      figure: `${AGENTS.length} agents · ${approvedSystems.length} systems · ${SKILLS.length} skills`,
      state: 'evidenced', href: '/atlas/model-cards',
    },

    /* ------------------------------- MEASURE ------------------------------ */
    {
      id: 'ms_replay', fn: 'MEASURE', iso: '42001 §9.1 · performance evaluation',
      control: 'Agents are scored on replay suites built from this client\'s own history before any promotion.',
      evidence: 'Evaluation suites with pass scores and open regressions.',
      figure: `${SUITES.length} suites · ${SUITES.reduce((n, s) => n + s.cases, 0).toLocaleString()} cases · ${SUITES.reduce((n, s) => n + s.regression, 0)} open regressions`,
      state: 'evidenced', href: '/atlas/evaluation',
    },
    {
      id: 'ms_redteam', fn: 'MEASURE', iso: '42001 §8.4 · verification of AI controls',
      control: 'Adversarial testing — prompt injection, retrieval poisoning, tool misuse, fabrication, unregistered models — against the live controls.',
      evidence: 'Red-team library run against the gateway classifier, registry and detectors; each run a verification record.',
      figure: ctx.redTeam
        ? `${ctx.redTeam.results.filter((r) => r.pass).length} of ${ctx.redTeam.results.length} held · ${ctx.redTeam.at.slice(0, 10)}`
        : `${RED_TEAM_CASES.length} cases available, not run this period`,
      state: ctx.redTeam ? (ctx.redTeam.results.every((r) => r.pass) ? 'evidenced' : 'gap') : 'not_exercised',
      href: '/governance/assurance',
    },
    {
      id: 'ms_bias', fn: 'MEASURE', iso: '42001 §6.1.4 · fairness',
      control: 'Matched-pair testing that the decision path returns the same mode, gates and floor whatever cohort the work came from.',
      evidence: 'Bias suite over declared cohorts; disparities listed individually.',
      figure: ctx.bias
        ? `${ctx.bias.pairs} pairs · ${ctx.bias.disparities.length} disparities · ${ctx.bias.at?.slice(0, 10) ?? ''}`
        : `${BIAS_CASES.length} cases available, not run this period`,
      state: ctx.bias ? (ctx.bias.invariant ? 'evidenced' : 'gap') : 'not_exercised',
      href: '/atlas/evaluation',
    },
    {
      id: 'ms_drift', fn: 'MEASURE', iso: '42001 §9.1 · monitoring over time',
      control: 'Each agent\'s live-success series is monitored for sustained decline; an alarm caps the agent by policy.',
      evidence: 'Drift windows with slope and drop from peak; alarm changes are evidence records. Run from Evaluation & Promotion, not the sandbox: raising an alarm changes an agent\'s ceiling, so it is not a read-only control.',
      figure: ctx.drift ? `${ctx.drift.windows.length} agents · ${driftAlarms} alarm${driftAlarms === 1 ? '' : 's'}` : 'not computed this period',
      state: ctx.drift ? 'evidenced' : 'not_exercised', href: '/atlas/evaluation',
    },
    {
      id: 'ms_conformance', fn: 'MEASURE', iso: '42001 §9.2 · internal audit',
      control: 'The commitments the platform makes are tested against the deployed engine, by the customer, on demand.',
      evidence: 'Contract-conformance set; each run a verification record naming who ran it.',
      figure: ctx.conformance
        ? `${ctx.conformance.held} of ${ctx.conformance.total} held · ${ctx.conformance.at?.slice(0, 10) ?? ''}`
        : `${CONFORMANCE_CASES.length} commitments available, not run this period`,
      state: ctx.conformance ? (ctx.conformance.held === ctx.conformance.total ? 'evidenced' : 'gap') : 'not_exercised',
      href: '/governance/assurance',
    },
    {
      id: 'ms_chain', fn: 'MEASURE', iso: '42001 §7.5.3 · control of documented information',
      control: 'The evidence chain is hash-linked; any edit to history invalidates every record after it.',
      evidence: 'Chain verification recomputing every digest from genesis.',
      figure: ctx.verification
        ? ctx.verification.valid
          ? `intact · ${ctx.verification.checked.toLocaleString()} records`
          : `BROKEN from sequence ${ctx.verification.firstBreakSeq}`
        : `${ctx.evidence.length.toLocaleString()} records, not verified this period`,
      state: ctx.verification ? (ctx.verification.valid ? 'evidenced' : 'gap') : 'not_exercised',
      href: '/governance/evidence',
    },

    /* -------------------------------- MANAGE ------------------------------ */
    {
      id: 'mg_oversight', fn: 'MANAGE', iso: '42001 §8.1 · operational control',
      control: 'A consequential action waits for a named human, and the approval is recorded before the action is.',
      evidence: 'Approval records preceding action records; an oversight audit over the chain itself.',
      figure: `${kinds(ctx.evidence, 'approval').toLocaleString()} approvals · ${kinds(ctx.evidence, 'action').toLocaleString()} actions`,
      state: 'evidenced', href: '/operate/approvals',
    },
    {
      id: 'mg_incidents', fn: 'MANAGE', iso: '42001 §10.2 · nonconformity and corrective action',
      control: 'AI incidents are detected in four classes, notified within 24 hours and root-caused within five business days.',
      evidence: 'Incident register with both clocks; detection, abort, probation, notification and RCA each a record.',
      figure: ctx.aiIncidents.length
        ? `${ctx.aiIncidents.length} recorded · ${openIncidents.length} open`
        : 'none detected this period',
      state: 'evidenced', href: '/governance/ai-incidents',
    },
    {
      id: 'mg_change', fn: 'MANAGE', iso: '42001 §8.5 · change management',
      control: 'A served model that differs from the registered one opens a notice and caps work on that system until accepted.',
      evidence: 'Currency check on every completed call; change log across registry, policy, skill and routing versions.',
      figure: ctx.modelChanges.length ? `${ctx.modelChanges.length} detected · ${openChanges.length} open` : 'none detected this period',
      state: 'evidenced', href: '/atlas/change-log',
    },
    {
      id: 'mg_data', fn: 'MANAGE', iso: '42001 §8.3 · data management and privacy',
      control: 'No customer data trains a model for anyone else, and deletion is certified under four eyes with the chain root recorded.',
      evidence: 'Training-exclusion attestations on a cadence; deletion certificates with manifest digest and pre-deletion root hash.',
      figure: `${ctx.attestations.length} attestation${ctx.attestations.length === 1 ? '' : 's'}${attestationCurrent ? ' (current)' : ' (OVERDUE)'} · ${ctx.deletions.length} certified deletion${ctx.deletions.length === 1 ? '' : 's'}`,
      state: attestationCurrent ? 'evidenced' : 'gap', href: '/atlas/systems',
    },
    {
      id: 'mg_residency', fn: 'MANAGE', iso: '42001 §8.3 · data residency',
      control: 'A model outside the permitted regions, or without a zero-retention configuration, cannot be used at all.',
      evidence: 'Residency rules enforced at resolution in the gateway.',
      figure: ctx.registry?.residency?.allowedRegions?.length
        ? `${ctx.registry.residency.allowedRegions.join(', ')} · ${approvedSystems.filter((s) => s.attestations?.noTrainingOnCustomerData).length} of ${approvedSystems.length} attested`
        : 'no residency rules configured',
      state: ctx.registry?.residency?.allowedRegions?.length ? 'evidenced' : 'gap', href: '/atlas/systems',
    },
    {
      id: 'mg_promotion', fn: 'MANAGE', iso: '42001 §8.2 · lifecycle gates',
      control: 'Autonomy is earned through five stage gates and withdrawn automatically on incident or drift.',
      evidence: 'Promotion pipeline with evidence at each stage; automatic demotions are client-visible.',
      figure: `${TOWERS.length} towers · ${AGENTS.filter((a) => a.ceiling === 'autonomous').length} agents at L4 · ${AGENTS.filter((a) => a.state !== 'active').length} not active`,
      state: 'evidenced', href: '/governance/autonomy',
    },
  ]
}

export const STATE_LABEL: Record<ControlState, string> = {
  evidenced: 'Evidenced',
  partial: 'Partial',
  not_exercised: 'Not exercised this period',
  gap: 'Gap',
}
