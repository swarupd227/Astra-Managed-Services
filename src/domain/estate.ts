import type { Agent, GraphEdge, GraphNode, Policy, Skill, Tower } from './types'

/**
 * The reference engagement: Nordbank Group — a European banking and insurance
 * estate under a five-year managed-services contract, month 14.
 */

export const CLIENT = {
  name: 'Nordbank Group',
  short: 'Nordbank',
  contract: 'MSA-2025-114 · Schedule 4 (Astra Operate)',
  monthsElapsed: 14,
  topology: 'In-tenant (Azure North Europe) · client-held keys (HYOK)',
  residency: 'EU only — model routing constrained to EU endpoints',
  timezone: 'Europe/Berlin',
  regulator: 'BaFin / EBA · DORA in scope',
}

export const TOWERS: Tower[] = [
  {
    id: 'twr_payments', name: 'Payments Applications', line: 'swpe',
    state: 'S4', concurrentStates: ['S4', 'S5', 'S6'], criticality: 0,
    owner: 'T. Bergmann', sdm: 'R. Venkatesh',
    entities: 3912, assertions: 41280, verificationCoverage: 96.4,
    autonomyEligibleVolume: 41.8, baselineHrsPerQtr: 3120,
    glidepathContracted: -12.0, glidepathActual: -14.6,
    regulatory: ['PSD2', 'SOX', 'DORA'],
  },
  {
    id: 'twr_core', name: 'Core Banking Applications', line: 'swpe',
    state: 'S4', concurrentStates: ['S4', 'S5'], criticality: 0,
    owner: 'T. Bergmann', sdm: 'R. Venkatesh',
    entities: 5140, assertions: 58910, verificationCoverage: 93.1,
    autonomyEligibleVolume: 33.2, baselineHrsPerQtr: 4480,
    glidepathContracted: -10.0, glidepathActual: -9.4,
    regulatory: ['SOX', 'DORA', 'BCBS-239'],
  },
  {
    id: 'twr_dataplat', name: 'Data Platform & Pipelines', line: 'data',
    state: 'S4', concurrentStates: ['S4', 'S5'], criticality: 1,
    owner: 'A. Sørensen', sdm: 'M. Okonkwo',
    entities: 2870, assertions: 33440, verificationCoverage: 91.8,
    autonomyEligibleVolume: 36.9, baselineHrsPerQtr: 2260,
    glidepathContracted: -11.0, glidepathActual: -12.8,
    regulatory: ['GDPR', 'BCBS-239'],
  },
  {
    id: 'twr_cloud', name: 'Cloud & Platform Operations', line: 'cloud',
    state: 'S4', concurrentStates: ['S4', 'S5', 'S6'], criticality: 1,
    owner: 'J. Halvorsen', sdm: 'M. Okonkwo',
    entities: 8940, assertions: 72110, verificationCoverage: 97.2,
    autonomyEligibleVolume: 58.4, baselineHrsPerQtr: 3980,
    glidepathContracted: -15.0, glidepathActual: -18.1,
    regulatory: ['DORA'],
  },
  {
    id: 'twr_euc', name: 'EUC & Workplace', line: 'cloud',
    state: 'S4', concurrentStates: ['S4', 'S5'], criticality: 2,
    owner: 'J. Halvorsen', sdm: 'M. Okonkwo',
    entities: 14320, assertions: 26400, verificationCoverage: 98.6,
    autonomyEligibleVolume: 74.1, baselineHrsPerQtr: 2940,
    glidepathContracted: -20.0, glidepathActual: -23.7,
    regulatory: [],
  },
  {
    id: 'twr_network', name: 'Network Operations', line: 'cloud',
    state: 'S4', concurrentStates: ['S4', 'S5'], criticality: 1,
    owner: 'J. Halvorsen', sdm: 'D. Kowalski',
    entities: 4180, assertions: 19870, verificationCoverage: 94.9,
    autonomyEligibleVolume: 52.3, baselineHrsPerQtr: 1740,
    glidepathContracted: -14.0, glidepathActual: -15.2,
    regulatory: ['DORA'],
  },
  {
    id: 'twr_secops', name: 'Security Operations', line: 'cloud',
    state: 'S4', concurrentStates: ['S4'], criticality: 0,
    owner: 'N. Achebe', sdm: 'D. Kowalski',
    entities: 3310, assertions: 21050, verificationCoverage: 95.5,
    autonomyEligibleVolume: 29.7, baselineHrsPerQtr: 2110,
    glidepathContracted: -8.0, glidepathActual: -8.6,
    regulatory: ['DORA', 'NIS2', 'ISO 27001'],
  },
  {
    id: 'twr_agentops', name: 'Agent Estate Operations', line: 'agentic',
    state: 'S3', concurrentStates: ['S3'], criticality: 1,
    owner: 'H. Lindqvist', sdm: 'L. Nakamura',
    entities: 640, assertions: 8120, verificationCoverage: 88.3,
    autonomyEligibleVolume: 22.5, baselineHrsPerQtr: 980,
    glidepathContracted: -6.0, glidepathActual: -4.1,
    regulatory: ['EU AI Act'],
  },
  {
    id: 'twr_claims', name: 'Insurance Claims Applications', line: 'swpe',
    state: 'S2', concurrentStates: ['S2'], criticality: 1,
    owner: 'F. Lorenz', sdm: 'S. Iyer',
    entities: 2410, assertions: 17600, verificationCoverage: 71.4,
    autonomyEligibleVolume: 0, baselineHrsPerQtr: 2680,
    glidepathContracted: 0, glidepathActual: 0,
    regulatory: ['Solvency II', 'GDPR'],
  },
  {
    id: 'twr_bi', name: 'BI & Reporting Operations', line: 'data',
    state: 'S1', concurrentStates: ['S1'], criticality: 2,
    owner: 'A. Sørensen', sdm: 'S. Iyer',
    entities: 1890, assertions: 9240, verificationCoverage: 42.7,
    autonomyEligibleVolume: 0, baselineHrsPerQtr: 1420,
    glidepathContracted: 0, glidepathActual: 0,
    regulatory: ['BCBS-239'],
  },
]

export const TOWER_BY_ID = Object.fromEntries(TOWERS.map((t) => [t.id, t])) as Record<string, Tower>

/* ------------------------------- Service graph ------------------------------ */

export const GRAPH_NODES: GraphNode[] = [
  { id: 'svc_payments', type: 'BusinessService', name: 'Retail Payments', tower: 'twr_payments', tier: 0, attrs: { criticality: 'Tier 0', owner: 'T. Bergmann', sla: 'INC_P2_RESOLUTION' } },
  { id: 'app_ledger', type: 'Application', name: 'Ledger Service', tower: 'twr_payments', tier: 0, attrs: { stack: 'Java 21 / Spring Boot', repo: 'nordbank/ledger-svc', env: 'prod-neu' } },
  { id: 'app_settle', type: 'Application', name: 'Settlement Engine', tower: 'twr_payments', tier: 0, attrs: { stack: 'Kotlin / Ktor', repo: 'nordbank/settlement', env: 'prod-neu' } },
  { id: 'app_pmtapi', type: 'Application', name: 'Payments API Gateway', tower: 'twr_payments', tier: 0, attrs: { stack: 'Envoy / Go', repo: 'nordbank/pmt-gw', env: 'prod-neu' } },
  { id: 'db_ledger_rw', type: 'InfraResource', name: 'ledger-pg-rw (PostgreSQL 16)', tower: 'twr_payments', tier: 0, attrs: { cloud: 'Azure', region: 'northeurope', sku: 'GP_Gen5_16', patch: 'current' } },
  { id: 'db_ledger_ro', type: 'InfraResource', name: 'ledger-pg-ro (replica)', tower: 'twr_payments', tier: 1, attrs: { cloud: 'Azure', region: 'northeurope', lag: '340ms' } },
  { id: 'if_iso20022', type: 'Interface', name: 'ISO 20022 inbound', tower: 'twr_payments', tier: 0, attrs: { auth: 'mTLS', spec: 'pain.001.001.09' } },
  { id: 'if_ftp_batch', type: 'Interface', name: 'Legacy FTP batch drop', tower: 'twr_payments', tier: 2, attrs: { auth: 'SFTP key', deprecated: 'ta_007 in flight' } },
  { id: 'svc_core', type: 'BusinessService', name: 'Core Deposits', tower: 'twr_core', tier: 0, attrs: { criticality: 'Tier 0', owner: 'T. Bergmann' } },
  { id: 'app_deposits', type: 'Application', name: 'Deposits Core', tower: 'twr_core', tier: 0, attrs: { stack: 'COBOL / z/OS + Java bridge', env: 'prod-mf' } },
  { id: 'svc_dwh', type: 'BusinessService', name: 'Regulatory Reporting', tower: 'twr_dataplat', tier: 1, attrs: { criticality: 'Tier 1', regulator: 'EBA' } },
  { id: 'pipe_finrep', type: 'Pipeline', name: 'FINREP nightly load', tower: 'twr_dataplat', tier: 1, attrs: { platform: 'Databricks', sla: '06:00 CET', contract: 'dc_finrep_v4' } },
  { id: 'da_txn_gold', type: 'DataAsset', name: 'txn_gold', tower: 'twr_dataplat', tier: 1, attrs: { pii: 'restricted', freshness: '15m', contract: 'dc_txn_v7' } },
  { id: 'inf_aks_neu', type: 'InfraResource', name: 'aks-neu-prod-01', tower: 'twr_cloud', tier: 1, attrs: { nodes: 42, version: '1.29', region: 'northeurope' } },
  { id: 'net_edge_fw', type: 'InfraResource', name: 'edge-fw-cluster-neu', tower: 'twr_network', tier: 0, attrs: { vendor: 'Palo Alto', ha: 'active/active' } },
  { id: 'rb_dbpool', type: 'Runbook', name: 'DB connection-pool exhaustion', tower: 'twr_payments', tier: 0, attrs: { uses: 'AC-31, AC-12', success: '98.4%', verified: 'human' } },
  { id: 'ke_pool_5511', type: 'KnownError', name: 'Pool sizing regression after chg_5511', tower: 'twr_payments', tier: 0, attrs: { first_seen: '2026-05-14', occurrences: 7 } },
  { id: 'agt_client_proc', type: 'AgentEntity', name: 'Nordbank Procurement Bot', tower: 'twr_agentops', tier: 2, attrs: { owner: 'Procurement', model: 'client-hosted', aer: 'aer_cl_002' } },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { id: 'e1', from: 'svc_payments', to: 'app_ledger', rel: 'DEPENDS_ON' },
  { id: 'e2', from: 'svc_payments', to: 'app_settle', rel: 'DEPENDS_ON' },
  { id: 'e3', from: 'svc_payments', to: 'app_pmtapi', rel: 'DEPENDS_ON' },
  { id: 'e4', from: 'app_ledger', to: 'db_ledger_rw', rel: 'RUNS_ON' },
  { id: 'e5', from: 'app_ledger', to: 'db_ledger_ro', rel: 'READS' },
  { id: 'e6', from: 'app_pmtapi', to: 'if_iso20022', rel: 'CALLS' },
  { id: 'e7', from: 'app_settle', to: 'if_ftp_batch', rel: 'CALLS' },
  { id: 'e8', from: 'app_settle', to: 'db_ledger_rw', rel: 'WRITES' },
  { id: 'e9', from: 'rb_dbpool', to: 'ke_pool_5511', rel: 'RESOLVES' },
  { id: 'e10', from: 'ke_pool_5511', to: 'db_ledger_rw', rel: 'CAUSED_BY' },
  { id: 'e11', from: 'app_ledger', to: 'inf_aks_neu', rel: 'RUNS_ON' },
  { id: 'e12', from: 'svc_dwh', to: 'pipe_finrep', rel: 'DEPENDS_ON' },
  { id: 'e13', from: 'pipe_finrep', to: 'da_txn_gold', rel: 'WRITES' },
  { id: 'e14', from: 'svc_core', to: 'app_deposits', rel: 'DEPENDS_ON' },
  { id: 'e15', from: 'app_deposits', to: 'db_ledger_rw', rel: 'READS' },
]

/* ---------------------------------- Agents --------------------------------- */

const T = (d: number) => new Date(Date.UTC(2027, 1, 18) - d * 86400000).toISOString()

export const AGENTS: Agent[] = [
  {
    id: 'agt_sentinel', name: 'Sentinel', codename: 'Triage & correlation',
    mission: 'Collapse event noise into causal work objects; classify against demand classes; enrich with graph context.',
    ownerHuman: 'R. Venkatesh', nhi: 'spiffe://nordbank/astra/agt_sentinel', origin: 'artizent',
    towers: ['twr_payments', 'twr_core', 'twr_cloud', 'twr_network', 'twr_euc', 'twr_dataplat'],
    skills: ['sk_triage_v12', 'sk_correlate_v8'], prohibited: ['AC-58', 'AC-71', 'direct_user_comms'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.962, replayN: 4820, liveSuccess90d: 0.991, lastRun: T(14) },
    economics: { costUsd30d: 412.8, costPerWo: 0.031, humanMinsDisplaced30d: 41260 },
    incidents: [], state: 'active', promotionReview: T(-41), createdAt: T(392), driftAlarm: false,
    trend: [0.981, 0.984, 0.988, 0.986, 0.99, 0.991, 0.991],
  },
  {
    id: 'agt_diagnost', name: 'Diagnost', codename: 'Diagnosis',
    mission: 'Build evidenced causal chains — symptom to component to probable cause — citing graph assertions and telemetry.',
    ownerHuman: 'R. Venkatesh', nhi: 'spiffe://nordbank/astra/agt_diagnost', origin: 'artizent',
    towers: ['twr_payments', 'twr_core', 'twr_cloud', 'twr_dataplat', 'twr_network'],
    skills: ['sk_causal_v9', 'sk_logscan_v6'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.948, replayN: 3140, liveSuccess90d: 0.974, lastRun: T(14) },
    economics: { costUsd30d: 1284.5, costPerWo: 0.214, humanMinsDisplaced30d: 62400 },
    incidents: [], state: 'active', promotionReview: T(-27), createdAt: T(392), driftAlarm: false,
    trend: [0.961, 0.966, 0.969, 0.971, 0.968, 0.973, 0.974],
  },
  {
    id: 'agt_remedian', name: 'Remedian', codename: 'Infrastructure remediation',
    mission: 'Execute runbook remediations with machine verification and a declared rollback for every mutating step.',
    ownerHuman: 'M. Okonkwo', nhi: 'spiffe://nordbank/astra/agt_remedian', origin: 'artizent',
    towers: ['twr_payments', 'twr_cloud', 'twr_network', 'twr_core'],
    skills: ['sk_dbpool_remediate_v7', 'sk_rolling_restart_v11', 'sk_config_revert_v5'],
    prohibited: ['AC-37', 'AC-44', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-12': 'A', 'AC-18': 'A', 'AC-24': 'A', 'AC-31': 'B', 'AC-41': 'B' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.931, replayN: 2260, liveSuccess90d: 0.984, lastRun: T(7) },
    economics: { costUsd30d: 688.2, costPerWo: 0.412, humanMinsDisplaced30d: 28940 },
    incidents: [
      { id: 'air_0007', at: T(281), summary: 'Restarted the wrong replica set — graph edge was stale', actionClass: 'AC-12', outcome: 'No customer impact; assertion TTL policy tightened', demotedDays: 14 },
    ],
    state: 'active', promotionReview: T(-12), createdAt: T(392), driftAlarm: false,
    trend: [0.972, 0.978, 0.981, 0.979, 0.983, 0.984, 0.984],
  },
  {
    id: 'agt_forge', name: 'Forge', codename: 'Code fix',
    mission: 'Reproduce defects, generate fixes and tests, open pull requests with reviewer-grade narratives.',
    ownerHuman: 'A. Fernandes', nhi: 'spiffe://nordbank/astra/agt_forge', origin: 'artizent',
    towers: ['twr_payments', 'twr_core', 'twr_claims'],
    skills: ['sk_repro_v4', 'sk_patch_v8', 'sk_testgen_v6'], prohibited: ['AC-12', 'AC-31', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-37': 'B' }, ceiling: 'approve_first',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.884, replayN: 940, liveSuccess90d: 0.912, lastRun: T(7) },
    economics: { costUsd30d: 2140.6, costPerWo: 4.82, humanMinsDisplaced30d: 18220 },
    incidents: [], state: 'active', promotionReview: T(-55), createdAt: T(214), driftAlarm: false,
    trend: [0.881, 0.889, 0.902, 0.898, 0.907, 0.911, 0.912],
  },
  {
    id: 'agt_sentryq', name: 'Sentry-Q', codename: 'Quality engineering',
    mission: 'Generate and maintain regression packs; gate releases with risk-based test selection.',
    ownerHuman: 'A. Fernandes', nhi: 'spiffe://nordbank/astra/agt_sentryq', origin: 'artizent',
    towers: ['twr_payments', 'twr_core', 'twr_claims'],
    skills: ['sk_riskselect_v5', 'sk_regenpack_v3'], prohibited: ['AC-31', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-37': 'B' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.908, replayN: 1120, liveSuccess90d: 0.946, lastRun: T(7) },
    economics: { costUsd30d: 780.4, costPerWo: 1.94, humanMinsDisplaced30d: 12480 },
    incidents: [], state: 'active', promotionReview: T(-33), createdAt: T(214), driftAlarm: false,
    trend: [0.925, 0.931, 0.938, 0.942, 0.944, 0.945, 0.946],
  },
  {
    id: 'agt_custodian', name: 'Custodian', codename: 'Data operations',
    mission: 'Detect and repair pipeline failures against data contracts; backfill with data-quality verification.',
    ownerHuman: 'A. Sørensen', nhi: 'spiffe://nordbank/astra/agt_custodian', origin: 'artizent',
    towers: ['twr_dataplat', 'twr_bi'],
    skills: ['sk_pipe_repair_v9', 'sk_backfill_v4', 'sk_dq_probe_v7'], prohibited: ['AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-12': 'A', 'AC-31': 'B', 'AC-44': 'C', 'AC-49': 'B' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.917, replayN: 1680, liveSuccess90d: 0.968, lastRun: T(14) },
    economics: { costUsd30d: 596.1, costPerWo: 0.386, humanMinsDisplaced30d: 21140 },
    incidents: [
      { id: 'air_0011', at: T(96), summary: 'Backfill emitted contract-violating nulls on txn_gold', actionClass: 'AC-49', outcome: 'Compensated in 4m; DQ pack extended to null-ratio bounds', demotedDays: 21 },
    ],
    state: 'active', promotionReview: T(-19), createdAt: T(310), driftAlarm: false,
    trend: [0.951, 0.958, 0.962, 0.959, 0.966, 0.967, 0.968],
  },
  {
    id: 'agt_prospect', name: 'Prospect', codename: 'Problem mining',
    mission: 'Cluster demand, quantify effort per class, generate costed elimination candidates with NPV.',
    ownerHuman: 'S. Iyer', nhi: 'spiffe://nordbank/astra/agt_prospect', origin: 'artizent',
    towers: TOWERS.map((t) => t.id),
    skills: ['sk_cluster_v6', 'sk_attribute_v5', 'sk_npv_v3'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_01_28', score: 0.939, replayN: 820, liveSuccess90d: 0.977, lastRun: T(21) },
    economics: { costUsd30d: 344.9, costPerWo: 0.128, humanMinsDisplaced30d: 9860 },
    incidents: [], state: 'active', promotionReview: T(-62), createdAt: T(392), driftAlarm: false,
    trend: [0.968, 0.971, 0.974, 0.976, 0.975, 0.977, 0.977],
  },
  {
    id: 'agt_bursar', name: 'Bursar', codename: 'FinOps',
    mission: 'Spend anomaly detection, rightsizing and commitment recommendations, governed cost actions.',
    ownerHuman: 'C. Duval', nhi: 'spiffe://nordbank/astra/agt_bursar', origin: 'artizent',
    towers: ['twr_cloud', 'twr_dataplat'],
    skills: ['sk_spend_anomaly_v7', 'sk_rightsize_v5'], prohibited: ['AC-31', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-18': 'B', 'AC-80': 'C' }, ceiling: 'approve_first',
    evaluation: { suiteId: 'es_2027_01_28', score: 0.902, replayN: 640, liveSuccess90d: 0.958, lastRun: T(21) },
    economics: { costUsd30d: 188.3, costPerWo: 0.244, humanMinsDisplaced30d: 6420 },
    incidents: [], state: 'active', promotionReview: T(-8), createdAt: T(280), driftAlarm: true,
    trend: [0.964, 0.961, 0.959, 0.962, 0.955, 0.957, 0.958],
  },
  {
    id: 'agt_warden', name: 'Warden', codename: 'Patch & vulnerability',
    mission: 'Risk-ranked patching campaigns with canary waves and per-wave evidence packs.',
    ownerHuman: 'N. Achebe', nhi: 'spiffe://nordbank/astra/agt_warden', origin: 'artizent',
    towers: ['twr_cloud', 'twr_euc', 'twr_secops', 'twr_network'],
    skills: ['sk_patchwave_v8', 'sk_vulnrank_v4'], prohibited: ['AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-12': 'A', 'AC-31': 'B', 'AC-52': 'A' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.926, replayN: 1440, liveSuccess90d: 0.979, lastRun: T(7) },
    economics: { costUsd30d: 402.7, costPerWo: 0.174, humanMinsDisplaced30d: 19880 },
    incidents: [], state: 'active', promotionReview: T(-24), createdAt: T(340), driftAlarm: false,
    trend: [0.972, 0.975, 0.977, 0.976, 0.978, 0.979, 0.979],
  },
  {
    id: 'agt_archivist', name: 'Archivist', codename: 'Knowledge',
    mission: 'Reverse-engineer estates; draft and refresh runbooks and graph assertions; queue human verification.',
    ownerHuman: 'S. Iyer', nhi: 'spiffe://nordbank/astra/agt_archivist', origin: 'artizent',
    towers: TOWERS.map((t) => t.id),
    skills: ['sk_reverse_v11', 'sk_runbook_draft_v9', 'sk_interview_v4'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.944, replayN: 2980, liveSuccess90d: 0.982, lastRun: T(14) },
    economics: { costUsd30d: 1462.2, costPerWo: 0.618, humanMinsDisplaced30d: 34720 },
    incidents: [], state: 'active', promotionReview: T(-47), createdAt: T(392), driftAlarm: false,
    trend: [0.976, 0.978, 0.98, 0.981, 0.98, 0.982, 0.982],
  },
  {
    id: 'agt_herald', name: 'Herald', codename: 'Service intelligence',
    mission: 'Assemble governance packs, SLA/XLA narratives and glidepath reporting — every figure evidence-linked.',
    ownerHuman: 'R. Venkatesh', nhi: 'spiffe://nordbank/astra/agt_herald', origin: 'artizent',
    towers: TOWERS.map((t) => t.id),
    skills: ['sk_govpack_v10', 'sk_narrative_v7', 'sk_askherald_v5'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.951, replayN: 1240, liveSuccess90d: 0.988, lastRun: T(14) },
    economics: { costUsd30d: 921.4, costPerWo: 1.12, humanMinsDisplaced30d: 15640 },
    incidents: [], state: 'active', promotionReview: T(-38), createdAt: T(392), driftAlarm: false,
    trend: [0.983, 0.985, 0.986, 0.987, 0.987, 0.988, 0.988],
  },
  {
    id: 'agt_concierge', name: 'Concierge', codename: 'Request handling',
    mission: 'Fulfil standard requests end to end — access within policy, provisioning from the approved catalog.',
    ownerHuman: 'M. Okonkwo', nhi: 'spiffe://nordbank/astra/agt_concierge', origin: 'artizent',
    towers: ['twr_euc', 'twr_cloud'],
    skills: ['sk_access_fulfil_v9', 'sk_provision_v7', 'sk_euc_reset_v12'], prohibited: ['AC-37', 'AC-44', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-18': 'A', 'AC-58': 'B', 'AC-66': 'A' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.937, replayN: 5240, liveSuccess90d: 0.986, lastRun: T(7) },
    economics: { costUsd30d: 512.6, costPerWo: 0.048, humanMinsDisplaced30d: 52180 },
    incidents: [], state: 'active', promotionReview: T(-16), createdAt: T(360), driftAlarm: false,
    trend: [0.979, 0.982, 0.984, 0.985, 0.985, 0.986, 0.986],
  },
  {
    id: 'agt_cl_procure', name: 'Nordbank Procurement Bot', codename: 'Client agent · managed',
    mission: 'Client-owned agent triaging supplier onboarding requests. Operated under Astra governance as a managed AgentEntity.',
    ownerHuman: 'Nordbank Procurement (F. Lorenz)', nhi: 'spiffe://nordbank/own/procurement-bot', origin: 'client',
    towers: ['twr_agentops'],
    skills: ['sk_cl_supplier_v3'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-44', 'AC-71'],
    grants: { 'AC-05': 'B', 'AC-58': 'D' }, ceiling: 'approve_first',
    evaluation: { suiteId: 'es_cl_2027_01', score: 0.812, replayN: 320, liveSuccess90d: 0.894, lastRun: T(28) },
    economics: { costUsd30d: 96.4, costPerWo: 0.71, humanMinsDisplaced30d: 3120 },
    incidents: [
      { id: 'air_0019', at: T(34), summary: 'Proposed an entitlement outside the approved catalog', actionClass: 'AC-58', outcome: 'Blocked at gate; four-eyes control held', demotedDays: 30 },
    ],
    state: 'probation', promotionReview: T(-4), createdAt: T(112), driftAlarm: true,
    trend: [0.902, 0.898, 0.891, 0.886, 0.889, 0.892, 0.894],
  },
  {
    id: 'agt_cl_kyc', name: 'Nordbank KYC Assist', codename: 'Client agent · onboarding',
    mission: 'Client-owned copilot summarising KYC dossiers for analysts. Onboarding to the promotion pipeline.',
    ownerHuman: 'Nordbank Financial Crime', nhi: 'spiffe://nordbank/own/kyc-assist', origin: 'client',
    towers: ['twr_agentops'],
    skills: ['sk_cl_kyc_v1'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-44', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'C' }, ceiling: 'advise',
    evaluation: { suiteId: 'es_cl_2027_02', score: 0.741, replayN: 140, liveSuccess90d: 0, lastRun: T(6) },
    economics: { costUsd30d: 41.2, costPerWo: 0, humanMinsDisplaced30d: 0 },
    incidents: [], state: 'onboarding', promotionReview: T(-25), createdAt: T(41), driftAlarm: false,
    trend: [0, 0, 0, 0.68, 0.71, 0.73, 0.741],
  },
]

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<string, Agent>

/* ---------------------------------- Skills --------------------------------- */

export const SKILLS: Skill[] = [
  { id: 'sk_dbpool_remediate_v7', name: 'DB connection-pool remediation', version: 'v7.2.0', layer: 'client', actionClasses: ['AC-31', 'AC-12'], successRate: 0.984, runs: 61, evalScore: 0.941, verificationPack: 'canary_slo_v6', owner: 'M. Okonkwo', updatedAt: T(23) },
  { id: 'sk_rolling_restart_v11', name: 'Rolling restart (stateless)', version: 'v11.0.4', layer: 'platform', actionClasses: ['AC-12'], successRate: 0.997, runs: 1840, evalScore: 0.978, verificationPack: 'health_probe_v4', owner: 'Platform core', updatedAt: T(58) },
  { id: 'sk_config_revert_v5', name: 'Config revert to known-good', version: 'v5.4.1', layer: 'platform', actionClasses: ['AC-31'], successRate: 0.972, runs: 412, evalScore: 0.933, verificationPack: 'canary_slo_v6', owner: 'Platform core', updatedAt: T(31) },
  { id: 'sk_triage_v12', name: 'Event triage & correlation', version: 'v12.1.0', layer: 'platform', actionClasses: ['AC-05', 'AC-08'], successRate: 0.991, runs: 28400, evalScore: 0.962, verificationPack: 'classification_agreement', owner: 'Platform core', updatedAt: T(12) },
  { id: 'sk_correlate_v8', name: 'Multi-signal correlation', version: 'v8.3.2', layer: 'platform', actionClasses: ['AC-08'], successRate: 0.986, runs: 19200, evalScore: 0.954, verificationPack: 'classification_agreement', owner: 'Platform core', updatedAt: T(12) },
  { id: 'sk_causal_v9', name: 'Causal-chain construction', version: 'v9.0.1', layer: 'platform', actionClasses: ['AC-05'], successRate: 0.974, runs: 8940, evalScore: 0.948, verificationPack: 'none', owner: 'Platform core', updatedAt: T(19) },
  { id: 'sk_logscan_v6', name: 'Log excerpt extraction', version: 'v6.2.0', layer: 'platform', actionClasses: ['AC-05'], successRate: 0.994, runs: 24100, evalScore: 0.971, verificationPack: 'none', owner: 'Platform core', updatedAt: T(44) },
  { id: 'sk_cert_rotate_v3', name: 'Certificate rotation', version: 'v3.6.0', layer: 'industry', actionClasses: ['AC-41'], successRate: 0.988, runs: 284, evalScore: 0.951, verificationPack: 'tls_probe_v3', owner: 'Banking pack', updatedAt: T(9) },
  { id: 'sk_pipe_repair_v9', name: 'Pipeline failure repair', version: 'v9.1.3', layer: 'platform', actionClasses: ['AC-12', 'AC-31'], successRate: 0.968, runs: 740, evalScore: 0.917, verificationPack: 'dq_contract_v5', owner: 'A. Sørensen', updatedAt: T(16) },
  { id: 'sk_backfill_v4', name: 'Contract-verified backfill', version: 'v4.2.1', layer: 'platform', actionClasses: ['AC-49'], successRate: 0.943, runs: 186, evalScore: 0.894, verificationPack: 'dq_contract_v5', owner: 'A. Sørensen', updatedAt: T(96) },
  { id: 'sk_dq_probe_v7', name: 'Data-quality probe suite', version: 'v7.0.0', layer: 'platform', actionClasses: ['AC-05'], successRate: 0.998, runs: 4120, evalScore: 0.982, verificationPack: 'none', owner: 'Platform core', updatedAt: T(52) },
  { id: 'sk_access_fulfil_v9', name: 'SoD-aware access fulfilment', version: 'v9.4.0', layer: 'industry', actionClasses: ['AC-58'], successRate: 0.991, runs: 3240, evalScore: 0.958, verificationPack: 'entitlement_diff_v3', owner: 'Banking pack', updatedAt: T(21) },
  { id: 'sk_euc_reset_v12', name: 'EUC state reset', version: 'v12.0.2', layer: 'platform', actionClasses: ['AC-66'], successRate: 0.998, runs: 9840, evalScore: 0.984, verificationPack: 'euc_checkin_v1', owner: 'Platform core', updatedAt: T(33) },
  { id: 'sk_patchwave_v8', name: 'Canaried patch wave', version: 'v8.1.0', layer: 'platform', actionClasses: ['AC-52', 'AC-12'], successRate: 0.979, runs: 620, evalScore: 0.926, verificationPack: 'patch_wave_v2', owner: 'N. Achebe', updatedAt: T(27) },
  { id: 'sk_patch_v8', name: 'Defect patch generation', version: 'v8.0.6', layer: 'platform', actionClasses: ['AC-37'], successRate: 0.912, runs: 448, evalScore: 0.884, verificationPack: 'release_pack_v9', owner: 'A. Fernandes', updatedAt: T(11) },
  { id: 'sk_govpack_v10', name: 'Governance pack assembly', version: 'v10.2.0', layer: 'platform', actionClasses: ['AC-05'], successRate: 0.988, runs: 168, evalScore: 0.951, verificationPack: 'none', owner: 'Platform core', updatedAt: T(6) },
]

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<string, Skill>

/* ---------------------------------- Policy --------------------------------- */

export const POLICIES: Policy[] = [
  {
    id: 'pol_change_std', name: 'change_standard', version: 'v9',
    appliesTo: { towers: ['twr_payments', 'twr_core'], envs: ['prod'] },
    rules: [
      { id: 'r1', when: 'action.class in [AC-12, AC-18, AC-24] and blast.tier <= 1', require: 'agent.grade[action.class] >= B and plan.confidence >= 0.85', mode: 'supervised', notify: ['oncall_sdm'], abortWindowSec: 120 },
      { id: 'r2', when: 'action.class == AC-31 and blast.tier == 0', mode: 'approve_first', gate: { approverRole: 'sdm', artefacts: ['diff', 'blast', 'rollback'], timeoutSec: 600, escalatesTo: 'duty_manager' } },
      { id: 'r3', when: 'action.class == AC-31 and blast.tier >= 1', require: 'agent.grade[AC-31] >= B', mode: 'supervised', notify: ['oncall_sdm'], abortWindowSec: 120 },
      { id: 'r4', when: 'action.class == AC-37', mode: 'approve_first', gate: { approverRole: 'code_owner', artefacts: ['diff', 'tests', 'rollback'], timeoutSec: 3600, escalatesTo: 'eng_lead' } },
      { id: 'r5', when: 'action.class == AC-58', mode: 'approve_first', gate: { approverRole: 'sdm+second_control', artefacts: ['entitlement_diff', 'sod_check'], timeoutSec: 1800, escalatesTo: 'security_lead' } },
      { id: 'r6', when: 'action.class == AC-71', maxMode: 'advise' },
      { id: 'r7', when: 'incident.major_active == true', maxMode: 'advise' },
      { id: 'r8', when: 'calendar.freeze == true', maxMode: 'approve_first' },
    ],
    budgets: { tokensUsdPerRun: 4.0, runsPerHour: 40 },
    evidence: { sealRequired: true, exportTo: ['client_grc', 'client_siem'] },
    updatedAt: T(18), updatedBy: 'L. Nakamura', source: 'git://nordbank-astra-policy/prod/change_standard.yaml@v9',
  },
  {
    id: 'pol_euc_std', name: 'euc_standard', version: 'v6',
    appliesTo: { towers: ['twr_euc'], envs: ['prod'] },
    rules: [
      { id: 'r1', when: 'action.class in [AC-66, AC-24] and blast.tier >= 2', require: 'agent.grade[action.class] >= A', mode: 'autonomous' },
      { id: 'r2', when: 'action.class == AC-18 and blast.tier >= 2', require: 'agent.grade[AC-18] >= A', mode: 'supervised' },
      { id: 'r3', when: 'action.class == AC-58', mode: 'approve_first', gate: { approverRole: 'sdm+second_control', artefacts: ['entitlement_diff', 'sod_check'], timeoutSec: 1800, escalatesTo: 'security_lead' } },
      { id: 'r4', when: 'incident.major_active == true', maxMode: 'advise' },
    ],
    budgets: { tokensUsdPerRun: 0.75, runsPerHour: 400 },
    evidence: { sealRequired: true, exportTo: ['client_grc'] },
    updatedAt: T(40), updatedBy: 'M. Okonkwo', source: 'git://nordbank-astra-policy/prod/euc_standard.yaml@v6',
  },
  {
    id: 'pol_data_contract', name: 'data_contract_gate', version: 'v4',
    appliesTo: { towers: ['twr_dataplat', 'twr_bi'], envs: ['prod'] },
    rules: [
      { id: 'r1', when: 'action.class in [AC-44, AC-49] and asset.contract == null', maxMode: 'advise' },
      { id: 'r2', when: 'action.class == AC-49 and asset.contract != null', mode: 'approve_first', gate: { approverRole: 'data_steward', artefacts: ['dq_pack', 'lineage', 'rollback'], timeoutSec: 3600, escalatesTo: 'data_owner' } },
      { id: 'r3', when: 'action.class in [AC-12, AC-31] and asset.pii == restricted', require: 'agent.grade[action.class] >= B', mode: 'supervised', notify: ['data_steward'] },
      { id: 'r4', when: 'incident.major_active == true', maxMode: 'advise' },
    ],
    budgets: { tokensUsdPerRun: 2.5, runsPerHour: 60 },
    evidence: { sealRequired: true, exportTo: ['client_grc', 'purview'] },
    updatedAt: T(29), updatedBy: 'A. Sørensen', source: 'git://nordbank-astra-policy/prod/data_contract_gate.yaml@v4',
  },
]

export const POLICY_BY_ID = Object.fromEntries(POLICIES.map((p) => [p.id, p])) as Record<string, Policy>

export function policyForTower(towerId: string): Policy {
  return POLICIES.find((p) => p.appliesTo.towers.includes(towerId)) ?? POLICIES[0]
}

/**
 * Which agents can act on an action class, optionally scoped to a tower.
 *
 * Used wherever a surface shows work by class and needs to name who does it —
 * the estate already knows, so no screen needs to render an unattributed row.
 */
export function agentsForClass(actionClass: string, tower?: string) {
  return AGENTS.filter(
    (a) => a.grants[actionClass] && !a.prohibited.includes(actionClass) && (!tower || a.towers.includes(tower)),
  )
}
