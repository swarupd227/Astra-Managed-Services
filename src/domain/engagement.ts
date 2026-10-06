import { configuredEngagements } from './config'
import type { Thresholds } from './thresholds'

/* ==========================================================================
   The engagement — one client's contract, scope and regime, held as data.

   Everything above this file is the product: the agent runtime, the policy
   engine, the gates, the evidence chain, and the service packs that carry a
   service line's agents, estate kinds and tools. Everything a client
   negotiates — which service lines are bought, the statutory regime, the
   notice hours, the term, what has been loaded so far — belongs here, to one
   engagement record.

   Two engagements are held. One is the engagement whose estate, tickets and
   inventory have been ingested and which every operational screen reads.
   The other is a second client at the bid stage, carrying its contract facts
   and nothing else. It is here to keep the separation honest: if a figure
   cannot be shown for an engagement whose estate has not been ingested, the
   platform must say so rather than borrow another client's numbers.
   ========================================================================== */

export type StageId = 'bid' | 'transition' | 'run' | 'improve' | 'assure' | 'exit'

export interface Stage {
  id: StageId
  name: string
  /** What the people in this stage are trying to answer. */
  question: string
  /** What leaving the stage produces. */
  outcome: string
  /**
   * Who the stage is for. The platform is client-facing: a stage marked
   * `provider` is our own work and is never shown to the client's people.
   */
  audience: 'client' | 'provider'
}

export const STAGES: Stage[] = [
  { id: 'transition', name: 'Transition', question: 'What exists, who knows it, and can we take it over safely?', outcome: 'A countersigned cutover', audience: 'client' },
  { id: 'run', name: 'Run', question: 'What is broken or at risk now, and what needs a decision?', outcome: 'Service levels met, demand resolved', audience: 'client' },
  { id: 'improve', name: 'Improve', question: 'What keeps recurring, and is the price coming down?', outcome: 'Demand removed and savings banked', audience: 'client' },
  { id: 'assure', name: 'Assure', question: 'Can you show what was done, by whom, under what authority?', outcome: 'Evidence an auditor accepts', audience: 'client' },
  { id: 'exit', name: 'Renew or exit', question: 'Is the price still market, and can we hand back cleanly?', outcome: 'Benchmark evidence, data returned and certified', audience: 'client' },
  // Ours, not the client's: the work of winning the engagement.
  { id: 'bid', name: 'Bid', question: 'What is in scope, what can agents take on, and what can we commit to?', outcome: 'A priced proposal with a cost-reduction commitment', audience: 'provider' },
]

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<StageId, Stage>

/* ------------------------------ Service packs ------------------------------- */

/**
 * A service pack is the platform's offer for one service line: the agents it
 * brings, what they work on, and what a client buys. Packs are reused across
 * engagements; a client's own names for them live on the engagement.
 */
export interface ServicePack {
  id: string
  name: string
  /** What the pack takes responsibility for, in the client's terms. */
  covers: string
  /** The agents the pack deploys. */
  agents: string[]
  /** How deeply the platform models this line today. */
  depth: 'deep' | 'standard' | 'light'
}

export const SERVICE_PACKS: ServicePack[] = [
  { id: 'pack_workplace', name: 'Digital workplace', covers: 'End-user devices, access and the service desk', agents: ['agt_concierge', 'agt_sentinel'], depth: 'standard' },
  { id: 'pack_infra', name: 'Infrastructure', covers: 'Cloud, network, storage and platform operations', agents: ['agt_sentinel', 'agt_diagnost', 'agt_remedian', 'agt_bursar'], depth: 'standard' },
  { id: 'pack_apps', name: 'Application management', covers: 'Application support, enhancement and release', agents: ['agt_diagnost', 'agt_forge', 'agt_sentryq', 'agt_warden'], depth: 'deep' },
  { id: 'pack_data', name: 'Data management', covers: 'Pipelines, data quality, governance and privacy', agents: ['agt_custodian', 'agt_archivist', 'agt_bursar'], depth: 'deep' },
  { id: 'pack_security', name: 'Security operations', covers: 'Detection, vulnerability and access governance', agents: ['agt_warden', 'agt_sentinel'], depth: 'light' },
  { id: 'pack_cross', name: 'Cross-functional', covers: 'Service management, reporting and governance', agents: ['agt_herald', 'agt_prospect', 'agt_archivist'], depth: 'standard' },
]

export const PACK_BY_ID = Object.fromEntries(SERVICE_PACKS.map((p) => [p.id, p])) as Record<string, ServicePack>

/* ------------------------------- Engagements -------------------------------- */

export interface Regime {
  name: string
  responseDays: number
  extensionDays: number
  /** Hours the contract allows to notify the client of an incident touching its data. */
  clientNoticeHrs: number
  /** Hours the client has to notify its regulator of a personal data breach. */
  regulatorNoticeHrs: number
  /** Where personal data may go without a transfer mechanism. */
  adequate: string[]
}

/** What the platform holds for an engagement. A figure needs its source ingested. */
export interface Ingested {
  contract: boolean
  inventory: boolean
  tickets: boolean
  estate: boolean
  telemetry: boolean
}

/**
 * A procedure area as the client's own contract names it, filed but not yet
 * adopted. Filed is a document; adopting it into the register is somebody
 * putting their name to a clause — see `src/domain/procedures.ts`.
 */
export interface FiledItem {
  id: string
  /** The client's words, in the contract's order. */
  name: string
  /** The platform's standard area it maps onto, where one fits. */
  standardId?: string
}

export interface Engagement {
  id: string
  client: string
  industry: string
  regions: string
  currency: string
  /** The client's own name for each service line, and the pack behind it. */
  serviceLines: { id: string; name: string; packId: string }[]
  regime: Regime
  stage: StageId
  contract: { termMonths: number; startsAt: string; baselineHrsPerYear: number | null; costReductionPct: number | null }
  /** The maintenance procedure areas the contract requires, and where they are stated. */
  procedureAreas?: { reference: string; areas: FiledItem[] }
  /**
   * The improvement dimensions the contract expects recommendations against.
   * Unlike the procedure areas, these are not adopted separately: they are
   * named in the same clause as the obligation itself, so the clause is the
   * authority. An engagement that files none is not scored for cadence.
   */
  improvementDimensions?: { reference: string; items: FiledItem[] }
  /**
   * Operating thresholds this contract states, overriding the platform's
   * defaults. See `src/domain/thresholds.ts` for what each one moves.
   */
  thresholds?: Partial<Thresholds>
  ingested: Ingested
  /** Why the engagement is where it is, in one clause. */
  note: string
}

/**
 * The engagements, as the database held them when the application started.
 *
 * These were literals here until the contract moved into Postgres. Nothing
 * about them is compiled in any more: a term changes by changing the row,
 * and there is no second copy to disagree with it.
 */
export const ENGAGEMENTS: Engagement[] = configuredEngagements()

export const ENGAGEMENT_BY_ID = Object.fromEntries(ENGAGEMENTS.map((e) => [e.id, e])) as Record<string, Engagement>

/**
 * The engagement the operational surfaces read. One estate is ingested, so
 * there is one answer to this and the platform does not pretend otherwise.
 */
export const ENGAGEMENT: Engagement = ENGAGEMENTS.find((e) => e.ingested.estate) ?? ENGAGEMENTS[0]

export const packsOf = (e: Engagement): ServicePack[] =>
  [...new Set(e.serviceLines.map((l) => l.packId))].map((id) => PACK_BY_ID[id]).filter(Boolean)

/** What is missing before an engagement's figures can be read from the platform. */
export const notIngested = (e: Engagement): string[] =>
  (Object.entries(e.ingested) as [keyof Ingested, boolean][]).filter(([, v]) => !v).map(([k]) => k)
