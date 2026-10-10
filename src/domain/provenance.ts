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

export type Origin = 'client_extract' | 'platform_record' | 'connector' | 'seeded' | 'declared' | 'not_built'

export const ORIGIN_LABEL: Record<Origin, string> = {
  client_extract: 'From the client’s records',
  platform_record: 'Written by the platform',
  connector: 'Client feed sample',
  seeded: 'Demonstration data',
  declared: 'Declared by someone',
  not_built: 'Not built',
}

export const ORIGIN_MEANING: Record<Origin, string> = {
  client_extract: 'Read from a file the client supplied. The figures are theirs; the platform only scoped and counted them.',
  platform_record: 'Produced by the platform as it ran — appended, hash-linked and replayable. Empty until it has run.',
  connector: 'Behind a client feed. The named system supplies these rows in service; until it is connected they are a sample of the right shape, and never this client’s figures.',
  seeded: 'A deterministic demonstration set. Shaped to be realistic and never to be quoted as evidence of this client’s estate.',
  declared: 'Somebody’s statement — a contract schedule, a bid estimate, a client’s own account — carried with whose it is.',
  not_built: 'Nothing is read: the capability does not exist yet.',
}

/**
 * Most cautionary first. The header marker takes the first origin present.
 *
 * A connector sample ranks beside a seed, because that is what it is until the
 * feed is wired. It is kept separate so a screen can say which system will
 * supply it, and so the one thing the platform may legitimately seed is
 * distinguishable from the things it may not.
 */
export const ORIGIN_ORDER: Origin[] = ['not_built', 'seeded', 'connector', 'declared', 'client_extract', 'platform_record']

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
    source: 'Ingested into the database from Attachment C.3 — Volumes.xlsx, tabs I1–I4: 28,028 incidents, 63,350 requests, 49 problem records, 3,195 catalogue tasks. Re-ingesting a newer extract replaces it without a deploy',
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
    id: 'ds_sla_attainment', name: 'Service level attainment, credits and clock events', origin: 'connector',
    source: 'ServiceNow, via the service-management feed: attainment month to date, jeopardy and the clock events a credit is settled against. Sampled against the client’s own targets until the feed is connected',
    routes: ['/governance/sla'],
    caution: 'The targets are the client’s; every attainment figure and credit on this screen is seeded',
    maturity: 'live',
  },
  {
    id: 'ds_inventory_records', name: 'Application records, drift and reconciliation', origin: 'connector',
    source: 'The CMDB and configuration feeds: lifecycle, configuration baselines and reconciliation against what the tickets show. Sampled from the client’s own listing until those feeds are connected',
    routes: ['/governance/portfolio', '/governance/inventory'],
    caution: 'Which applications exist is the client’s; their drift, baselines and reconciliation state are seeded',
    maturity: 'live',
  },
  {
    id: 'ds_commitment_measures', name: 'The figures read against each promise', origin: 'connector',
    source: 'Read by the platform’s own measures, which draw on the sets registered here — the ticket extract for baselines, the platform’s own records for what has been delivered, and the client feeds for today’s service figures',
    routes: ['/governance/commitments'],
    caution: 'Every row names what it was read from and refuses to score what it cannot read; a measure with no record behind it reads as not measured rather than zero',
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
    caution: 'The chain opens empty. Everything done in a session is appended to it and verifiable for real; a verification that passes over no records says exactly that',
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
    id: 'ds_work', name: 'The live queue, runs and approvals', origin: 'connector',
    source: 'ServiceNow, via the service-management feed: the work objects themselves. Their timelines, agent runs and approvals are written by the platform as it works them. Sampled until the feed is connected',
    routes: ['/', '/w/', '/operate/room', '/operate/board', '/operate/work', '/operate/resolver', '/operate/approvals', '/operate/shift', '/operate/mim', '/operate/run', '/workplace', '/brief', '/copilot', '/missions'],
    caution: 'Not this client’s estate. Volumes and timings are shaped to be realistic and must not be quoted as measurement',
    maturity: 'live',
  },
  {
    id: 'ds_graph', name: 'The estate as a typed graph', origin: 'connector',
    source: 'Discovery and the CMDB: towers, applications, components and the edges between them. Sampled from the client’s inventory until discovery runs against the estate',
    routes: ['/operate/graph', '/atlas/coverage', '/transition'],
    caution: 'Edges and confidences are seeded; a real engagement discovers them',
    maturity: 'live',
  },
  {
    id: 'ds_data_estate', name: 'Data estate, lineage and reliability', origin: 'connector',
    source: 'Azure Data Factory, Purview and the warehouse catalogue: sources, feeds, pipelines, datasets, reports and external recipients, with the pipeline run history behind them. Sampled from the data response and C.3 tab E until those feeds are connected',
    routes: ['/operate/data', '/operate/data-reliability'],
    caution: 'Run histories, availability and error budgets are seeded; the lineage shape follows the client’s described estate',
    maturity: 'live',
  },
  {
    id: 'ds_privacy', name: 'Privacy requests, incidents and records of processing', origin: 'connector',
    source: 'The privacy request tool and the incident record: subject requests against the statutory clock, data incidents with their notice clocks, holds and retention. Sampled until those feeds are connected',
    routes: ['/operate/privacy'],
    caution: 'The regime, notice hours and clock arithmetic are the engagement’s; the requests and incidents are seeded',
    maturity: 'live',
  },
  {
    id: 'ds_fleet', name: 'The agent workforce and its readiness', origin: 'platform_record',
    source: 'The charters are the platform’s design — identity, mission, towers, skills, prohibitions and the ceiling each may reach. Everything measured about them is written as they run: evaluation, live success, spend, hand-backs and incidents all start at nothing',
    routes: ['/workforce', '/atlas/fleet', '/atlas/lifecycle', '/atlas/agent', '/atlas/tokenops', '/governance/autonomy'],
    caution: 'Readiness checks read live files where they exist — the approved model registry and the tool catalogue — and report unproven where there is no record yet, which at the start is everywhere else',
    maturity: 'live',
  },
  {
    id: 'ds_ledgers', name: 'Banked savings, the glidepath and credits', origin: 'platform_record',
    source: 'Written by the platform when a claim survives its verification window. The baseline and the contracted curve are the contract’s; nothing is banked against them until it has been verified, so the ledgers open empty',
    routes: ['/governance/glidepath', '/governance/savings', '/transform/work-orders', '/transform/debt', '/governance/programmes', '/governance/headroom'],
    caution: 'An hour appears here only after its verification window has elapsed, so delivered reads nothing against a contracted curve that keeps rising',
    maturity: 'live',
  },
  {
    id: 'ds_exit', name: 'What the platform holds of the client', origin: 'connector',
    source: 'Nine holdings with their return paths and retention reasons. What is held is the platform’s own design; how much of it there is comes from the sets it describes, so the counts follow their feeds',
    routes: ['/governance/exit'],
    caution: 'A holding’s return path is a commitment; its volume is only as real as the feed behind the set it counts',
    maturity: 'live',
  },
  {
    id: 'ds_assurance', name: 'Conformance, red team and AI incidents', origin: 'connector',
    source: 'Control mappings and adversarial cases are the platform’s own; the AI incidents are detected and recorded as it runs. The control set and the cases are sampled; a run against them executes for real',
    routes: ['/governance/ai-pack', '/governance/ai-incidents', '/governance/assurance', '/atlas/evaluation', '/governance/registers', '/governance/reports', '/governance/proposals', '/governance/objectives', '/governance/executive', '/operate/releases', '/operate/vendors'],
    caution: 'A conformance or red-team run executes for real; the control set and the adversarial cases it runs against are the platform’s own sample',
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
    id: 'ds_recommendations', name: 'Recommendations raised, and what they returned', origin: 'platform_record',
    source: 'Three books read as one: the proposals agents raise, the innovation register, and a standing watch per improvement dimension. Each watch derives its findings from a register the platform already reads — the estate for data quality and security, the demand ledger for automation, the reliability reader for performance, the provenance register and the extract’s own stated limits for platform capabilities, and the ticket history, escalation log and live queue for operational efficiency',
    routes: ['/governance/recommendations', '/governance/proposals'],
    caution: 'A finding is a condition that holds, re-stated while it is true and gone when it is fixed, and it names what it was read from so it can be checked. None carries a currency figure: the registers behind them count items, hours and readers, and a value derived from those would be asserted. A dimension with no watch, or whose register is empty, stays silent and is counted as silent',
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
    id: 'ds_procedures', name: 'The procedures themselves, and their reviews', origin: 'platform_record',
    source: 'Written when a procedure is authored and when a review is recorded. The areas they answer are the client’s; the execution counts are read from the work the platform did',
    routes: ['/governance/procedures'],
    caution: 'A procedure appears once it has been written, so the register is empty until it is, and coverage is measured against the areas the contract files',
    maturity: 'live',
  },
  {
    id: 'ds_intake', name: 'Tickets arriving from the client’s ticketing system', origin: 'client_extract',
    source: 'The client’s own incident dump, loaded row by row: reference, short description, category and sub-category, state, their priority word, assignment group and when it was raised. No longer sampled — the arrivals the intake is shown are the client’s own, read a page at a time',
    routes: ['/operate/room', '/operate/board', '/operate/work'],
    caution: 'The dump carries no configuration items at all, so what a ticket names is read from the declaration against its sub-category rather than from the ticket. Everything else on admission is derived: the class is matched against the client’s own history and sub-category volumes, the blast radius is walked from the graph, and the routing follows from the runbooks and grants the platform holds — a ticket matching nothing is held for a person rather than classified at a low confidence. Their priority scheme has five levels against the platform’s four and 94% of the dump sits at their lowest, so any figure cut by priority says more about how they file than about urgency',
    maturity: 'live',
  },
  {
    id: 'ds_ticket_feed', name: 'How the client’s incident dump is read', origin: 'declared',
    source: 'What a person confirmed when the dump was loaded: which column feeds which field, what each of the client’s priority words means on the platform’s four levels, and — per sub-category, in two separable halves — which costed class its demand belongs to and which estate component it lands on. Proposed by profiling the dump’s values, then confirmed, and held against the engagement rather than in the platform’s code',
    routes: ['/operate/room', '/operate/board', '/operate/work'],
    caution: 'The sub-category volumes beside these declarations are counted from the dump; the class and the component are somebody’s decision and are the part nothing can derive. The component sets which tower an arriving ticket lands on and therefore which approval policy, service level and knowledge pack govern it, so a wrong component is a wrong gate rather than a wrong label. Most of this dump carries a component and no class: the costed classes were derived from an extract covering application and data management alone, 2,721 of the 28,028 incidents, and it prices none of the digital-workplace volume. Those arrivals are placed but classified no further than their theme, which is the honest reading of knowing what a ticket is about and not what it is. No class can be added from this extract either — it supplies no resolution or close timestamp, so the effort figure a costed class needs is not derivable at all',
    maturity: 'live',
  },
  {
    id: 'ds_experiments', name: 'Recommendations funded as experiments, and what they moved', origin: 'platform_record',
    source: 'Written when somebody funds a recommendation: the count the condition held for at the time, the hypothesis, the success criterion and the window. The outcome is that same count re-derived afterwards',
    routes: ['/governance/recommendations'],
    caution: 'The outcome is movement in the condition, not a currency figure — the registers behind these findings count items, applications and hours, and a value derived from them would be asserted. An experiment that moved nothing keeps its place',
    maturity: 'live',
  },
  {
    id: 'ds_finance', name: 'Fees, expenses and credit notes, row by row', origin: 'connector',
    source: 'The client’s finance system, via the engagement feed: one row per entry with the amount and when it reached the warehouse, plus what each report’s definition of net revenue includes and when it last refreshed. Sampled until that feed is connected',
    routes: ['/operate/data'],
    caution: 'The rows are a sample; the reconciliation over them is not. Every row is placed in exactly one bucket, so the causes sum to the difference by construction, and whatever they do not account for is reported as an unexplained remainder rather than absorbed',
    maturity: 'live',
  },
  {
    id: 'ds_publication', name: 'What each consumer is reading, and what the gate decided', origin: 'platform_record',
    source: 'Written when a load is reconciled: the control totals the source declared with it, the totals counted after it ran, every measure that did not agree, and whether the load was published or held',
    routes: ['/operate/data'],
    caution: 'The declared totals are the source’s own and travel with the feed; the counted totals and the decision between them are the platform’s. An item whose feed declares no totals cannot be reconciled and is held rather than passed',
    maturity: 'live',
  },
  {
    id: 'ds_obligations', name: 'What the contract obliges, recurring', origin: 'client_extract',
    source: 'Read from the engagement database at start-up: what is owed, how often, what evidence discharges it, the clause, and the date it first fell due',
    routes: ['/governance/registers'],
    caution: 'Only the contract’s side is loaded. The next due date is rolled forward from the cadence and the state from that date; nobody is named as owner until somebody is assigned, and no obligation is reported green on the strength of evidence the platform has not seen',
    maturity: 'partial',
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
