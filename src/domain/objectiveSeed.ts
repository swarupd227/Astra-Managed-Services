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
        id: 'om_focus_released',
        label: 'KNet staff released from run-the-business work',
        source: { kind: 'client_effort', field: 'released' },
        direction: 'up',
      },
      {
        id: 'om_focus_strategic',
        label: 'KNet staff now on strategic work',
        source: { kind: 'client_effort', field: 'strategic_gained' },
        direction: 'up',
      },
      {
        id: 'om_focus_proxy',
        label: 'Total effort removed from the run model',
        source: { kind: 'glidepath_banked' },
        direction: 'up',
        proxy: true,
        proxyNote: 'Corroborates the declarations above rather than standing in for them. It measures provider-side effort removed, which is related to but not the same as capacity returned to KNet — a fall here can occur with no change at all to how KNet\'s people spend their week.',
      },
    ],
    servedBy: { demandClasses: ['dc_pwd_reset', 'dc_sw_provision', 'dc_access_recert'] },
    state: 'proposed',
    gaps: [
      'The two figures above are KNet\'s own declarations about KNet\'s own staff. The platform holds them, ages them and shows how each was arrived at; it does not measure them and cannot verify them.',
      'Two of the four functions have not re-attested inside the 90-day window, and their figures are excluded from the headline rather than carried forward.',
      'Security Operations declined a timesheet extract, so its split rests on a manager\'s estimate. It is reported unadjusted and is not evidence of the same kind as the two timesheet-based functions.',
      'Released and redeployed are separate facts. Where the two do not match, the difference is attrition, vacancy or reassignment elsewhere — indistinguishable from here.',
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
        label: 'Estate simplification — scope remaining against plan',
        source: { kind: 'programme_burndown', id: 'prg_estate_simplification' },
        direction: 'down',
      },
    ],
    servedBy: { demandClasses: ['dc_workday_migration', 'dc_iem_ghost', 'dc_shadow_app'] },
    state: 'proposed',
    gaps: [
      'The burn-down counts only scope items the platform can evidence are gone. An item declared finished at a change board with no decommission record behind it stays on the remaining count, and the two curves are reported separately rather than reconciled.',
      'Zero observed traffic is not evidence of decommission. One item rests on it today, and a system nobody used this quarter is not a system that has been switched off.',
      'This is a burn-down of a named scope, not a count of the estate. "Reducing the number of systems under support" still has no denominator: there is no application inventory here, so the platform can say eight things were in scope and cannot say what fraction of the estate that is.',
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
    servedBy: { },
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
    servedBy: { },
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
        label: 'Demand no longer arriving — the attributed fall only',
        source: { kind: 'deflection_rate', attributedOnly: true },
        direction: 'up',
        target: 20,
      },
      {
        id: 'om_ex_deflection_total',
        label: 'Total fall against the agreed baselines',
        source: { kind: 'deflection_rate', attributedOnly: false },
        direction: 'up',
        proxy: true,
        proxyNote: 'The larger figure and the weaker one. It includes arrivals that stopped for reasons nothing in the ledger can name, which is a question about those classes rather than evidence that anything was deflected.',
      },
    ],
    servedBy: { demandClasses: ['dc_pwd_reset', 'dc_onedrive_sync', 'dc_sw_provision'] },
    state: 'proposed',
    gaps: [
      'Most of the observed fall is unattributed. The two rates above are reported separately so the gap between them is visible, and only the attributed one should be quoted as deflection.',
      'One class has too short an observation window to state a rate at all, and is withheld rather than annualised from six weeks.',
      'One baseline was estimated at transition rather than observed, and one covers less than a full seasonal cycle. A wrong baseline moves the rate more than anything actually done.',
      'Attributed arrivals are derived from attributed hours at the class\'s average cost per arrival. That is a derivation, not a count: it assumes the arrivals removed cost what an average arrival costs.',
      'No end-user-facing surface: the platform can measure the consultant\'s experience but cannot yet be part of it.',
    ],
  },
]
