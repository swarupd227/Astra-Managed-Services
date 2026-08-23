import type { ActionClass, Role, ServiceLine } from './types'

/* --------------------------------------------------------------------------
   Action-class taxonomy (spec §7.2).
   Floors are platform minima. Client governance may tighten, never loosen.
   -------------------------------------------------------------------------- */

export const ACTION_CLASSES: ActionClass[] = [
  { id: 'AC-05', name: 'Read / collect diagnostics', reversibility: 'read_only', floor: 'autonomous', verificationPack: 'none', fourEyes: false, domain: 'Observe' },
  { id: 'AC-08', name: 'Correlate & classify event', reversibility: 'read_only', floor: 'autonomous', verificationPack: 'classification_agreement', fourEyes: false, domain: 'Observe' },
  { id: 'AC-12', name: 'Restart stateless workload', reversibility: 'self_healing', floor: 'supervised', verificationPack: 'health_probe_v4', fourEyes: false, domain: 'Infrastructure' },
  { id: 'AC-18', name: 'Scale within approved bounds', reversibility: 'reversible', floor: 'supervised', verificationPack: 'capacity_probe_v2', fourEyes: false, domain: 'Infrastructure' },
  { id: 'AC-24', name: 'Clear cache / flush pool', reversibility: 'self_healing', floor: 'autonomous', verificationPack: 'health_probe_v4', fourEyes: false, domain: 'Infrastructure' },
  { id: 'AC-31', name: 'Revert config to known-good', reversibility: 'reversible', floor: 'supervised', tier0Floor: 'approve_first', verificationPack: 'canary_slo_v6', fourEyes: false, domain: 'Change' },
  { id: 'AC-37', name: 'Apply code fix via CI/CD', reversibility: 'reversible', floor: 'approve_first', verificationPack: 'release_pack_v9', fourEyes: false, domain: 'Change' },
  { id: 'AC-41', name: 'Rotate certificate / secret', reversibility: 'reversible', floor: 'supervised', verificationPack: 'tls_probe_v3', fourEyes: false, domain: 'Security' },
  { id: 'AC-44', name: 'Schema migration', reversibility: 'compensable', floor: 'approve_first', verificationPack: 'dq_contract_v5', fourEyes: false, domain: 'Data' },
  { id: 'AC-49', name: 'Pipeline backfill / replay', reversibility: 'compensable', floor: 'approve_first', verificationPack: 'dq_contract_v5', fourEyes: false, domain: 'Data' },
  { id: 'AC-52', name: 'Patch wave (canaried)', reversibility: 'reversible', floor: 'supervised', verificationPack: 'patch_wave_v2', fourEyes: false, domain: 'Security' },
  { id: 'AC-58', name: 'IAM / entitlement change', reversibility: 'reversible', floor: 'approve_first', verificationPack: 'entitlement_diff_v3', fourEyes: true, domain: 'Security' },
  { id: 'AC-63', name: 'Network config change', reversibility: 'reversible', floor: 'supervised', tier0Floor: 'approve_first', verificationPack: 'reachability_v2', fourEyes: false, domain: 'Network' },
  { id: 'AC-66', name: 'EUC device / profile reset', reversibility: 'self_healing', floor: 'autonomous', verificationPack: 'euc_checkin_v1', fourEyes: false, domain: 'Workplace' },
  { id: 'AC-71', name: 'Data deletion / purge', reversibility: 'irreversible', floor: 'advise', verificationPack: 'n/a', fourEyes: true, domain: 'Data' },
  { id: 'AC-80', name: 'Spend-committing action', reversibility: 'bounded', floor: 'approve_first', verificationPack: 'budget_check_v2', fourEyes: false, domain: 'FinOps' },
]

export const AC = Object.fromEntries(ACTION_CLASSES.map((a) => [a.id, a])) as Record<string, ActionClass>

/* --------------------------------------------------------------------------
   Roles (spec §15.1). The role a user assumes changes navigation, home screen,
   approval rights and the density of what they are shown.
   -------------------------------------------------------------------------- */

export const ROLES: Role[] = [
  {
    id: 'sdm',
    title: 'Service Delivery Manager',
    org: 'artizent',
    person: 'R. Venkatesh',
    home: '/copilot',
    surfaces: ['transition', 'run', 'transform', 'governance', 'platform'],
    description: 'Owns tower delivery. Holds the approval pen for gated runs and the escalation path.',
    canApprove: true,
  },
  {
    id: 'resolver',
    title: 'Resolver Engineer (L2/L3)',
    org: 'artizent',
    person: 'A. Fernandes',
    home: '/copilot',
    surfaces: ['run', 'transition'],
    description: 'Works a queue where agents have already triaged, enriched and often drafted the fix.',
    canApprove: false,
  },
  {
    id: 'shiftlead',
    title: 'Shift Lead',
    org: 'artizent',
    person: 'M. Okonkwo',
    home: '/operate/shift',
    surfaces: ['run'],
    description: 'Queue health, SLA burn-down, human/agent load split, handover generation.',
    canApprove: true,
  },
  {
    id: 'mim',
    title: 'Major Incident Manager',
    org: 'artizent',
    person: 'D. Kowalski',
    home: '/operate/mim',
    surfaces: ['run', 'governance'],
    description: 'Declares and runs major incidents. Autonomy auto-caps to Advise while an MI is open.',
    canApprove: true,
  },
  {
    id: 'transition',
    title: 'Transition Lead',
    org: 'artizent',
    person: 'S. Iyer',
    home: '/transition/coverage',
    surfaces: ['transition', 'run', 'governance'],
    description: 'Runs estate ingestion through cutover; owns the §10.3 handover acceptance checks.',
    canApprove: true,
  },
  {
    id: 'sme',
    title: 'SME / Knowledge Verifier',
    org: 'client',
    person: 'P. Raghavan',
    home: '/transition/verify',
    surfaces: ['transition'],
    description: 'One assertion at a time: claim, provenance, evidence — approve, correct or reject.',
    canApprove: false,
  },
  {
    id: 'aieng',
    title: 'AI / Platform Engineer',
    org: 'artizent',
    person: 'L. Nakamura',
    home: '/atlas/fleet',
    surfaces: ['platform', 'run', 'governance'],
    description: 'Agent lifecycle, evaluation harnesses, policy authoring and simulation, TokenOps.',
    canApprove: true,
  },
  {
    id: 'exec',
    title: 'Client Executive (CIO)',
    org: 'client',
    person: 'H. Lindqvist',
    home: '/governance/executive',
    surfaces: ['governance', 'transform'],
    description: 'One page of service truth. Decisions awaiting them, and nothing they must dig for.',
    canApprove: true,
  },
  {
    id: 'serviceowner',
    title: 'Client Service Owner',
    org: 'client',
    person: 'T. Bergmann',
    home: '/governance/sla',
    surfaces: ['governance', 'run', 'transform'],
    description: 'Tower SLA clocks, obligations register, credit position, improvement backlog.',
    canApprove: true,
  },
  {
    id: 'commercial',
    title: 'Commercial / Finance Manager',
    org: 'client',
    person: 'C. Duval',
    home: '/governance/glidepath',
    surfaces: ['governance', 'transform'],
    description: 'Glidepath and Transform ledgers, credit worksheets, signed extracts for invoicing.',
    canApprove: false,
  },
  {
    id: 'auditor',
    title: 'Auditor / Risk & Compliance',
    org: 'client',
    person: 'N. Achebe',
    home: '/governance/evidence',
    surfaces: ['governance'],
    description: 'Read-only. Search any action, agent, decision or period; verify the hash chain; export.',
    canApprove: false,
    readOnly: true,
  },
  {
    id: 'clientteam',
    title: 'Client Engineer (co-delivery)',
    org: 'client',
    person: 'K. Mehta',
    home: '/operate/resolver',
    surfaces: ['run', 'transition'],
    description: 'Same queues and knowledge as Artizent engineers — capability transfer as a product feature.',
    canApprove: false,
  },
]

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<string, Role>

/* -------------------------------------------------------------------------- */

export const SERVICE_LINES: Record<ServiceLine, { name: string; short: string; blurb: string }> = {
  swpe: {
    name: 'Software & Product Engineering',
    short: 'SW&PE',
    blurb: 'L2/L3 application support, release and environment management, QE, tech-debt and modernisation.',
  },
  data: {
    name: 'Data & Analytics',
    short: 'D&A',
    blurb: 'Pipeline operations, data-quality stewardship, BI ops, lineage and compliance, AI-ready data products.',
  },
  agentic: {
    name: 'Agentic Enterprise',
    short: 'Agentic',
    blurb: 'Production operations of agent estates — ours and the client’s — under one governance regime.',
  },
  cloud: {
    name: 'Cloud & AI Ops',
    short: 'Cloud',
    blurb: 'Cloud, SRE, observability, EUC, network, security operations, resilience and FinOps.',
  },
}

export const AUTONOMY_LEVELS = [
  { level: 0, mode: 'manual' as const, label: 'L0 Manual', meaning: 'Platform observes and records only; humans execute.' },
  { level: 1, mode: 'advise' as const, label: 'L1 Advise', meaning: 'Agent diagnoses and plans; a human executes; platform verifies and learns.' },
  { level: 2, mode: 'approve_first' as const, label: 'L2 Approve-first', meaning: 'Agent executes only after explicit approval of the concrete plan.' },
  { level: 3, mode: 'supervised' as const, label: 'L3 Supervised', meaning: 'Agent executes immediately; human on the loop with a hard abort.' },
  { level: 4, mode: 'autonomous' as const, label: 'L4 Autonomous', meaning: 'Agent executes unattended within budgeted scope; humans audit by sampling.' },
]

export const MODE_TO_LEVEL: Record<string, number> = {
  manual: 0, advise: 1, approve_first: 2, supervised: 3, autonomous: 4,
}
export const LEVEL_TO_MODE = ['manual', 'advise', 'approve_first', 'supervised', 'autonomous'] as const

export const MODE_LABEL: Record<string, string> = {
  manual: 'Manual', advise: 'Advise', approve_first: 'Approve-first', supervised: 'Supervised', autonomous: 'Autonomous',
}
