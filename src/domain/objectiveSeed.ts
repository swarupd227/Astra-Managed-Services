import type { Objective } from './objectives'

/**
 * The engagement's objectives, as the client stated them.
 *
 * Estate data, not platform logic: every engagement states objectives, and
 * the platform's job is to hold them, evidence them, and be honest where it
 * cannot. Statements are verbatim; the mapping to measures is a proposal
 * until a named client owner accepts it.
 */
export const OBJECTIVES: Objective[] = [
  {
    id: 'obj_ai_ops',
    statement:
      'AI-Enabled Operations: leverage automation, artificial intelligence, and modern service management capabilities to reduce manual effort, improve service quality, accelerate resolution times, and drive cost savings and operational efficiencies across the IT environment.',
    source: 'RFP Instructions §2.4 — primary objective 1',
    owner: 'E. Whitfield (CIO)',
    horizon: 'Contract term, reviewed quarterly',
    measures: [
      { id: 'om_ai_effort', label: 'Manual effort removed by automation', source: { kind: 'glidepath_banked', attribution: 'automation' }, direction: 'up' },
      { id: 'om_ai_eligible', label: 'Volume eligible for autonomous handling', source: { kind: 'tower_avg', field: 'autonomyEligibleVolume' }, target: 35, direction: 'up' },
      { id: 'om_ai_p1', label: 'Resolution time held at target (P1, Application Dev & Integration)', source: { kind: 'sla', id: 'sla_apps_p1' }, direction: 'up' },
      { id: 'om_ai_unitcost', label: 'Model spend against human cost displaced', source: { kind: 'spend_ratio' }, target: 6, direction: 'down' },
    ],
    servedBy: {
      demandClasses: ['dc_pwd_reset', 'dc_triple_av', 'dc_access_recert'],
      transformAllocations: ['ta_019', 'ta_044'],
    },
    state: 'proposed',
    gaps: [],
  },
  {
    id: 'obj_strategic_focus',
    statement:
      'Enable Strategic Focus for KNet: transition routine operational activities to a partner-led model, allowing KNet resources to focus on strategic priorities, business enablement, consultant productivity, digital innovation, cybersecurity, and emerging technology initiatives.',
    source: 'RFP Instructions §2.4 — primary objective 2',
    owner: 'E. Whitfield (CIO)',
    horizon: 'Through transition and the first two contract years',
    measures: [
      {
        id: 'om_focus_none',
        label: 'Client staff hours returned to strategic work',
        source: {
          kind: 'none',
          why: 'The glidepath measures effort displaced from the managed-service baseline — the provider\'s hours, not the retained organisation\'s. Hours returned to the client\'s own team are a different baseline, and no feed for them exists.',
        },
        direction: 'up',
      },
      {
        id: 'om_focus_proxy',
        label: 'Total effort removed from the run model',
        source: { kind: 'glidepath_banked' },
        direction: 'up',
        proxy: true,
        proxyNote: 'Stands in for client hours released. It measures provider-side effort removed, which is related to but not the same as capacity returned to KNet. Accepting it as evidence for this objective is the client\'s judgement, not the platform\'s.',
      },
    ],
    servedBy: { demandClasses: ['dc_pwd_reset', 'dc_sw_provision', 'dc_access_recert'] },
    state: 'proposed',
    gaps: [
      'No retained-organisation baseline: the platform holds the managed-service baseline only.',
      'No feed of KNet time allocation, so "focus shifted to strategic work" cannot be evidenced here — only inferred from what the service absorbed.',
    ],
  },
  {
    id: 'obj_modernization',
    statement:
      'Technology Modernization: support the transition from legacy technologies and on-premises infrastructure to modern, cloud-based platforms, accelerate modernization, simplify the technology environment, and enable a more agile operating model.',
    source: 'RFP Instructions §2.4 — primary objective 3',
    owner: 'R. Castellano (Client Service Owner — Applications)',
    horizon: 'Three years, tracked against the migration programme',
    measures: [
      { id: 'om_mod_workday', label: 'Effort still tied to the HCM migration', source: { kind: 'demand_class', id: 'dc_workday_migration' }, direction: 'down' },
      { id: 'om_mod_legacy', label: 'Effort still tied to the retired-but-live time-entry application', source: { kind: 'demand_class', id: 'dc_iem_ghost' }, direction: 'down' },
      {
        id: 'om_mod_burndown',
        label: 'Estate simplification against plan',
        source: {
          kind: 'none',
          why: 'There is no programme object with a target end-state and a burn-down. Retirement dates live as free text on graph-node attributes, so "on track to simplify" cannot be answered — only "how much demand does this legacy thing still cause".',
        },
        direction: 'down',
      },
    ],
    servedBy: { demandClasses: ['dc_workday_migration', 'dc_iem_ghost', 'dc_shadow_app'], transformAllocations: ['ta_007'] },
    state: 'proposed',
    gaps: [
      'No migration or programme object: a target end-state, its milestones and a burn-down cannot be represented.',
      'Estate simplification has no measure — no count of applications, interfaces or hosts retired against plan.',
    ],
  },
  {
    id: 'obj_supplier_innovation',
    statement:
      "Leverage Supplier Innovation: utilize the Supplier's tools, platforms, automation capabilities, and industry expertise to accelerate modernization, improve operational maturity, and continuously optimize service delivery.",
    source: 'RFP Instructions §2.4 — primary objective 4',
    owner: 'J. Whitcombe (Commercial / Finance Manager)',
    horizon: 'Continuous, reported at each governance forum',
    measures: [
      { id: 'om_inn_value', label: 'Innovation value realised and verified', source: { kind: 'innovation_verified' }, direction: 'up' },
      { id: 'om_inn_accel', label: 'Effort removed through acceleration rather than headcount', source: { kind: 'glidepath_banked', attribution: 'acceleration' }, direction: 'up' },
    ],
    servedBy: { transformAllocations: ['ta_036', 'ta_044'] },
    state: 'proposed',
    gaps: [],
  },
  {
    id: 'obj_cost_scalability',
    statement:
      'Cost Efficiency and Scalability: create a flexible and efficient operating model that delivers measurable productivity improvements and cost optimization while supporting future business growth and evolving technology requirements.',
    source: 'RFP Instructions §2.4 — primary objective 5',
    owner: 'J. Whitcombe (Commercial / Finance Manager)',
    horizon: 'Contract term, against the countersigned baseline',
    measures: [
      { id: 'om_cost_glidepath', label: 'Glidepath actual against contracted', source: { kind: 'glidepath_trajectory' }, direction: 'down' },
      { id: 'om_cost_ratio', label: 'Cost to deliver the automation itself', source: { kind: 'spend_ratio' }, target: 6, direction: 'down' },
      {
        id: 'om_cost_scale',
        label: 'Headroom for growth in demand',
        source: {
          kind: 'none',
          why: 'Nothing models demand growth against capacity headroom. The autonomy forecast projects the autonomy trajectory, not volume, so "supports future growth" is not answerable from platform records.',
        },
        direction: 'up',
      },
    ],
    servedBy: { transformAllocations: ['ta_012', 'ta_025'] },
    state: 'proposed',
    gaps: ['No demand forecast and no capacity-headroom measure, so the scalability half of this objective is unevidenced.'],
  },
  {
    id: 'obj_employee_experience',
    statement:
      'Enhanced Employee Experience: improve service responsiveness, increase self-service capabilities, reduce employee friction points, and provide a modern support experience across all locations and working models.',
    source: 'RFP Instructions §2.4 — primary objective 6',
    owner: 'P. Lindegaard (Infrastructure & Digital Workplace Lead)',
    horizon: 'Continuous, with experience measures reported monthly',
    measures: [
      { id: 'om_ex_ttp', label: 'Time to productive for a new joiner', source: { kind: 'sla', id: 'xla_euc_ttp' }, direction: 'up' },
      { id: 'om_ex_nps', label: 'Overall satisfaction', source: { kind: 'sla', id: 'xla_nps' }, direction: 'up' },
      { id: 'om_ex_fulfil', label: 'Standard request fulfilment against target', source: { kind: 'sla', id: 'sla_euc_req' }, direction: 'up' },
      { id: 'om_ex_lockout', label: 'Friction removed from the largest single demand class', source: { kind: 'demand_class', id: 'dc_pwd_reset' }, direction: 'down' },
      {
        id: 'om_ex_deflection',
        label: 'Demand deflected to self-service',
        source: {
          kind: 'none',
          why: 'Avoidance is recorded as an attribution once work is closed, but there is no deflection rate against a target, and no end-user-facing surface — every screen here serves the provider or client IT, never the consultant. Experience is measured, not served.',
        },
        direction: 'up',
      },
    ],
    servedBy: { demandClasses: ['dc_pwd_reset', 'dc_onedrive_sync', 'dc_sw_provision'], transformAllocations: ['ta_019'] },
    state: 'proposed',
    gaps: [
      'No self-service deflection rate against a target, which the service description explicitly asks for.',
      'No end-user-facing surface: the platform can measure the consultant\'s experience but cannot yet be part of it.',
    ],
  },
]
