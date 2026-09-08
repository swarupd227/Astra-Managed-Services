import { Rng, digest } from './rng'
import { TOWERS } from './estate'
import { ACTION_CLASSES } from './reference'
import type { Assertion, AutonomyScheduleCell } from './types'

const rng = new Rng(51009)
const NOW = new Date('2027-02-18T09:42:00.000Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString()

/* ------------------------- Verification queue (§10.1) ----------------------- */

const CLAIMS: { subject: string; predicate: string; object: string; narrative: string; tower: string; tier: 0 | 1 | 2 | 3 }[] = [
  { subject: 'app_mulesoft', predicate: 'DEPENDS_ON', object: 'db_sap_prod', narrative: 'Mulesoft calls SAP S/4HANA synchronously during the Salesforce quote-to-cash sync; an SAP outage blocks the sync entirely rather than degrading it.', tower: 'twr_payments', tier: 1 },
  { subject: 'app_mulesoft', predicate: 'OWNED_BY', object: 'team_integration_named_user', narrative: 'Mulesoft Anypoint has exactly one named user across the entire client organization. No secondary owner or on-call backup is recorded.', tower: 'twr_payments', tier: 1 },
  { subject: 'app_iem', predicate: 'FAILS_WHEN', object: 'time_code not in approved catalog', narrative: 'IEM rejects any time-code correction outside its approved catalog, even though the application inventory marks it replaced by Concur. Operators route around it manually.', tower: 'twr_payments', tier: 2 },
  { subject: 'app_focus', predicate: 'READS', object: 'db_sap_prod', narrative: 'FOCUS billing reads time-and-expense data directly from the SAP HANA production database rather than a replica — a HANA outage stalls billing immediately.', tower: 'twr_payments', tier: 1 },
  { subject: 'app_focus', predicate: 'HAS_SLO', object: 'weekly billing run < 90min', narrative: 'The weekly billing run must complete within 90 minutes to meet the downstream invoicing cut-off. Current p95 is 78 minutes.', tower: 'twr_payments', tier: 1 },
  { subject: 'pipe_datamart', predicate: 'PRODUCED_BY', object: 'adf_engagement_ingest', narrative: 'The nightly datamart refresh is produced by an Azure Data Factory pipeline, not by the legacy ETL jobs still referenced in older runbooks.', tower: 'twr_dataplat', tier: 1 },
  { subject: 'app_hcm', predicate: 'CALLS', object: 'db_sap_prod', narrative: 'PeopleSoft HCM reads organizational hierarchy directly from SAP S/4HANA during payroll extract. A schema change on either side surfaces as a payroll defect.', tower: 'twr_core', tier: 0 },
  { subject: 'db_sap_prod', predicate: 'HAS_MAINTENANCE_WINDOW', object: 'Sun 02:00–04:00 CST', narrative: 'SAP S/4HANA has a weekly maintenance window agreed with the business. Changes outside it require a CAB exception.', tower: 'twr_core', tier: 0 },
  { subject: 'rb_mulesoft_failover', predicate: 'RESOLVES', object: 'dc_mulesoft_soleowner', narrative: 'Drafted runbook: page the named Mulesoft owner and, failing response within 30 minutes, escalate to the Artizent integration on-call. Derived from 3 historical incidents.', tower: 'twr_payments', tier: 1 },
  { subject: 'app_iem', predicate: 'HAS_DATA_CLASS', object: 'restricted (time & expense)', narrative: 'IEM time-entry data is tied to individual consultant billing codes. Context retrieval must redact client-identifying fields before any model call.', tower: 'twr_payments', tier: 0 },
  { subject: 'if_ftp_legacy', predicate: 'IS_DEPRECATED', object: 'true (ta_007 delivered)', narrative: 'Telemetry shows zero traffic on the legacy FTP-based time-entry export for 74 consecutive days following ta_007. The declared dependency in the CMDB is stale.', tower: 'twr_payments', tier: 2 },
  { subject: 'da_oracle_dm', predicate: 'HAS_TELEMETRY', object: 'none', narrative: 'The Oracle datamart serving 7,000 users emits no incident telemetry at all — a named blind spot. Any outage today would be diagnosed from user reports alone.', tower: 'twr_dataplat', tier: 0 },
  { subject: 'da_oracle_dm', predicate: 'HAS_SLO', object: 'freshness unknown', narrative: 'No freshness SLO has ever been defined for the Oracle datamart, because no monitoring exists to measure one against.', tower: 'twr_dataplat', tier: 0 },
  { subject: 'ke_triple_av', predicate: 'CAUSED_BY', object: 'net_sase_edge', narrative: 'Three endpoint-security agents — Cisco AMP, Trellix ePO and a third EDR — run concurrent full-disk scans on the same fleet, contending for CPU. 41 occurrences recorded since 2025-09-11.', tower: 'twr_secops', tier: 0 },
  { subject: 'rb_endpoint_dedupe', predicate: 'RESOLVES', object: 'ke_triple_av', narrative: 'Drafted runbook: re-stagger and de-duplicate scan windows across the three agents, verify with a CPU probe. Derived from 41 historical tickets.', tower: 'twr_secops', tier: 0 },
  { subject: 'net_sase_edge', predicate: 'CAUSED_BY', object: 'PRB0040062', narrative: 'OneDrive and PowerPoint sync failures cluster in the hours immediately following Cisco Zero-Trust (SASE) enrolment — 72 related incidents against this problem record.', tower: 'twr_network', tier: 1 },
  { subject: 'if_zta', predicate: 'HAS_SLO', object: 'enrolment < 5min', narrative: 'Zero Trust Network Access enrolment must complete within 5 minutes to avoid a support call. Current p95 is 11 minutes on first-time enrolments.', tower: 'twr_network', tier: 1 },
  { subject: 'da_cmdb_gap', predicate: 'HAS_DATA_CLASS', object: 'unclassified', narrative: '55 applications visible in 12 months of ticket data carry no classification because they are absent from the official application inventory (Attachment C.4).', tower: 'twr_claims', tier: 1 },
  { subject: 'da_cmdb_gap', predicate: 'CONFLICTS_WITH', object: 'Attachment C.4 incident-count column', narrative: 'The application inventory\'s own incident-count column reports 13,134 incidents/year; the real 12-month ticket extract shows 28,028 — a gap of roughly 14,894 the inventory does not explain.', tower: 'twr_claims', tier: 1 },
  { subject: 'agt_client_iem', predicate: 'OWNED_BY', object: 'Kearney Finance Operations', narrative: 'The IEM Time-Entry Bot is a client-owned agent operating under Astra governance. Its proposals outside the approved time-code catalog are blocked at the policy gate.', tower: 'twr_agentops', tier: 1 },
  { subject: 'agt_client_iem', predicate: 'REQUIRES', object: 'Schedule O whitelist entry', narrative: 'Schedule O requires 72-hour pre-notice and a whitelist entry for any AI system in production. The whitelist Exhibit itself does not yet exist in the RFP pack — this agent currently runs ahead of its own governance artefact.', tower: 'twr_agentops', tier: 1 },
  { subject: 'app_focus', predicate: 'OWNED_BY', object: 'team_billing_platform', narrative: 'FOCUS billing is owned by the Billing Platform team, though the SAP HANA layer beneath it is jointly managed with Application Maintenance. Two-party ownership slows schema changes.', tower: 'twr_payments', tier: 1 },
  { subject: 'sem_model_research', predicate: 'READS', object: 'da_oracle_dm', narrative: 'The Research & Analytics semantic model partially reads from the Oracle datamart — the datamart\'s own blind spot propagates silently into every downstream Power BI report.', tower: 'twr_bi', tier: 1 },
  { subject: 'app_alteryx_wf', predicate: 'FAILS_WHEN', object: 'license seats exhausted', narrative: 'Alteryx workflows fail silently when the shared license pool is exhausted during a concurrent run — the most common root cause behind the tower\'s 659 annual incidents.', tower: 'twr_bi', tier: 2 },
]

export const ASSERTIONS: Assertion[] = CLAIMS.map((c, i) => {
  const sources: Assertion['source'][] = ['code_analysis', 'telemetry_inference', 'ticket_mining', 'human_statement']
  const source = sources[i % 4]
  const conflict = c.subject === 'if_ftp_legacy' || c.predicate === 'CONFLICTS_WITH'
  const assertedDays = rng.int(1, 22)
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
    assertedAt: daysAgo(assertedDays),
    // A pointer precise enough to go and look, plus a hash of the claim as
    // asserted — so a verifier can check the source, and a later edit to it
    // is detectable rather than assumed away.
    provenance: {
      sourceRef:
        source === 'code_analysis' ? `repo://kearney/${c.subject.replace(/^[a-z]+_/, '')}@${digest(c.subject).slice(0, 7)}:${c.predicate.toLowerCase()}.config`
          : source === 'telemetry_inference' ? `azure-monitor://traces?target=${c.subject}&window=30d&asserted=${daysAgo(assertedDays).slice(0, 10)}`
            : source === 'ticket_mining' ? `servicenow://query?subject=${c.subject}&window=14mo&sample=${240 + i * 17}`
              : `interview://${daysAgo(assertedDays + 2).slice(0, 10)}/session-${12 + (i % 7)}?sme=A.%20Ferreira`,
      retrievedAt: daysAgo(assertedDays + 1),
      contentHash: digest(`${c.subject}|${c.predicate}|${c.object}|${c.narrative}`),
    },
    ttlDays: c.tier <= 1 ? 90 : 180,
    conflictsWith: conflict ? (c.subject === 'if_ftp_legacy' ? 'CMDB declares this interface active' : 'Attachment C.4 declares 13,134 incidents/year') : undefined,
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
  { id: 'dis_01', actionClass: 'AC-31', at: daysAgo(2), agentProposal: 'Revert CMDB sync worker count 12 → 6 (matches pre-change baseline)', humanResolution: 'Scaled to 18 and raised a capacity problem record', why: 'Agent optimised for the incident; the human knew a quarterly reconciliation sweep across all 96 offices was starting. The business calendar is not yet in the graph.', verdict: 'unexplained', action: 'Raise graph work object: ingest client business calendar as a first-class entity' },
  { id: 'dis_02', actionClass: 'AC-37', at: daysAgo(3), agentProposal: 'Patch null-guard in ApplicationRecord.parseOwner()', humanResolution: 'Fixed upstream in the CMDB ingest contract instead', why: 'Both resolve the symptom. The human fix removes the class; the agent fix removes the instance. Prospect has since raised the class as an elimination candidate.', verdict: 'explained', action: 'No grade impact — narrative quality scored 0.88' },
  { id: 'dis_03', actionClass: 'AC-31', at: daysAgo(5), agentProposal: 'Revert Mulesoft timeout 30s → 10s', humanResolution: 'Left at 30s; escalated to the named integration owner', why: 'Agent cited an assertion that is stale — the Mulesoft named-user handoff was renegotiated in December and the graph still carries the old value.', verdict: 'unexplained', action: 'Assertion asr_4101 forced to re-verification; TTL policy tightened for sole-owner integrations' },
  { id: 'dis_04', actionClass: 'AC-49', at: daysAgo(6), agentProposal: 'Backfill engagement_gold for the 3-day gap', humanResolution: 'Blocked backfill; corrected source first', why: 'The asset has no data contract, so the agent could not verify the backfill. Policy already caps this at Advise — the disagreement confirms the cap is correct.', verdict: 'explained', action: 'Data contract authored for engagement_gold; re-shadow after it lands' },
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
  { id: 'ho_6', artefact: 'Capability transfer log', acceptance: 'Client-agreed transfer targets met', consumedBy: 'Joint operating model', state: 'pass', detail: 'Kearney verifiers active: 6 of 6 target. 2 client-authored skills published to the client golden repo.' },
]
