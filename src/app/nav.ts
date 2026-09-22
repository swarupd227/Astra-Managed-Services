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

/** Pinned above the groups — the agent workforce itself, whatever stage the engagement is in. */
export const PINNED: NavItem[] = [
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
 * Navigation follows the stages of the client's engagement — Transition,
 * Run, Improve, Assure — with My Workplace for the people the service is for
 * and the Agent Platform for the team that builds the workforce. Winning the
 * engagement is our own stage and has no entry here.
 *
 * One entry per question someone actually has. Where several screens answer
 * the same question they sit behind one entry as tabs (`src/app/groups.tsx`);
 * every screen keeps its own route.
 */
export const SURFACES: Surface[] = [
  {
    id: 'transition',
    name: 'Transition',
    short: 'Transition',
    tagline: 'What exists, who knows it, and can we take it over safely?',
    users: 'Transition leads, incumbent SMEs, client teams',
    items: [
      { to: '/transition', label: 'Transition', desc: 'Estate coverage, knowledge verification, shadow agreement and cutover gates', badge: 'verify' },
    ],
  },
  {
    id: 'run',
    name: 'Run',
    short: 'Run',
    tagline: 'What is broken or at risk now, and what needs a decision?',
    users: 'Service delivery teams, SDMs, resolvers',
    items: [
      { to: '/operate/operations', label: 'Operations', desc: 'Who is working on what, the priority lanes and SLA burn-down, and the shift handover' },
      { to: '/operate/approvals', label: 'Approvals', desc: 'Gated runs ordered by urgency × blast radius', badge: 'approvals' },
      { to: '/operate/resolver', label: 'Resolver Workspace', desc: 'A queue where agents have already done the pre-work' },
      { to: '/operate/mim', label: 'Major Incident', desc: 'Incident room with auto-scribed timeline and brake status', badge: 'mi' },
      { to: '/governance/sla', label: 'Service Levels', desc: 'Attainment, jeopardy, clock audits, computed credits' },
      { to: '/operate/data', label: 'Data', desc: 'The data estate and its lineage, and the reliability of the data services built on it' },
      { to: '/operate/privacy', label: 'Privacy & Obligations', desc: 'Requests against the statutory clock, incidents against their notice clocks, holds, retention and records of processing' },
      { to: '/operate/releases', label: 'Releases', desc: 'Vendor and internal releases, regression gates and change freezes' },
      { to: '/operate/vendors', label: 'Vendors', desc: 'Suppliers, contracts, response commitments and held work' },
      { to: '/operate/graph', label: 'Service Graph', desc: 'The estate as a typed graph with confidence on every edge' },
    ],
  },
  {
    id: 'transform',
    name: 'Improve',
    short: 'Improve',
    tagline: 'What keeps recurring, and is the price coming down?',
    users: 'Service governance, commercial owners, improvement leads',
    items: [
      { to: '/governance/savings', label: 'Savings', desc: 'Recurrence mined into costed eliminations, the glidepath against the countersigned baseline, and innovation from idea to verified value' },
      { to: '/transform/work-orders', label: 'Work Orders', desc: 'Separately authorised development — estimate, burn and authorisation' },
      { to: '/transform/debt', label: 'Technical Debt', desc: 'Debt register, measured interest and the quarterly remediation recommendation' },
    ],
  },
  {
    id: 'governance',
    name: 'Assure',
    short: 'Assure',
    tagline: 'Can you show what was done, by whom, under what authority?',
    users: 'Client executives, service governance, audit',
    items: [
      { to: '/governance/executive', label: 'Executive Home', desc: 'One page of service truth and the decisions awaiting you' },
      { to: '/governance/outcomes', label: 'Outcomes', desc: 'What the engagement was bought to achieve, the programmes burning down, the client’s own declared effort, and whether the service absorbs growth' },
      { to: '/governance/acceleration', label: 'Engagement & Acceleration', desc: 'Engagements loaded and their service packs, the stages of an engagement, and what the platform makes faster in every one' },
      { to: '/governance/proof', label: 'Proof', desc: 'Search any action and verify the hash chain, run the conformance set and the red team yourself, and read the AI control frameworks against stored records' },
      { to: '/governance/ai-incidents', label: 'AI Incidents', desc: 'Fabrication, injection, oversight and cohort findings — with notification and RCA clocks' },
      { to: '/governance/proposals', label: 'Proposals', desc: 'What the workforce raised unprompted — claim, evidence, value, ageing' },
      { to: '/governance/registers', label: 'Decisions & Obligations', desc: 'Decisions as objects with tracked follow-through' },
      { to: '/governance/portfolio', label: 'Application Portfolio', desc: 'Kind, vendor, configuration baseline and record reconciliation per application' },
      { to: '/governance/autonomy', label: 'Autonomy Posture', desc: 'Tower × action-class matrix, promotions and demotions' },
      { to: '/governance/exit', label: 'Renew & Exit', desc: 'Exit obligations against their clauses, what the platform holds of the client and what has been returned or destroyed, the benchmark pack and the successor pack' },
      { to: '/governance/reports', label: 'Reports', desc: 'Governed semantic layer, signed extracts, natural-language queries' },
    ],
  },
  {
    /**
     * The only surface facing the person the service is for rather than the
     * people who run or buy it. One item by design: a consultant has no
     * business seeing the estate, and a portal that leaks the provider's
     * screens to an end user has confused transparency with exposure.
     */
    id: 'workplace',
    name: 'My Workplace',
    short: 'Workplace',
    tagline: 'What affects the systems you use, and what the service can do about it',
    users: 'Consultants and everyone else the service is actually for',
    items: [
      { to: '/workplace', label: 'My Workplace', desc: 'Known issues, self-service where it genuinely exists, and how the service has been running' },
    ],
  },
  {
    id: 'platform',
    name: 'Agent Platform',
    short: 'Agent Platform',
    tagline: 'The agent workforce — employment records, evaluation, policy, economics',
    users: 'AI engineering, platform team',
    items: [
      { to: '/atlas/fleet', label: 'Agent Fleet', desc: 'Every agent under one governance regime, the service functions each covers, and the model card generated from its records' },
      { to: '/atlas/systems', label: 'AI Systems', desc: 'The approved model registry the gateway enforces, and every version-linked change to what the AI does' },
      { to: '/atlas/evaluation', label: 'Evaluation & Policy', desc: 'Suites and the promotion pipeline, policy-as-code with a simulator, and the unit economics of every model' },
    ],
  },
]

export const SURFACE_BY_ID = Object.fromEntries(SURFACES.map((s) => [s.id, s])) as Record<SurfaceId, Surface>

export const ALL_NAV = [
  ...PINNED.map((i) => ({ ...i, surface: 'run' as SurfaceId, surfaceName: 'Astra' })),
  ...SURFACES.flatMap((s) => s.items.map((i) => ({ ...i, surface: s.id, surfaceName: s.name }))),
]
