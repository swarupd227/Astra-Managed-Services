/* Report catalog, semantic-layer metrics and worked query examples. Seeded records. */

export const CATALOG = [
  { cadence: 'Daily', name: 'Ops Day Report', audience: 'SDM, shift leads, client ops', contents: 'Volumes, P1/P2 narrative, SLA jeopardy, agent activity summary, exceptions', signed: false },
  { cadence: 'Daily', name: 'Shift Handover Pack', audience: 'Shift leads', contents: 'Board state, open risks, in-flight gated runs, watch items', signed: false },
  { cadence: 'Weekly', name: 'Service Performance Report', audience: 'Client service owner', contents: 'SLA/XLA attainment WTD, backlog and ageing, problem and elimination progress, upcoming changes', signed: false },
  { cadence: 'Weekly', name: 'Autonomy & Agent Report', audience: 'Client service owner, AI engineering', contents: 'Promotions and demotions with evidence, sampled-review results, incident-free run streaks', signed: false },
  { cadence: 'Monthly', name: 'Governance Pack (master)', audience: 'Service governance board', contents: 'Service, economics, autonomy, innovation, risks, decisions, obligations — opening with the decision sheet', signed: false },
  { cadence: 'Monthly', name: 'SLA Compliance & Credits Statement', audience: 'Commercial, client vendor management', contents: 'Attainment matrix, breach register with clock audits, credit and earnback computation', signed: true },
  { cadence: 'Monthly', name: 'Glidepath & Transform Statement', audience: 'Commercial, CFO office', contents: 'Baseline versus actual decomposition, banked savings, credit ledger movements', signed: true },
  { cadence: 'Monthly', name: 'Exhibit O-1 Currency Report', audience: 'Client AI officer, audit', contents: 'Registry against served models for the period, every model-change notice with its clock, registry revisions and the red-team, bias and drift results that gate promotion', signed: true },
  { cadence: 'Monthly', name: 'TokenOps & AI Economics', audience: 'Client IT finance, governance', contents: 'Model spend by tower and workflow, spend-versus-displaced-cost ratio, optimisation actions taken', signed: false },
  { cadence: 'Monthly', name: 'CSAT / XLA Report', audience: 'Service governance', contents: 'Experience metrics, friction index, survey verbatims themed by Herald, improvement actions', signed: false },
  { cadence: 'Quarterly', name: 'Executive QBR Pack', audience: 'Client executives', contents: 'Outcome commitments status, value story, innovation showcase, next-quarter autonomy plan', signed: true },
  { cadence: 'Quarterly', name: 'Risk, Compliance & Audit Report', audience: 'Risk and compliance, auditors', contents: 'Evidence-chain attestations, policy changes, access reviews, control test results, regulator-ready annex', signed: true },
  { cadence: 'Quarterly', name: 'Continuous Improvement & Innovation', audience: 'Joint innovation council', contents: 'Funnel: ideas, funded items, delivered value verified, flywheel coupling metrics', signed: false },
  { cadence: 'On demand', name: 'Major Incident PIR', audience: 'All stakeholders', contents: 'Auto-assembled timeline, root cause, actions, prevention entries created', signed: false },
  { cadence: 'On demand', name: 'Benchmark & Trend Studies', audience: 'Client strategy', contents: 'Estate trends against anonymised cross-client patterns — opt-in, aggregate only', signed: false },
]

export const METRICS = [
  { name: 'sla_attainment', grain: 'tower × measure × month', clock: 'client_biz_hours(America/Chicago), pauses per contract', source: 'SLA engine + Evidence Chain clock records' },
  { name: 'banked_savings_hours', grain: 'tower × demand class × quarter', clock: 'banked on verification-window close', source: 'Baseline & Glidepath Ledger' },
  { name: 'autonomy_eligible_volume', grain: 'tower × month', clock: 'evaluated at policy decision time', source: 'Policy engine decisions + Service Graph' },
  { name: 'cost_per_resolved_work_object', grain: 'demand class × month', clock: 'metered per model call', source: 'TokenOps ledger' },
  { name: 'capacity_credits_available', grain: 'tower × quarter', clock: 'accrual on banking; expiry after two quarters', source: 'Transform Ledger' },
  { name: 'xla_friction_index', grain: 'tower × month', clock: 'closure feedback window', source: 'XLA instrumentation' },
]

export const SAMPLE_ANSWERS: { q: string; metric: string; filters: string[]; answer: string; evidence: string }[] = [
{
    q: 'show P2 MTTR for security vs last quarter, excluding the MI week',
    metric: 'incident_mttr (governed) · grain: tower × priority × period',
    filters: ['tower = twr_secops', 'priority = P2', 'period = 2027-Q1 vs 2026-Q4', 'exclude: declared_MI window 2027-01-19 → 2027-01-26'],
    answer: 'P2 MTTR on Infrastructure — Security is 68 minutes for 2027-Q1 against 141 minutes in 2026-Q4 — a 51.8% reduction. The exclusion removed 14 work objects from the current period and 0 from the comparison period.',
    evidence: 'ev_mtr_q1_secops',
  },
  {
    q: 'how much of the glidepath came from elimination rather than automation',
    metric: 'banked_savings_hours (governed) · grain: attribution × quarter',
    filters: ['period = contract to date', 'group by attribution'],
    answer: 'Of hours banked to date, elimination accounts for 44%, automation 31%, acceleration 17% and avoidance 8%. Avoidance is discounted 60% before entering the ledger, per the commercial schedule.',
    evidence: 'ev_gp_attrib_rollup',
  },
  {
    q: 'what is our agent error rate per thousand autonomous actions',
    metric: 'agent_attributable_sev_incidents (governed) · grain: per 1,000 autonomous actions',
    filters: ['period = trailing 12 months', 'scope = L3 and L4 executions'],
    answer: '0.31 agent-attributable severity incidents per 1,000 autonomous actions, trending down from 0.58 a year ago. Two incidents in the period, both compensated automatically, both triggering immediate demotion.',
    evidence: 'ev_agent_safety_12m',
  },
]
