import { ASSERTIONS, AUTONOMY_SCHEDULE, HANDOVER } from './knowledge'
import { AGENTS } from './estate'
import { COMMITMENTS, MEASURES } from './commitments'
import { DATA_ITEMS } from './dataEstate'
import { ENGAGEMENT } from './engagement'
import { HOLDINGS } from './exit'
import { INVENTORY, reconcile } from './inventory'
import { DEMAND_CLASSES, GLIDEPATH, SLAS } from './ledgers'
import { LEVEL_TO_MODE } from './reference'
import { digest } from './rng'
import { historyFor, recurring } from './ticketHistory'

/* ==========================================================================
   The successor pack — what the client walks away with.

   The platform already counted what it would hand over. Counting is a
   promise; this produces it. Each part names what the successor can do with
   it on day one, which of the two parties owns it, the records it is built
   from, and a function that emits the actual content — so the pack can be
   produced on any ordinary Tuesday rather than assembled under pressure at
   exit.

   Two things keep it honest. Ownership is stated per part: most of this is
   the client's own estate knowledge coming home, and the parts that are our
   grant to make are marked as such rather than quietly included. And what
   is withheld is listed with the reason, because a pack that does not say
   what is missing from it cannot be relied on.
   ========================================================================== */

export type Format = 'csv' | 'json' | 'markdown'

export const FORMAT_LABEL: Record<Format, string> = { csv: 'CSV', json: 'JSON', markdown: 'Markdown' }

/** Whose the part is. The distinction a client will ask about first. */
export type Ownership = 'client' | 'supplier_grant'

export const OWNERSHIP_LABEL: Record<Ownership, string> = {
  client: 'The client’s own',
  supplier_grant: 'Ours, granted on exit',
}

export interface PackPart {
  id: string
  name: string
  /** What the successor can do with it on day one. */
  purpose: string
  format: Format
  ownership: Ownership
  /** The records it is built from. */
  readFrom: string
  build: () => string
  rows: () => number
}

/* ------------------------------ Emitting content ----------------------------- */

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A CSV with a header row, one column per key of the first object. */
function csv<T extends object>(rows: T[], columns: (keyof T & string)[]): string {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')
}

const json = (value: unknown) => JSON.stringify(value, null, 1)

/* --------------------------------- The parts -------------------------------- */

export const PACK_PARTS: PackPart[] = [
  {
    id: 'pk_knowledge', name: 'Verified estate knowledge', format: 'csv', ownership: 'client',
    purpose: 'Every claim about the estate with who verified it and when it expires — the successor starts from facts rather than interviews',
    readFrom: 'The assertion store, as verified during the term',
    rows: () => ASSERTIONS.length,
    build: () => csv(
      ASSERTIONS.map((a) => ({
        id: a.id, subject: a.subject, predicate: a.predicate, object: a.object, tower: a.tower,
        verification: a.verification, verifiedBy: a.verifiedBy ?? '', confidence: a.confidence,
        method: a.method, assertedAt: a.assertedAt, ttlDays: a.ttlDays, tier: a.tier, narrative: a.narrative,
      })),
      ['id', 'subject', 'predicate', 'object', 'tower', 'verification', 'verifiedBy', 'confidence', 'method', 'assertedAt', 'ttlDays', 'tier', 'narrative'],
    ),
  },
  {
    id: 'pk_demand', name: 'Demand classes, causes and costed fixes', format: 'csv', ownership: 'client',
    purpose: 'What recurs, why, what removing it costs and what was already removed — the improvement plan does not restart',
    readFrom: 'The demand ledger and the elimination register',
    rows: () => DEMAND_CLASSES.length,
    build: () => csv(
      DEMAND_CLASSES.map((d) => ({
        id: d.id, name: d.name, tower: d.tower, volumeYr: d.volumeYr, hoursYr: d.hoursYr, trend: d.trend,
        cause: d.cause, state: d.eliminationState, projectedRemoval: d.projectedRemoval ?? '',
        npv36m: d.npv36m ?? '', effortDays: d.effortDays ?? '', proposalType: d.proposalType ?? '',
      })),
      ['id', 'name', 'tower', 'volumeYr', 'hoursYr', 'trend', 'cause', 'state', 'projectedRemoval', 'npv36m', 'effortDays', 'proposalType'],
    ),
  },
  {
    id: 'pk_runbooks', name: 'Runbooks and handover artefacts', format: 'csv', ownership: 'client',
    purpose: 'Each artefact with the test it has to pass and what consumes it, so the successor can prove it holds them',
    readFrom: 'The handover register with its acceptance tests',
    rows: () => HANDOVER.length,
    build: () => csv(HANDOVER, ['id', 'artefact', 'acceptance', 'consumedBy', 'state', 'detail']),
  },
  {
    id: 'pk_data_estate', name: 'Data estate and lineage', format: 'csv', ownership: 'client',
    purpose: 'Every source, feed, pipeline, dataset, report and external recipient with what it reads from — the blast radius of any change, on day one',
    readFrom: 'The data estate register and its lineage edges',
    rows: () => DATA_ITEMS.length,
    build: () => csv(
      DATA_ITEMS.map((d) => ({
        id: d.id, name: d.name, kind: d.kind, tower: d.tower, platform: d.platform, owner: d.owner,
        steward: d.steward ?? '', classification: d.classification ?? '', lineage: d.lineage,
        telemetry: d.telemetry, consumers: d.consumers ?? '', readsFrom: d.upstream,
      })),
      ['id', 'name', 'kind', 'tower', 'platform', 'owner', 'steward', 'classification', 'lineage', 'telemetry', 'consumers', 'readsFrom'],
    ),
  },
  {
    id: 'pk_portfolio', name: 'Application portfolio with reconciliation', format: 'csv', ownership: 'client',
    purpose: 'What is actually supported, including what we found that the client’s own list does not carry',
    readFrom: 'The portfolio register reconciled against the ticket history',
    rows: () => INVENTORY.length,
    build: () => csv(
      INVENTORY.map((i) => ({
        id: i.id, name: i.name, kind: i.kind, tier: i.tier, owner: i.owner,
        clientRecord: i.clientRecord, observed: i.observed, reconciliation: reconcile(i),
        annualIncidents: i.annualIncidents, demandClasses: i.demandClasses,
        configBaseline: i.config.baseline, knownGood: i.config.knownGood, drift: i.config.drift,
        aiEnabled: Boolean(i.aiEnabled), aiSystemId: i.aiSystemId ?? '', note: i.note,
      })),
      ['id', 'name', 'kind', 'tier', 'owner', 'clientRecord', 'observed', 'reconciliation', 'annualIncidents', 'demandClasses', 'configBaseline', 'knownGood', 'drift', 'aiEnabled', 'aiSystemId', 'note'],
    ),
  },
  {
    id: 'pk_ticket_history', name: 'Ticket history, scoped and themed', format: 'json', ownership: 'client',
    purpose: 'Their own extract returned with the scope rule applied, the demand themes, every repeating phrasing — and what the extract cannot support',
    readFrom: 'The ingested ticket history for the engagement',
    rows: () => {
      const h = historyFor(ENGAGEMENT.id)
      return h ? h.themes.length + recurring(h).length : 0
    },
    build: () => {
      const h = historyFor(ENGAGEMENT.id)
      if (!h) return json({ ingested: false })
      return json({
        source: h.source, period: h.period, volumes: h.volumes, scope: h.scope,
        themes: h.themes, repeating: recurring(h), shape: h.shape, problems: h.problems,
        willNotSupport: h.cannot,
      })
    },
  },
  {
    id: 'pk_service_levels', name: 'Service levels with their clocks', format: 'csv', ownership: 'client',
    purpose: 'Every target with how its clock starts, stops and pauses, so attainment can be computed the same way by whoever runs it next',
    readFrom: 'The service level register',
    rows: () => SLAS.length,
    build: () => csv(
      SLAS.map((s) => ({
        id: s.id, name: s.name, tower: s.tower, kind: s.kind, metric: s.metric, targetMins: s.targetMins,
        attainmentTarget: s.attainmentTarget, clockStart: s.clock.start, clockStop: s.clock.stop,
        clockPauses: s.clock.pauses, calendar: s.clock.calendar, earnback: s.earnback,
      })),
      ['id', 'name', 'tower', 'kind', 'metric', 'targetMins', 'attainmentTarget', 'clockStart', 'clockStop', 'clockPauses', 'calendar', 'earnback'],
    ),
  },
  {
    id: 'pk_savings', name: 'Banked savings against the baseline', format: 'csv', ownership: 'client',
    purpose: 'Every claim, banked or rejected, with its verification window — the benchmark position needs no reconstruction',
    readFrom: 'The glidepath ledger',
    rows: () => GLIDEPATH.length,
    build: () => csv(GLIDEPATH, ['id', 'at', 'tower', 'demandClass', 'attribution', 'hoursSaved', 'verifiedDays', 'verificationWindow', 'state', 'evidenceId', 'narrative']),
  },
  {
    id: 'pk_commitments', name: 'Commitments and how each was measured', format: 'json', ownership: 'client',
    purpose: 'The promise, the measure behind it and what that measure reads — so a successor can be held to the same thing, or a better one',
    readFrom: 'The commitment ledger and the measure registry',
    rows: () => COMMITMENTS.filter((c) => c.engagementId === ENGAGEMENT.id).length,
    build: () => json(
      COMMITMENTS.filter((c) => c.engagementId === ENGAGEMENT.id).map((c) => ({
        id: c.id, name: c.name, promise: c.promise, stage: c.stage,
        target: c.target, dueAt: c.dueAt, baseline: c.baseline, consequence: c.consequence,
        measure: { id: c.measureId, name: MEASURES[c.measureId]?.name, needsIngested: MEASURES[c.measureId]?.needs, readFrom: MEASURES[c.measureId]?.route ?? null },
      })),
    ),
  },
  {
    id: 'pk_autonomy', name: 'Autonomy schedule, tower by action class', format: 'csv', ownership: 'client',
    purpose: 'What was allowed to run unattended, what it was graded on, and what blocked the rest — the governance position transfers intact',
    readFrom: 'The autonomy schedule the policy engine enforced',
    rows: () => AUTONOMY_SCHEDULE.length,
    build: () => csv(
      AUTONOMY_SCHEDULE.map((c) => ({
        tower: c.tower, actionClass: c.actionClass,
        current: LEVEL_TO_MODE[c.current], target: LEVEL_TO_MODE[c.target],
        evidence: c.evidence, blocked: c.blocked ?? '',
      })),
      ['tower', 'actionClass', 'current', 'target', 'evidence', 'blocked'],
    ),
  },
  {
    id: 'pk_agents', name: 'Agent charters and grants', format: 'json', ownership: 'supplier_grant',
    purpose: 'What each agent was for, what it was allowed to do and what it was never allowed to do — ours to give, and given so the successor can match it',
    readFrom: 'The agent employment records',
    rows: () => AGENTS.length,
    build: () => json(
      AGENTS.map((a) => ({
        id: a.id, name: a.name, mission: a.mission, origin: a.origin, owner: a.ownerHuman,
        towers: a.towers, skills: a.skills, prohibited: a.prohibited,
        ceiling: a.ceiling, grants: a.grants, evaluation: a.evaluation,
      })),
    ),
  },
  {
    id: 'pk_holdings', name: 'What the platform held, and what became of it', format: 'csv', ownership: 'client',
    purpose: 'The register of everything we kept of theirs, whether it can come back, and the reason anything stays',
    readFrom: 'The exit register',
    rows: () => HOLDINGS.length,
    build: () => csv(
      HOLDINGS.map((h) => ({
        id: h.id, name: h.name, kind: h.kind, what: h.what, location: h.location,
        records: h.count() ?? '', returnable: h.returnable,
        mustKeep: h.mustKeep?.reason ?? '', until: h.mustKeep?.until ?? '',
      })),
      ['id', 'name', 'kind', 'what', 'location', 'records', 'returnable', 'mustKeep', 'until'],
    ),
  },
]

export const PART_BY_ID = Object.fromEntries(PACK_PARTS.map((p) => [p.id, p])) as Record<string, PackPart>

/** What the pack does not contain, and why. A pack that hides its gaps cannot be relied on. */
export const WITHHELD: { what: string; why: string }[] = [
  { what: 'The context store', why: 'Indexed and embedded copies of client material, not returnable in a usable form — the source material it was built from is the client’s already' },
  { what: 'Platform backups', why: 'The backup cycle must expire before destruction can be certified; nothing in them is absent from the parts above' },
  { what: 'The evidence chain in full', why: 'Returned as a sealed export on request, and a copy is retained for seven years to meet the supplier’s own audit obligation' },
  { what: 'Agent runtime and skills source', why: 'The platform itself is not part of the engagement; the charters, grants and schedules that governed it are, and they are above' },
]

/* -------------------------------- Producing it ------------------------------- */

export interface BuiltPart {
  part: PackPart
  rows: number
  bytes: number
  /** Over the content, the same way the evidence chain digests a record. */
  digest: string
  content: string
}

export interface Manifest {
  at: string
  by: string
  parts: { id: string; name: string; format: Format; ownership: Ownership; rows: number; bytes: number; digest: string }[]
  rows: number
  bytes: number
  /** Over the part digests in order: one line to check the whole pack against. */
  digest: string
  withheld: { what: string; why: string }[]
}

/** Build every part. The content is produced here, not described. */
export function buildPack(): BuiltPart[] {
  return PACK_PARTS.map((part) => {
    const content = part.build()
    return { part, rows: part.rows(), bytes: new TextEncoder().encode(content).length, digest: digest(content), content }
  })
}

export function manifestOf(built: BuiltPart[], at: string, by: string): Manifest {
  return {
    at,
    by,
    parts: built.map((b) => ({
      id: b.part.id, name: b.part.name, format: b.part.format, ownership: b.part.ownership,
      rows: b.rows, bytes: b.bytes, digest: b.digest,
    })),
    rows: built.reduce((n, b) => n + b.rows, 0),
    bytes: built.reduce((n, b) => n + b.bytes, 0),
    digest: digest(built.map((b) => b.digest).join('|')),
    withheld: WITHHELD,
  }
}

/** A production of the pack, as the register holds it. */
export interface PackExport {
  id: string
  at: string
  by: string
  /** Why it was produced: an annual proof, a benchmark, a real exit. */
  reason: string
  manifest: Manifest
  evidenceId?: string
}

export const DAY = 86_400_000

/** Produced within the year, or not. The commitment reads this. */
export function freshness(log: PackExport[], nowMs: number): { last: PackExport | null; daysSince: number | null; withinYear: boolean } {
  const last = [...log].sort((a, b) => b.at.localeCompare(a.at))[0] ?? null
  const daysSince = last ? Math.floor((nowMs - Date.parse(last.at)) / DAY) : null
  return { last, daysSince, withinYear: daysSince !== null && daysSince <= 365 }
}
