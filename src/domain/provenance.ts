/* ==========================================================================
   Where the figures on a screen come from.

   A platform that refuses to state a number it cannot measure has to be
   just as plain about the numbers it shows. Every dataset the application
   reads is registered here with its origin — a file the client supplied,
   a record the platform itself wrote, a demonstration seed, or somebody's
   declaration — the screens it feeds, and what a reader must not do with
   it.

   The register exists so the marker in the page header can be computed
   rather than remembered. A screen reading a demonstration seed says so in
   its own header, every time, and an evaluator never has to guess which
   figures would survive contact with a real estate.
   ========================================================================== */

export type Origin = 'client_extract' | 'platform_record' | 'seeded' | 'declared' | 'not_built'

export const ORIGIN_LABEL: Record<Origin, string> = {
  client_extract: 'From the client’s records',
  platform_record: 'Written by the platform',
  seeded: 'Demonstration data',
  declared: 'Declared by someone',
  not_built: 'Not built',
}

export const ORIGIN_MEANING: Record<Origin, string> = {
  client_extract: 'Read from a file the client supplied. The figures are theirs; the platform only scoped and counted them.',
  platform_record: 'Produced by the platform as it ran — appended, hash-linked and replayable.',
  seeded: 'A deterministic demonstration set. Shaped to be realistic and never to be quoted as evidence of this client’s estate.',
  declared: 'Somebody’s statement — a contract schedule, a bid estimate, a client’s own account — carried with whose it is.',
  not_built: 'Nothing is read: the capability does not exist yet.',
}

/** Most cautionary first. The header marker takes the first origin present. */
export const ORIGIN_ORDER: Origin[] = ['not_built', 'seeded', 'declared', 'client_extract', 'platform_record']

export type Maturity = 'live' | 'partial' | 'not_built'

export const MATURITY_LABEL: Record<Maturity, string> = { live: 'Live', partial: 'Partial', not_built: 'Not built' }

export interface DataSet {
  id: string
  /** What the figures are about. */
  name: string
  origin: Origin
  /** The file, the system, or the seed. Named precisely enough to be checked. */
  source: string
  /** When the source was taken, where that is knowable. */
  asOf?: string
  /** The routes whose figures come from this set. Matched by prefix. */
  routes: string[]
  /** What a reader must not do with it. */
  caution?: string
  maturity: Maturity
}

export const DATASETS: DataSet[] = [
  {
    id: 'ds_engagement', name: 'The engagement’s own terms', origin: 'client_extract',
    source: 'Azure Database for PostgreSQL: the contract, regime, service lines, stated thresholds and filed areas, read once at start-up — there is no compiled copy to fall back to',
    routes: ['/governance/acceleration', '/governance/commitments', '/governance/procedures', '/governance/recommendations'],
    caution: 'A term changes by changing the row; if the database cannot be read the platform does not start rather than running on a stale copy',
    maturity: 'live',
  },
  {
    id: 'ds_tickets', name: 'Incidents, requests, problems and catalogue tasks', origin: 'client_extract',
    source: 'Attachment C.3 — Volumes.xlsx, tabs I1–I4: 28,028 incidents, 63,350 requests, 49 problem records, 3,195 catalogue tasks',
    asOf: '2026-06-05',
    routes: ['/governance/commitments', '/governance/elimination', '/governance/savings'],
    caution: 'No resolution or close timestamp and an unusable priority field: handling time, MTTR and urgency cannot be derived from it',
    maturity: 'live',
  },
  {
    id: 'ds_inventory_source', name: 'Application, server, database and device listings', origin: 'client_extract',
    source: 'Attachment C.4 — Application Listing, and C.3 tabs A–F: 508 servers, 429 database instances, 9,817 end-user devices',
    asOf: '2026-08-31',
    routes: ['/governance/portfolio', '/governance/inventory'],
    caution: 'A floor, not a total: the ticket extract names applications the listing does not',
    maturity: 'partial',
  },
  {
    id: 'ds_service_levels', name: 'Service levels and their targets', origin: 'client_extract',
    source: 'Attachment D.1 — Service Levels: 40 service levels with targets, criticality and calculation',
    asOf: '2026-08-31',
    routes: ['/governance/sla'],
    caution: 'Targets and definitions are the client’s; attainment, credits and clock events on these screens are a demonstration seed',
    maturity: 'partial',
  },
  {
    id: 'ds_sla_attainment', name: 'Service level attainment, credits and clock events', origin: 'seeded',
    source: 'Demonstration set against the client’s own targets: attainment month to date, jeopardy, clock audits and computed credits',
    routes: ['/governance/sla'],
    caution: 'The targets are the client’s; every attainment figure and credit on this screen is seeded',
    maturity: 'live',
  },
  {
    id: 'ds_inventory_records', name: 'Application records, drift and reconciliation', origin: 'seeded',
    source: 'Demonstration set shaped from the client’s listing: lifecycle, configuration baselines and reconciliation against what the tickets show',
    routes: ['/governance/portfolio', '/governance/inventory'],
    caution: 'Which applications exist is the client’s; their drift, baselines and reconciliation state are seeded',
    maturity: 'live',
  },
  {
    id: 'ds_commitment_measures', name: 'The figures read against each promise', origin: 'seeded',
    source: 'Read by the platform’s own measures, which draw on the sets registered here — the ticket extract for baselines, demonstration sets for today’s figures',
    routes: ['/governance/commitments'],
    caution: 'Every row names what it was read from; where that is a demonstration set, the figure is not evidence of this estate',
    maturity: 'live',
  },
  {
    id: 'ds_catalogue', name: 'Tools, and which role may call them', origin: 'platform_record',
    source: 'server/tool-catalogue.json — the file the gateway enforces on every call',
    routes: ['/atlas/policy', '/atlas/evaluation'],
    maturity: 'live',
  },
  {
    id: 'ds_registry', name: 'Approved models and version-linked change', origin: 'platform_record',
    source: 'server/ai-registry.json — read live by the gateway, which refuses an unapproved model',
    routes: ['/atlas/systems', '/atlas/change-log', '/atlas/model-cards'],
    maturity: 'live',
  },
  {
    id: 'ds_evidence', name: 'The evidence chain', origin: 'platform_record',
    source: 'Appended as the platform runs: every tool call, decision, approval and recorded remedy, hash-linked to the one before it',
    routes: ['/governance/evidence', '/governance/proof'],
    caution: 'The chain opens on a seeded backbone; everything done in a session is appended and verifiable for real',
    maturity: 'live',
  },
  {
    id: 'ds_commitments', name: 'The promises themselves', origin: 'declared',
    source: 'Contract schedules and the response document, loaded per engagement',
    routes: ['/governance/commitments'],
    caution: 'A promise is a declaration; only the figure read against it is measured',
    maturity: 'live',
  },
  {
    id: 'ds_baselines', name: 'How long the work takes without the platform', origin: 'declared',
    source: 'Bid team estimates, transition lead estimates and the client’s own account, each row carrying whose',
    routes: ['/governance/acceleration'],
    caution: 'Never measured here: a baseline is always somebody’s statement',
    maturity: 'live',
  },
  {
    id: 'ds_effort', name: 'The client’s own effort on the service', origin: 'declared',
    source: 'Effort declarations by function, each with its method and attestation date',
    routes: ['/governance/client-effort', '/governance/outcomes'],
    caution: 'A declaration beyond its attestation window is excluded from the headline rather than aged quietly',
    maturity: 'live',
  },
  {
    id: 'ds_work', name: 'The live queue, runs and approvals', origin: 'seeded',
    source: 'Deterministic demonstration set: work objects with their timelines, agent runs, gated approvals and shift handovers',
    routes: ['/', '/w/', '/operate/room', '/operate/board', '/operate/work', '/operate/resolver', '/operate/approvals', '/operate/shift', '/operate/mim', '/operate/run', '/workplace', '/brief', '/copilot', '/missions'],
    caution: 'Not this client’s estate. Volumes and timings are shaped to be realistic and must not be quoted as measurement',
    maturity: 'live',
  },
  {
    id: 'ds_graph', name: 'The estate as a typed graph', origin: 'seeded',
    source: 'Demonstration set shaped from the client’s inventory: towers, applications, components and their edges with confidence',
    routes: ['/operate/graph', '/atlas/coverage', '/transition'],
    caution: 'Edges and confidences are seeded; a real engagement discovers them',
    maturity: 'live',
  },
  {
    id: 'ds_data_estate', name: 'Data estate, lineage and reliability', origin: 'seeded',
    source: 'Demonstration set shaped from the data response and C.3 tab E: sources, feeds, pipelines, datasets, reports, applications and external recipients, with 30 days of run history',
    routes: ['/operate/data', '/operate/data-reliability'],
    caution: 'Run histories, availability and error budgets are seeded; the lineage shape follows the client’s described estate',
    maturity: 'live',
  },
  {
    id: 'ds_privacy', name: 'Privacy requests, incidents and records of processing', origin: 'seeded',
    source: 'Demonstration set: requests against the statutory clock, data incidents with notice clocks, holds and retention',
    routes: ['/operate/privacy'],
    caution: 'The regime, notice hours and clock arithmetic are the engagement’s; the requests and incidents are seeded',
    maturity: 'live',
  },
  {
    id: 'ds_fleet', name: 'The agent workforce and its readiness', origin: 'seeded',
    source: 'Demonstration set: twelve agents with employment records, evaluation history, budgets and escalation logs',
    routes: ['/workforce', '/atlas/fleet', '/atlas/lifecycle', '/atlas/agent', '/atlas/tokenops', '/governance/autonomy'],
    caution: 'Readiness checks read live files where they exist — the approved model registry and the tool catalogue — and seeded records everywhere else',
    maturity: 'live',
  },
  {
    id: 'ds_ledgers', name: 'Banked savings, the glidepath and credits', origin: 'seeded',
    source: 'Demonstration set: verification windows, banked and rejected claims against a countersigned baseline of 214,000 hours',
    routes: ['/governance/glidepath', '/governance/savings', '/transform/work-orders', '/transform/debt', '/governance/programmes', '/governance/headroom'],
    caution: 'Hours and values are seeded; the baseline and the contracted curve are the contract’s',
    maturity: 'live',
  },
  {
    id: 'ds_exit', name: 'What the platform holds of the client', origin: 'seeded',
    source: 'Demonstration register of nine holdings with their return paths, retention reasons and settlement records',
    routes: ['/governance/exit'],
    caution: 'Counts are read from the seeded sets they describe',
    maturity: 'live',
  },
  {
    id: 'ds_assurance', name: 'Conformance, red team and AI incidents', origin: 'seeded',
    source: 'Demonstration set: control mappings, adversarial cases and detected AI incidents with their clocks',
    routes: ['/governance/ai-pack', '/governance/ai-incidents', '/governance/assurance', '/atlas/evaluation', '/governance/registers', '/governance/reports', '/governance/proposals', '/governance/objectives', '/governance/executive', '/operate/releases', '/operate/vendors'],
    caution: 'Runs execute for real against seeded controls and records',
    maturity: 'partial',
  },
  {
    id: 'ds_improvement_dimensions', name: 'The improvement dimensions recommendations are owed against', origin: 'client_extract',
    source: 'Read from the engagement database at start-up, as filed at Table 1 — Enterprise Data Platform, Data Governance & Quality, and Data Integration & Pipelines, item 1: the six the clause names, in the client’s own words',
    asOf: '2026-08-31',
    routes: ['/governance/recommendations'],
    caution: 'Cadence is scored against this list alone; an engagement that files none is not scored at all',
    maturity: 'live',
  },
  {
    id: 'ds_recommendations', name: 'Recommendations raised, and what they returned', origin: 'seeded',
    source: 'Two demonstration registers and one live watch, read as one: six unprompted agent proposals, eleven innovation items with realised figures, and Custodian’s standing data-quality findings computed from the estate register itself',
    routes: ['/governance/recommendations', '/governance/proposals'],
    caution: 'The recommendations are seeded; the cadence window, the expiry clocks and the realised-against-projected arithmetic are computed',
    maturity: 'live',
  },
  {
    id: 'ds_procedure_areas', name: 'The procedure areas the contract requires', origin: 'client_extract',
    source: 'Read from the engagement database at start-up, as filed at Attachment B.3 — Application Management, item 1: the eleven areas in the client’s own words and order',
    asOf: '2026-08-31',
    routes: ['/governance/procedures'],
    caution: 'Coverage is reported against this list only once somebody adopts it against the clause; until then nothing is scored',
    maturity: 'live',
  },
  {
    id: 'ds_procedures', name: 'The procedures themselves, and their reviews', origin: 'seeded',
    source: 'Demonstration register of twelve procedures with owners, versions, review periods and the action classes each authorises; execution counts are read from the work the platform did',
    routes: ['/governance/procedures'],
    caution: 'The procedures and review dates are seeded; the areas they answer are the client’s, and the execution counts are read from live work records',
    maturity: 'live',
  },
  {
    id: 'ds_client_control', name: 'The client’s rights over the workforce, and the directives in force', origin: 'platform_record',
    source: 'The rights are registered in src/domain/clientControl.ts and the holders in server/tool-catalogue.json, which the gateway enforces; every directive is written as the client sets it and sealed to the evidence chain',
    routes: ['/governance/client-control'],
    caution: 'The agents the directives apply to are a demonstration set; the right, the refusals and the sealing are real',
    maturity: 'live',
  },
  {
    id: 'ds_successor_pack', name: 'The successor pack and its productions', origin: 'platform_record',
    source: 'Each part is emitted from the registers it names in src/domain/successorPack.ts; every production digests what it emitted and seals the manifest to the evidence chain',
    routes: ['/governance/successor-pack'],
    caution: 'The content inherits the origin of the register behind each part — knowledge, demand and lineage parts carry demonstration records; the build, the digests and the manifest are real',
    maturity: 'live',
  },
  {
    id: 'ds_provenance', name: 'This register', origin: 'platform_record',
    source: 'src/domain/provenance.ts — one row per dataset the application reads',
    routes: ['/governance/provenance'],
    maturity: 'live',
  },
]

/* --------------------------------- Readings --------------------------------- */

const normalise = (path: string) => (path.startsWith('/') ? path : `/${path}`).replace(/\/+$/, '') || '/'

/** True when a registered route covers this path. '/' matches only itself. */
const covers = (route: string, path: string) => {
  const r = normalise(route), p = normalise(path)
  if (r === '/') return p === '/'
  return p === r || p.startsWith(`${r}/`)
}

export interface RouteProvenance {
  path: string
  datasets: DataSet[]
  /** The origin a reader needs to know about first. */
  headline: Origin | null
}

/** What feeds one screen. More than one dataset is the usual case. */
export function provenanceFor(path: string): RouteProvenance {
  const datasets = DATASETS.filter((d) => d.routes.some((r) => covers(r, path)))
  const headline = ORIGIN_ORDER.find((o) => datasets.some((d) => d.origin === o)) ?? null
  return { path: normalise(path), datasets, headline }
}

export interface ProvenanceSummary {
  datasets: DataSet[]
  byOrigin: Record<Origin, number>
  /** Screens the register accounts for. */
  routes: number
  /** Datasets carrying something a reader must not do with them. */
  withCaution: number
}

export function provenanceSummary(): ProvenanceSummary {
  const byOrigin = DATASETS.reduce(
    (acc, d) => ({ ...acc, [d.origin]: acc[d.origin] + 1 }),
    { client_extract: 0, platform_record: 0, seeded: 0, declared: 0, not_built: 0 } as Record<Origin, number>,
  )
  return {
    datasets: [...DATASETS].sort((a, b) => ORIGIN_ORDER.indexOf(a.origin) - ORIGIN_ORDER.indexOf(b.origin) || a.name.localeCompare(b.name)),
    byOrigin,
    routes: new Set(DATASETS.flatMap((d) => d.routes)).size,
    withCaution: DATASETS.filter((d) => d.caution).length,
  }
}
