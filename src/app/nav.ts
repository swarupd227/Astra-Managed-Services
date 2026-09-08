import type { SurfaceId } from '@/domain/types'

export interface NavItem {
  to: string
  label: string
  short?: string
  desc: string
  badge?: 'approvals' | 'verify' | 'mi' | 'obligations'
}

export interface Surface {
  id: SurfaceId
  name: string
  short: string
  tagline: string
  users: string
  items: NavItem[]
}

/** Pinned above the groups — the agentic entry point to the platform. */
export const PINNED: NavItem[] = [
  {
    to: '/copilot',
    label: 'Astra Copilot',
    desc: 'State an intent; watch an agent retrieve, reason, plan and meet the policy engine',
  },
  {
    to: '/workforce',
    label: 'Agent Workforce',
    desc: 'What every agent is doing right now, live, with its reasoning open',
  },
  {
    to: '/missions',
    label: 'Missions',
    desc: 'Standing delegation — a goal, a workforce, and budgets that make autonomy finite',
  },
]

/**
 * Navigation follows the engagement lifecycle — Transition, then Run, then
 * Transform — with Governance and the agent platform sitting across all three
 * because they are not phases.
 */
export const SURFACES: Surface[] = [
  {
    id: 'transition',
    name: 'Transition',
    short: 'Transition',
    tagline: 'Acquiring and verifying estate knowledge through to a countersigned cutover',
    users: 'Transition leads, incumbent SMEs, client teams',
    items: [
      { to: '/transition/coverage', label: 'Estate Coverage', desc: 'What is mapped, what is dark, graph quality SLOs' },
      { to: '/transition/verify', label: 'Knowledge Verification', desc: 'One assertion at a time — approve, correct or reject', badge: 'verify' },
      { to: '/transition/shadow', label: 'Shadow Scoreboard', desc: 'Agreement per action class with disagreement drill-downs' },
      { to: '/transition/cutover', label: 'Cutover Readiness', desc: 'Handover artefacts as machine-checked acceptance gates' },
    ],
  },
  {
    id: 'run',
    name: 'Run',
    short: 'Run',
    tagline: 'Resolving demand through governed agents under a live service level',
    users: 'Service delivery teams, SDMs, resolvers',
    items: [
      { to: '/operate/room', label: 'Operations Room', desc: 'Who is working, on what, and what is needed from you' },
      { to: '/operate/board', label: 'Tower Board', desc: 'Priority lanes and SLA burn-down — the reference view' },
      { to: '/operate/approvals', label: 'Approval Inbox', desc: 'Gated runs ordered by urgency × blast radius', badge: 'approvals' },
      { to: '/operate/resolver', label: 'Resolver Workspace', desc: 'A queue where agents have already done the pre-work' },
      { to: '/operate/shift', label: 'Shift & Handover', desc: 'Queue health, load split, generated handover pack' },
      { to: '/operate/mim', label: 'Major Incident', desc: 'Incident room with auto-scribed timeline and brake status', badge: 'mi' },
      { to: '/governance/sla', label: 'SLA & XLA', desc: 'Attainment, jeopardy, clock audits, computed credits' },
      { to: '/operate/graph', label: 'Service Graph', desc: 'The estate as a typed graph with confidence on every edge' },
    ],
  },
  {
    id: 'transform',
    name: 'Transform',
    short: 'Transform',
    tagline: 'Converting banked savings into capacity credits and a simpler estate',
    users: 'Service governance, commercial owners, improvement leads',
    items: [
      { to: '/governance/elimination', label: 'Demand Elimination', desc: 'Recurrence mining and the costed elimination backlog' },
      { to: '/governance/glidepath', label: 'Glidepath & Credits', desc: 'Baseline vs. actual, banked savings, Transform Ledger' },
      { to: '/governance/innovation', label: 'Innovation Register', desc: 'Idea to verified value, with the failures left visible' },
    ],
  },
  {
    id: 'governance',
    name: 'Governance',
    short: 'Governance',
    tagline: 'Oversight across the whole lifecycle — posture, decisions, evidence',
    users: 'Client executives, service governance, audit',
    items: [
      { to: '/governance/executive', label: 'Executive Home', desc: 'One page of service truth and the decisions awaiting you' },
      { to: '/governance/autonomy', label: 'Autonomy Posture', desc: 'Tower × action-class matrix, promotions and demotions' },
      { to: '/governance/proposals', label: 'Proposals', desc: 'What the workforce raised unprompted — claim, evidence, value, ageing' },
      { to: '/governance/registers', label: 'Decisions & Obligations', desc: 'Decisions as objects with tracked follow-through' },
      { to: '/governance/evidence', label: 'Evidence Explorer', desc: 'Search any action; verify the hash chain; export' },
      { to: '/governance/ai-incidents', label: 'AI Incidents', desc: 'Fabrication, injection, oversight and cohort findings — with notification and RCA clocks' },
      { to: '/governance/assurance', label: 'Assurance Sandbox', desc: 'Run the conformance set, the red team, the bias suite and the chain check yourself' },
      { to: '/governance/reports', label: 'Reports', desc: 'Governed semantic layer, signed extracts, natural-language queries' },
    ],
  },
  {
    id: 'platform',
    name: 'Agent Platform',
    short: 'Agent Platform',
    tagline: 'The agent workforce — employment records, evaluation, policy, economics',
    users: 'AI engineering, platform team',
    items: [
      { to: '/atlas/fleet', label: 'Agent Fleet', desc: 'Every agent, ours and the client’s, under one governance regime' },
      { to: '/atlas/systems', label: 'AI Systems', desc: 'The approved model registry the gateway enforces — exhibit, purposes, revision history' },
      { to: '/atlas/change-log', label: 'Change Log', desc: 'Every version-linked change to what the AI does, and vendor model changes with their notice clocks' },
      { to: '/atlas/model-cards', label: 'Model Cards', desc: 'Generated per agent and per AI system from stored records' },
      { to: '/atlas/evaluation', label: 'Evaluation & Promotion', desc: 'Suites, regression diffs, the promotion pipeline' },
      { to: '/atlas/policy', label: 'Policy & Simulator', desc: 'Author policy-as-code and ask the engine what it would decide' },
      { to: '/atlas/tokenops', label: 'Model Economics', desc: 'Unit economics, routing frontiers, distillation candidates' },
    ],
  },
]

export const SURFACE_BY_ID = Object.fromEntries(SURFACES.map((s) => [s.id, s])) as Record<SurfaceId, Surface>

export const ALL_NAV = [
  ...PINNED.map((i) => ({ ...i, surface: 'run' as SurfaceId, surfaceName: 'Astra' })),
  ...SURFACES.flatMap((s) => s.items.map((i) => ({ ...i, surface: s.id, surfaceName: s.name }))),
]
