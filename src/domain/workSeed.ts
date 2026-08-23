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
    { title: 'Latency SLO breach', dc: 'dc_conn_pool_exhaustion', type: 'incident', ac: ['AC-31', 'AC-12'], mins: 95, variants: ['on Retail Payments (p99 1.9s)', 'on card authorisation path', 'on standing-order submission', 'on Payments API /v2/initiate'] },
    { title: 'Settlement batch stalled', dc: 'dc_ftp_stall', type: 'incident', ac: ['AC-12'], mins: 70, variants: ['at ISO 20022 ingest', 'awaiting partner acknowledgement', 'on the SEPA direct-debit run', 'at pain.002 response parse'] },
    { title: 'Certificate expiry', dc: 'dc_cert_expiry', type: 'incident', ac: ['AC-41'], mins: 45, variants: ['on pmt-gw edge listener (6 days)', 'on the partner mTLS bundle (2 days)', 'on ledger-svc client cert (11 days)'] },
    { title: 'Duplicate settlement instruction', dc: 'dc_dup_settlement', type: 'problem', ac: ['AC-37'], mins: 240, variants: ['on the retry path', 'after idempotency-key collision', 'on partner replay window'] },
    { title: 'Reconciliation break', dc: 'dc_recon_break', type: 'incident', ac: ['AC-05'], mins: 130, variants: ['in end-of-day ledger sweep', 'between settlement and nostro', 'on FX leg valuation'] },
    { title: 'Payment API 5xx spike', dc: 'dc_api_5xx', type: 'incident', ac: ['AC-18', 'AC-12'], mins: 85, variants: ['from downstream timeout', 'on the fraud-scoring hop', 'during the 09:00 volume ramp'] },
    { title: 'Release verification failed', dc: 'dc_release_verify', type: 'change', ac: ['AC-37'], mins: 180, variants: ['on ledger-svc 4.18.2 canary', 'on pmt-gw 2.9.0 smoke pack'] },
    { title: 'Sanctions screening queue backlog', dc: 'dc_screening_backlog', type: 'incident', ac: ['AC-18'], mins: 110, variants: ['after list refresh', 'during quarter-end volume'] },
  ],
  twr_core: [
    { title: 'Batch window overrun', dc: 'dc_batch_overrun', type: 'incident', ac: ['AC-05'], mins: 160, variants: ['on Deposits Core nightly', 'on interest accrual job', 'on statement generation'] },
    { title: 'Interest accrual defect', dc: 'dc_accrual_defect', type: 'problem', ac: ['AC-37'], mins: 320, variants: ['on leap-day boundary', 'on negative-rate products', 'on mid-month rate change'] },
    { title: 'MQ channel depth alarm', dc: 'dc_mq_depth', type: 'incident', ac: ['AC-12'], mins: 55, variants: ['on the core bridge', 'on CORE.OUT.PAYMENTS', 'on the mainframe adapter'] },
    { title: 'Standing-order amendment failing', dc: 'dc_so_validation', type: 'incident', ac: ['AC-05'], mins: 90, variants: ['on validation rule 4417', 'for joint-account holders'] },
    { title: 'Statement generation incomplete', dc: 'dc_stmt_gap', type: 'incident', ac: ['AC-49'], mins: 145, variants: ['for 2,140 retail accounts', 'on the corporate segment'] },
    { title: 'Mainframe region at capacity', dc: 'dc_mf_capacity', type: 'incident', ac: ['AC-18'], mins: 120, variants: ['CICS region CORPA', 'during month-end close'] },
  ],
  twr_dataplat: [
    { title: 'FINREP nightly load missed contract', dc: 'dc_pipeline_fail', type: 'incident', ac: ['AC-12', 'AC-49'], mins: 110, variants: ['06:00 CET delivery breached by 41m', 'upstream feed arrived late', 'cluster start-up contention'] },
    { title: 'Data contract breach', dc: 'dc_dq_null_ratio', type: 'incident', ac: ['AC-49'], mins: 140, variants: ['txn_gold null ratio 4.1% vs 0.5% bound', 'customer_dim referential integrity', 'positions_gold freshness SLO'] },
    { title: 'Lineage gap', dc: 'dc_lineage_gap', type: 'problem', ac: ['AC-05'], mins: 200, variants: ['on the regulatory extract path', 'between Fabric and Collibra', 'on the risk aggregation layer'] },
    { title: 'Job cost anomaly', dc: 'dc_job_cost', type: 'finding', ac: ['AC-18'], mins: 60, variants: ['Databricks 4.2× baseline', 'runaway autoscale on the ingest cluster', 'skewed join on txn_silver'] },
    { title: 'Schema drift', dc: 'dc_schema_drift', type: 'incident', ac: ['AC-44'], mins: 175, variants: ['on the upstream customer feed', 'new nullable column on party_ref', 'type widened on amount_minor'] },
    { title: 'Pipeline green but contract-violating', dc: 'dc_false_green', type: 'incident', ac: ['AC-49'], mins: 165, variants: ['claims_gold emitted 0-row partitions', 'silent truncation on the FX feed'] },
  ],
  twr_cloud: [
    { title: 'Node pool memory pressure', dc: 'dc_node_pressure', type: 'incident', ac: ['AC-18', 'AC-12'], mins: 65, variants: ['aks-neu-prod-01 northeurope', 'aks-weu-prod-02 westeurope', 'system pool eviction threshold'] },
    { title: 'FinOps coverage below floor', dc: 'dc_ri_coverage', type: 'finding', ac: ['AC-80'], mins: 90, variants: ['reserved-instance coverage 61% vs 80%', 'savings plan expiring in 14 days'] },
    { title: 'Storage nearing throughput quota', dc: 'dc_storage_quota', type: 'incident', ac: ['AC-18'], mins: 50, variants: ['stnbkledgerprod at 88%', 'stnbkarchive IOPS ceiling'] },
    { title: 'Configuration drift detected', dc: 'dc_tf_drift', type: 'finding', ac: ['AC-31'], mins: 75, variants: ['against Terraform state (14 resources)', 'console change on the payments RG', 'NSG rule added outside pipeline'] },
    { title: 'Ingress certificate rotation due', dc: 'dc_cert_expiry', type: 'change', ac: ['AC-41'], mins: 40, variants: ['ingress-nginx wildcard (9 days)', 'app-gw listener bundle'] },
    { title: 'Availability probe failing', dc: 'dc_probe_fail', type: 'incident', ac: ['AC-12'], mins: 80, variants: ['on the identity broker', 'on the API management gateway'] },
    { title: 'Backup job failed', dc: 'dc_backup_fail', type: 'incident', ac: ['AC-12'], mins: 95, variants: ['ledger-pg point-in-time chain', 'vault snapshot on the archive tier'] },
  ],
  twr_euc: [
    { title: 'Account lockout after MFA re-enrolment', dc: 'dc_pwd_reset', type: 'request', ac: ['AC-66'], mins: 18, variants: ['Stockholm office', 'Frankfurt office', 'remote worker, Oslo', 'Copenhagen branch', 'Malmö branch'] },
    { title: 'Workplace profile corruption', dc: 'dc_profile_corrupt', type: 'incident', ac: ['AC-66'], mins: 35, variants: ['after policy push 2027-02-16', 'roaming sync race on sign-in', 'OneDrive known-folder move'] },
    { title: 'Catalog software provisioning', dc: 'dc_sw_provision', type: 'request', ac: ['AC-18'], mins: 22, variants: ['Bloomberg add-in', 'Power BI Desktop', 'Visual Studio Enterprise', 'Adobe Acrobat Pro'] },
    { title: 'Shared mailbox access request', dc: 'dc_mailbox_access', type: 'request', ac: ['AC-58'], mins: 28, variants: ['Treasury operations', 'Financial crime team', 'Corporate onboarding'] },
    { title: 'VDI session pool exhausted', dc: 'dc_vdi_pool', type: 'incident', ac: ['AC-18'], mins: 42, variants: ['Frankfurt pool', 'Stockholm pool at 09:05'] },
    { title: 'New joiner not productive at start', dc: 'dc_joiner_ttp', type: 'request', ac: ['AC-66'], mins: 55, variants: ['HR record arrived after cut-off', 'device shipped to the wrong site'] },
    { title: 'Printer and follow-me queue failure', dc: 'dc_print_queue', type: 'incident', ac: ['AC-12'], mins: 26, variants: ['Stockholm floor 4', 'Frankfurt executive floor'] },
  ],
  twr_network: [
    { title: 'BGP peer flap', dc: 'dc_bgp_flap', type: 'incident', ac: ['AC-63'], mins: 105, variants: ['edge-fw-cluster-neu, carrier A', 'transit peer, carrier B', 'internet edge, Stockholm'] },
    { title: 'Branch VPN degraded', dc: 'dc_vpn_degraded', type: 'incident', ac: ['AC-63'], mins: 80, variants: ['Malmö — jitter above threshold', 'Bergen — packet loss 2.4%', 'Aarhus — tunnel re-key failures'] },
    { title: 'Firewall rule request', dc: 'dc_fw_request', type: 'change', ac: ['AC-63'], mins: 60, variants: ['new payment partner range', 'SaaS egress for the data platform'] },
    { title: 'Load balancer health check flapping', dc: 'dc_lb_flap', type: 'incident', ac: ['AC-63'], mins: 70, variants: ['on the payments VIP', 'on the identity VIP'] },
  ],
  twr_secops: [
    { title: 'Critical CVE on base image', dc: 'dc_cve_image', type: 'finding', ac: ['AC-52'], mins: 120, variants: ['ledger-svc runtime (CVSS 9.1)', 'shared JDK base, 31 downstream repos', 'nginx sidecar image'] },
    { title: 'Impossible-travel sign-in', dc: 'dc_impossible_travel', type: 'incident', ac: ['AC-58'], mins: 95, variants: ['privileged account, Oslo → Manila', 'service principal, unusual region'] },
    { title: 'Access recertification overdue', dc: 'dc_access_recert', type: 'request', ac: ['AC-58'], mins: 150, variants: ['Q1 campaign — 412 entitlements', 'privileged tier, 38 accounts'] },
    { title: 'Endpoint detection alert', dc: 'dc_edr_alert', type: 'finding', ac: ['AC-05'], mins: 85, variants: ['credential-dumping signature', 'suspicious PowerShell on a build agent'] },
    { title: 'Patch wave held at canary gate', dc: 'dc_patch_wave', type: 'change', ac: ['AC-52'], mins: 110, variants: ['February wave, ring 1', 'out-of-band fix, ring 0'] },
  ],
  twr_agentops: [
    { title: 'Client agent proposed out-of-catalog entitlement', dc: 'dc_agent_scope', type: 'finding', ac: ['AC-58'], mins: 70, variants: ['Procurement Bot — blocked at gate', 'Procurement Bot — second occurrence'] },
    { title: 'Replay score below promotion threshold', dc: 'dc_agent_eval', type: 'finding', ac: ['AC-05'], mins: 110, variants: ['KYC Assist — 0.741 vs 0.85 required', 'Procurement Bot — regression on v3'] },
    { title: 'Agent token budget breached', dc: 'dc_agent_budget', type: 'finding', ac: ['AC-05'], mins: 45, variants: ['soft threshold, KYC Assist', 'hard threshold, degraded to mid tier'] },
    { title: 'Drift alarm on client agent', dc: 'dc_agent_drift', type: 'finding', ac: ['AC-05'], mins: 90, variants: ['input distribution shift, Procurement Bot', 'model version change without regression'] },
  ],
  twr_claims: [
    { title: 'Claims intake queue backlog', dc: 'dc_claims_backlog', type: 'incident', ac: ['AC-05'], mins: 130, variants: ['shadow observation — 214 in queue', 'motor segment, storm event'] },
    { title: 'Document OCR failure rate above threshold', dc: 'dc_ocr_failure', type: 'incident', ac: ['AC-05'], mins: 95, variants: ['oversized documents (>400 pages)', 'scanned faxes from broker channel'] },
    { title: 'Reinsurance API timeout during binding', dc: 'dc_reins_timeout', type: 'incident', ac: ['AC-05'], mins: 115, variants: ['partner latency above 30s', 'certificate renegotiation stall'] },
    { title: 'Policy admin validation rejecting valid claims', dc: 'dc_policy_validation', type: 'problem', ac: ['AC-05'], mins: 180, variants: ['rule set 88 after February release'] },
  ],
  twr_bi: [
    { title: 'Board pack refresh failed', dc: 'dc_bi_refresh', type: 'incident', ac: ['AC-05'], mins: 85, variants: ['semantic model timeout at 06:48', 'gateway credential expiry'] },
    { title: 'Report showing stale figures', dc: 'dc_bi_stale', type: 'incident', ac: ['AC-05'], mins: 70, variants: ['liquidity dashboard, 2 days behind', 'branch performance pack'] },
    { title: 'Semantic model definition conflict', dc: 'dc_bi_semantic', type: 'problem', ac: ['AC-05'], mins: 140, variants: ['two definitions of net revenue', 'headcount measure grain mismatch'] },
  ],
}

const HUMANS = ['A. Fernandes', 'K. Mehta', 'P. Raghavan', 'M. Okonkwo', 'R. Venkatesh', 'J. Halvorsen', 'D. Kowalski', 'L. Nakamura']

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
        affected: rng.shuffle(['app_ledger', 'db_ledger_rw', 'app_pmtapi', 'inf_aks_neu', 'pipe_finrep', 'net_edge_fw']).slice(0, rng.int(1, 3)),
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
  policyId: 'pol_change_std',
  policyVersion: 'v9',
  actionClasses: ['AC-31', 'AC-12'],
  blastRadius: { services: 1, dependents: 2, maxTier: 0, dataMutation: false },
  agentGrades: { 'AC-31': 'B', 'AC-12': 'A' },
  planConfidence: 0.91,
  gates: [{ role: 'on-call SDM', timeoutSec: 600, escalatesTo: 'duty manager' }],
  reasons: [
    'AC-31 platform floor is Supervised; Tier-0 blast radius raises it to Approve-first',
    'Agent grade B on AC-31, A on AC-12',
    'Plan confidence 0.91 exceeds the 0.85 requirement',
    'No change freeze active; no major incident open',
  ],
  evaluatedInMs: 31.4,
  overrides: [],
}

export const HERO: WorkObject = {
  id: HERO_ID,
  ref: 'INC0482913',
  type: 'incident',
  title: 'Latency SLO breach on Retail Payments',
  tower: 'twr_payments',
  service: 'Retail Payments',
  affected: ['app_ledger', 'db_ledger_rw'],
  demandClass: 'dc_conn_pool_exhaustion',
  classificationConfidence: 0.91,
  priority: 'P2',
  state: 'gated',
  createdAt: iso(41),
  slaTargetMins: 240,
  slaElapsedMins: 41,
  slaPaused: false,
  breachProbability: 0.18,
  assignee: 'agt_remedian',
  assigneeKind: 'agent',
  runId: 'run_hero01',
  autonomy: heroAutonomy,
  economics: { estManualMins: 95, actualAgentMins: 3, tokensUsd: 0.83, attribution: 'pending' },
  evidenceHead: 'ev_c41a9f2e10',
  source: { system: 'Datadog', ref: 'mon-4471 · svc_payments p99 latency' },
  awaitingApproval: true,
  xla: { touches: 1, reassignments: 0, reopened: false },
  narrative: [
    { id: 'h1', at: iso(41), actorKind: 'system', actor: 'Datadog', text: 'Monitor mon-4471: p99 latency on svc_payments crossed 1,800 ms for 3 consecutive evaluations.', level: 'crit' },
    { id: 'h2', at: iso(40.97), actorKind: 'agent', actor: 'Sentinel', text: 'Correlated 214 alerts into 1 causal candidate. Classified dc_conn_pool_exhaustion at 91% confidence. P2 raised; INC0482913 opened in ServiceNow.', evidenceId: 'ev_c41a9f2e01', level: 'info' },
    { id: 'h3', at: iso(40.85), actorKind: 'agent', actor: 'Diagnost', text: 'Context package pkg_5d3f: 27 assertions (11 human-verified, 16 machine-corroborated), 2 runbooks, 3 prior incidents. Causal chain: chg_5511 reduced conn_pool.max on db_ledger_rw from 500 to 200 → pool exhaustion under morning peak → upstream latency breach.', evidenceId: 'ev_c41a9f2e02', level: 'info' },
    { id: 'h4', at: iso(40.77), actorKind: 'agent', actor: 'Remedian', text: 'Selected skill sk_dbpool_remediate_v7 — 98.4% success across 61 runs on this demand class.', evidenceId: 'ev_c41a9f2e03', level: 'info' },
    { id: 'h5', at: iso(40.76), actorKind: 'system', actor: 'Autonomy Policy Engine', text: 'AC-31 revert-config + AC-12 restart-stateless. Blast radius 1 service, 2 dependents, tier 0, no data mutation. Policy change_standard_v9 → APPROVE-FIRST, gate: on-call SDM, 10-minute timeout then escalate. Decided in 31.4 ms.', evidenceId: 'ev_c41a9f2e04', level: 'warn' },
    { id: 'h6', at: iso(40.7), actorKind: 'system', actor: 'HITL gateway', text: 'Approval card delivered to R. Venkatesh (on-call SDM) on console and mobile. Diff, blast summary, rollback plan and agent track record attached.', level: 'warn' },
  ],
}

export const HERO_RUN: Run = {
  id: 'run_hero01',
  workObjectId: HERO_ID,
  skillId: 'sk_dbpool_remediate_v7',
  state: 'gated',
  startedAt: iso(41),
  tokensUsd: 0.83,
  steps: [
    { id: 's1', kind: 'agent', label: 'Correlate signals into causal candidate', agentId: 'agt_sentinel', state: 'done', detail: '214 alerts → 1 candidate · dc_conn_pool_exhaustion (0.91)', durationMs: 1900, tokensUsd: 0.04 },
    { id: 's2', kind: 'agent', label: 'Assemble decision context (graph + telemetry)', agentId: 'agt_diagnost', state: 'done', detail: 'pkg_5d3f · 27 assertions · floor: machine_corroborated · 5,840 of 6,000 token budget', durationMs: 4200, tokensUsd: 0.19 },
    { id: 's3', kind: 'agent', label: 'Construct causal chain', agentId: 'agt_diagnost', state: 'done', detail: 'chg_5511 → pool exhaustion → latency breach', durationMs: 5100, tokensUsd: 0.38 },
    { id: 's4', kind: 'agent', label: 'Plan: select sk_dbpool_remediate_v7', agentId: 'agt_remedian', state: 'done', detail: '98.4% success, n=61', durationMs: 380, tokensUsd: 0.02 },
    { id: 's5', kind: 'gate', label: 'Approval — on-call SDM', state: 'blocked', detail: 'awaiting decision · escalates to duty manager in 09:12', durationMs: 0 },
    { id: 's6', kind: 'tool', label: 'Revert conn_pool.max 200 → 500 on db_ledger_rw', state: 'pending', compensation: 'Reapply chg_5511 (tested in non-prod 2027-02-16)', durationMs: 0 },
    { id: 's7', kind: 'tool', label: 'Rolling restart of app_ledger (6 replicas)', state: 'pending', compensation: 'Self-healing — no compensation required', durationMs: 0 },
    { id: 's8', kind: 'verify', label: 'Verification pack canary_slo_v6', state: 'pending', detail: 'canary 1 replica → SLO probe → synthetic transaction set', durationMs: 0 },
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
    push({ id: `${wo.evidenceHead}-02`, at: wo.createdAt, kind: 'clock', workObjectId: wo.id, actor: 'SLA engine', summary: `Clock started — target ${wo.slaTargetMins}m`, payload: { start: 'validated_priority_set', calendar: 'client_biz_hours(Europe/Berlin)', target: wo.slaTargetMins }, sealed: true })
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
