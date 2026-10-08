import { Rng } from './rng'
import { ENGAGEMENT, ENGAGEMENT_BY_ID, type ContractObligation } from './engagement'
import { WORK_OBJECTS } from './workSeed'
import type {
  Decision, DemandClassRec, GlidepathEntry, InnovationItem, Obligation, SlaSpec, TokenSeries, TransformLedger,
} from './types'

const rng = new Rng(77341)
const NOW = new Date('2027-02-18T09:42:00.000Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString()
const daysAhead = (d: number) => new Date(NOW.getTime() + d * 86400000).toISOString()

/* ------------------------------ Demand classes ------------------------------ */

const CURATED_CLASSES: DemandClassRec[] = [
  { id: 'dc_cert_expiry', name: 'Certificate expiry incidents', tower: 'twr_payments', volumeYr: 31, hoursYr: 47, trend: -0.88, cause: 'No certificate lifecycle automation across the Mulesoft/FOCUS legacy VM estate (210 graph nodes)', eliminationState: 'candidate', projectedRemoval: 0.92, npv36m: 41000, effortDays: 6, proposalType: 'automation' },
  { id: 'dc_mulesoft_soleowner', name: 'Mulesoft single-owner bridge risk', tower: 'twr_payments', volumeYr: 18, hoursYr: 54, trend: -0.05, cause: 'The Salesforce ↔ SAP integration hub has exactly one named user; the bridge runs unmonitored whenever they are unavailable', eliminationState: 'candidate', projectedRemoval: 0.55, npv36m: 96000, effortDays: 28, proposalType: 'engineering_fix' },
  { id: 'dc_iem_ghost', name: 'IEM still live despite "retired" status', tower: 'twr_payments', volumeYr: 658, hoursYr: 410, trend: -0.03, cause: 'IEM is marked replaced by Concur in the client\'s own application inventory, but consultants still submit time through it — the highest-volume live app in the tower', eliminationState: 'candidate', projectedRemoval: 0.5, npv36m: 168000, effortDays: 45, proposalType: 'modernisation' },
  { id: 'dc_batch_overrun', name: 'Core batch window overrun', tower: 'twr_core', volumeYr: 62, hoursYr: 165, trend: -0.12, cause: 'Contention between the SAP S/4HANA nightly close and the PeopleSoft → Workday migration extract', eliminationState: 'candidate', projectedRemoval: 0.7, npv36m: 96000, effortDays: 21, proposalType: 'engineering_fix' },
  { id: 'dc_workday_migration', name: 'PeopleSoft → Workday migration defects', tower: 'twr_core', volumeYr: 84, hoursYr: 224, trend: 0.06, cause: 'PeopleSoft HCM retires August 2027; mapping errors surface on every wave of the Workday cutover', eliminationState: 'candidate', projectedRemoval: 0.4, npv36m: 118000, effortDays: 60, proposalType: 'modernisation' },
  { id: 'dc_mq_depth', name: 'Integration queue depth alarms', tower: 'twr_core', volumeYr: 204, hoursYr: 112, trend: -0.44, cause: 'Static alarm thresholds on the SAP ↔ ServiceNow bridge unrelated to the client\'s business calendar', eliminationState: 'candidate', projectedRemoval: 0.8, npv36m: 61000, effortDays: 7, proposalType: 'policy_change' },
  { id: 'dc_pipeline_fail', name: 'Pipeline failure — upstream schema drift', tower: 'twr_dataplat', volumeYr: 156, hoursYr: 288, trend: -0.52, cause: 'No enforced data contract on the Azure Data Factory customer/HCM feed', eliminationState: 'candidate', projectedRemoval: 0.78, npv36m: 148000, effortDays: 18, proposalType: 'engineering_fix' },
  { id: 'dc_dq_null_ratio', name: 'Data-quality null-ratio breaches', tower: 'twr_dataplat', volumeYr: 87, hoursYr: 131, trend: -0.19, cause: 'DQ rules authored per-report rather than per-asset across the datamart and downstream gold tables', eliminationState: 'candidate', projectedRemoval: 0.65, npv36m: 54000, effortDays: 12, proposalType: 'automation' },
  { id: 'dc_oracle_blindspot', name: 'Oracle datamart blind spot', tower: 'twr_dataplat', volumeYr: 40, hoursYr: 60, trend: 0.2, cause: 'A Tier-1, 7,000-user Oracle datamart carries zero incident telemetry; nothing can be root-caused against it today', eliminationState: 'candidate', projectedRemoval: 0.3, npv36m: 42000, effortDays: 15, proposalType: 'automation' },
  { id: 'dc_node_pressure', name: 'Azure VM memory pressure', tower: 'twr_cloud', volumeYr: 240, hoursYr: 160, trend: -0.71, cause: 'Absent autoscaling on workloads mid-migration out of the Chicago DC', eliminationState: 'candidate', projectedRemoval: 0.9, npv36m: 88000, effortDays: 5, proposalType: 'automation' },
  { id: 'dc_tf_drift', name: 'Terraform state drift findings', tower: 'twr_cloud', volumeYr: 312, hoursYr: 208, trend: -0.28, cause: 'Console changes outside the pipeline during the Chicago DC → Azure exit', eliminationState: 'candidate', projectedRemoval: 0.75, npv36m: 74000, effortDays: 10, proposalType: 'policy_change' },
  { id: 'dc_pwd_reset', name: 'Password / MFA lockout resets', tower: 'twr_euc', volumeYr: 2484, hoursYr: 745, trend: -0.2, cause: 'No self-service path for post-MFA-re-enrolment lockouts — the largest single incident subcategory across 9,817 endpoints', eliminationState: 'candidate', projectedRemoval: 0.75, npv36m: 312000, effortDays: 18, proposalType: 'self_service' },
  { id: 'dc_onedrive_sync', name: 'OneDrive / M365 sync failures', tower: 'twr_euc', volumeYr: 926, hoursYr: 540, trend: 0.18, cause: 'OneDrive sync breaks following Cisco Zero-Trust re-enrolment; 926 incidents/year and rising', eliminationState: 'candidate', projectedRemoval: 0.5, npv36m: 121000, effortDays: 20, proposalType: 'engineering_fix' },
  { id: 'dc_sw_provision', name: 'Catalog software provisioning', tower: 'twr_euc', volumeYr: 2140, hoursYr: 784, trend: -0.83, cause: 'Manual approval hop for pre-approved catalog items', eliminationState: 'candidate', projectedRemoval: 0.88, npv36m: 196000, effortDays: 8, proposalType: 'automation' },
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

/**
 * The ledger is complete by construction. Live work can carry a demand class
 * nobody has yet costed, and until now such a class did not exist to the
 * elimination loop, the objective measures or the fabrication detector —
 * forty classes and most of the live queue were invisible to all three.
 *
 * A class derived here is marked sampled. Its annual volume and effort stay
 * at zero rather than being extrapolated from a queue sample about a day
 * long, so every population-weighted figure is unchanged. The class becomes
 * visible and eliminable, and the number of items seen is kept instead.
 */
function sampledClasses(curated: DemandClassRec[]): DemandClassRec[] {
  const known = new Set(curated.map((d) => d.id))
  const seen = new Map<string, { name: string; tower: string; n: number }>()
  for (const w of WORK_OBJECTS) {
    if (known.has(w.demandClass)) continue
    const row = seen.get(w.demandClass)
    if (row) row.n++
    else seen.set(w.demandClass, { name: w.title.split(' — ')[0], tower: w.tower, n: 1 })
  }
  return [...seen].map(([id, r]) => ({
    id,
    name: r.name,
    tower: r.tower,
    volumeYr: 0,
    hoursYr: 0,
    trend: 0,
    cause: '',
    eliminationState: 'none' as const,
    volumeBasis: 'sampled' as const,
    sampleCount: r.n,
  }))
}

export const DEMAND_CLASSES: DemandClassRec[] = [...CURATED_CLASSES, ...sampledClasses(CURATED_CLASSES)]

/* ---------------------------- Glidepath ledger ------------------------------ */

/**
 * Every hour the platform claims to have taken out of the baseline.
 *
 * It starts empty, and the only thing that fills it is a verified claim: a
 * demand class whose volume actually decayed, measured against its trailing
 * mean, over a verification window that actually elapsed. There were 83
 * entries here, derived from each class's *projected* removal — a projection
 * dressed as a bank. Thirteen per cent of the baseline read as delivered and
 * the executive sparkline climbed, on nothing but arithmetic over an
 * assumption.
 *
 * A claim has to survive its window before it may be banked, so an empty
 * ledger is the correct state at the start of a contract: nothing has had
 * time to be true yet.
 */
export const GLIDEPATH: GlidepathEntry[] = []

export const bankedHours = (tower?: string) =>
  GLIDEPATH.filter((g) => g.state === 'banked' && (!tower || g.tower === tower)).reduce((s, g) => s + g.hoursSaved, 0)

export const verifyingHours = (tower?: string) =>
  GLIDEPATH.filter((g) => g.state === 'verifying' && (!tower || g.tower === tower)).reduce((s, g) => s + g.hoursSaved, 0)

/* ---------------------------- Transform ledgers ----------------------------- */

/**
 * Reinvestment credits: banked savings turned into funded work.
 *
 * The credit arithmetic is the contract's (a reinvest/price-reduction split
 * per tower), but the inputs are measurements — hours banked, credits
 * accrued, credits consumed, and the yield each allocation actually
 * returned. Five towers of those were written here, down to a frozen
 * allocation with a clause reference and thirteen funded items reporting
 * yields against their promises. None of it had been earned, allocated or
 * returned.
 *
 * A tower appears once it has banked something in the glidepath ledger,
 * which is the only thing a credit can be struck from.
 */
export const TRANSFORM: TransformLedger[] = []

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

/**
 * What the platform spent on models, and how it routed to spend it.
 *
 * All three registers are measurements of our own operation, so all three
 * start empty. There were thirty days of daily spend here, drawn from a
 * random walk with a weekend dip and a compounding efficiency trend; a
 * routing table reporting the share and quality delta of seven reasoning
 * steps and the date each was last refitted; and four distillation
 * candidates with volumes, scores and verdicts. The spend chart, the cost per
 * resolved work object and the cache-hit trend were all drawn from the first
 * of those, and the change log carried a routing refit for each row of the
 * second.
 */
export const TOKEN_SERIES: TokenSeries[] = []

export const ROUTING_TABLE: {
  step: string
  tier: string
  share: number
  qualityDelta: number
  costPer1k: number
  refitAt: string
}[] = []

export const DISTILLATION_CANDIDATES: {
  skill: string
  step: string
  volume30d: number
  frontierScore: number
  smallScore: number
  delta: number
  verdict: string
  projectedSaveUsd30d: number
}[] = []

/* ------------------------------- Governance --------------------------------- */

/**
 * What the governance forums decided, what the contract obliges, and what has
 * been proposed to improve the service.
 *
 * Eight decisions were written here, each with a forum, a date, a named
 * client owner, the inputs it weighed, a condition and a follow-through
 * state — minutes for meetings that never sat. Ten obligations carried an
 * owner, a due date and a red/amber/green state. Eleven innovation items
 * carried sponsors, hypotheses and realised value, including two that had
 * 'failed' and one that returned $412,000.
 *
 * Decisions are written by the platform when a confirmation is taken, so the
 * register fills itself. Innovation items are raised, assessed, funded and
 * verified through the recommendation flow. The obligations now come from the
 * engagement's own terms in the database — see `OBLIGATIONS` below.
 */
export const DECISIONS: Decision[] = []

/**
 * What the contract obliges, recurring.
 *
 * Read from the engagement's terms rather than written here. The contract
 * states what is owed, how often, what evidence discharges it and when it
 * first fell due; the next due date follows from the cadence, and the state
 * follows from that date. Nobody's name is attached, because an owner is an
 * assignment and not a term — the ten that used to sit here each carried one,
 * along with a RAG state, which made a hand-written table read as a live
 * control.
 */
export const OBLIGATIONS: Obligation[] = readObligations()

/** Rolls a first-due date forward by its cadence until it is in the future. */
function nextDue(firstDue: string, cadence: ContractObligation['cadence'], now: Date): Date {
  const months = cadence === 'Monthly' ? 1 : cadence === 'Quarterly' ? 3 : cadence === 'Half-yearly' ? 6 : 12
  const d = new Date(`${firstDue}T00:00:00.000Z`)
  // A cadence that has not come round yet keeps its first date, which is how
  // an obligation can legitimately be owed before the service has run once.
  while (d.getTime() <= now.getTime()) d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

export function readObligations(engagementId?: string, now = NOW): Obligation[] {
  const e = engagementId ? ENGAGEMENT_BY_ID[engagementId] : ENGAGEMENT
  if (!e) return []
  return e.obligations.map((o) => {
    const due = nextDue(o.firstDue, o.cadence, now)
    const daysLeft = Math.round((due.getTime() - now.getTime()) / 86_400_000)
    return {
      id: o.id,
      title: o.title,
      cadence: o.cadence,
      evidenceRequirement: o.evidenceRequirement,
      dueAt: due.toISOString(),
      // Derived from the clock alone. Whether the evidence has been produced
      // is a record the platform does not hold yet, so an obligation is never
      // reported green on the strength of nothing: it is amber once it is
      // close enough to need attention.
      state: daysLeft < 0 ? 'red' : daysLeft <= 14 ? 'amber' : 'green',
      owner: '',
      reference: o.reference,
    }
  })
}

export const INNOVATION: InnovationItem[] = []

/* ------------------------------- Clock audit -------------------------------- */

export interface ClockEvent {
  at: string
  event: 'clock_start' | 'pause' | 'resume' | 'reclassify' | 'clock_stop'
  detail: string
  evidence: string
}

export interface ClockAudit {
  workObjectRef: string
  sla: string
  targetMins: number
  events: ClockEvent[]
}

/**
 * The worked clock audit a credit dispute is settled against.
 *
 * Null until one has been produced. A five-event audit of INC0482874 used to
 * sit here — validated, paused for the client, resumed, reclassified,
 * resolved — and the SLA compliance drawer opened on it as the proof that the
 * clock could be reconstructed. The arithmetic over those events was real;
 * the incident was not.
 */
export const CLOCK_AUDIT: ClockAudit | null = null

/** Running clock in minutes — wall time between start and stop, less every pause. */
export function clockElapsedMins(audit: ClockAudit): number {
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
export function clockPausedMins(audit: ClockAudit): number {
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
