import type { Agent, GraphEdge, GraphNode, Policy, Skill, Tower } from './types'

/**
 * The reference engagement: Kearney Global — a global management-consulting
 * firm's IT estate under a managed-services contract, month 3 of transition.
 * Towers map onto the SOW's five bundles (B1 Digital Workplace, B2
 * Infrastructure, B3 Application Management, B4 Data Management, B5
 * Cross-Functional), not onto Kearney's internal business-process journeys.
 */

export const CLIENT = {
  name: 'Kearney Global',
  short: 'Kearney',
  contract: 'MSA-2026-041 · Schedule B (Astra Operate)',
  monthsElapsed: 3,
  topology: 'Azure (Central US) + Chicago DC in exit · 96 offices, 40 countries',
  residency: 'Global — AI-system whitelist and residency terms pending Schedule O Exhibit O-1/O-2',
  timezone: 'America/Chicago',
  regulator: 'GDPR · SOC 2 Type II · ISO 27001/27701 · NIST AI RMF & ISO/IEC 42001 (Schedule O)',
}

export const TOWERS: Tower[] = [
  {
    id: 'twr_payments', name: 'Application Development & Integration (B3)', line: 'swpe',
    state: 'S3', concurrentStates: ['S2', 'S3', 'S4'], criticality: 1,
    owner: 'R. Castellano', sdm: 'R. Venkatesh',
    entities: 1240, assertions: 14200, verificationCoverage: 74.6,
    autonomyEligibleVolume: 18.4, baselineHrsPerQtr: 620,
    glidepathContracted: -8.0, glidepathActual: -5.1,
    regulatory: ['SOC 2', 'GDPR'],
  },
  {
    id: 'twr_core', name: 'Application Maintenance (B3)', line: 'swpe',
    state: 'S4', concurrentStates: ['S3', 'S4', 'S5'], criticality: 0,
    owner: 'R. Castellano', sdm: 'R. Venkatesh',
    entities: 5860, assertions: 61400, verificationCoverage: 88.9,
    autonomyEligibleVolume: 31.5, baselineHrsPerQtr: 2960,
    glidepathContracted: -10.0, glidepathActual: -7.8,
    regulatory: ['SOC 2', 'GDPR'],
  },
  {
    id: 'twr_dataplat', name: 'Data Management Services (B4)', line: 'data',
    state: 'S3', concurrentStates: ['S2', 'S3', 'S4'], criticality: 1,
    owner: 'S. Okafor', sdm: 'M. Okonkwo',
    entities: 3120, assertions: 28600, verificationCoverage: 79.4,
    autonomyEligibleVolume: 24.7, baselineHrsPerQtr: 1480,
    glidepathContracted: -9.0, glidepathActual: -6.3,
    regulatory: ['GDPR', 'ISO 27701'],
  },
  {
    id: 'twr_cloud', name: 'Infrastructure — Enterprise Compute (B2)', line: 'cloud',
    state: 'S4', concurrentStates: ['S3', 'S4', 'S5'], criticality: 1,
    owner: 'P. Lindegaard', sdm: 'M. Okonkwo',
    entities: 7480, assertions: 54200, verificationCoverage: 86.1,
    autonomyEligibleVolume: 44.9, baselineHrsPerQtr: 2680,
    glidepathContracted: -13.0, glidepathActual: -14.4,
    regulatory: ['SOC 2'],
  },
  {
    id: 'twr_euc', name: 'Digital Workplace Services (B1)', line: 'cloud',
    state: 'S4', concurrentStates: ['S4', 'S5'], criticality: 2,
    owner: 'P. Lindegaard', sdm: 'M. Okonkwo',
    entities: 9820, assertions: 41300, verificationCoverage: 92.7,
    autonomyEligibleVolume: 68.3, baselineHrsPerQtr: 3720,
    glidepathContracted: -18.0, glidepathActual: -16.9,
    regulatory: [],
  },
  {
    id: 'twr_network', name: 'Infrastructure — Network Services (B2)', line: 'cloud',
    state: 'S3', concurrentStates: ['S3', 'S4'], criticality: 1,
    owner: 'P. Lindegaard', sdm: 'D. Kowalski',
    entities: 2340, assertions: 17900, verificationCoverage: 81.2,
    autonomyEligibleVolume: 33.8, baselineHrsPerQtr: 1180,
    glidepathContracted: -11.0, glidepathActual: -9.2,
    regulatory: ['SOC 2'],
  },
  {
    id: 'twr_secops', name: 'Infrastructure — Security (B2)', line: 'cloud',
    state: 'S3', concurrentStates: ['S2', 'S3', 'S4'], criticality: 0,
    owner: 'V. Marchetti', sdm: 'D. Kowalski',
    entities: 4610, assertions: 33500, verificationCoverage: 83.6,
    autonomyEligibleVolume: 21.9, baselineHrsPerQtr: 2430,
    glidepathContracted: -7.0, glidepathActual: -3.8,
    regulatory: ['ISO 27001', 'SOC 2', 'NIST AI RMF'],
  },
  {
    id: 'twr_agentops', name: 'AI & Automation Governance (B5)', line: 'agentic',
    state: 'S2', concurrentStates: ['S1', 'S2', 'S3'], criticality: 1,
    owner: 'E. Whitfield', sdm: 'L. Nakamura',
    entities: 780, assertions: 9640, verificationCoverage: 68.2,
    autonomyEligibleVolume: 14.1, baselineHrsPerQtr: 640,
    glidepathContracted: -5.0, glidepathActual: -1.9,
    regulatory: ['EU AI Act', 'NIST AI RMF', 'ISO/IEC 42001'],
  },
  {
    id: 'twr_claims', name: 'Cross-Functional — CMDB & Service Mapping (B5)', line: 'swpe',
    state: 'S1', concurrentStates: ['S1'], criticality: 1,
    owner: 'M. Osei', sdm: 'S. Iyer',
    entities: 1450, assertions: 8900, verificationCoverage: 58.3,
    autonomyEligibleVolume: 0, baselineHrsPerQtr: 890,
    glidepathContracted: 0, glidepathActual: 0,
    regulatory: ['SOC 2'],
  },
  {
    id: 'twr_bi', name: 'Data Management — Research & Analytics (B4)', line: 'data',
    state: 'S2', concurrentStates: ['S1', 'S2'], criticality: 2,
    owner: 'S. Okafor', sdm: 'S. Iyer',
    entities: 1980, assertions: 11200, verificationCoverage: 51.4,
    autonomyEligibleVolume: 6.8, baselineHrsPerQtr: 940,
    glidepathContracted: 0, glidepathActual: 0,
    regulatory: ['GDPR'],
  },
]

export const TOWER_BY_ID = Object.fromEntries(TOWERS.map((t) => [t.id, t])) as Record<string, Tower>

/* ------------------------------- Service graph ------------------------------ */

export const GRAPH_NODES: GraphNode[] = [
  { id: 'svc_engagement', type: 'BusinessService', name: 'Engagement Billing & Integration', tower: 'twr_payments', tier: 1, attrs: { criticality: 'Tier 1', owner: 'R. Castellano', sla: 'SLA_APP_AVAILABILITY' } },
  { id: 'app_mulesoft', type: 'Application', name: 'Mulesoft Integration Hub (Salesforce ↔ SAP)', tower: 'twr_payments', tier: 1, attrs: { stack: 'Mulesoft Anypoint', repo: 'kearney/sfdc-sap-bridge', env: 'prod-centralus', users: 1 } },
  { id: 'app_focus', type: 'Application', name: 'FOCUS (SAP HANA Time & Billing)', tower: 'twr_payments', tier: 1, attrs: { stack: 'SAP HANA', repo: 'kearney/focus-billing', env: 'prod-chi-dc' } },
  { id: 'app_iem', type: 'Application', name: 'IEM (legacy time entry)', tower: 'twr_payments', tier: 2, attrs: { status: 'superseded by Concur — still live', annualIncidents: 658, cmdb: 'not in Attachment C.4' } },
  { id: 'db_sap_prod', type: 'InfraResource', name: 'sap-hana-prod (SAP S/4HANA DB)', tower: 'twr_core', tier: 0, attrs: { hosting: 'Chicago DC', sku: 'HANA-XL', patch: 'current' } },
  { id: 'db_sap_replica', type: 'InfraResource', name: 'sap-hana-replica', tower: 'twr_core', tier: 1, attrs: { hosting: 'Chicago DC', lag: '280ms' } },
  { id: 'svc_core', type: 'BusinessService', name: 'Core Enterprise Applications', tower: 'twr_core', tier: 0, attrs: { criticality: 'Tier 0', owner: 'R. Castellano' } },
  { id: 'app_hcm', type: 'Application', name: 'PeopleSoft HCM (retiring Aug 2027)', tower: 'twr_core', tier: 0, attrs: { stack: 'PeopleSoft', env: 'prod-chi-dc', migratesTo: 'Workday' } },
  { id: 'svc_dwh', type: 'BusinessService', name: 'Enterprise Data Platform', tower: 'twr_dataplat', tier: 1, attrs: { criticality: 'Tier 1', owner: 'S. Okafor' } },
  { id: 'pipe_datamart', type: 'Pipeline', name: 'Nightly datamart refresh', tower: 'twr_dataplat', tier: 1, attrs: { platform: 'Azure Data Factory', sla: '05:00 CST', contract: 'dc_datamart_v2' } },
  { id: 'da_oracle_dm', type: 'DataAsset', name: 'Oracle datamart (no incident telemetry)', tower: 'twr_dataplat', tier: 0, attrs: { pii: 'none', freshness: 'unknown', contract: 'none — blind spot' } },
  { id: 'inf_azure_compute', type: 'InfraResource', name: 'az-centralus-prod-01', tower: 'twr_cloud', tier: 1, attrs: { vms: 437, region: 'centralus', migration: 'Chicago DC exit — Yr3 target' } },
  { id: 'net_sase_edge', type: 'InfraResource', name: 'cisco-sase-global', tower: 'twr_network', tier: 0, attrs: { vendor: 'Cisco', mode: 'Zero Trust (SASE)' } },
  { id: 'if_zta', type: 'Interface', name: 'Zero Trust Network Access (ZTA)', tower: 'twr_network', tier: 1, attrs: { auth: 'SAML/OIDC', policy: 'Cisco ZTA' } },
  { id: 'rb_mulesoft_failover', type: 'Runbook', name: 'Mulesoft integration failover', tower: 'twr_payments', tier: 1, attrs: { uses: 'AC-31, AC-12', success: '91.2%', verified: 'human' } },
  { id: 'ke_mulesoft_soleowner', type: 'KnownError', name: 'Sole maintainer unavailable — bridge unmonitored', tower: 'twr_payments', tier: 1, attrs: { first_seen: '2026-06-02', occurrences: 3 } },
  { id: 'rb_endpoint_dedupe', type: 'Runbook', name: 'Endpoint security stack de-duplication', tower: 'twr_secops', tier: 0, attrs: { uses: 'AC-52, AC-31', success: '87.0%', verified: 'human' } },
  { id: 'ke_triple_av', type: 'KnownError', name: 'Three concurrent endpoint-security agents contend for CPU', tower: 'twr_secops', tier: 0, attrs: { first_seen: '2025-09-11', occurrences: 41 } },
  { id: 'da_cmdb_gap', type: 'DataAsset', name: 'Unreconciled CMDB — 55 apps outside Attachment C.4', tower: 'twr_claims', tier: 1, attrs: { pii: 'none', freshness: 'stale', contract: 'none — reconciliation pending' } },
  { id: 'agt_client_iem', type: 'AgentEntity', name: 'Kearney IEM Time-Entry Bot', tower: 'twr_agentops', tier: 2, attrs: { owner: 'Finance Operations', model: 'client-hosted', aer: 'aer_cl_002' } },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { id: 'e1', from: 'svc_engagement', to: 'app_mulesoft', rel: 'DEPENDS_ON' },
  { id: 'e2', from: 'svc_engagement', to: 'app_focus', rel: 'DEPENDS_ON' },
  { id: 'e3', from: 'svc_engagement', to: 'app_iem', rel: 'DEPENDS_ON' },
  { id: 'e4', from: 'app_focus', to: 'db_sap_prod', rel: 'RUNS_ON' },
  { id: 'e5', from: 'app_focus', to: 'db_sap_replica', rel: 'READS' },
  { id: 'e6', from: 'app_mulesoft', to: 'db_sap_prod', rel: 'CALLS' },
  { id: 'e7', from: 'app_iem', to: 'db_sap_replica', rel: 'WRITES' },
  { id: 'e8', from: 'rb_mulesoft_failover', to: 'ke_mulesoft_soleowner', rel: 'RESOLVES' },
  { id: 'e9', from: 'ke_mulesoft_soleowner', to: 'app_mulesoft', rel: 'CAUSED_BY' },
  { id: 'e10', from: 'app_mulesoft', to: 'inf_azure_compute', rel: 'RUNS_ON' },
  { id: 'e11', from: 'svc_dwh', to: 'pipe_datamart', rel: 'DEPENDS_ON' },
  { id: 'e12', from: 'pipe_datamart', to: 'da_oracle_dm', rel: 'WRITES' },
  { id: 'e13', from: 'svc_core', to: 'app_hcm', rel: 'DEPENDS_ON' },
  { id: 'e14', from: 'app_hcm', to: 'db_sap_prod', rel: 'READS' },
  { id: 'e15', from: 'rb_endpoint_dedupe', to: 'ke_triple_av', rel: 'RESOLVES' },
  { id: 'e16', from: 'ke_triple_av', to: 'net_sase_edge', rel: 'CAUSED_BY' },
]

/* ---------------------------------- Agents --------------------------------- */

const T = (d: number) => new Date(Date.UTC(2027, 1, 18) - d * 86400000).toISOString()

export const AGENTS: Agent[] = [
  {
    id: 'agt_sentinel', name: 'Sentinel', codename: 'Triage & correlation',
    mission: 'Auto-classify and route the incident/request stream against demand classes; enrich with CMDB and graph context before a human ever sees the ticket.',
    ownerHuman: 'R. Venkatesh', nhi: 'spiffe://kearney/astra/agt_sentinel', origin: 'artizent',
    towers: ['twr_payments', 'twr_core', 'twr_cloud', 'twr_network', 'twr_euc', 'twr_dataplat'],
    skills: ['sk_triage_v12', 'sk_correlate_v8'], prohibited: ['AC-58', 'AC-71', 'direct_user_comms'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.962, replayN: 4820, liveSuccess90d: 0.991, lastRun: T(14) },
    economics: { costUsd30d: 412.8, costPerWo: 0.031, humanMinsDisplaced30d: 41260 },
    incidents: [], state: 'active', promotionReview: T(-41), createdAt: T(88), driftAlarm: false,
    trend: [0.981, 0.984, 0.988, 0.986, 0.99, 0.991, 0.991],
  },
  {
    id: 'agt_diagnost', name: 'Diagnost', codename: 'Diagnosis',
    mission: 'Build evidenced causal chains — symptom to component to probable cause — citing graph assertions and telemetry across the Digital Workplace and Infrastructure towers.',
    ownerHuman: 'R. Venkatesh', nhi: 'spiffe://kearney/astra/agt_diagnost', origin: 'artizent',
    towers: ['twr_payments', 'twr_core', 'twr_cloud', 'twr_dataplat', 'twr_network'],
    skills: ['sk_causal_v9', 'sk_logscan_v6'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.948, replayN: 3140, liveSuccess90d: 0.974, lastRun: T(14) },
    economics: { costUsd30d: 1284.5, costPerWo: 0.214, humanMinsDisplaced30d: 62400 },
    incidents: [], state: 'active', promotionReview: T(-27), createdAt: T(88), driftAlarm: false,
    trend: [0.961, 0.966, 0.969, 0.971, 0.968, 0.973, 0.974],
  },
  {
    id: 'agt_remedian', name: 'Remedian', codename: 'Self-remediation',
    mission: 'Resolve account lockouts and password resets end to end — the single largest incident subcategory — with a declared rollback for every mutating step.',
    ownerHuman: 'M. Okonkwo', nhi: 'spiffe://kearney/astra/agt_remedian', origin: 'artizent',
    towers: ['twr_euc', 'twr_cloud', 'twr_network', 'twr_core'],
    skills: ['sk_dbpool_remediate_v7', 'sk_rolling_restart_v11', 'sk_config_revert_v5'],
    prohibited: ['AC-37', 'AC-44', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-12': 'A', 'AC-18': 'A', 'AC-24': 'A', 'AC-31': 'B', 'AC-41': 'B', 'AC-66': 'A' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.931, replayN: 2260, liveSuccess90d: 0.984, lastRun: T(7) },
    economics: { costUsd30d: 688.2, costPerWo: 0.412, humanMinsDisplaced30d: 28940 },
    incidents: [
      { id: 'air_0007', at: T(52), summary: 'Reset the wrong AD account after a stale graph edge', actionClass: 'AC-12', outcome: 'No user impact; assertion TTL policy tightened', demotedDays: 14 },
    ],
    state: 'active', promotionReview: T(-12), createdAt: T(88), driftAlarm: false,
    trend: [0.972, 0.978, 0.981, 0.979, 0.983, 0.984, 0.984],
  },
  {
    id: 'agt_forge', name: 'Forge', codename: 'Code fix',
    mission: 'Reproduce application defects, generate fixes and tests, open pull requests with reviewer-grade narratives for the SAP/PeopleSoft/ServiceNow estate.',
    ownerHuman: 'A. Fernandes', nhi: 'spiffe://kearney/astra/agt_forge', origin: 'artizent',
    towers: ['twr_payments', 'twr_core'],
    skills: ['sk_repro_v4', 'sk_patch_v8', 'sk_testgen_v6'], prohibited: ['AC-12', 'AC-31', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-37': 'B' }, ceiling: 'approve_first',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.884, replayN: 940, liveSuccess90d: 0.912, lastRun: T(7) },
    economics: { costUsd30d: 2140.6, costPerWo: 4.82, humanMinsDisplaced30d: 18220 },
    incidents: [], state: 'active', promotionReview: T(-55), createdAt: T(64), driftAlarm: false,
    trend: [0.881, 0.889, 0.902, 0.898, 0.907, 0.911, 0.912],
  },
  {
    id: 'agt_sentryq', name: 'Sentry-Q', codename: 'SaaS regression checks',
    mission: 'Generate and run regression packs after every M365/SaaS vendor update; gate releases with risk-based test selection before they reach the estate.',
    ownerHuman: 'A. Fernandes', nhi: 'spiffe://kearney/astra/agt_sentryq', origin: 'artizent',
    towers: ['twr_payments', 'twr_core', 'twr_euc'],
    skills: ['sk_riskselect_v5', 'sk_regenpack_v3'], prohibited: ['AC-31', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-37': 'B' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.908, replayN: 1120, liveSuccess90d: 0.946, lastRun: T(7) },
    economics: { costUsd30d: 780.4, costPerWo: 1.94, humanMinsDisplaced30d: 12480 },
    incidents: [], state: 'active', promotionReview: T(-33), createdAt: T(64), driftAlarm: false,
    trend: [0.925, 0.931, 0.938, 0.942, 0.944, 0.945, 0.946],
  },
  {
    id: 'agt_custodian', name: 'Custodian', codename: 'Pipeline-failure triage',
    mission: 'Detect and repair data-pipeline failures against contracts — starting with the FOCUS/SAP-HANA nightly load — with data-quality-verified backfill.',
    ownerHuman: 'S. Okafor', nhi: 'spiffe://kearney/astra/agt_custodian', origin: 'artizent',
    towers: ['twr_dataplat', 'twr_bi'],
    skills: ['sk_pipe_repair_v9', 'sk_backfill_v4', 'sk_dq_probe_v7'], prohibited: ['AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-12': 'A', 'AC-31': 'B', 'AC-44': 'C', 'AC-49': 'B' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.917, replayN: 1680, liveSuccess90d: 0.968, lastRun: T(14) },
    economics: { costUsd30d: 596.1, costPerWo: 0.386, humanMinsDisplaced30d: 21140 },
    incidents: [
      { id: 'air_0011', at: T(35), summary: 'Backfill emitted contract-violating nulls into the datamart', actionClass: 'AC-49', outcome: 'Compensated in 4m; DQ pack extended to null-ratio bounds', demotedDays: 21 },
    ],
    state: 'active', promotionReview: T(-19), createdAt: T(70), driftAlarm: false,
    trend: [0.951, 0.958, 0.962, 0.959, 0.966, 0.967, 0.968],
  },
  {
    id: 'agt_prospect', name: 'Prospect', codename: 'Problem-pattern detection',
    mission: 'Cluster recurring demand, quantify effort per class, and generate costed elimination candidates with NPV — starting with duplicate endpoint-security stacks and the Mulesoft single-owner risk.',
    ownerHuman: 'S. Iyer', nhi: 'spiffe://kearney/astra/agt_prospect', origin: 'artizent',
    towers: TOWERS.map((t) => t.id),
    skills: ['sk_cluster_v6', 'sk_attribute_v5', 'sk_npv_v3'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_01_28', score: 0.939, replayN: 820, liveSuccess90d: 0.977, lastRun: T(21) },
    economics: { costUsd30d: 344.9, costPerWo: 0.128, humanMinsDisplaced30d: 9860 },
    incidents: [], state: 'active', promotionReview: T(-62), createdAt: T(88), driftAlarm: false,
    trend: [0.968, 0.971, 0.974, 0.976, 0.975, 0.977, 0.977],
  },
  {
    id: 'agt_bursar', name: 'Bursar', codename: 'FinOps',
    mission: 'Spend anomaly detection, rightsizing and commitment recommendations for the Chicago DC → Azure migration, with governed cost actions.',
    ownerHuman: 'J. Whitcombe', nhi: 'spiffe://kearney/astra/agt_bursar', origin: 'artizent',
    towers: ['twr_cloud', 'twr_dataplat'],
    skills: ['sk_spend_anomaly_v7', 'sk_rightsize_v5'], prohibited: ['AC-31', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-18': 'B', 'AC-80': 'C' }, ceiling: 'approve_first',
    evaluation: { suiteId: 'es_2027_01_28', score: 0.902, replayN: 640, liveSuccess90d: 0.958, lastRun: T(21) },
    economics: { costUsd30d: 188.3, costPerWo: 0.244, humanMinsDisplaced30d: 6420 },
    incidents: [], state: 'active', promotionReview: T(-8), createdAt: T(56), driftAlarm: true,
    trend: [0.964, 0.961, 0.959, 0.962, 0.955, 0.957, 0.958],
  },
  {
    id: 'agt_warden', name: 'Warden', codename: 'Patch & endpoint de-duplication',
    mission: 'Risk-ranked patching campaigns with canary waves, and the lead on consolidating three concurrent endpoint-security stacks onto one — per-wave evidence packs throughout.',
    ownerHuman: 'V. Marchetti', nhi: 'spiffe://kearney/astra/agt_warden', origin: 'artizent',
    towers: ['twr_cloud', 'twr_euc', 'twr_secops', 'twr_network'],
    skills: ['sk_patchwave_v8', 'sk_vulnrank_v4'], prohibited: ['AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-12': 'A', 'AC-31': 'B', 'AC-52': 'A' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.926, replayN: 1440, liveSuccess90d: 0.979, lastRun: T(7) },
    economics: { costUsd30d: 402.7, costPerWo: 0.174, humanMinsDisplaced30d: 19880 },
    incidents: [], state: 'active', promotionReview: T(-24), createdAt: T(84), driftAlarm: false,
    trend: [0.972, 0.975, 0.977, 0.976, 0.978, 0.979, 0.979],
  },
  {
    id: 'agt_archivist', name: 'Archivist', codename: 'Knowledge capture',
    mission: 'Reverse-engineer the shadow estate; draft and refresh runbooks and graph assertions for the 55 apps missing from the CMDB; capture departing KNet staff knowledge before rebadging completes.',
    ownerHuman: 'S. Iyer', nhi: 'spiffe://kearney/astra/agt_archivist', origin: 'artizent',
    towers: TOWERS.map((t) => t.id),
    skills: ['sk_reverse_v11', 'sk_runbook_draft_v9', 'sk_interview_v4'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-08': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.944, replayN: 2980, liveSuccess90d: 0.982, lastRun: T(14) },
    economics: { costUsd30d: 1462.2, costPerWo: 0.618, humanMinsDisplaced30d: 34720 },
    incidents: [], state: 'active', promotionReview: T(-47), createdAt: T(88), driftAlarm: false,
    trend: [0.976, 0.978, 0.98, 0.981, 0.98, 0.982, 0.982],
  },
  {
    id: 'agt_herald', name: 'Herald', codename: 'Service intelligence',
    mission: 'Assemble governance packs, SLA/XLA narratives and glidepath reporting — including the SLA weighting-pool proposal Attachment D.1 leaves TBD — every figure evidence-linked.',
    ownerHuman: 'R. Venkatesh', nhi: 'spiffe://kearney/astra/agt_herald', origin: 'artizent',
    towers: TOWERS.map((t) => t.id),
    skills: ['sk_govpack_v10', 'sk_narrative_v7', 'sk_askherald_v5'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'A' }, ceiling: 'autonomous',
    evaluation: { suiteId: 'es_2027_02_04', score: 0.951, replayN: 1240, liveSuccess90d: 0.988, lastRun: T(14) },
    economics: { costUsd30d: 921.4, costPerWo: 1.12, humanMinsDisplaced30d: 15640 },
    incidents: [], state: 'active', promotionReview: T(-38), createdAt: T(88), driftAlarm: false,
    trend: [0.983, 0.985, 0.986, 0.987, 0.987, 0.988, 0.988],
  },
  {
    id: 'agt_concierge', name: 'Concierge', codename: 'Request handling',
    mission: 'Fulfil hardware and cloud-application-access requests end to end — the two largest Service Catalog task types — provisioning from the approved catalog within policy.',
    ownerHuman: 'M. Okonkwo', nhi: 'spiffe://kearney/astra/agt_concierge', origin: 'artizent',
    towers: ['twr_euc', 'twr_cloud'],
    skills: ['sk_access_fulfil_v9', 'sk_provision_v7', 'sk_euc_reset_v12'], prohibited: ['AC-37', 'AC-44', 'AC-71'],
    grants: { 'AC-05': 'A', 'AC-18': 'A', 'AC-58': 'B', 'AC-66': 'A' }, ceiling: 'supervised',
    evaluation: { suiteId: 'es_2027_02_11', score: 0.937, replayN: 5240, liveSuccess90d: 0.986, lastRun: T(7) },
    economics: { costUsd30d: 512.6, costPerWo: 0.048, humanMinsDisplaced30d: 52180 },
    incidents: [], state: 'active', promotionReview: T(-16), createdAt: T(80), driftAlarm: false,
    trend: [0.979, 0.982, 0.984, 0.985, 0.985, 0.986, 0.986],
  },
  {
    id: 'agt_cl_procure', name: 'Kearney IEM Time-Entry Bot', codename: 'Client agent · managed',
    mission: 'Client-owned agent handling time-entry corrections in the legacy IEM tool that Attachment C.4 lists as retired but which still carries 658 incidents/year. Operated under Astra governance as a managed AgentEntity.',
    ownerHuman: 'Kearney Finance Operations (M. Osei)', nhi: 'spiffe://kearney/own/iem-timebot', origin: 'client',
    towers: ['twr_agentops'],
    skills: ['sk_cl_supplier_v3'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-44', 'AC-71'],
    grants: { 'AC-05': 'B', 'AC-58': 'D' }, ceiling: 'approve_first',
    evaluation: { suiteId: 'es_cl_2027_01', score: 0.812, replayN: 320, liveSuccess90d: 0.894, lastRun: T(28) },
    economics: { costUsd30d: 96.4, costPerWo: 0.71, humanMinsDisplaced30d: 3120 },
    incidents: [
      { id: 'air_0019', at: T(19), summary: 'Proposed a time-code correction outside the approved catalog', actionClass: 'AC-58', outcome: 'Blocked at gate; four-eyes control held', demotedDays: 30 },
    ],
    state: 'probation', promotionReview: T(-4), createdAt: T(41), driftAlarm: true,
    trend: [0.902, 0.898, 0.891, 0.886, 0.889, 0.892, 0.894],
  },
  {
    id: 'agt_cl_kyc', name: 'Kearney Proposal Copilot', codename: 'Client agent · onboarding',
    mission: 'Client-owned copilot drafting engagement-proposal boilerplate for business-development teams. Onboarding to the promotion pipeline.',
    ownerHuman: 'Kearney Market & Client Development', nhi: 'spiffe://kearney/own/proposal-copilot', origin: 'client',
    towers: ['twr_agentops'],
    skills: ['sk_cl_kyc_v1'], prohibited: ['AC-12', 'AC-31', 'AC-37', 'AC-44', 'AC-58', 'AC-71'],
    grants: { 'AC-05': 'C' }, ceiling: 'advise',
    evaluation: { suiteId: 'es_cl_2027_02', score: 0.741, replayN: 140, liveSuccess90d: 0, lastRun: T(6) },
    economics: { costUsd30d: 41.2, costPerWo: 0, humanMinsDisplaced30d: 0 },
    incidents: [], state: 'onboarding', promotionReview: T(-25), createdAt: T(29), driftAlarm: false,
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
  { id: 'sk_cert_rotate_v3', name: 'Certificate rotation', version: 'v3.6.0', layer: 'industry', actionClasses: ['AC-41'], successRate: 0.988, runs: 284, evalScore: 0.951, verificationPack: 'tls_probe_v3', owner: 'Consulting pack', updatedAt: T(9) },
  { id: 'sk_pipe_repair_v9', name: 'Pipeline failure repair', version: 'v9.1.3', layer: 'platform', actionClasses: ['AC-12', 'AC-31'], successRate: 0.968, runs: 740, evalScore: 0.917, verificationPack: 'dq_contract_v5', owner: 'S. Okafor', updatedAt: T(16) },
  { id: 'sk_backfill_v4', name: 'Contract-verified backfill', version: 'v4.2.1', layer: 'platform', actionClasses: ['AC-49'], successRate: 0.943, runs: 186, evalScore: 0.894, verificationPack: 'dq_contract_v5', owner: 'S. Okafor', updatedAt: T(96) },
  { id: 'sk_dq_probe_v7', name: 'Data-quality probe suite', version: 'v7.0.0', layer: 'platform', actionClasses: ['AC-05'], successRate: 0.998, runs: 4120, evalScore: 0.982, verificationPack: 'none', owner: 'Platform core', updatedAt: T(52) },
  { id: 'sk_access_fulfil_v9', name: 'SoD-aware access fulfilment', version: 'v9.4.0', layer: 'industry', actionClasses: ['AC-58'], successRate: 0.991, runs: 3240, evalScore: 0.958, verificationPack: 'entitlement_diff_v3', owner: 'Consulting pack', updatedAt: T(21) },
  { id: 'sk_euc_reset_v12', name: 'EUC state reset', version: 'v12.0.2', layer: 'platform', actionClasses: ['AC-66'], successRate: 0.998, runs: 9840, evalScore: 0.984, verificationPack: 'euc_checkin_v1', owner: 'Platform core', updatedAt: T(33) },
  { id: 'sk_patchwave_v8', name: 'Canaried patch wave', version: 'v8.1.0', layer: 'platform', actionClasses: ['AC-52', 'AC-12'], successRate: 0.979, runs: 620, evalScore: 0.926, verificationPack: 'patch_wave_v2', owner: 'V. Marchetti', updatedAt: T(27) },
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
      { id: 'r0a', when: 'model.whitelisted == false', maxMode: 'manual' },
      { id: 'r0b', when: 'suspensions.any == true', maxMode: 'advise' },
      { id: 'r0c', when: 'retrieval.minVerification == unverified and action.class != AC-05', maxMode: 'advise' },
      { id: 'r0d', when: 'agent.drift == true', maxMode: 'supervised' },
      { id: 'r0e', when: 'model.changed == true', maxMode: 'advise' },
      { id: 'r0f', when: 'audience.endUser == true and retrieval.minVerification != human_verified', maxMode: 'advise' },
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
    updatedAt: T(18), updatedBy: 'L. Nakamura', source: 'git://kearney-astra-policy/prod/change_standard.yaml@v9',
  },
  {
    id: 'pol_euc_std', name: 'euc_standard', version: 'v6',
    appliesTo: { towers: ['twr_euc'], envs: ['prod'] },
    rules: [
      { id: 'r0a', when: 'model.whitelisted == false', maxMode: 'manual' },
      { id: 'r0b', when: 'suspensions.any == true', maxMode: 'advise' },
      { id: 'r0c', when: 'retrieval.minVerification == unverified and action.class != AC-05', maxMode: 'advise' },
      { id: 'r0d', when: 'agent.drift == true', maxMode: 'supervised' },
      { id: 'r0e', when: 'model.changed == true', maxMode: 'advise' },
      { id: 'r0f', when: 'audience.endUser == true and retrieval.minVerification != human_verified', maxMode: 'advise' },
      { id: 'r1', when: 'action.class in [AC-66, AC-24] and blast.tier >= 2', require: 'agent.grade[action.class] >= A', mode: 'autonomous' },
      { id: 'r2', when: 'action.class == AC-18 and blast.tier >= 2', require: 'agent.grade[AC-18] >= A', mode: 'supervised' },
      { id: 'r3', when: 'action.class == AC-58', mode: 'approve_first', gate: { approverRole: 'sdm+second_control', artefacts: ['entitlement_diff', 'sod_check'], timeoutSec: 1800, escalatesTo: 'security_lead' } },
      { id: 'r4', when: 'incident.major_active == true', maxMode: 'advise' },
    ],
    budgets: { tokensUsdPerRun: 0.75, runsPerHour: 400 },
    evidence: { sealRequired: true, exportTo: ['client_grc'] },
    updatedAt: T(40), updatedBy: 'M. Okonkwo', source: 'git://kearney-astra-policy/prod/euc_standard.yaml@v6',
  },
  {
    id: 'pol_data_contract', name: 'data_contract_gate', version: 'v4',
    appliesTo: { towers: ['twr_dataplat', 'twr_bi'], envs: ['prod'] },
    rules: [
      { id: 'r0a', when: 'model.whitelisted == false', maxMode: 'manual' },
      { id: 'r0b', when: 'suspensions.any == true', maxMode: 'advise' },
      { id: 'r0c', when: 'retrieval.minVerification == unverified and action.class != AC-05', maxMode: 'advise' },
      { id: 'r0d', when: 'agent.drift == true', maxMode: 'supervised' },
      { id: 'r0e', when: 'model.changed == true', maxMode: 'advise' },
      { id: 'r0f', when: 'audience.endUser == true and retrieval.minVerification != human_verified', maxMode: 'advise' },
      { id: 'r1', when: 'action.class in [AC-44, AC-49] and asset.contract == null', maxMode: 'advise' },
      { id: 'r2', when: 'action.class == AC-49 and asset.contract != null', mode: 'approve_first', gate: { approverRole: 'data_steward', artefacts: ['dq_pack', 'lineage', 'rollback'], timeoutSec: 3600, escalatesTo: 'data_owner' } },
      { id: 'r3', when: 'action.class in [AC-12, AC-31] and asset.pii == restricted', require: 'agent.grade[action.class] >= B', mode: 'supervised', notify: ['data_steward'] },
      { id: 'r4', when: 'incident.major_active == true', maxMode: 'advise' },
    ],
    budgets: { tokensUsdPerRun: 2.5, runsPerHour: 60 },
    evidence: { sealRequired: true, exportTo: ['client_grc', 'purview'] },
    updatedAt: T(29), updatedBy: 'S. Okafor', source: 'git://kearney-astra-policy/prod/data_contract_gate.yaml@v4',
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
