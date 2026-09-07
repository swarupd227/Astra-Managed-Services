import { Rng, digest } from './rng'
import { sealChain } from './evidence'
import { AGENTS, TOWERS, policyForTower } from './estate'
import { AC } from './reference'
import type {
  AutonomyDecision, EvidenceRecord, Priority, Run, RunStep, TimelineEntry, WorkObject, WorkState, WorkType,
} from './types'

/** Fixed clock. A briefing estate must not drift with the wall clock. */
export const NOW = new Date('2027-02-18T09:42:00.000Z')
const iso = (minsAgo: number) => new Date(NOW.getTime() - minsAgo * 60000).toISOString()

const rng = new Rng(20270218)

/* ---------------------------- Demand class labels --------------------------- */

interface Tpl { title: string; dc: string; type: WorkType; ac: string[]; mins: number; variants: string[] }

const DEMAND_TITLES: Record<string, Tpl[]> = {
  twr_payments: [
    { title: 'Mulesoft integration failure', dc: 'dc_mulesoft_soleowner', type: 'incident', ac: ['AC-31', 'AC-12'], mins: 95, variants: ['on the Salesforce → SAP quote-to-cash sync', 'on the nightly bridge reconciliation job', 'during the sole maintainer\'s out-of-office window', 'on Mulesoft Anypoint runtime restart'] },
    { title: 'FOCUS billing batch stalled', dc: 'dc_focus_stall', type: 'incident', ac: ['AC-12'], mins: 70, variants: ['at SAP HANA time-entry ingest', 'awaiting rate-card refresh', 'on the weekly billing run', 'at time-and-expense export'] },
    { title: 'Certificate expiry', dc: 'dc_cert_expiry', type: 'incident', ac: ['AC-41'], mins: 45, variants: ['on the Mulesoft Anypoint edge listener (6 days)', 'on the FOCUS SAP HANA client cert (2 days)', 'on the IEM legacy gateway cert (11 days)'] },
    { title: 'Duplicate time-entry submission', dc: 'dc_dup_timeentry', type: 'problem', ac: ['AC-37'], mins: 240, variants: ['on the IEM retry path', 'after idempotency-key collision in IEM', 'on consultant resubmission after timeout'] },
    { title: 'Reconciliation break', dc: 'dc_recon_break', type: 'incident', ac: ['AC-05'], mins: 130, variants: ['between Mulesoft and SAP S/4HANA', 'between FOCUS billing and the Salesforce opportunity', 'on engagement-code mapping'] },
    { title: 'Integration API 5xx spike', dc: 'dc_api_5xx', type: 'incident', ac: ['AC-18', 'AC-12'], mins: 85, variants: ['from Mulesoft downstream timeout', 'on the Salesforce ↔ SAP bridge', 'during the month-end billing ramp'] },
    { title: 'Release verification failed', dc: 'dc_release_verify', type: 'change', ac: ['AC-37'], mins: 180, variants: ['on Mulesoft Anypoint 4.6 canary', 'on FOCUS SAP HANA patch smoke pack'] },
    { title: 'IEM still live despite retirement notice', dc: 'dc_iem_ghost', type: 'incident', ac: ['AC-18'], mins: 60, variants: ['time-entry correction rejected', 'traffic continuing after the Concur cutover date', 'consultant unable to submit hours'] },
  ],
  twr_core: [
    { title: 'Batch window overrun', dc: 'dc_batch_overrun', type: 'incident', ac: ['AC-05'], mins: 160, variants: ['on SAP S/4HANA nightly close', 'on PeopleSoft HCM payroll extract', 'on the ServiceNow CMDB sync job'] },
    { title: 'PeopleSoft-to-Workday migration defect', dc: 'dc_workday_migration', type: 'problem', ac: ['AC-37'], mins: 320, variants: ['on benefits-enrolment mapping', 'on org-hierarchy carryover', 'on retro-pay calculation'] },
    { title: 'Integration queue depth alarm', dc: 'dc_mq_depth', type: 'incident', ac: ['AC-12'], mins: 55, variants: ['on the SAP ↔ ServiceNow bridge', 'on the SAP S/4HANA core interface queue', 'on the PeopleSoft adapter'] },
    { title: 'ServiceNow catalog item failing', dc: 'dc_snow_catalog', type: 'incident', ac: ['AC-05'], mins: 90, variants: ['on a post-go-live catalog item', 'for cross-region approvals'] },
    { title: 'Salesforce sync incomplete', dc: 'dc_sfdc_gap', type: 'incident', ac: ['AC-49'], mins: 145, variants: ['for 2,140 opportunity records', 'on the partner-account segment'] },
    { title: 'SAP S/4HANA at capacity', dc: 'dc_sap_capacity', type: 'incident', ac: ['AC-18'], mins: 120, variants: ['application server pool CORPA', 'during month-end close'] },
  ],
  twr_dataplat: [
    { title: 'ADF nightly load missed contract', dc: 'dc_pipeline_fail', type: 'incident', ac: ['AC-12', 'AC-49'], mins: 110, variants: ['05:00 CST delivery breached by 41m', 'upstream feed arrived late', 'cluster start-up contention'] },
    { title: 'Data contract breach', dc: 'dc_dq_null_ratio', type: 'incident', ac: ['AC-49'], mins: 140, variants: ['engagement_gold null ratio 4.1% vs 0.5% bound', 'client_dim referential integrity', 'utilization_gold freshness SLO'] },
    { title: 'Lineage gap', dc: 'dc_lineage_gap', type: 'problem', ac: ['AC-05'], mins: 200, variants: ['on the Oracle datamart extract path', 'between Azure Data Factory and Purview', 'on the billing aggregation layer'] },
    { title: 'Job cost anomaly', dc: 'dc_job_cost', type: 'finding', ac: ['AC-18'], mins: 60, variants: ['ADF pipeline 4.2× baseline', 'runaway autoscale on the ingest cluster', 'skewed join on engagement_silver'] },
    { title: 'Schema drift', dc: 'dc_schema_drift', type: 'incident', ac: ['AC-44'], mins: 175, variants: ['on the upstream HCM feed', 'new nullable column on client_ref', 'type widened on hours_minor'] },
    { title: 'Oracle datamart blind spot', dc: 'dc_oracle_blindspot', type: 'incident', ac: ['AC-05'], mins: 165, variants: ['7,000 users affected, no telemetry to confirm scope', 'root cause unconfirmed — zero incident history exists for this asset', 'freshness cannot be verified against any contract'] },
  ],
  twr_cloud: [
    { title: 'Node pool memory pressure', dc: 'dc_node_pressure', type: 'incident', ac: ['AC-18', 'AC-12'], mins: 65, variants: ['az-centralus-prod-01', 'az-centralus-prod-02', 'system pool eviction threshold'] },
    { title: 'FinOps coverage below floor', dc: 'dc_ri_coverage', type: 'finding', ac: ['AC-80'], mins: 90, variants: ['reserved-instance coverage 61% vs 80%', 'savings plan expiring in 14 days'] },
    { title: 'Storage nearing throughput quota', dc: 'dc_storage_quota', type: 'incident', ac: ['AC-18'], mins: 50, variants: ['stkearneyprod at 88%', 'stkearneyarchive IOPS ceiling'] },
    { title: 'Configuration drift detected', dc: 'dc_tf_drift', type: 'finding', ac: ['AC-31'], mins: 75, variants: ['against Terraform state (14 resources)', 'console change on the data platform RG', 'NSG rule added outside pipeline'] },
    { title: 'Ingress certificate rotation due', dc: 'dc_cert_expiry', type: 'change', ac: ['AC-41'], mins: 40, variants: ['ingress-nginx wildcard (9 days)', 'app-gw listener bundle'] },
    { title: 'Availability probe failing', dc: 'dc_probe_fail', type: 'incident', ac: ['AC-12'], mins: 80, variants: ['on the identity broker', 'on the API management gateway'] },
    { title: 'Chicago DC exit wave stalled', dc: 'dc_dc_exit', type: 'incident', ac: ['AC-12'], mins: 95, variants: ['last-wave VM migration stall', 'Windows Server host still live past its cutover date'] },
  ],
  twr_euc: [
    { title: 'Account lockout after MFA re-enrolment', dc: 'dc_pwd_reset', type: 'request', ac: ['AC-66'], mins: 18, variants: ['Chicago office', 'London office', 'remote worker, Mumbai', 'Singapore office', 'São Paulo office'] },
    { title: 'OneDrive sync failure', dc: 'dc_onedrive_sync', type: 'incident', ac: ['AC-66'], mins: 35, variants: ['after Cisco Zero-Trust enrolment', 'known-folder move stall', 'sync client crash loop'] },
    { title: 'Catalog software provisioning', dc: 'dc_sw_provision', type: 'request', ac: ['AC-18'], mins: 22, variants: ['Alteryx Designer', 'Power BI Desktop', 'Visual Studio Enterprise', 'Adobe Acrobat Pro'] },
    { title: 'Outlook performance degraded', dc: 'dc_outlook_perf', type: 'incident', ac: ['AC-66'], mins: 28, variants: ['shared calendar sync stall', 'add-in crash loop', 'cached-mode rebuild'] },
    { title: 'Teams call quality incident', dc: 'dc_teams_quality', type: 'incident', ac: ['AC-18'], mins: 42, variants: ['client-office conference pool', 'meeting-room device pairing failure'] },
    { title: 'New joiner not productive at start', dc: 'dc_joiner_ttp', type: 'request', ac: ['AC-66'], mins: 55, variants: ['HR record arrived after cut-off', 'device shipped to the wrong office'] },
    { title: 'PowerPoint fails to save after Zero-Trust enrolment', dc: 'dc_ppt_sync', type: 'incident', ac: ['AC-12'], mins: 26, variants: ['deck fails to save to OneDrive', 'autosave conflict post-ZTA re-auth'] },
    { title: 'Endpoint security stack contention', dc: 'dc_endpoint_contention', type: 'incident', ac: ['AC-52', 'AC-31'], mins: 120, variants: ['before a client steering-committee deck', 'during a live client call', 'overnight before a deliverable deadline'] },
  ],
  twr_network: [
    { title: 'Zero-Trust enrolment failure', dc: 'dc_zta_enroll', type: 'incident', ac: ['AC-63'], mins: 105, variants: ['SASE agent registration timeout', 'certificate-based device-trust failure', 'conditional-access policy conflict'] },
    { title: 'OneDrive/PowerPoint sync breaks after ZTA enrolment', dc: 'dc_zta_sync_break', type: 'problem', ac: ['AC-63'], mins: 80, variants: ['related to PRB0040062', 'sync token invalidated by SASE re-authentication'] },
    { title: 'Firewall / SASE rule request', dc: 'dc_fw_request', type: 'change', ac: ['AC-63'], mins: 60, variants: ['new SaaS egress range', 'partner VPN range'] },
    { title: 'Gateway health check flapping', dc: 'dc_lb_flap', type: 'incident', ac: ['AC-63'], mins: 70, variants: ['on the ZTA gateway', 'on the identity VIP'] },
    { title: 'Ivanti registration failure', dc: 'dc_ivanti_reg', type: 'problem', ac: ['AC-63'], mins: 90, variants: ['device certificate mismatch', 'MDM enrolment token expired'] },
  ],
  twr_secops: [
    { title: 'Endpoint security agents contend for CPU', dc: 'dc_triple_av', type: 'incident', ac: ['AC-52', 'AC-31'], mins: 120, variants: ['Cisco AMP, Trellix ePO and a third EDR scanning concurrently', 'overlapping full-disk scans on the same fleet segment', 'related to PRB0040112'] },
    { title: 'Critical CVE on base image', dc: 'dc_cve_image', type: 'finding', ac: ['AC-52'], mins: 120, variants: ['Windows 11 golden image (CVSS 9.1)', 'shared endpoint-agent package, 31 downstream device groups'] },
    { title: 'Impossible-travel sign-in', dc: 'dc_impossible_travel', type: 'incident', ac: ['AC-58'], mins: 95, variants: ['privileged account, unusual region', 'service principal, unusual region'] },
    { title: 'Access recertification overdue', dc: 'dc_access_recert', type: 'request', ac: ['AC-58'], mins: 150, variants: ['Q1 campaign — 412 entitlements', 'privileged tier, 38 accounts'] },
    { title: 'Endpoint detection alert', dc: 'dc_edr_alert', type: 'finding', ac: ['AC-05'], mins: 85, variants: ['credential-dumping signature', 'suspicious PowerShell on a build agent'] },
    { title: 'Patch wave held at canary gate', dc: 'dc_patch_wave', type: 'change', ac: ['AC-52'], mins: 110, variants: ['February wave, ring 1', 'out-of-band fix, ring 0'] },
  ],
  twr_agentops: [
    { title: 'Client agent proposed outside the Schedule O whitelist', dc: 'dc_agent_scope', type: 'finding', ac: ['AC-58'], mins: 70, variants: ['IEM Time-Entry Bot — blocked at gate', 'Proposal Copilot — second occurrence'] },
    { title: 'Replay score below promotion threshold', dc: 'dc_agent_eval', type: 'finding', ac: ['AC-05'], mins: 110, variants: ['Proposal Copilot — 0.741 vs 0.85 required', 'IEM Time-Entry Bot — regression on v3'] },
    { title: 'Agent token budget breached', dc: 'dc_agent_budget', type: 'finding', ac: ['AC-05'], mins: 45, variants: ['soft threshold, Proposal Copilot', 'hard threshold, degraded to mid tier'] },
    { title: 'Drift alarm on client agent', dc: 'dc_agent_drift', type: 'finding', ac: ['AC-05'], mins: 90, variants: ['input distribution shift, IEM Time-Entry Bot', 'model version change without regression'] },
    { title: 'AI system deployed without 72-hour pre-notice', dc: 'dc_schedule_o_notice', type: 'incident', ac: ['AC-58'], mins: 130, variants: ['new AI system live before Exhibit whitelist published', 'notice filed after deployment, not before'] },
  ],
  twr_claims: [
    { title: 'Shadow IT application discovered', dc: 'dc_shadow_app', type: 'incident', ac: ['AC-05'], mins: 130, variants: ['absent from Attachment C.4', 'owner unknown in the ticket record', 'no CMDB record at all'] },
    { title: 'CMDB reconciliation mismatch', dc: 'dc_cmdb_mismatch', type: 'problem', ac: ['AC-05'], mins: 180, variants: ['incident-count column does not reconcile against the ticket extract', 'application-owner field stale for 2+ quarters'] },
    { title: 'Service map gap on a Tier-1 dependency', dc: 'dc_svc_map_gap', type: 'incident', ac: ['AC-05'], mins: 115, variants: ['undocumented dependency mis-routed the incident', 'orphaned CI record with no owning tower'] },
    { title: 'CMDB accuracy below SLA target', dc: 'dc_cmdb_accuracy', type: 'finding', ac: ['AC-05'], mins: 95, variants: ['below the 98% Critical SLA target', 'sampling audit flags 6 CIs'] },
  ],
  twr_bi: [
    { title: 'Leadership pack refresh failed', dc: 'dc_bi_refresh', type: 'incident', ac: ['AC-05'], mins: 85, variants: ['semantic model timeout at 06:48', 'gateway credential expiry'] },
    { title: 'Report showing stale figures', dc: 'dc_bi_stale', type: 'incident', ac: ['AC-05'], mins: 70, variants: ['utilization dashboard, 2 days behind', 'practice performance pack'] },
    { title: 'Alteryx workflow failure', dc: 'dc_alteryx_fail', type: 'incident', ac: ['AC-05'], mins: 95, variants: ['macro engine timeout', 'license seat exhausted'] },
    { title: 'M365 Copilot / Azure OpenAI usage anomaly', dc: 'dc_copilot_anomaly', type: 'finding', ac: ['AC-05'], mins: 60, variants: ['token spend spike', 'hallucinated citation flagged by reviewer'] },
    { title: 'Semantic model definition conflict', dc: 'dc_bi_semantic', type: 'problem', ac: ['AC-05'], mins: 140, variants: ['two definitions of net revenue', 'headcount measure grain mismatch'] },
  ],
}

const HUMANS = ['A. Fernandes', 'K. Mehta', 'M. Okonkwo', 'R. Venkatesh', 'P. Lindegaard', 'D. Kowalski', 'L. Nakamura', 'S. Iyer']

/* --------------------------- Autonomy decision stub ------------------------- */

function decisionFor(tower: string, acs: string[], agentId: string, tier: number, conf: number): AutonomyDecision {
  const policy = policyForTower(tower)
  const agent = AGENTS.find((a) => a.id === agentId)!
  const primary = AC[acs[0]]
  const grades: Record<string, 'A' | 'B' | 'C' | 'D'> = {}
  acs.forEach((c) => { grades[c] = agent.grants[c] ?? 'C' })

  let mode: AutonomyDecision['mode'] = primary?.floor ?? 'advise'
  if (primary?.tier0Floor && tier === 0) mode = primary.tier0Floor
  if (conf < 0.8 && mode === 'supervised') mode = 'approve_first'

  const gates =
    mode === 'approve_first'
      ? [{ role: primary?.fourEyes ? 'sdm + second control' : 'on-call SDM', timeoutSec: primary?.fourEyes ? 1800 : 600, escalatesTo: 'duty manager' }]
      : []

  return {
    mode,
    policyId: policy.id,
    policyVersion: policy.version,
    actionClasses: acs,
    blastRadius: { services: tier === 0 ? 1 : rng.int(1, 4), dependents: rng.int(0, 6), maxTier: tier, dataMutation: acs.some((c) => ['AC-44', 'AC-49', 'AC-71'].includes(c)) },
    agentGrades: grades,
    planConfidence: conf,
    gates,
    reasons: [
      `${primary?.id} platform floor is ${primary?.floor.replace(/_/g, '-')}`,
      tier === 0 ? 'Tier-0 blast radius applies the stricter floor' : `Blast radius tier ${tier}`,
      `Agent grade ${grades[acs[0]]} on ${acs[0]}`,
    ],
    evaluatedInMs: rng.float(11, 38, 1),
    overrides: [],
  }
}

/* ------------------------------- Run builder -------------------------------- */

function buildRun(wo: WorkObject, skillId: string, acs: string[], state: WorkState): Run {
  const gated = wo.autonomy?.mode === 'approve_first'
  const steps: RunStep[] = [
    { id: 's1', kind: 'agent', label: 'Assemble decision context from Service Graph', agentId: 'agt_diagnost', state: 'done', detail: `27 assertions · 11 human-verified · package ${digest(wo.id).slice(0, 8)}`, durationMs: 2400, tokensUsd: 0.09 },
    { id: 's2', kind: 'agent', label: 'Construct causal chain', agentId: 'agt_diagnost', state: 'done', detail: `confidence ${(wo.classificationConfidence * 100).toFixed(1)}%`, durationMs: 5100, tokensUsd: 0.31 },
    { id: 's3', kind: 'agent', label: `Select skill ${skillId}`, agentId: 'agt_remedian', state: 'done', detail: 'success 98.4% over 61 runs', durationMs: 400, tokensUsd: 0.02 },
    { id: 's4', kind: 'gate', label: gated ? 'Human approval — on-call SDM' : 'Policy decision (no gate required)', state: gated ? (state === 'gated' ? 'blocked' : 'done') : 'done', detail: gated ? 'diff, blast summary and rollback presented' : 'supervised mode, notify only', durationMs: gated ? 27000 : 30 },
    { id: 's5', kind: 'tool', label: acs[0] === 'AC-31' ? 'Revert configuration to known-good' : `Execute ${AC[acs[0]]?.name ?? acs[0]}`, state: state === 'gated' || state === 'planned' ? 'pending' : state === 'executing' ? 'running' : 'done', compensation: acs[0] === 'AC-31' ? 'Reapply chg_5511 (tested)' : 'Restore prior state snapshot', durationMs: 18000, tokensUsd: 0.04 },
    { id: 's6', kind: 'verify', label: `Verification pack ${AC[acs[0]]?.verificationPack ?? 'health_probe_v4'}`, state: ['verifying'].includes(state) ? 'running' : ['resolved', 'learned'].includes(state) ? 'done' : 'pending', detail: ['resolved', 'learned'].includes(state) ? 'SLO recovered · synthetic checks pass' : 'canary window 3m', durationMs: 42000 },
    { id: 's7', kind: 'agent', label: 'Write resolution narrative & seal evidence', agentId: 'agt_herald', state: ['resolved', 'learned'].includes(state) ? 'done' : 'pending', detail: ['resolved', 'learned'].includes(state) ? 'written back to ServiceNow' : undefined, durationMs: 3100, tokensUsd: 0.12 },
  ]

  return {
    id: `run_${wo.id.slice(3)}`,
    workObjectId: wo.id,
    skillId,
    steps,
    state: state === 'gated' ? 'gated' : state === 'executing' ? 'executing' : state === 'verifying' ? 'verifying' : ['resolved', 'learned'].includes(state) ? 'complete' : 'planned',
    startedAt: wo.createdAt,
    tokensUsd: steps.reduce((s, x) => s + (x.tokensUsd ?? 0), 0),
  }
}

/* ------------------------------ Work generation ----------------------------- */

const STATE_WEIGHTS: readonly (readonly [WorkState, number])[] = [
  ['detected', 6], ['triaged', 10], ['planned', 8], ['gated', 9],
  ['executing', 7], ['verifying', 8], ['resolved', 34], ['learned', 18],
]

const PRIORITY_WEIGHTS: readonly (readonly [Priority, number])[] = [
  ['P1', 2], ['P2', 16], ['P3', 52], ['P4', 30],
]

const SLA_TARGET: Record<Priority, number> = { P1: 60, P2: 240, P3: 480, P4: 1440 }

function agentForAc(ac: string): string {
  if (['AC-05', 'AC-08'].includes(ac)) return 'agt_sentinel'
  if (['AC-37'].includes(ac)) return 'agt_forge'
  if (['AC-44', 'AC-49'].includes(ac)) return 'agt_custodian'
  if (['AC-58', 'AC-66'].includes(ac)) return 'agt_concierge'
  if (['AC-52'].includes(ac)) return 'agt_warden'
  if (['AC-80'].includes(ac)) return 'agt_bursar'
  return 'agt_remedian'
}

function skillForAc(ac: string): string {
  const map: Record<string, string> = {
    'AC-31': 'sk_dbpool_remediate_v7', 'AC-12': 'sk_rolling_restart_v11', 'AC-18': 'sk_rolling_restart_v11',
    'AC-41': 'sk_cert_rotate_v3', 'AC-37': 'sk_patch_v8', 'AC-49': 'sk_backfill_v4', 'AC-44': 'sk_pipe_repair_v9',
    'AC-58': 'sk_access_fulfil_v9', 'AC-66': 'sk_euc_reset_v12', 'AC-52': 'sk_patchwave_v8', 'AC-05': 'sk_causal_v9',
    'AC-63': 'sk_config_revert_v5', 'AC-80': 'sk_rightsize_v5', 'AC-08': 'sk_triage_v12', 'AC-24': 'sk_rolling_restart_v11',
  }
  return map[ac] ?? 'sk_causal_v9'
}

const REF_PREFIX: Record<WorkType, string> = {
  incident: 'INC', request: 'REQ', change: 'CHG', problem: 'PRB', enhancement: 'ENH', finding: 'SEC',
}

function narrativeFor(wo: WorkObject, acs: string[]): TimelineEntry[] {
  const t = (m: number) => iso(wo.slaElapsedMins - m)
  const out: TimelineEntry[] = [
    { id: 'n1', at: t(0), actorKind: 'system', actor: 'Event bus', text: `Signal received from ${wo.source.system} · ${wo.source.ref}`, level: 'info' },
    { id: 'n2', at: t(-0.05), actorKind: 'agent', actor: 'Sentinel', text: `Correlated ${rng.int(11, 240)} signals into one causal candidate. Classified ${wo.demandClass} at ${(wo.classificationConfidence * 100).toFixed(0)}% confidence.`, evidenceId: `ev_${digest(wo.id + 'n2').slice(0, 10)}`, level: 'info' },
  ]
  if (wo.state !== 'detected') {
    out.push({ id: 'n3', at: t(-0.2), actorKind: 'agent', actor: 'Diagnost', text: `Causal chain drafted from ${rng.int(14, 34)} graph assertions and ${rng.int(2, 9)} prior incidents of this class.`, evidenceId: `ev_${digest(wo.id + 'n3').slice(0, 10)}`, level: 'info' })
  }
  if (['planned', 'gated', 'executing', 'verifying', 'resolved', 'learned'].includes(wo.state)) {
    out.push({ id: 'n4', at: t(-0.35), actorKind: 'system', actor: 'Autonomy Policy Engine', text: `Action classes ${acs.join(' + ')} evaluated against ${wo.autonomy?.policyId} ${wo.autonomy?.policyVersion} → ${wo.autonomy?.mode.replace(/_/g, '-')}. Decided in ${wo.autonomy?.evaluatedInMs}ms.`, evidenceId: `ev_${digest(wo.id + 'n4').slice(0, 10)}`, level: 'info' })
  }
  if (wo.state === 'gated') {
    out.push({ id: 'n5', at: t(-0.4), actorKind: 'system', actor: 'HITL gateway', text: `Awaiting approval from ${wo.autonomy?.gates[0]?.role ?? 'on-call SDM'}. Escalates to ${wo.autonomy?.gates[0]?.escalatesTo ?? 'duty manager'} on timeout.`, level: 'warn' })
  }
  if (['executing', 'verifying', 'resolved', 'learned'].includes(wo.state)) {
    out.push({ id: 'n6', at: t(-0.55), actorKind: 'human', actor: rng.pick(HUMANS), text: 'Approved. Plan, blast radius and rollback reviewed.', evidenceId: `ev_${digest(wo.id + 'n6').slice(0, 10)}`, level: 'ok' })
    out.push({ id: 'n7', at: t(-0.6), actorKind: 'agent', actor: 'Remedian', text: `Executed ${AC[acs[0]]?.name ?? acs[0]} with canary verification. Compensation held ready throughout.`, evidenceId: `ev_${digest(wo.id + 'n7').slice(0, 10)}`, level: 'info' })
  }
  if (['resolved', 'learned'].includes(wo.state)) {
    out.push({ id: 'n8', at: t(-0.85), actorKind: 'agent', actor: 'Herald', text: `Verification green. Resolution narrative written back to ${wo.source.system}. Evidence chain sealed.`, evidenceId: `ev_${digest(wo.id + 'n8').slice(0, 10)}`, level: 'ok' })
  }
  if (wo.state === 'learned') {
    out.push({ id: 'n9', at: t(-0.95), actorKind: 'agent', actor: 'Prospect', text: `Demand-class counter incremented. Elimination candidate raised against ${wo.demandClass}.`, evidenceId: `ev_${digest(wo.id + 'n9').slice(0, 10)}`, level: 'ok' })
  }
  return out
}

function generate(): { work: WorkObject[]; runs: Run[] } {
  const work: WorkObject[] = []
  const runs: Run[] = []
  let n = 482900

  for (const tower of TOWERS) {
    const templates = DEMAND_TITLES[tower.id] ?? []
    if (!templates.length) continue
    const inTransition = ['S0', 'S1', 'S2', 'S3'].includes(tower.state)
    const count = inTransition ? 14 : tower.id === 'twr_euc' ? 74 : tower.id === 'twr_cloud' ? 52 : 34

    for (let i = 0; i < count; i++) {
      const tpl = templates[i % templates.length]
      const variant = tpl.variants[Math.floor(i / templates.length) % tpl.variants.length]
      const priority = rng.pickWeighted(PRIORITY_WEIGHTS)
      let state = rng.pickWeighted(STATE_WEIGHTS)
      // Towers still in shadow never execute: proposals only.
      if (inTransition && ['gated', 'executing', 'verifying'].includes(state)) state = 'triaged'

      const target = SLA_TARGET[priority]
      const openStates: WorkState[] = ['detected', 'triaged', 'planned', 'gated', 'executing', 'verifying']
      const isOpen = openStates.includes(state)
      const elapsed = isOpen ? rng.int(4, Math.round(target * 1.15)) : rng.int(Math.round(target * 0.15), Math.round(target * 0.9))
      const tier = tower.criticality
      const conf = rng.float(0.72, 0.98, 2)
      const acs = tpl.ac
      const agentId = agentForAc(acs[0])
      const agentAssigned = rng.bool(0.62)
      const id = `wo_${digest(`${tower.id}${i}`).slice(0, 6)}`
      const burn = elapsed / target
      const paused = isOpen && rng.bool(0.07)

      const wo: WorkObject = {
        id,
        ref: `${REF_PREFIX[tpl.type]}0${n++}`,
        type: tpl.type,
        title: `${tpl.title} — ${variant}`,
        tower: tower.id,
        service: tower.name,
        affected: rng.shuffle(['app_mulesoft', 'db_sap_prod', 'app_focus', 'inf_azure_compute', 'pipe_datamart', 'net_sase_edge']).slice(0, rng.int(1, 3)),
        demandClass: tpl.dc,
        classificationConfidence: conf,
        priority,
        state,
        createdAt: iso(elapsed),
        slaTargetMins: target,
        slaElapsedMins: elapsed,
        slaPaused: paused,
        pauseReason: paused ? rng.pick(['awaiting_client', 'vendor_dependency', 'change_freeze_client_initiated']) : undefined,
        breachProbability: isOpen ? Math.min(0.97, Math.max(0.02, burn * rng.float(0.7, 1.25, 2))) : 0,
        // One draw, not two. Rolling separately for the id and the kind put an
        // agent id against assigneeKind 'human' (and the reverse) on roughly a
        // third of all work — which made every "work this agent holds" query
        // silently undercount, and rendered the wrong actor chip on the row.
        assignee: inTransition ? rng.pick(HUMANS) : state === 'detected' ? null : agentAssigned ? agentId : rng.pick(HUMANS),
        assigneeKind: inTransition ? 'human' : state === 'detected' ? null : agentAssigned ? 'agent' : 'human',
        economics: {
          estManualMins: tpl.mins,
          actualAgentMins: ['resolved', 'learned'].includes(state) ? rng.float(1.5, Math.max(3, tpl.mins * 0.22), 1) : 0,
          tokensUsd: rng.float(0.04, 2.4, 2),
          attribution: state === 'learned' ? 'automation' : ['resolved'].includes(state) ? 'acceleration' : 'pending',
        },
        evidenceHead: `ev_${digest(id).slice(0, 10)}`,
        narrative: [],
        source: { system: rng.pickWeighted([['ServiceNow', 8], ['Datadog', 5], ['Jira SM', 2], ['Defender', 1], ['Azure Monitor', 3]] as const), ref: `${REF_PREFIX[tpl.type]}0${n}` },
        awaitingApproval: state === 'gated',
        xla: { touches: rng.int(1, 5), reassignments: rng.int(0, 2), reopened: rng.bool(0.05) },
      }

      if (!inTransition && state !== 'detected') {
        wo.autonomy = decisionFor(tower.id, acs, agentId, tier, conf)
        if (state === 'gated') wo.autonomy.mode = 'approve_first'
      }
      wo.narrative = narrativeFor(wo, acs)

      if (state !== 'detected' && !inTransition) {
        const run = buildRun(wo, skillForAc(acs[0]), acs, state)
        wo.runId = run.id
        runs.push(run)
      }
      work.push(wo)
    }
  }

  return { work, runs }
}

const generated = generate()

/* ------------------------- The §6.3 worked example -------------------------- */

const HERO_ID = 'wo_hero01'

const heroAutonomy: AutonomyDecision = {
  mode: 'approve_first',
  policyId: 'pol_euc_std',
  policyVersion: 'v6',
  actionClasses: ['AC-52', 'AC-31'],
  blastRadius: { services: 1, dependents: 2, maxTier: 0, dataMutation: false },
  agentGrades: { 'AC-52': 'A', 'AC-31': 'B' },
  planConfidence: 0.89,
  gates: [{ role: 'on-call SDM', timeoutSec: 600, escalatesTo: 'duty manager' }],
  reasons: [
    'AC-52 platform floor is Supervised; contention on a Security-owned endpoint-agent stack raises it to Approve-first',
    'Agent grade A on AC-52, B on AC-31',
    'Plan confidence 0.89 exceeds the 0.85 requirement',
    'No change freeze active; no major incident open',
  ],
  evaluatedInMs: 28.7,
  overrides: [],
}

export const HERO: WorkObject = {
  id: HERO_ID,
  ref: 'INC0482913',
  type: 'incident',
  title: 'Three endpoint-security agents pegging a consultant laptop the night before a deliverable',
  tower: 'twr_euc',
  service: 'Digital Workplace Services',
  affected: ['ke_triple_av'],
  demandClass: 'dc_endpoint_contention',
  classificationConfidence: 0.89,
  priority: 'P2',
  state: 'gated',
  createdAt: iso(41),
  slaTargetMins: 240,
  slaElapsedMins: 41,
  slaPaused: false,
  breachProbability: 0.18,
  assignee: 'agt_warden',
  assigneeKind: 'agent',
  runId: 'run_hero01',
  autonomy: heroAutonomy,
  economics: { estManualMins: 120, actualAgentMins: 4, tokensUsd: 0.83, attribution: 'pending' },
  evidenceHead: 'ev_c41a9f2e10',
  source: { system: 'Defender', ref: 'mon-8834 · endpoint CPU saturation, fleet segment CHI-CONSULT-04' },
  awaitingApproval: true,
  xla: { touches: 1, reassignments: 0, reopened: false },
  narrative: [
    { id: 'h1', at: iso(41), actorKind: 'system', actor: 'Microsoft Defender for Endpoint', text: 'Monitor mon-8834: sustained CPU saturation above 92% for 11 minutes across 214 devices in fleet segment CHI-CONSULT-04, correlated with three overlapping AV/EDR scan cycles.', level: 'crit' },
    { id: 'h2', at: iso(40.97), actorKind: 'agent', actor: 'Sentinel', text: 'Correlated 187 alerts into 1 causal candidate. Classified dc_endpoint_contention at 89% confidence. P2 raised; INC0482913 opened in ServiceNow.', evidenceId: 'ev_c41a9f2e01', level: 'info' },
    { id: 'h3', at: iso(40.85), actorKind: 'agent', actor: 'Diagnost', text: 'Context package pkg_7f2a: 19 assertions (9 human-verified, 10 machine-corroborated), citing known error ke_triple_av (41 occurrences since 2025-09-11). Causal chain: Cisco AMP, Trellix ePO and a third EDR each scheduled independent full-disk scans overlapping 22:00–01:00 CST → CPU starvation on the device → consultant unable to finish a client deck due at 08:00.', evidenceId: 'ev_c41a9f2e02', level: 'info' },
    { id: 'h4', at: iso(40.77), actorKind: 'agent', actor: 'Warden', text: 'Selected skill sk_patchwave_v8 (endpoint de-duplication mode) — 97.9% success across 620 runs on this demand class.', evidenceId: 'ev_c41a9f2e03', level: 'info' },
    { id: 'h5', at: iso(40.76), actorKind: 'system', actor: 'Autonomy Policy Engine', text: 'AC-52 canaried patch wave + AC-31 revert-config. Blast radius 1 device group, 2 dependents, tier 0 (Security-owned agent stack), no data mutation. Policy euc_standard_v6 → APPROVE-FIRST, gate: on-call SDM, 10-minute timeout then escalate. Decided in 28.7 ms.', evidenceId: 'ev_c41a9f2e04', level: 'warn' },
    { id: 'h6', at: iso(40.7), actorKind: 'system', actor: 'HITL gateway', text: 'Approval card delivered to M. Okonkwo (on-call SDM) on console and mobile. Diff, blast summary, rollback plan and agent track record attached.', level: 'warn' },
  ],
}

export const HERO_RUN: Run = {
  id: 'run_hero01',
  workObjectId: HERO_ID,
  skillId: 'sk_patchwave_v8',
  state: 'gated',
  startedAt: iso(41),
  tokensUsd: 0.83,
  steps: [
    { id: 's1', kind: 'agent', label: 'Correlate signals into causal candidate', agentId: 'agt_sentinel', state: 'done', detail: '187 alerts → 1 candidate · dc_endpoint_contention (0.89)', durationMs: 1900, tokensUsd: 0.04 },
    { id: 's2', kind: 'agent', label: 'Assemble decision context (graph + telemetry)', agentId: 'agt_diagnost', state: 'done', detail: 'pkg_7f2a · 19 assertions · floor: machine_corroborated · scan-schedule telemetry across 3 vendor agents', durationMs: 4200, tokensUsd: 0.21 },
    { id: 's3', kind: 'agent', label: 'Construct causal chain', agentId: 'agt_diagnost', state: 'done', detail: 'ke_triple_av: Cisco AMP + Trellix ePO + a third EDR overlapping full-disk scans 22:00–01:00 CST → CPU starvation → deliverable-critical laptop unusable', durationMs: 5100, tokensUsd: 0.36 },
    { id: 's4', kind: 'agent', label: 'Plan: select sk_patchwave_v8 (de-duplication mode)', agentId: 'agt_warden', state: 'done', detail: '97.9% success, n=620', durationMs: 380, tokensUsd: 0.02 },
    { id: 's5', kind: 'gate', label: 'Approval — on-call SDM', state: 'blocked', detail: 'awaiting decision · escalates to duty manager in 09:12', durationMs: 0 },
    { id: 's6', kind: 'tool', label: 'Re-stagger and de-duplicate scan windows across the three agents', state: 'pending', compensation: 'Restore prior scan schedule (tested in non-prod 2027-02-16)', durationMs: 0 },
    { id: 's7', kind: 'tool', label: 'Rolling restart of endpoint-agent supervisor (214 devices, fleet segment CHI-CONSULT-04)', state: 'pending', compensation: 'Self-healing — no compensation required', durationMs: 0 },
    { id: 's8', kind: 'verify', label: 'Verification pack patch_wave_v2', state: 'pending', detail: 'canary 10 devices → CPU probe → scan-completion check', durationMs: 0 },
    { id: 's9', kind: 'agent', label: 'Write narrative, seal evidence, update demand class', agentId: 'agt_herald', state: 'pending', durationMs: 0, tokensUsd: 0.2 },
  ],
}

/* -------------------------------- Assembly ---------------------------------- */

export const WORK_OBJECTS: WorkObject[] = [HERO, ...generated.work]
export const RUNS: Run[] = [HERO_RUN, ...generated.runs]

/* ------------------------------ Evidence chain ------------------------------ */

function buildEvidence(): EvidenceRecord[] {
  const raw: Omit<EvidenceRecord, 'hash' | 'prevHash' | 'tampered'>[] = []
  let seq = 1

  const push = (r: Omit<EvidenceRecord, 'hash' | 'prevHash' | 'tampered' | 'seq'>) => {
    raw.push({ ...r, seq: seq++ })
  }

  const ordered = [...WORK_OBJECTS].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  for (const wo of ordered) {
    const acs = wo.autonomy?.actionClasses ?? ['AC-05']
    push({ id: `${wo.evidenceHead}-01`, at: wo.createdAt, kind: 'observation', workObjectId: wo.id, agentId: 'agt_sentinel', actor: 'Sentinel', summary: `Signal correlated and classified ${wo.demandClass}`, payload: { source: wo.source, confidence: wo.classificationConfidence, priority: wo.priority }, sealed: true })
    push({ id: `${wo.evidenceHead}-02`, at: wo.createdAt, kind: 'clock', workObjectId: wo.id, actor: 'SLA engine', summary: `Clock started — target ${wo.slaTargetMins}m`, payload: { start: 'validated_priority_set', calendar: 'client_biz_hours(America/Chicago)', target: wo.slaTargetMins }, sealed: true })
    if (wo.autonomy) {
      push({ id: `${wo.evidenceHead}-03`, at: wo.createdAt, kind: 'decision', workObjectId: wo.id, runId: wo.runId, actionClass: acs[0], actor: 'Autonomy Policy Engine', summary: `Execution mode ${wo.autonomy.mode} under ${wo.autonomy.policyId} ${wo.autonomy.policyVersion}`, payload: { inputVector: { actionClasses: acs, blast: wo.autonomy.blastRadius, grades: wo.autonomy.agentGrades, confidence: wo.autonomy.planConfidence }, reasons: wo.autonomy.reasons, evaluatedInMs: wo.autonomy.evaluatedInMs }, sealed: true })
    }
    if (['executing', 'verifying', 'resolved', 'learned'].includes(wo.state)) {
      push({ id: `${wo.evidenceHead}-04`, at: wo.createdAt, kind: 'approval', workObjectId: wo.id, runId: wo.runId, actor: wo.narrative.find((x) => x.actorKind === 'human')?.actor ?? 'R. Venkatesh', summary: 'Gated action approved', payload: { shown: ['diff', 'blast_radius', 'rollback_plan', 'agent_track_record'], channel: 'mobile' }, sealed: true })
      push({ id: `${wo.evidenceHead}-05`, at: wo.createdAt, kind: 'action', workObjectId: wo.id, runId: wo.runId, agentId: wo.assigneeKind === 'agent' ? wo.assignee ?? undefined : 'agt_remedian', actionClass: acs[0], actor: 'Remedian', summary: `${AC[acs[0]]?.name ?? acs[0]} executed`, payload: { compensationHeld: true, targets: wo.affected }, sealed: true })
    }
    if (['resolved', 'learned'].includes(wo.state)) {
      push({ id: `${wo.evidenceHead}-06`, at: wo.createdAt, kind: 'verification', workObjectId: wo.id, runId: wo.runId, actor: 'Verifier', summary: `${AC[acs[0]]?.verificationPack ?? 'health_probe_v4'} passed`, payload: { probes: ['slo_recovery', 'synthetic_txn'], result: 'green' }, sealed: true })
      push({ id: `${wo.evidenceHead}-07`, at: wo.createdAt, kind: 'economic', workObjectId: wo.id, actor: 'Glidepath Ledger', summary: `Effort delta attributed (${wo.economics.attribution})`, payload: { estManualMins: wo.economics.estManualMins, actualAgentMins: wo.economics.actualAgentMins, tokensUsd: wo.economics.tokensUsd }, sealed: true })
    }
  }

  return sealChain(raw)
}

export const EVIDENCE: EvidenceRecord[] = buildEvidence()
