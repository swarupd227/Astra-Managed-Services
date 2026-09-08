import { Rng } from './rng'
import type {
  Decision, DemandClassRec, GlidepathEntry, InnovationItem, Obligation, SlaSpec, TokenSeries, TransformLedger,
} from './types'

const rng = new Rng(77341)
const NOW = new Date('2027-02-18T09:42:00.000Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString()
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86400000).toISOString()

/* ------------------------------ Demand classes ------------------------------ */

export const DEMAND_CLASSES: DemandClassRec[] = [
  { id: 'dc_cert_expiry', name: 'Certificate expiry incidents', tower: 'twr_payments', volumeYr: 31, hoursYr: 47, trend: -0.88, cause: 'No certificate lifecycle automation across the Mulesoft/FOCUS legacy VM estate (210 graph nodes)', eliminationState: 'verifying', projectedRemoval: 0.92, npv36m: 41000, effortDays: 6, observedDecay: -0.88, verifyDay: 22, proposalType: 'automation' },
  { id: 'dc_mulesoft_soleowner', name: 'Mulesoft single-owner bridge risk', tower: 'twr_payments', volumeYr: 18, hoursYr: 54, trend: -0.05, cause: 'The Salesforce ↔ SAP integration hub has exactly one named user; the bridge runs unmonitored whenever they are unavailable', eliminationState: 'candidate', projectedRemoval: 0.55, npv36m: 96000, effortDays: 28, proposalType: 'engineering_fix' },
  { id: 'dc_iem_ghost', name: 'IEM still live despite "retired" status', tower: 'twr_payments', volumeYr: 658, hoursYr: 410, trend: -0.03, cause: 'IEM is marked replaced by Concur in the client\'s own application inventory, but consultants still submit time through it — the highest-volume live app in the tower', eliminationState: 'candidate', projectedRemoval: 0.5, npv36m: 168000, effortDays: 45, proposalType: 'modernisation' },
  { id: 'dc_batch_overrun', name: 'Core batch window overrun', tower: 'twr_core', volumeYr: 62, hoursYr: 165, trend: -0.12, cause: 'Contention between the SAP S/4HANA nightly close and the PeopleSoft → Workday migration extract', eliminationState: 'candidate', projectedRemoval: 0.7, npv36m: 96000, effortDays: 21, proposalType: 'engineering_fix' },
  { id: 'dc_workday_migration', name: 'PeopleSoft → Workday migration defects', tower: 'twr_core', volumeYr: 84, hoursYr: 224, trend: 0.06, cause: 'PeopleSoft HCM retires August 2027; mapping errors surface on every wave of the Workday cutover', eliminationState: 'candidate', projectedRemoval: 0.4, npv36m: 118000, effortDays: 60, proposalType: 'modernisation' },
  { id: 'dc_mq_depth', name: 'Integration queue depth alarms', tower: 'twr_core', volumeYr: 204, hoursYr: 112, trend: -0.44, cause: 'Static alarm thresholds on the SAP ↔ ServiceNow bridge unrelated to the client\'s business calendar', eliminationState: 'approved', projectedRemoval: 0.8, npv36m: 61000, effortDays: 7, proposalType: 'policy_change' },
  { id: 'dc_pipeline_fail', name: 'Pipeline failure — upstream schema drift', tower: 'twr_dataplat', volumeYr: 156, hoursYr: 288, trend: -0.52, cause: 'No enforced data contract on the Azure Data Factory customer/HCM feed', eliminationState: 'verifying', projectedRemoval: 0.78, npv36m: 148000, effortDays: 18, observedDecay: -0.61, verifyDay: 44, proposalType: 'engineering_fix' },
  { id: 'dc_dq_null_ratio', name: 'Data-quality null-ratio breaches', tower: 'twr_dataplat', volumeYr: 87, hoursYr: 131, trend: -0.19, cause: 'DQ rules authored per-report rather than per-asset across the datamart and downstream gold tables', eliminationState: 'candidate', projectedRemoval: 0.65, npv36m: 54000, effortDays: 12, proposalType: 'automation' },
  { id: 'dc_oracle_blindspot', name: 'Oracle datamart blind spot', tower: 'twr_dataplat', volumeYr: 40, hoursYr: 60, trend: 0.2, cause: 'A Tier-1, 7,000-user Oracle datamart carries zero incident telemetry; nothing can be root-caused against it today', eliminationState: 'candidate', projectedRemoval: 0.3, npv36m: 42000, effortDays: 15, proposalType: 'automation' },
  { id: 'dc_node_pressure', name: 'Azure VM memory pressure', tower: 'twr_cloud', volumeYr: 240, hoursYr: 160, trend: -0.71, cause: 'Absent autoscaling on workloads mid-migration out of the Chicago DC', eliminationState: 'eliminated', projectedRemoval: 0.9, npv36m: 88000, effortDays: 5, observedDecay: -0.9, verifyDay: 90, proposalType: 'automation' },
  { id: 'dc_tf_drift', name: 'Terraform state drift findings', tower: 'twr_cloud', volumeYr: 312, hoursYr: 208, trend: -0.28, cause: 'Console changes outside the pipeline during the Chicago DC → Azure exit', eliminationState: 'approved', projectedRemoval: 0.75, npv36m: 74000, effortDays: 10, proposalType: 'policy_change' },
  { id: 'dc_pwd_reset', name: 'Password / MFA lockout resets', tower: 'twr_euc', volumeYr: 2484, hoursYr: 745, trend: -0.2, cause: 'No self-service path for post-MFA-re-enrolment lockouts — the largest single incident subcategory across 9,817 endpoints', eliminationState: 'candidate', projectedRemoval: 0.75, npv36m: 312000, effortDays: 18, proposalType: 'self_service' },
  { id: 'dc_onedrive_sync', name: 'OneDrive / M365 sync failures', tower: 'twr_euc', volumeYr: 926, hoursYr: 540, trend: 0.18, cause: 'OneDrive sync breaks following Cisco Zero-Trust re-enrolment; 926 incidents/year and rising', eliminationState: 'candidate', projectedRemoval: 0.5, npv36m: 121000, effortDays: 20, proposalType: 'engineering_fix' },
  { id: 'dc_sw_provision', name: 'Catalog software provisioning', tower: 'twr_euc', volumeYr: 2140, hoursYr: 784, trend: -0.83, cause: 'Manual approval hop for pre-approved catalog items', eliminationState: 'eliminated', projectedRemoval: 0.88, npv36m: 196000, effortDays: 8, observedDecay: -0.83, verifyDay: 90, proposalType: 'automation' },
  { id: 'dc_zta_sync_break', name: 'Zero-Trust rollout friction', tower: 'twr_network', volumeYr: 2362, hoursYr: 890, trend: 0.22, cause: 'Cisco Zero-Trust/SASE enrolment breaks OneDrive and PowerPoint sync immediately after rollout — causally linked to 4 of the top 10 open problem records', eliminationState: 'candidate', projectedRemoval: 0.45, npv36m: 142000, effortDays: 30, proposalType: 'engineering_fix' },
  { id: 'dc_bgp_flap', name: 'BGP peer flap', tower: 'twr_network', volumeYr: 64, hoursYr: 128, trend: -0.08, cause: 'Carrier-side instability; damping not tuned', eliminationState: 'candidate', projectedRemoval: 0.45, npv36m: 31000, effortDays: 6, proposalType: 'policy_change' },
  { id: 'dc_triple_av', name: 'Endpoint security agents contend for CPU', tower: 'twr_secops', volumeYr: 41, hoursYr: 96, trend: 0.3, cause: 'Cisco AMP, Trellix ePO and a third EDR run concurrently on the same fleet, contending for CPU — the consultant feels it as a slow laptop the night before a steering committee', eliminationState: 'candidate', projectedRemoval: 0.85, npv36m: 168000, effortDays: 25, proposalType: 'engineering_fix' },
  { id: 'dc_access_recert', name: 'Access recertification chase', tower: 'twr_secops', volumeYr: 412, hoursYr: 344, trend: -0.22, cause: 'Recert campaigns run by spreadsheet outside the IGA tool', eliminationState: 'candidate', projectedRemoval: 0.68, npv36m: 92000, effortDays: 22, proposalType: 'automation' },
  { id: 'dc_shadow_app', name: 'Shadow IT / CMDB reconciliation gap', tower: 'twr_claims', volumeYr: 1979, hoursYr: 620, trend: 0.1, cause: '55 applications appear in the ticket data but are not in the official inventory (Attachment C.4) — a roughly 14,894-incident gap between the inventory\'s own incident-count column and the real ticket extract', eliminationState: 'candidate', projectedRemoval: 0.4, npv36m: 88000, effortDays: 35, proposalType: 'automation' },
  { id: 'dc_agent_budget', name: 'Client-agent budget breaches', tower: 'twr_agentops', volumeYr: 48, hoursYr: 36, trend: 0.14, cause: 'Client agents deployed without TokenOps budgets at onboarding', eliminationState: 'candidate', projectedRemoval: 0.9, npv36m: 18000, effortDays: 4, proposalType: 'policy_change' },
  // AI Incident classes — one demand class per contractual incident class, so a
  // detection lands in the same queues, ledgers and elimination views as any other work.
  { id: 'dc_ai_fabrication', name: 'AI Incident — fabrication', tower: 'twr_agentops', volumeYr: 6, hoursYr: 18, trend: 0, cause: 'A proposal cited agents, skills, action classes or estate entities that do not exist; caught by the groundedness detector before the policy engine', eliminationState: 'none' },
  { id: 'dc_ai_security_compromise', name: 'AI Incident — security compromise', tower: 'twr_agentops', volumeYr: 4, hoursYr: 16, trend: 0, cause: 'Prompt injection in an utterance or retrieved context, canary leakage, or a proposal using tools the agent was never granted', eliminationState: 'none' },
  { id: 'dc_ai_oversight_failure', name: 'AI Incident — oversight failure', tower: 'twr_agentops', volumeYr: 1, hoursYr: 8, trend: 0, cause: 'An action in the evidence chain without the human approval its decision required, or executed while the platform brake was on', eliminationState: 'none' },
  { id: 'dc_ai_discriminatory_pattern', name: 'AI Incident — discriminatory pattern', tower: 'twr_agentops', volumeYr: 1, hoursYr: 12, trend: 0, cause: 'Sustained disparity in priority, gating or agent handling across declared cohorts', eliminationState: 'none' },
]

/* ---------------------------- Glidepath ledger ------------------------------ */

function buildGlidepath(): GlidepathEntry[] {
  const out: GlidepathEntry[] = []
  const attribs: GlidepathEntry['attribution'][] = ['automation', 'elimination', 'acceleration', 'avoidance']
  DEMAND_CLASSES.forEach((dc, i) => {
    const n = dc.eliminationState === 'eliminated' ? 4 : dc.eliminationState === 'verifying' ? 2 : 1
    for (let k = 0; k < n; k++) {
      const attribution = dc.eliminationState === 'eliminated' ? (k === 0 ? 'elimination' : 'automation') : attribs[(i + k) % 4]
      const banked = dc.eliminationState === 'eliminated' || (dc.eliminationState === 'verifying' && k === 0 && (dc.verifyDay ?? 0) > 60)
      const window = attribution === 'avoidance' ? 90 : 60
      out.push({
        id: `gp_${String(out.length + 1).padStart(4, '0')}`,
        at: daysAgo(rng.int(10, 300)),
        tower: dc.tower,
        demandClass: dc.id,
        attribution,
        hoursSaved: Math.round((dc.hoursYr * (dc.projectedRemoval ?? 0.5)) / (n * (attribution === 'avoidance' ? 2.4 : 1))),
        verifiedDays: banked ? window : dc.verifyDay ?? rng.int(8, 55),
        verificationWindow: window,
        state: banked ? 'banked' : 'verifying',
        evidenceId: `ev_gp_${String(out.length + 1).padStart(4, '0')}`,
        narrative:
          attribution === 'elimination'
            ? `Class volume decayed ${Math.round(Math.abs(dc.observedDecay ?? 0.5) * 100)}% against trailing mean after ${dc.proposalType?.replace(/_/g, ' ')}.`
            : attribution === 'avoidance'
              ? 'Counterfactual-modelled prevented incidents, discounted 60% per contract schedule.'
              : attribution === 'acceleration'
                ? 'Human-assisted resolution; measured time delta against the shadow-period standard.'
                : 'Agent-executed resolution replacing the measured manual path.',
      })
    }
  })
  // One visibly rejected claim — the ledger must be able to say no.
  out.push({
    id: 'gp_9001',
    at: daysAgo(64),
    tower: 'twr_core',
    demandClass: 'dc_batch_overrun',
    attribution: 'elimination',
    hoursSaved: 96,
    verifiedDays: 60,
    verificationWindow: 60,
    state: 'rejected',
    evidenceId: 'ev_gp_9001',
    narrative: 'Claimed elimination not confirmed: class volume fell 9% against a 70% projection. Not banked. Root cause re-opened as a transform candidate.',
  })
  return out
}

export const GLIDEPATH: GlidepathEntry[] = buildGlidepath()

export const bankedHours = (tower?: string) =>
  GLIDEPATH.filter((g) => g.state === 'banked' && (!tower || g.tower === tower)).reduce((s, g) => s + g.hoursSaved, 0)

export const verifyingHours = (tower?: string) =>
  GLIDEPATH.filter((g) => g.state === 'verifying' && (!tower || g.tower === tower)).reduce((s, g) => s + g.hoursSaved, 0)

/* ---------------------------- Transform ledgers ----------------------------- */

export const TRANSFORM: TransformLedger[] = [
  {
    tower: 'twr_payments', quarter: '2027-Q1',
    bankedSavingsHrs: 1240, reinvestPct: 60, priceReductionPct: 40,
    creditsAccrued: 744, creditsCarriedIn: 121, creditsConsumed: 505, freezeState: 'none',
    allocations: [
      { id: 'ta_007', title: 'Automate certificate rotation on the Mulesoft/FOCUS VM estate', objectiveId: 'obj_ai_ops', credits: 300, approvedIn: 'gov_2026_11', state: 'delivered', yieldPromised: 190, yieldRealised: 214 },
      { id: 'ta_031', title: 'Draft the missing Mulesoft integration runbook', objectiveId: 'obj_ai_ops', credits: 260, approvedIn: 'gov_2027_02', state: 'executing', yieldPromised: 140 },
      { id: 'ta_034', title: 'Retire legacy IEM in favor of Concur', objectiveId: 'obj_modernization', credits: 380, approvedIn: 'gov_2027_02', state: 'approved', yieldPromised: 175 },
    ],
  },
  {
    tower: 'twr_cloud', quarter: '2027-Q1',
    bankedSavingsHrs: 1610, reinvestPct: 60, priceReductionPct: 40,
    creditsAccrued: 966, creditsCarriedIn: 88, creditsConsumed: 640, freezeState: 'none',
    allocations: [
      { id: 'ta_012', title: 'Autoscaling across workloads exiting the Chicago DC', objectiveId: 'obj_modernization', credits: 180, approvedIn: 'gov_2026_10', state: 'delivered', yieldPromised: 130, yieldRealised: 158 },
      { id: 'ta_028', title: 'Pipeline-only change enforcement (kill console drift)', objectiveId: 'obj_ai_ops', credits: 460, approvedIn: 'gov_2027_01', state: 'verifying', yieldPromised: 205 },
      { id: 'ta_040', title: 'Self-healing probes for tier-2 workloads ahead of the DC exit', objectiveId: 'obj_modernization', credits: 220, approvedIn: 'gov_2027_02', state: 'approved', yieldPromised: 96 },
    ],
  },
  {
    tower: 'twr_euc', quarter: '2027-Q1',
    bankedSavingsHrs: 2340, reinvestPct: 60, priceReductionPct: 40,
    creditsAccrued: 1404, creditsCarriedIn: 210, creditsConsumed: 980, freezeState: 'none',
    allocations: [
      { id: 'ta_019', title: 'Self-service lockout recovery portal', objectiveId: 'obj_employee_experience', credits: 420, approvedIn: 'gov_2026_09', state: 'delivered', yieldPromised: 1200, yieldRealised: 1388 },
      { id: 'ta_036', title: 'Zero-touch catalog provisioning', objectiveId: 'obj_employee_experience', credits: 560, approvedIn: 'gov_2027_01', state: 'delivered', yieldPromised: 620, yieldRealised: 690 },
      { id: 'ta_044', title: 'Consolidate three endpoint-security agents onto one', objectiveId: 'obj_employee_experience', credits: 300, approvedIn: 'gov_2027_02', state: 'executing', yieldPromised: 268 },
    ],
  },
  {
    tower: 'twr_dataplat', quarter: '2027-Q1',
    bankedSavingsHrs: 780, reinvestPct: 60, priceReductionPct: 40,
    creditsAccrued: 468, creditsCarriedIn: 34, creditsConsumed: 120, freezeState: 'frozen',
    freezeReason: 'XLA trust score breached target for Research & Analytics consumers — new credit allocation frozen until service is restored (§12.5).',
    allocations: [
      { id: 'ta_022', title: 'Enforce data contracts on the Azure Data Factory customer feed', objectiveId: 'obj_ai_ops', credits: 120, approvedIn: 'gov_2026_12', state: 'verifying', yieldPromised: 224 },
    ],
  },
  {
    tower: 'twr_core', quarter: '2027-Q1',
    bankedSavingsHrs: 610, reinvestPct: 60, priceReductionPct: 40,
    creditsAccrued: 366, creditsCarriedIn: 0, creditsConsumed: 210, freezeState: 'none',
    allocations: [
      { id: 'ta_025', title: 'Business-calendar-aware integration alarm thresholds', objectiveId: 'obj_ai_ops', credits: 210, approvedIn: 'gov_2027_01', state: 'executing', yieldPromised: 90 },
    ],
  },
]

/* ---------------------------------- SLAs ------------------------------------ */

export const SLAS: SlaSpec[] = [
  { id: 'sla_apps_p1', tower: 'twr_payments', name: 'P1 resolution — Application Development & Integration', metric: 'resolution_time', targetMins: 60, attainmentTarget: 95, attainmentMtd: 97.2, volumeMtd: 4, breachesMtd: 0, headroom: 2.2, kind: 'sla', clock: { start: 'validated_priority_set', stop: 'resolution_confirmed', pauses: ['awaiting_client (cap 8h/wo)', 'vendor_dependency (logged)'], calendar: '24×7' }, credit: [{ band: '93–95%', pct: 3 }, { band: '88–93%', pct: 6 }, { band: '<88%', pct: 10 }], earnback: '3 consecutive months ≥ 97%' },
  { id: 'sla_apps_p2', tower: 'twr_payments', name: 'P2 resolution — Application Development & Integration', metric: 'resolution_time', targetMins: 240, attainmentTarget: 95, attainmentMtd: 96.1, volumeMtd: 58, breachesMtd: 2, headroom: 1.1, kind: 'sla', clock: { start: 'validated_priority_set', stop: 'resolution_confirmed', pauses: ['awaiting_client (cap 8h/wo)', 'vendor_dependency (logged)', 'change_freeze_client_initiated'], calendar: 'client_biz_hours(America/Chicago)' }, credit: [{ band: '94–95%', pct: 2 }, { band: '90–94%', pct: 4 }, { band: '<90%', pct: 7 }], earnback: '3 consecutive months ≥ 97%' },
  { id: 'sla_core_p2', tower: 'twr_core', name: 'P2 resolution — Application Maintenance', metric: 'resolution_time', targetMins: 240, attainmentTarget: 95, attainmentMtd: 94.1, volumeMtd: 51, breachesMtd: 3, headroom: 0, kind: 'sla', clock: { start: 'validated_priority_set', stop: 'resolution_confirmed', pauses: ['awaiting_client (cap 8h/wo)', 'vendor_dependency (logged)'], calendar: 'client_biz_hours(America/Chicago)' }, credit: [{ band: '94–95%', pct: 2 }, { band: '90–94%', pct: 4 }, { band: '<90%', pct: 7 }], earnback: '3 consecutive months ≥ 97%' },
  { id: 'sla_data_delivery', tower: 'twr_dataplat', name: 'ADF nightly delivery by 05:00 CST', metric: 'delivery_time', targetMins: 0, attainmentTarget: 99, attainmentMtd: 97.4, volumeMtd: 18, breachesMtd: 1, headroom: 0, kind: 'sla', clock: { start: 'pipeline_scheduled', stop: 'contract_verified', pauses: ['upstream_vendor_dependency (logged)'], calendar: 'business_days(America/Chicago)' }, credit: [{ band: '97–99%', pct: 3 }, { band: '<97%', pct: 6 }], earnback: '2 consecutive months at 100%' },
  { id: 'sla_cloud_avail', tower: 'twr_cloud', name: 'Availability — tier-1 platform services', metric: 'availability', targetMins: 0, attainmentTarget: 99.9, attainmentMtd: 99.97, volumeMtd: 0, breachesMtd: 0, headroom: 12, kind: 'sla', clock: { start: 'probe_fail_confirmed', stop: 'probe_recovered', pauses: ['planned_maintenance_window'], calendar: '24×7' }, credit: [{ band: '99.5–99.9%', pct: 4 }, { band: '<99.5%', pct: 8 }], earnback: 'Quarterly at ≥ 99.95%' },
  { id: 'sla_euc_req', tower: 'twr_euc', name: 'Standard request fulfilment', metric: 'fulfilment_time', targetMins: 480, attainmentTarget: 95, attainmentMtd: 99.2, volumeMtd: 1840, breachesMtd: 15, headroom: 62, kind: 'sla', clock: { start: 'request_validated', stop: 'fulfilment_confirmed', pauses: ['awaiting_requester', 'awaiting_line_manager_approval'], calendar: 'client_biz_hours(America/Chicago)' }, credit: [{ band: '92–95%', pct: 2 }, { band: '<92%', pct: 4 }], earnback: '3 consecutive months ≥ 97%' },
  { id: 'sla_net_p2', tower: 'twr_network', name: 'P2 resolution — Network Services', metric: 'resolution_time', targetMins: 240, attainmentTarget: 95, attainmentMtd: 95.8, volumeMtd: 24, breachesMtd: 1, headroom: 1, kind: 'sla', clock: { start: 'validated_priority_set', stop: 'resolution_confirmed', pauses: ['carrier_dependency (logged)'], calendar: '24×7' }, credit: [{ band: '92–95%', pct: 3 }, { band: '<92%', pct: 5 }], earnback: '3 consecutive months ≥ 97%' },
  { id: 'sla_cmdb_accuracy', tower: 'twr_claims', name: 'CMDB Accuracy (Critical SLA)', metric: 'accuracy', targetMins: 0, attainmentTarget: 98, attainmentMtd: 91.3, volumeMtd: 0, breachesMtd: 1, headroom: 0, kind: 'sla', clock: { start: 'sampling_audit_started', stop: 'sampling_audit_confirmed', pauses: [], calendar: 'monthly' }, credit: [{ band: '95–98%', pct: 4 }, { band: '<95%', pct: 8 }], earnback: '2 consecutive months ≥ 98%' },
  { id: 'xla_pmt_friction', tower: 'twr_payments', name: 'Requester friction index', metric: 'friction_index', targetMins: 0, attainmentTarget: 70, attainmentMtd: 81.4, volumeMtd: 62, breachesMtd: 0, headroom: 0, kind: 'xla', clock: { start: 'request_raised', stop: 'closure_feedback', pauses: [], calendar: 'client_biz_hours(America/Chicago)' }, credit: [{ band: '65–70', pct: 1 }, { band: '<65', pct: 2 }], earnback: 'Quarterly at ≥ 80' },
  { id: 'xla_trust_bi', tower: 'twr_bi', name: 'Consumer trust score — Research & Analytics', metric: 'trust_score', targetMins: 0, attainmentTarget: 75, attainmentMtd: 68.2, volumeMtd: 41, breachesMtd: 1, headroom: 0, kind: 'xla', clock: { start: 'survey_issued', stop: 'survey_closed', pauses: [], calendar: 'monthly' }, credit: [{ band: '70–75', pct: 1 }, { band: '<70', pct: 3 }], earnback: '2 consecutive months ≥ 78' },
  { id: 'xla_euc_ttp', tower: 'twr_euc', name: 'Time-to-productive — new joiner', metric: 'time_to_productive', targetMins: 240, attainmentTarget: 90, attainmentMtd: 96.1, volumeMtd: 128, breachesMtd: 5, headroom: 8, kind: 'xla', clock: { start: 'joiner_record_created', stop: 'first_successful_signin', pauses: ['awaiting_hr_data'], calendar: 'client_biz_hours(America/Chicago)' }, credit: [{ band: '85–90%', pct: 1 }, { band: '<85%', pct: 2 }], earnback: 'Quarterly at ≥ 93%' },
  { id: 'xla_nps', tower: 'twr_claims', name: 'Overall Satisfaction (NPS)', metric: 'nps_score', targetMins: 0, attainmentTarget: 20, attainmentMtd: 24, volumeMtd: 212, breachesMtd: 0, headroom: 4, kind: 'xla', clock: { start: 'survey_issued', stop: 'survey_closed', pauses: [], calendar: 'monthly' }, credit: [{ band: '15–20', pct: 1 }, { band: '<15', pct: 2 }], earnback: 'Quarterly at ≥ 25' },
  { id: 'ola_carrier', tower: 'twr_network', name: 'Carrier restoration (third party)', metric: 'restoration_time', targetMins: 480, attainmentTarget: 95, attainmentMtd: 88.3, volumeMtd: 12, breachesMtd: 2, headroom: 0, kind: 'ola', clock: { start: 'carrier_ticket_raised', stop: 'carrier_confirms_restored', pauses: [], calendar: '24×7' }, credit: [{ band: '<95%', pct: 0 }], earnback: 'Attributed to carrier in SIAM report' },
  // AI Incident clocks — the contract's own: notify within 24 hours, publish the root-cause analysis within five business days.
  { id: 'sla_ai_notify', tower: 'twr_agentops', name: 'AI Incident — customer notification', metric: 'notification_time', targetMins: 1440, attainmentTarget: 100, attainmentMtd: 100, volumeMtd: 0, breachesMtd: 0, headroom: 0, kind: 'sla', clock: { start: 'incident_detected', stop: 'customer_notified', pauses: [], calendar: '24×7' }, credit: [{ band: '<100%', pct: 2 }], earnback: 'Quarter with every notification inside 24h' },
  { id: 'sla_ai_rca', tower: 'twr_agentops', name: 'AI Incident — root-cause analysis', metric: 'rca_time', targetMins: 7200, attainmentTarget: 100, attainmentMtd: 100, volumeMtd: 0, breachesMtd: 0, headroom: 0, kind: 'sla', clock: { start: 'incident_detected', stop: 'rca_published', pauses: [], calendar: 'business_days(America/Chicago)' }, credit: [{ band: '<100%', pct: 2 }], earnback: 'Quarter with every RCA inside five business days' },
]

/* --------------------------------- TokenOps --------------------------------- */

export const TOKEN_SERIES: TokenSeries[] = Array.from({ length: 30 }, (_, i) => {
  const day = new Date(NOW.getTime() - (29 - i) * 86400000)
  const weekend = [0, 6].includes(day.getUTCDay())
  const base = weekend ? 0.42 : 1
  const trend = 1 - i * 0.006 // routing and caching improvements compound
  return {
    day: day.toISOString().slice(0, 10),
    frontierUsd: Math.round(base * trend * rng.float(180, 260) * 100) / 100,
    midUsd: Math.round(base * rng.float(60, 96) * 100) / 100,
    smallUsd: Math.round(base * rng.float(9, 22) * 100) / 100,
    cacheHitPct: Math.round((0.41 + i * 0.006 + rng.float(-0.03, 0.03, 3)) * 1000) / 10,
    displacedUsd: Math.round(base * rng.float(5400, 7200) * 100) / 100,
  }
})

export const ROUTING_TABLE = [
  { step: 'Event classification', tier: 'small (client-hosted)', share: 94, qualityDelta: -0.004, costPer1k: 0.0006, refitAt: daysAgo(4) },
  { step: 'Log extraction', tier: 'mid', share: 88, qualityDelta: -0.009, costPer1k: 0.003, refitAt: daysAgo(4) },
  { step: 'Causal reasoning', tier: 'frontier', share: 96, qualityDelta: 0, costPer1k: 0.018, refitAt: daysAgo(4) },
  { step: 'Plan synthesis', tier: 'frontier', share: 91, qualityDelta: 0, costPer1k: 0.018, refitAt: daysAgo(4) },
  { step: 'Narrative drafting', tier: 'mid', share: 79, qualityDelta: -0.012, costPer1k: 0.003, refitAt: daysAgo(11) },
  { step: 'Runbook drafting', tier: 'frontier', share: 68, qualityDelta: 0, costPer1k: 0.018, refitAt: daysAgo(11) },
  { step: 'Knowledge verification triage', tier: 'mid', share: 96, qualityDelta: -0.006, costPer1k: 0.003, refitAt: daysAgo(4) },
]

export const DISTILLATION_CANDIDATES = [
  { skill: 'sk_triage_v12', step: 'Event classification', volume30d: 28400, frontierScore: 0.962, smallScore: 0.958, delta: 0.004, verdict: 'ready', projectedSaveUsd30d: 214 },
  { skill: 'sk_logscan_v6', step: 'Log extraction', volume30d: 24100, frontierScore: 0.971, smallScore: 0.962, delta: 0.009, verdict: 'ready', projectedSaveUsd30d: 168 },
  { skill: 'sk_narrative_v7', step: 'Narrative drafting', volume30d: 9600, frontierScore: 0.944, smallScore: 0.918, delta: 0.026, verdict: 'below_threshold', projectedSaveUsd30d: 96 },
  { skill: 'sk_causal_v9', step: 'Causal reasoning', volume30d: 8940, frontierScore: 0.948, smallScore: 0.792, delta: 0.156, verdict: 'frontier_only', projectedSaveUsd30d: 0 },
]

/* ------------------------------- Governance --------------------------------- */

export const DECISIONS: Decision[] = [
  { id: 'dec_2027_014', forum: 'Service governance board · 2027-02', at: daysAgo(4), owner: 'R. Castellano (Client Service Owner)', subject: 'Promote AC-31 to L3 Supervised on Application Development & Integration', inputs: ['promotion_pack pr_88', 'sampled_review 2026-Q4', 'incident_history air_0007'], decision: 'approved_with_condition', condition: 'Weekly sampled review for 8 weeks; automatic demotion on any Sev-attributable error', effective: 'policy PR #214 merged 2027-02-14', evidenceId: 'ev_dd41a2', followThrough: { text: 'Weekly sampled review', state: 'green', progress: 'week 1 of 8 · agreement 98.4%' } },
  { id: 'dec_2027_013', forum: 'Service governance board · 2027-02', at: daysAgo(4), owner: 'R. Castellano (Client Service Owner)', subject: 'Allocate 380 capacity credits to ta_034 (Retire legacy IEM in favor of Concur)', inputs: ['transform_ledger 2027-Q1', 'run_simplification_score 0.71', 'demand_class dc_iem_ghost precedent'], decision: 'approved', effective: 'Transform Ledger updated 2027-02-14', evidenceId: 'ev_dd41a3', followThrough: { text: 'Delivery start gate', state: 'green', progress: 'kickoff 2027-02-24' } },
  { id: 'dec_2027_012', forum: 'Joint innovation council · 2027-02', at: daysAgo(9), owner: 'E. Whitfield (CIO)', subject: 'Sponsor experiment: predictive jeopardy routing on Application Maintenance', inputs: ['innovation_register inv_0044', 'breach_pattern_analysis'], decision: 'approved', effective: 'Funded from innovation allowance', evidenceId: 'ev_dd41a4', followThrough: { text: '60-day verification against success criteria', state: 'amber', progress: 'day 9 · baseline still being measured' } },
  { id: 'dec_2027_011', forum: 'Service governance board · 2027-01', at: daysAgo(35), owner: 'R. Castellano (Client Service Owner)', subject: 'Freeze credit allocation on Research & Analytics pending XLA recovery', inputs: ['xla_trust_bi 68.2 vs target 75', 'consumer_survey verbatims'], decision: 'approved', effective: 'Transform Ledger freeze flag set 2027-01-14', evidenceId: 'ev_dd41a5', followThrough: { text: 'Restore trust score ≥ 75 for two consecutive months', state: 'red', progress: 'month 2 · 68.2, not recovering' } },
  { id: 'dec_2027_010', forum: 'Service governance board · 2027-01', at: daysAgo(35), owner: 'V. Marchetti (Security & Risk Lead)', subject: 'Reject L4 promotion for AC-58 on any tower', inputs: ['four_eyes_control_review', 'segregation-of-duties assessment'], decision: 'rejected', effective: 'Autonomy schedule annotated — AC-58 capped at L2 permanently', evidenceId: 'ev_dd41a6' },
  { id: 'dec_2027_009', forum: 'Executive & commercial review · 2026-Q4', at: daysAgo(71), owner: 'E. Whitfield (CIO)', subject: 'Adopt 60/40 reinvest-to-price-reduction conversion for year 2', inputs: ['glidepath_attainment -14.6% vs -12% contracted', 'transform_yield ta_007 realised 214 vs 190 promised'], decision: 'approved', effective: 'Commercial schedule 4.2 amended', evidenceId: 'ev_dd41a7', followThrough: { text: 'Quarterly reconciliation of ledgers', state: 'green', progress: '2027-Q1 reconciled, zero restatements' } },
  { id: 'dec_2027_008', forum: 'Service governance board · 2026-12', at: daysAgo(96), owner: 'S. Okafor (Data & Analytics Lead)', subject: 'Demote Custodian on AC-49 following contract-violating backfill', inputs: ['incident air_0011', 'verification_failure_analysis'], decision: 'approved', effective: 'Grade B → C for 21 days; DQ pack extended', evidenceId: 'ev_dd41a8', followThrough: { text: 'Re-pass stage gates before restoration', state: 'green', progress: 'restored 2027-01-08 after replay + shadow' } },
]

export const OBLIGATIONS: Obligation[] = [
  { id: 'obl_001', title: 'Monthly governance pack delivered T-1 business day', owner: 'R. Venkatesh', dueAt: daysAhead(8), cadence: 'Monthly', evidenceRequirement: 'Signed extract hash + distribution log', state: 'green' },
  { id: 'obl_002', title: 'SLA compliance & credits statement issued', owner: 'J. Whitcombe', dueAt: daysAhead(8), cadence: 'Monthly', evidenceRequirement: 'Signed extract, clock audits attached', state: 'green' },
  { id: 'obl_003', title: 'SOC 2 Type II resilience control test', owner: 'D. Kowalski', dueAt: daysAhead(23), cadence: 'Half-yearly', evidenceRequirement: 'Game-day report + auditor annex', state: 'amber' },
  { id: 'obl_004', title: 'Exit plan refresh (knowledge pack portability attestation)', owner: 'S. Iyer', dueAt: daysAhead(41), cadence: 'Yearly', evidenceRequirement: 'Export manifest + client countersignature', state: 'green' },
  { id: 'obl_005', title: 'ISO 27001 surveillance audit evidence pack', owner: 'V. Marchetti', dueAt: daysAhead(12), cadence: 'Yearly', evidenceRequirement: 'Annex A control mapping + continuous evidence extract', state: 'amber' },
  { id: 'obl_006', title: 'EU AI Act deployer register — AER inventory attestation', owner: 'L. Nakamura', dueAt: daysAhead(3), cadence: 'Quarterly', evidenceRequirement: 'AER inventory export + human-oversight documentation', state: 'red' },
  { id: 'obl_007', title: 'Quarterly access recertification (platform + agent NHI)', owner: 'V. Marchetti', dueAt: daysAgo(2), cadence: 'Quarterly', evidenceRequirement: 'Recertification log with reviewer identities', state: 'red' },
  { id: 'obl_008', title: 'Data-return commitment rehearsal', owner: 'S. Okafor', dueAt: daysAhead(88), cadence: 'Yearly', evidenceRequirement: 'Rehearsal report + volumes returned', state: 'green' },
  { id: 'obl_009', title: 'Cyber insurance evidence refresh', owner: 'J. Whitcombe', dueAt: daysAhead(56), cadence: 'Yearly', evidenceRequirement: 'Certificate of currency', state: 'green' },
  { id: 'obl_010', title: 'Model change-control report (router + model versions)', owner: 'L. Nakamura', dueAt: daysAhead(15), cadence: 'Quarterly', evidenceRequirement: 'Replay regression results per change', state: 'green' },
]

export const INNOVATION: InnovationItem[] = [
  { id: 'inv_0051', title: 'Voice-channel intake for office operations', source: 'client', sponsor: 'R. Castellano', valueClass: 'experience', stage: 'idea', hypothesis: 'Office staff raise 40% of EUC demand by phone; conversational intake removes the reformatting hop.' },
  { id: 'inv_0050', title: 'Graph-derived change-risk score in the CAB pack', source: 'artizent', sponsor: 'R. Venkatesh', valueClass: 'risk', stage: 'assessed', hypothesis: 'Incident gravity plus dependency depth predicts change failure better than the current manual risk matrix.', projectedValueUsd: 74000 },
  { id: 'inv_0044', title: 'Predictive jeopardy routing on Application Maintenance', source: 'agent', sponsor: 'E. Whitfield', valueClass: 'cost', stage: 'funded', hypothesis: 'Routing at-risk P2s to senior resolvers 45 minutes earlier lifts attainment above 95% without added headcount.', projectedValueUsd: 118000, fundingSource: 'innovation_allowance', cycleDays: 9 },
  { id: 'inv_0039', title: 'Shift-handover pack generated from board state', source: 'artizent', sponsor: 'M. Okonkwo', valueClass: 'experience', stage: 'verified', hypothesis: 'Auto-drafted handovers cut the 25-minute overlap to under 8 minutes with no loss of context.', projectedValueUsd: 62000, realisedValueUsd: 71400, verdict: 'verified', fundingSource: 'capacity_credits', cycleDays: 34, reuseCount: 3 },
  { id: 'inv_0035', title: 'Self-service lockout recovery portal', source: 'client', sponsor: 'P. Lindegaard', valueClass: 'cost', stage: 'scaled', hypothesis: 'A guided self-service path removes the majority of post-MFA lockout demand.', projectedValueUsd: 384000, realisedValueUsd: 412000, verdict: 'verified', fundingSource: 'capacity_credits', cycleDays: 52, reuseCount: 2 },
  { id: 'inv_0031', title: 'LLM-scored sentiment on resolver comms', source: 'artizent', sponsor: 'R. Venkatesh', valueClass: 'experience', stage: 'verified', hypothesis: 'Language-model tone scoring correlates with CSAT strongly enough to act on between surveys.', projectedValueUsd: 40000, realisedValueUsd: 18000, verdict: 'partial', fundingSource: 'innovation_allowance', cycleDays: 61 },
  { id: 'inv_0028', title: 'Auto-generated Terraform from drift findings', source: 'agent', sponsor: 'P. Lindegaard', valueClass: 'cost', stage: 'delivered', hypothesis: 'Drift findings can be converted directly into reviewed IaC pull requests.', projectedValueUsd: 88000, fundingSource: 'capacity_credits', cycleDays: 40 },
  { id: 'inv_0022', title: 'Federated agent marketplace with client-authored skills', source: 'council', sponsor: 'E. Whitfield', valueClass: 'capability', stage: 'verified', hypothesis: 'Kearney engineers can author and publish skills into the client golden repo without Artizent in the loop.', projectedValueUsd: 0, realisedValueUsd: 0, verdict: 'verified', fundingSource: 'innovation_allowance', cycleDays: 88, reuseCount: 6 },
  { id: 'inv_0019', title: 'Predictive DR-failover rehearsal from graph topology', source: 'artizent', sponsor: 'D. Kowalski', valueClass: 'risk', stage: 'verified', hypothesis: 'Topology-derived rehearsal scenarios surface resilience gaps the scripted DR test misses.', projectedValueUsd: 96000, realisedValueUsd: 0, verdict: 'failed', fundingSource: 'innovation_allowance', cycleDays: 74 },
  { id: 'inv_0014', title: 'Sentiment-triggered proactive outreach', source: 'artizent', sponsor: 'M. Okonkwo', valueClass: 'experience', stage: 'verified', hypothesis: 'Contacting requesters whose tone degrades mid-ticket reduces escalations.', projectedValueUsd: 34000, realisedValueUsd: 0, verdict: 'failed', fundingSource: 'innovation_allowance', cycleDays: 45 },
  { id: 'inv_0009', title: 'Zero-touch catalog provisioning', source: 'client', sponsor: 'P. Lindegaard', valueClass: 'cost', stage: 'scaled', hypothesis: 'Pre-approved catalog items need no human approval hop when the requester is in the entitled group.', projectedValueUsd: 196000, realisedValueUsd: 224000, verdict: 'verified', fundingSource: 'capacity_credits', cycleDays: 29, reuseCount: 4 },
]

/* ------------------------------- Clock audit -------------------------------- */

export interface ClockEvent {
  at: string
  event: 'clock_start' | 'pause' | 'resume' | 'reclassify' | 'clock_stop'
  detail: string
  evidence: string
}

/**
 * A worked SLA clock audit — the record a credit dispute is settled against.
 * Seeded, because it predates the simulated window; the totals shown on the
 * surface are computed from these events rather than restated beside them.
 */
export const CLOCK_AUDIT: { workObjectRef: string; sla: string; targetMins: number; events: ClockEvent[] } = {
  workObjectRef: 'INC0482874',
  sla: 'P1 resolution, Digital Workplace Services',
  targetMins: 60,
  events: [
    { at: '2027-02-14T08:12:00Z', event: 'clock_start', detail: 'Priority P1 validated by Sentinel; matrix v3 impact×urgency — a Kearney partner locked out ahead of a client meeting', evidence: 'ev_clk_0441' },
    { at: '2027-02-14T08:24:00Z', event: 'pause', detail: 'awaiting_client — requester asked to confirm the device serial number tied to the locked account. Client acknowledgement recorded.', evidence: 'ev_clk_0442' },
    { at: '2027-02-14T08:41:00Z', event: 'resume', detail: 'Client responded, and the pause sat within the cap agreed for this work object.', evidence: 'ev_clk_0443' },
    { at: '2027-02-14T08:49:00Z', event: 'reclassify', detail: 'P1 → P1 (no change). Reclassification attempt logged and separately reported.', evidence: 'ev_clk_0444' },
    { at: '2027-02-14T09:02:00Z', event: 'clock_stop', detail: 'Resolution confirmed by verification pack euc_checkin_v1.', evidence: 'ev_clk_0445' },
  ],
}

/** Running clock in minutes — wall time between start and stop, less every pause. */
export function clockElapsedMins(audit = CLOCK_AUDIT): number {
  const ms = (i: number) => new Date(audit.events[i].at).getTime()
  const start = audit.events.findIndex((e) => e.event === 'clock_start')
  const stop = audit.events.findIndex((e) => e.event === 'clock_stop')
  if (start < 0 || stop < 0) return 0

  let paused = 0
  let pausedAt: number | null = null
  for (let i = start; i <= stop; i++) {
    if (audit.events[i].event === 'pause') pausedAt = ms(i)
    else if (audit.events[i].event === 'resume' && pausedAt !== null) {
      paused += ms(i) - pausedAt
      pausedAt = null
    }
  }
  return Math.round((ms(stop) - ms(start) - paused) / 60_000)
}

/** Total time the clock was stopped, in minutes. */
export function clockPausedMins(audit = CLOCK_AUDIT): number {
  const ms = (i: number) => new Date(audit.events[i].at).getTime()
  let paused = 0
  let pausedAt: number | null = null
  for (let i = 0; i < audit.events.length; i++) {
    if (audit.events[i].event === 'pause') pausedAt = ms(i)
    else if (audit.events[i].event === 'resume' && pausedAt !== null) {
      paused += ms(i) - pausedAt
      pausedAt = null
    }
  }
  return Math.round(paused / 60_000)
}
