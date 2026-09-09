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
      {
        id: 'om_mod_count',
        label: 'Systems under support',
        source: { kind: 'inventory', field: 'under_support' },
        direction: 'down',
      },
      {
        id: 'om_mod_record',
        label: 'Where the client\'s own record matches what we observe',
        source: { kind: 'inventory', field: 'record_accuracy' },
        target: 90,
        direction: 'up',
      },
    ],
    servedBy: { demandClasses: ['dc_workday_migration', 'dc_iem_ghost', 'dc_shadow_app'] },
    state: 'proposed',
    gaps: [
      'The burn-down counts only scope items the platform can evidence are gone. An item declared finished at a change board with no decommission record behind it stays on the remaining count, and the two curves are reported separately rather than reconciled.',
      'Zero observed traffic is not evidence of decommission. One item rests on it today, and a system nobody used this quarter is not a system that has been switched off.',
      'The count of systems under support is a floor rather than a total. Several applications in it were found rather than declared, and shadow IT is by definition what nobody has found — so any modernisation percentage against this denominator is flattered by an unknown amount.',
      'The client\'s own application record and this platform disagree about a quarter of the estate, including one system listed as retired that carries 658 incidents a year. Progress reported against their record and progress reported against ours are not the same number, and neither is authoritative on its own.',
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
        id: 'om_cost_absorption',
        label: 'Growth absorbed without a proportional rise in effort',
        source: { kind: 'growth', field: 'absorption' },
        direction: 'up',
      },
      {
        id: 'om_cost_headroom',
        label: 'Forecast growth the service could take at flat effort',
        source: { kind: 'growth', field: 'headroom' },
        target: 60,
        direction: 'up',
      },
    ],
    servedBy: { },
    state: 'proposed',
    gaps: [
      'Absorption is untested rather than achieved. All of the business-caused growth sits in one demand class, so a verdict would rest on a single causal judgement. What the record does show is the service removing work, which is a different claim from absorbing growth.',
      'Roughly two thirds of rising volume is not the client growing — it is transition friction, service defects and the AI estate itself. Those are reported separately and never summed into a growth figure.',
      'Effort stands in for headcount. The contract speaks of headcount and the ledgers hold hours, so a service absorbing growth by working the same people harder would look identical here.',
      'One business driver is declared. Office footprint and acquisition activity are named and unquantified, and they drive network and identity demand the headroom figure does not touch — a single acquisition would move the estate more than a year of headcount growth.',
    ],
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
      'The platform now faces the end user, but it still cannot measure one. Every experience figure shown to a consultant is a cohort figure, and there is no per-person experience record — so "how was your week" remains a question the platform can put to somebody and cannot answer about them.',
      'Self-service is offered only where the elimination behind it is verified, which today is one of the five things this consultant repeatedly raises. The other four are candidates, so the surface is honest about still needing a person and correspondingly thin.',
      'There is no identity integration. The consumer view is defined by a declared list of systems a person depends on rather than read from a directory, so coverage beyond a named individual is not evidenced.',
    ],
  },
]
