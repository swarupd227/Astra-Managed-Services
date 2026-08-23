import { Rng } from './rng'
import { TOWERS } from './estate'
import { ACTION_CLASSES } from './reference'
import type { Assertion, AutonomyScheduleCell } from './types'

const rng = new Rng(51009)
const NOW = new Date('2027-02-18T09:42:00.000Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString()

/* ------------------------- Verification queue (§10.1) ----------------------- */

const CLAIMS: { subject: string; predicate: string; object: string; narrative: string; tower: string; tier: 0 | 1 | 2 | 3 }[] = [
  { subject: 'app_claims_intake', predicate: 'DEPENDS_ON', object: 'svc_document_store', narrative: 'Claims Intake reads scanned documents synchronously from the Document Store; a Document Store outage blocks intake entirely rather than degrading it.', tower: 'twr_claims', tier: 1 },
  { subject: 'app_claims_intake', predicate: 'OWNED_BY', object: 'team_claims_platform', narrative: 'Claims Intake is owned by the Claims Platform team (lead: F. Lorenz). On-call rota is shared with Policy Admin outside business hours.', tower: 'twr_claims', tier: 1 },
  { subject: 'job_ocr_batch', predicate: 'FAILS_WHEN', object: 'pdf_page_count > 400', narrative: 'The OCR batch job times out on documents beyond roughly 400 pages. Operators currently split these by hand and re-submit.', tower: 'twr_claims', tier: 1 },
  { subject: 'rpt_board_pack', predicate: 'READS', object: 'sem_model_finance_v3', narrative: 'The board pack refreshes from the finance semantic model, not directly from the warehouse — a warehouse fix does not clear a board-pack failure.', tower: 'twr_bi', tier: 2 },
  { subject: 'sem_model_finance_v3', predicate: 'HAS_SLO', object: 'refresh < 45min', narrative: 'The finance semantic model must refresh within 45 minutes to meet the 07:30 board distribution. Current p95 is 38 minutes.', tower: 'twr_bi', tier: 2 },
  { subject: 'pipe_claims_feed', predicate: 'PRODUCED_BY', object: 'adf_claims_ingest', narrative: 'The claims feed is produced by an Azure Data Factory pipeline, not by Databricks — the Databricks runbook does not apply to it.', tower: 'twr_bi', tier: 2 },
  { subject: 'app_policy_admin', predicate: 'CALLS', object: 'if_reinsurance_api', narrative: 'Policy Admin calls the reinsurance partner API synchronously during quote binding. Partner latency surfaces as a Policy Admin incident.', tower: 'twr_claims', tier: 1 },
  { subject: 'db_claims_pg', predicate: 'HAS_MAINTENANCE_WINDOW', object: 'Sun 02:00–04:00 CET', narrative: 'Claims Postgres has a weekly maintenance window agreed with the business. Changes outside it require a CAB exception.', tower: 'twr_claims', tier: 1 },
  { subject: 'runbook_ocr_retry', predicate: 'RESOLVES', object: 'dc_ocr_failure', narrative: 'Drafted runbook: split oversized documents, re-queue, verify page count parity. Derived from 34 historical tickets.', tower: 'twr_claims', tier: 1 },
  { subject: 'app_claims_intake', predicate: 'HAS_DATA_CLASS', object: 'restricted (health data)', narrative: 'Claims intake handles health data under GDPR Article 9. Context retrieval must redact before any model call.', tower: 'twr_claims', tier: 0 },
  { subject: 'if_ftp_batch', predicate: 'IS_DEPRECATED', object: 'true (ta_007 delivered)', narrative: 'Telemetry shows zero traffic on the legacy FTP drop for 74 consecutive days following ta_007. The declared dependency in the CMDB is stale.', tower: 'twr_payments', tier: 2 },
  { subject: 'db_ledger_ro', predicate: 'REPLICATION_LAG_SLO', object: '< 2s', narrative: 'Read replica lag beyond 2 seconds causes reconciliation mismatches. The current alarm fires at 10 seconds — too late.', tower: 'twr_payments', tier: 0 },
  { subject: 'svc_document_store', predicate: 'HAS_SLO', object: 'availability 99.5%', narrative: 'The Document Store carries a 99.5% availability objective agreed at transition. Claims Intake depends on it synchronously, so the effective claims objective cannot exceed it.', tower: 'twr_claims', tier: 1 },
  { subject: 'job_ocr_batch', predicate: 'OWNED_BY', object: 'team_claims_platform', narrative: 'The OCR batch job is operated by the Claims Platform team, though it was built by a since-departed vendor. No second owner is recorded.', tower: 'twr_claims', tier: 1 },
  { subject: 'app_policy_admin', predicate: 'DEPENDS_ON', object: 'db_claims_pg', narrative: 'Policy Admin writes bind records directly to Claims Postgres rather than through an interface; a Postgres failover interrupts quote binding.', tower: 'twr_claims', tier: 1 },
  { subject: 'db_claims_pg', predicate: 'HAS_DATA_CLASS', object: 'restricted (health data)', narrative: 'Claims Postgres holds Article 9 health data. Backups inherit the classification, which constrains where they may be restored.', tower: 'twr_claims', tier: 0 },
  { subject: 'if_reinsurance_api', predicate: 'HAS_SLO', object: 'p95 < 1.2s', narrative: 'The reinsurance partner contracts a 1.2 second p95. Breaches are the partner’s to remedy, but surface to us as Policy Admin latency.', tower: 'twr_claims', tier: 1 },
  { subject: 'runbook_bind_timeout', predicate: 'RESOLVES', object: 'dc_bind_timeout', narrative: 'Drafted runbook: confirm partner health, retry the bind idempotently, reconcile any duplicate policy record. Derived from 19 historical tickets.', tower: 'twr_claims', tier: 1 },
  { subject: 'app_claims_intake', predicate: 'CALLS', object: 'job_ocr_batch', narrative: 'Intake enqueues OCR asynchronously and polls for completion. A stalled OCR queue presents as intake backlog rather than intake failure.', tower: 'twr_claims', tier: 1 },
  { subject: 'rpt_regulatory_pack', predicate: 'READS', object: 'sem_model_finance_v3', narrative: 'The regulatory pack shares the finance semantic model with the board pack, so a model defect reaches both — one commercially, one with a regulator attached.', tower: 'twr_bi', tier: 1 },
  { subject: 'adf_claims_ingest', predicate: 'FAILS_WHEN', object: 'source schema drift', narrative: 'The ingest pipeline has no schema contract and fails on any upstream column change. Failures are silent until the downstream refresh misses.', tower: 'twr_bi', tier: 2 },
  { subject: 'sem_model_finance_v3', predicate: 'OWNED_BY', object: 'team_bi_platform', narrative: 'The finance semantic model is owned by BI Platform, with change approval held by Finance. Two-party ownership is the reason model changes take a fortnight.', tower: 'twr_bi', tier: 2 },
  { subject: 'pipe_claims_feed', predicate: 'HAS_SLO', object: 'daily by 05:00 CET', narrative: 'The claims feed must land before 05:00 for the morning refresh chain. It currently lands at 04:20 median with a long tail on month-end.', tower: 'twr_bi', tier: 2 },
  { subject: 'rpt_board_pack', predicate: 'HAS_MAINTENANCE_WINDOW', object: 'Sat 22:00–23:00 CET', narrative: 'Board pack infrastructure is patched in a Saturday window. The window overlaps month-end close in four months of the year.', tower: 'twr_bi', tier: 2 },
]

export const ASSERTIONS: Assertion[] = CLAIMS.map((c, i) => {
  const sources: Assertion['source'][] = ['code_analysis', 'telemetry_inference', 'ticket_mining', 'human_statement']
  const source = sources[i % 4]
  const conflict = c.subject === 'if_ftp_batch' || c.subject === 'db_ledger_ro'
  return {
    id: `asr_${String(4100 + i)}`,
    subject: c.subject,
    predicate: c.predicate,
    object: c.object,
    tower: c.tower,
    source,
    method:
      source === 'code_analysis' ? 'tree-sitter AST + config semantics extraction'
        : source === 'telemetry_inference' ? 'trace corroboration over 30 days'
          : source === 'ticket_mining' ? 'symptom→cause→fix triple mining (14 months)'
            : 'structured SME interview capture',
    confidence: rng.float(0.62, 0.97, 2),
    verification: conflict ? 'machine_corroborated' : rng.pickWeighted([['unverified', 6], ['machine_corroborated', 4]] as const),
    assertedAt: daysAgo(rng.int(1, 22)),
    ttlDays: c.tier <= 1 ? 90 : 180,
    conflictsWith: conflict ? (c.subject === 'if_ftp_batch' ? 'CMDB declares this interface active' : 'Monitoring config declares a 10s threshold') : undefined,
    narrative: c.narrative,
    tier: c.tier,
  }
})

/* --------------------------- Shadow scoreboard (§10.1) ---------------------- */

export interface ShadowRow {
  actionClass: string
  tower: string
  proposals: number
  agreement: number
  threshold: number
  unexplained: number
  confidenceBand: [number, number]
  readiness: 'met' | 'approaching' | 'below'
  proposedGrade: 'A' | 'B' | 'C' | 'D'
}

export const SHADOW: ShadowRow[] = [
  { actionClass: 'AC-05', tower: 'twr_claims', proposals: 1840, agreement: 99.1, threshold: 97, unexplained: 0, confidenceBand: [98.6, 99.5], readiness: 'met', proposedGrade: 'A' },
  { actionClass: 'AC-08', tower: 'twr_claims', proposals: 1640, agreement: 97.8, threshold: 96, unexplained: 0, confidenceBand: [97.0, 98.4], readiness: 'met', proposedGrade: 'A' },
  { actionClass: 'AC-12', tower: 'twr_claims', proposals: 412, agreement: 96.4, threshold: 95, unexplained: 1, confidenceBand: [94.3, 97.9], readiness: 'approaching', proposedGrade: 'B' },
  { actionClass: 'AC-31', tower: 'twr_claims', proposals: 188, agreement: 91.5, threshold: 95, unexplained: 3, confidenceBand: [86.9, 94.7], readiness: 'below', proposedGrade: 'C' },
  { actionClass: 'AC-37', tower: 'twr_claims', proposals: 96, agreement: 88.5, threshold: 92, unexplained: 2, confidenceBand: [80.6, 93.6], readiness: 'below', proposedGrade: 'C' },
  { actionClass: 'AC-05', tower: 'twr_bi', proposals: 940, agreement: 98.2, threshold: 97, unexplained: 0, confidenceBand: [97.2, 98.9], readiness: 'met', proposedGrade: 'A' },
  { actionClass: 'AC-12', tower: 'twr_bi', proposals: 210, agreement: 94.8, threshold: 95, unexplained: 1, confidenceBand: [90.9, 97.2], readiness: 'approaching', proposedGrade: 'B' },
  { actionClass: 'AC-49', tower: 'twr_bi', proposals: 74, agreement: 85.1, threshold: 92, unexplained: 4, confidenceBand: [75.0, 92.0], readiness: 'below', proposedGrade: 'D' },
]

export const SHADOW_DISAGREEMENTS = [
  { id: 'dis_01', actionClass: 'AC-31', at: daysAgo(2), agentProposal: 'Revert claims-intake worker count 12 → 6 (matches pre-change baseline)', humanResolution: 'Scaled to 18 and raised a capacity problem record', why: 'Agent optimised for the incident; the human knew a quarter-end volume peak was starting. The business calendar is not yet in the graph.', verdict: 'unexplained', action: 'Raise graph work object: ingest client business calendar as a first-class entity' },
  { id: 'dis_02', actionClass: 'AC-37', at: daysAgo(3), agentProposal: 'Patch null-guard in DocumentParser.parsePage()', humanResolution: 'Fixed upstream in the ingest contract instead', why: 'Both resolve the symptom. The human fix removes the class; the agent fix removes the instance. Prospect has since raised the class as an elimination candidate.', verdict: 'explained', action: 'No grade impact — narrative quality scored 0.88' },
  { id: 'dis_03', actionClass: 'AC-31', at: daysAgo(5), agentProposal: 'Revert reinsurance API timeout 30s → 10s', humanResolution: 'Left at 30s; escalated to the partner', why: 'Agent cited an assertion that is stale — the partner SLA was renegotiated in December and the graph still carries the old value.', verdict: 'unexplained', action: 'Assertion asr_3980 forced to re-verification; TTL policy tightened for partner contracts' },
  { id: 'dis_04', actionClass: 'AC-49', at: daysAgo(6), agentProposal: 'Backfill claims_gold for the 3-day gap', humanResolution: 'Blocked backfill; corrected source first', why: 'The asset has no data contract, so the agent could not verify the backfill. Policy already caps this at Advise — the disagreement confirms the cap is correct.', verdict: 'explained', action: 'Data contract authored for claims_gold; re-shadow after it lands' },
]

/* --------------------------- Coverage dashboard ----------------------------- */

export interface CoverageRow {
  tower: string
  entities: number
  mapped: number
  dark: number
  humanVerified: number
  machineCorroborated: number
  unverified: number
  stale: number
  contradictionRate: number
  verificationLatencyDays: number
  volumeCovered: number
}

export const COVERAGE: CoverageRow[] = TOWERS.map((t) => {
  const inTransition = ['S0', 'S1', 'S2', 'S3'].includes(t.state)
  const hv = t.verificationCoverage
  const mc = Math.min(99.5, hv + rng.float(1.5, 4.5, 1))
  return {
    tower: t.id,
    entities: t.entities,
    mapped: Math.round(t.entities * (inTransition ? rng.float(0.72, 0.9, 3) : rng.float(0.95, 0.995, 3))),
    dark: 0,
    humanVerified: hv,
    machineCorroborated: Math.round((mc - hv) * 10) / 10,
    unverified: Math.round((100 - mc) * 10) / 10,
    stale: rng.float(0.2, 2.4, 1),
    contradictionRate: inTransition ? rng.float(3.1, 7.8, 1) : rng.float(0.4, 2.2, 1),
    verificationLatencyDays: inTransition ? rng.float(2.1, 4.6, 1) : rng.float(1.1, 3.8, 1),
    volumeCovered: inTransition ? rng.float(58, 84, 1) : rng.float(88, 97, 1),
  }
}).map((r) => ({ ...r, dark: r.entities - r.mapped }))

/* -------------------------- Autonomy schedule (§7.2) ------------------------ */

const TARGET_BY_CLASS: Record<string, number> = {
  'AC-05': 4, 'AC-08': 4, 'AC-12': 4, 'AC-18': 4, 'AC-24': 4, 'AC-31': 3, 'AC-37': 2,
  'AC-41': 3, 'AC-44': 2, 'AC-49': 2, 'AC-52': 3, 'AC-58': 2, 'AC-63': 3, 'AC-66': 4, 'AC-71': 1, 'AC-80': 2,
}

const BLOCKERS: Record<string, string> = {
  'AC-31': 'No rollback path on 3 tier-0 components — transform item ta_040 raised',
  'AC-63': 'Config backup not automated on the branch estate',
  'AC-49': 'Data contract absent on 2 of 5 gold assets',
}

export const AUTONOMY_SCHEDULE: AutonomyScheduleCell[] = TOWERS.flatMap((t) => {
  const inTransition = ['S0', 'S1', 'S2'].includes(t.state)
  const hyper = t.state === 'S3'
  return ACTION_CLASSES.map((ac) => {
    const target = TARGET_BY_CLASS[ac.id] ?? 2
    let current = target
    if (inTransition) current = ac.id === 'AC-05' || ac.id === 'AC-08' ? 1 : 0
    else if (hyper) current = Math.min(2, target)
    else {
      // Mature towers sit at or just below target; EUC is the proving ground and leads.
      const lead = t.id === 'twr_euc' || t.id === 'twr_cloud'
      current = lead ? target : Math.max(0, target - (rng.bool(0.34) ? 1 : 0))
    }
    const blocked = current < target && BLOCKERS[ac.id] && !inTransition ? BLOCKERS[ac.id] : undefined
    return {
      tower: t.id,
      actionClass: ac.id,
      current: current as 0 | 1 | 2 | 3 | 4,
      target: target as 0 | 1 | 2 | 3 | 4,
      evidence: inTransition ? 'shadow scoring in progress' : `replay n=${rng.int(210, 1240)} · live ${rng.float(94, 99.4, 1)}%`,
      blocked,
    }
  })
})

/* --------------------------- Cutover readiness (§10.3) ---------------------- */

export interface HandoverArtefact {
  id: string
  artefact: string
  acceptance: string
  consumedBy: string
  state: 'pass' | 'fail' | 'running' | 'pending'
  detail: string
}

export const HANDOVER: HandoverArtefact[] = [
  { id: 'ho_1', artefact: 'Verified knowledge pack (graph slice, runbooks, known errors)', acceptance: 'Graph quality SLOs met; tier-0/1 100% human-verified', consumedBy: 'Context assembler — every agent decision', state: 'fail', detail: '71.4% of historical volume covered against an 85% threshold. 4 tier-1 services still unverified.' },
  { id: 'ho_2', artefact: 'Countersigned baseline (effort, cost, service levels)', acceptance: 'Both parties sign platform-measured figures; variance notes closed', consumedBy: 'Baseline & Glidepath Ledger', state: 'running', detail: 'Shadow-period measurement at day 24 of 28. Provisional: 2,680 hrs/qtr.' },
  { id: 'ho_3', artefact: 'Autonomy Schedule v1 (tower × action class)', acceptance: 'Every grade backed by replay + shadow evidence; governance approval recorded', consumedBy: 'Autonomy Policy Engine', state: 'fail', detail: 'AC-31 and AC-37 below agreement threshold. Draft schedule caps both at L1.' },
  { id: 'ho_4', artefact: 'Demand-class register with top-20 elimination candidates', acceptance: 'Classes cover ≥ 80% of historical volume; candidates costed', consumedBy: 'Demand Elimination Engine', state: 'pass', detail: '18 classes cover 82.4% of 14 months of ticket volume. All 20 candidates costed with NPV.' },
  { id: 'ho_5', artefact: 'Hypercare exit report', acceptance: 'N green weeks; reverse-shadow retired; escalation drill passed', consumedBy: 'Governance Cockpit — S3→S4 transition', state: 'pending', detail: 'Not started. Gated on cutover.' },
  { id: 'ho_6', artefact: 'Capability transfer log', acceptance: 'Client-agreed transfer targets met', consumedBy: 'Joint operating model', state: 'pass', detail: 'Nordbank verifiers active: 6 of 6 target. 2 client-authored skills published to the client golden repo.' },
]
