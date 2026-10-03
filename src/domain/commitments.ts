import type { Basis } from './acceleration'
import { reliabilitySummary } from './dataReliability'
import { ENGAGEMENT, ENGAGEMENT_BY_ID, type Engagement, type Ingested, type StageId } from './engagement'
import { escalationSummary } from './escalations'
import { readExit } from './exit'
import { inventorySummary } from './inventory'
import { DEMAND_CLASSES, TRANSFORM } from './ledgers'
import { glidepathAttainment, verifiedVolumeCoverage, volumeRemoved } from './metrics'
import { privacySummary } from './privacy'
import { clustersWithCause, historyFor, recurring, refusal, themeOf, type Derivable, type TicketHistory } from './ticketHistory'
import type { FleetLifecycle } from './agentLifecycle'
// Type only: the pack reads the commitment register, and this must not become a cycle.
import type { PackExport } from './successorPack'
import { NOW, WORK_OBJECTS } from './workSeed'

/* ==========================================================================
   Commitments — the promises the engagement is held to, and what the
   platform reads today against each one.

   The measures are platform code: one registry, each entry naming what it
   needs ingested before it can be read and returning a figure with the basis
   it was obtained on. The commitments are data: a row per promise, pointing
   at a measure, carrying its target, its date and what happens if it is
   missed. A second client loads its own rows and nothing here changes.

   Three rules keep the ledger from becoming a slide.

   A baseline is never invented. It is read from the ticket history ingested
   for the engagement, or it is someone's declaration and says whose.

   A measure that cannot be read reports that, with the reason, and the
   commitment is marked not measurable rather than assumed to be on track.
   An extract missing close timestamps cannot support a resolution-time
   promise, so the platform declines to score one.

   Pace is arithmetic. Expected progress is the straight line from baseline
   to target across the window, so behind and on track are computed rather
   than asserted, and a promise past its date with the target unmet is
   missed — whoever that embarrasses.
   ========================================================================== */

export type Direction = 'at_least' | 'at_most'

export interface MeasureCtx {
  nowMs: number
  /**
   * Agent readiness, read once by the caller through the shared reader, so
   * the ledger cannot answer differently from the readiness page.
   */
  fleet?: FleetLifecycle
  /** What has been recorded this session against commitments. */
  remedies?: Remedy[]
  /** Successor packs produced, for the commitment that the pack is produced rather than promised. */
  packExports?: PackExport[]
}

export interface MeasureReading {
  /** Null when the measure cannot be read. The note then says why. */
  value: number | null
  display: string
  note: string
  basis: Basis
}

export interface Measure {
  id: string
  name: string
  unit: 'pct' | 'count'
  /** What must be ingested for the engagement before this can be read. */
  needs: (keyof Ingested)[]
  /** What the ingested extract must support. */
  needsDerivable?: Derivable[]
  /** The page carrying the evidence. */
  route?: string
  read: (ctx: MeasureCtx) => MeasureReading
}

const pct = (n: number) => `${n.toFixed(1)}%`
const unreadable = (note: string): MeasureReading => ({ value: null, display: '—', note, basis: 'not_measured' })

/** Share of a theme's mapped classes verified as removed, weighted by volume. */
function themeRemoved(h: TicketHistory, themeId: string): MeasureReading {
  const theme = themeOf(h, themeId)
  if (!theme) return unreadable('No such theme in the ingested history')
  const classes = DEMAND_CLASSES.filter((d) => theme.classIds.includes(d.id))
  if (!classes.length) return unreadable('No costed demand class stands against this theme yet')
  const volume = classes.reduce((n, d) => n + d.volumeYr, 0)
  const removed = classes
    .filter((d) => d.eliminationState === 'eliminated')
    .reduce((n, d) => n + d.volumeYr * (d.projectedRemoval ?? 0), 0)
  const verified = classes.filter((d) => d.eliminationState === 'eliminated').length
  return {
    value: volume ? (100 * removed) / volume : 0,
    display: pct(volume ? (100 * removed) / volume : 0),
    note: `${verified} of ${classes.length} mapped classes verified as removed, against ${theme.incidents.toLocaleString('en-GB')} incidents a year`,
    basis: 'measured',
  }
}

/* -------------------------------- The measures ------------------------------- */

export const MEASURES: Record<string, Measure> = {
  access_removed: {
    id: 'access_removed', name: 'Access and login demand removed', unit: 'pct',
    needs: ['tickets'], needsDerivable: ['theme', 'volume'], route: '/governance/elimination',
    read: () => {
      const h = historyFor(ENGAGEMENT.id)
      return h ? themeRemoved(h, 'th_access') : unreadable('No ticket history ingested')
    },
  },
  pipeline_removed: {
    id: 'pipeline_removed', name: 'Pipeline and interface failures removed', unit: 'pct',
    needs: ['tickets'], needsDerivable: ['theme', 'volume'], route: '/governance/elimination',
    read: () => {
      const h = historyFor(ENGAGEMENT.id)
      return h ? themeRemoved(h, 'th_pipeline') : unreadable('No ticket history ingested')
    },
  },
  demand_removed: {
    id: 'demand_removed', name: 'Demand removed from the book', unit: 'pct',
    needs: ['tickets'], needsDerivable: ['volume'], route: '/governance/elimination',
    read: () => ({ value: volumeRemoved(), display: pct(volumeRemoved()), note: 'Only classes verified as eliminated count', basis: 'measured' }),
  },
  cluster_cause_coverage: {
    id: 'cluster_cause_coverage', name: 'Repeating clusters with a named cause', unit: 'pct',
    needs: ['tickets'], needsDerivable: ['recurrence', 'problem_coverage'], route: '/governance/elimination',
    read: () => {
      const h = historyFor(ENGAGEMENT.id)
      if (!h) return unreadable('No ticket history ingested')
      const all = recurring(h)
      const owned = clustersWithCause(h)
      const value = all.length ? (100 * owned.length) / all.length : 0
      return {
        value,
        display: `${owned.length}/${all.length}`,
        note: `${all.length} clusters seen ten times or more; ${all.length - owned.length} carry no costed cause`,
        basis: 'measured',
      }
    },
  },
  unaided_resolution: {
    id: 'unaided_resolution', name: 'Work closed without a person', unit: 'pct',
    needs: ['telemetry'], route: '/operate/room',
    read: () => {
      const closed = WORK_OBJECTS.filter((w) => ['resolved', 'learned'].includes(w.state))
      if (!closed.length) return unreadable('No closed work in the window')
      const unaided = closed.filter((w) => w.autonomy?.mode === 'autonomous')
      const value = (100 * unaided.length) / closed.length
      return { value, display: pct(value), note: `${unaided.length} of ${closed.length} closed items in the window`, basis: 'measured' }
    },
  },
  change_share: {
    id: 'change_share', name: 'Released savings put back into change', unit: 'pct',
    needs: ['contract'], route: '/governance/savings',
    read: () => {
      const quarter = [...TRANSFORM].sort((a, b) => b.quarter.localeCompare(a.quarter))[0]?.quarter
      const rows = TRANSFORM.filter((t) => t.quarter === quarter)
      const hours = rows.reduce((n, t) => n + t.bankedSavingsHrs, 0)
      if (!hours) return unreadable('No banked savings in the latest quarter')
      const value = rows.reduce((n, t) => n + t.reinvestPct * t.bankedSavingsHrs, 0) / hours
      return { value, display: pct(value), note: `Weighted across ${rows.length} towers in ${quarter}`, basis: 'measured' }
    },
  },
  cost_reduction: {
    id: 'cost_reduction', name: 'Charge against the countersigned baseline', unit: 'pct',
    needs: ['contract', 'tickets'], route: '/governance/glidepath',
    read: () => {
      // The glidepath carries a reduction as a negative movement against the
      // baseline. A commitment is a reduction, so it is read as a positive one.
      const g = glidepathAttainment()
      return { value: -g.actual, display: pct(-g.actual), note: `Banked against the baseline; ${pct(-g.contracted)} contracted to date`, basis: 'measured' }
    },
  },
  escalation_rate: {
    id: 'escalation_rate', name: 'Runs escalated to a person', unit: 'pct',
    needs: ['telemetry'], route: '/atlas/lifecycle',
    read: () => {
      const e = escalationSummary()
      return {
        value: e.ratePct,
        display: pct(e.ratePct),
        note: `${e.total} escalations, ${e.waiting} still waiting, median pick-up ${e.medianPickupMins} min`,
        basis: 'measured',
      }
    },
  },
  autonomy_unproven: {
    id: 'autonomy_unproven', name: 'Agents in autonomous service with a check failing', unit: 'count',
    needs: ['telemetry'], route: '/atlas/lifecycle',
    read: ({ fleet }) => {
      if (!fleet) return unreadable('Readiness not read on this request')
      const rows = fleet.agents.filter((a) => a.stage === 'autonomous' && a.blockers.length > 0)
      return {
        value: rows.length,
        display: String(rows.length),
        note: rows.length ? rows.map((r) => r.agent.name).join(', ') : `${fleet.agents.filter((a) => a.stage === 'autonomous').length} autonomous, every check passing`,
        basis: 'measured',
      }
    },
  },
  data_services_meeting: {
    id: 'data_services_meeting', name: 'Data services meeting their availability target', unit: 'pct',
    needs: ['telemetry'], route: '/operate/data-reliability',
    read: () => {
      const s = reliabilitySummary()
      if (!s.measured) return unreadable('No data service has enough history to measure')
      const value = (100 * s.meetingTarget) / s.measured
      return { value, display: `${s.meetingTarget}/${s.measured}`, note: `${s.budgetsExhausted} error budgets exhausted, ${s.openOutages} open`, basis: 'measured' }
    },
  },
  notice_on_time: {
    id: 'notice_on_time', name: 'Incidents notified inside the contract clock', unit: 'pct',
    needs: ['telemetry'], route: '/operate/privacy',
    read: ({ nowMs }) => {
      const s = privacySummary(nowMs)
      const notified = s.incidents.filter((i) => i.notice)
      if (!notified.length) return unreadable('No incident has been notified in the window')
      const onTime = notified.filter((i) => Date.parse(i.notice!.at) <= Date.parse(i.clientDueAt))
      const value = (100 * onTime.length) / notified.length
      return {
        value,
        display: `${onTime.length}/${notified.length}`,
        note: s.noticeOwed ? `${s.noticeOwed} open incident${s.noticeOwed === 1 ? '' : 's'} still owed a notice` : 'No notice outstanding',
        basis: 'measured',
      }
    },
  },
  inventory_reconciled: {
    id: 'inventory_reconciled', name: 'Applications in support that the client also lists', unit: 'pct',
    needs: ['inventory', 'tickets'], needsDerivable: ['inventory_match'], route: '/governance/portfolio',
    read: () => {
      const s = inventorySummary()
      const value = s.reconciledShare * 100
      return {
        value,
        display: pct(value),
        note: `${s.byReconciliation.unrecorded} found but not listed, ${s.byReconciliation.ghost} listed as retired but live`,
        basis: 'measured',
      }
    },
  },
  knowledge_verified: {
    id: 'knowledge_verified', name: 'Volume covered by verified knowledge', unit: 'pct',
    needs: ['estate'], route: '/transition/verify',
    read: () => {
      const value = verifiedVolumeCoverage()
      return { value, display: pct(value), note: 'Weighted by the volume each verified claim covers', basis: 'measured' }
    },
  },
  exit_path_proven: {
    id: 'exit_path_proven', name: 'Holdings with a proven exit path', unit: 'pct',
    needs: ['contract'], route: '/governance/exit',
    read: () => {
      // Proven means one of two things, tested now rather than at exit: it can
      // be handed back in a usable form, or there is a stated reason it stays.
      const r = readExit()
      const proven = r.holdings.filter((h) => h.returnable || h.mustKeep)
      const unproven = r.holdings.filter((h) => !h.returnable && !h.mustKeep)
      return {
        value: (100 * proven.length) / r.holdings.length,
        display: `${proven.length}/${r.holdings.length}`,
        note: unproven.length
          ? `Neither returnable nor with a reason to stay: ${unproven.map((h) => h.holding.name).join(', ')}`
          : `${r.residual.length} retained, each with a stated reason`,
        basis: 'measured',
      }
    },
  },
  handling_time_delta: {
    id: 'handling_time_delta', name: 'Time to resolve against the incumbent', unit: 'pct',
    needs: ['tickets'], needsDerivable: ['handling_time'],
    read: () => unreadable('Nothing to compare against'),
  },
  successor_pack_produced: {
    id: 'successor_pack_produced', name: 'Successor packs produced in the last year', unit: 'count',
    needs: ['contract'], route: '/governance/successor-pack',
    read: ({ nowMs, packExports }) => {
      // Produced, not promised: only a pack that was actually built counts, and
      // only while it is less than a year old.
      const within = (packExports ?? []).filter((e) => nowMs - Date.parse(e.at) <= 365 * 86_400_000)
      const last = [...(packExports ?? [])].sort((a, b) => b.at.localeCompare(a.at))[0]
      return {
        value: within.length,
        display: String(within.length),
        note: last
          ? `Last produced ${last.at.slice(0, 10)} by ${last.by}: ${last.manifest.parts.length} parts, ${last.manifest.rows.toLocaleString('en-GB')} records`
          : 'Never produced: the pack has only ever been counted',
        basis: 'measured',
      }
    },
  },
}

/* ------------------------------- What would fix it --------------------------- */

/**
 * A named step that would move a measure, with the role that owns it. Derived
 * from the same records the measure was read from, so a commitment behind its
 * curve produces a work list rather than a colour.
 */
export interface RecoveryStep {
  what: string
  /** Role id, from the reference roles. */
  owner: string
  route?: string
}

/** Per measure, what would move it. Empty where nothing nameable is outstanding. */
export const RECOVERY: Record<string, (ctx: MeasureCtx) => RecoveryStep[]> = {
  access_removed: () => themeRecovery('th_access'),
  pipeline_removed: () => themeRecovery('th_pipeline'),
  demand_removed: () => themeRecovery('th_access'),
  cluster_cause_coverage: () => {
    const h = historyFor(ENGAGEMENT.id)
    if (!h) return []
    const owned = new Set(clustersWithCause(h).map((c) => c.id))
    return recurring(h)
      .filter((c) => !owned.has(c.id))
      .map((c) => ({ what: `Raise a problem record for “${c.example}” — ${c.incidents} incidents across ${c.months} months`, owner: 'sdm', route: '/governance/elimination' }))
  },
  unaided_resolution: () => [
    { what: 'Promote the action classes already at shadow agreement, or say which the client will not grant', owner: 'aieng', route: '/governance/autonomy' },
  ],
  change_share: () => [
    { what: 'Allocate the quarter’s banked credits to change rather than carrying them', owner: 'exec', route: '/governance/savings' },
  ],
  cost_reduction: () => [
    { what: 'Bank the verified removals against the countersigned baseline, or re-cost the curve', owner: 'commercial', route: '/governance/glidepath' },
  ],
  escalation_rate: () => {
    const e = escalationSummary()
    return e.byReason.map((r) => ({ what: `${r.fix} — ${r.count} escalations`, owner: 'aieng', route: '/atlas/lifecycle' }))
  },
  autonomy_unproven: ({ fleet }) =>
    (fleet?.agents ?? [])
      .filter((a) => a.stage === 'autonomous' && a.blockers.length)
      .map((a) => ({ what: `${a.agent.name}: clear ${a.blockers.map((b) => b.name).join(', ')} or demote it`, owner: 'aieng', route: '/atlas/lifecycle' })),
  data_services_meeting: () => {
    const s = reliabilitySummary()
    return s.services
      .filter((x) => x.measured && !x.meetsTarget)
      .map((x) => ({ what: `${x.service.name}: availability below target`, owner: 'sdm', route: '/operate/data-reliability' }))
  },
  notice_on_time: ({ nowMs }) =>
    privacySummary(nowMs).incidents
      .filter((i) => !i.notice)
      .map((i) => ({ what: `Notify the client of ${i.incident.id} — ${i.hoursLeft !== null && i.hoursLeft < 0 ? `${Math.abs(i.hoursLeft)} h past the clock` : `${i.hoursLeft} h left`}`, owner: 'sdm', route: '/operate/privacy' })),
  inventory_reconciled: () => {
    const s = inventorySummary()
    const steps: RecoveryStep[] = []
    if (s.byReconciliation.unrecorded) steps.push({ what: `Add ${s.byReconciliation.unrecorded} found application${s.byReconciliation.unrecorded === 1 ? '' : 's'} to the client’s own list, or stop supporting them`, owner: 'transition', route: '/governance/portfolio' })
    if (s.byReconciliation.ghost) steps.push({ what: `Decide ${s.byReconciliation.ghost} application${s.byReconciliation.ghost === 1 ? '' : 's'} listed as retired but still live`, owner: 'serviceowner', route: '/governance/portfolio' })
    return steps
  },
  knowledge_verified: () => [
    { what: 'Put the remaining claims to the people who know them, highest volume first', owner: 'sme', route: '/transition/verify' },
  ],
  exit_path_proven: () => {
    const r = readExit()
    return r.holdings
      .filter((h) => !h.returnable && !h.mustKeep)
      .map((h) => ({ what: `${h.holding.name}: make it returnable in a usable form, or state the reason it stays`, owner: 'serviceowner', route: '/governance/exit' }))
  },
  handling_time_delta: () => [
    { what: 'Measure resolution time from our own clocks from cutover, then offer the commitment', owner: 'sdm' },
  ],
  successor_pack_produced: () => [
    { what: 'Produce the successor pack and hand it over — every part builds today', owner: 'serviceowner', route: '/governance/successor-pack' },
  ],
}

/** The classes behind a theme that have not yet earned their removal. */
function themeRecovery(themeId: string): RecoveryStep[] {
  const h = historyFor(ENGAGEMENT.id)
  const theme = h ? themeOf(h, themeId) : null
  if (!theme) return []
  if (!theme.classIds.length) return [{ what: `Cost a demand class against “${theme.name}” — ${theme.incidents} incidents a year with none`, owner: 'sdm', route: '/governance/elimination' }]
  return DEMAND_CLASSES
    .filter((d) => theme.classIds.includes(d.id) && d.eliminationState !== 'eliminated')
    .map((d) => ({
      what: `${d.name}: ${d.eliminationState === 'verifying' ? 'finish the verification window' : d.eliminationState === 'approved' ? 'deliver the approved fix' : 'get the candidate approved'}`,
      owner: d.eliminationState === 'candidate' ? 'exec' : 'sdm',
      route: '/governance/elimination',
    }))
}

/* --------------------------------- Remedies ---------------------------------- */

/** What can be recorded against a commitment that is not being met. */
export type RemedyKind = 'accept_recovery' | 'apply_consequence' | 'rebaseline' | 'waive'

export const REMEDY_LABEL: Record<RemedyKind, string> = {
  accept_recovery: 'Recovery accepted',
  apply_consequence: 'Consequence applied',
  rebaseline: 'Re-baselined',
  waive: 'Waived',
}

export interface Remedy {
  commitmentId: string
  kind: RemedyKind
  at: string
  by: string
  /** What was decided, in one clause. */
  detail: string
  /** When the recovery lands, for an accepted recovery. */
  dueAt?: string
  /** Governance reference: minutes, change record, credit note. */
  reference: string
  evidenceId?: string
}

/* ------------------------------ The commitments ------------------------------ */

export type ConsequenceKind = 'fee_at_risk' | 'make_good' | 'none'

export interface Consequence {
  kind: ConsequenceKind
  /** Share of the monthly charge at risk, where that is the consequence. */
  pctOfCharge?: number
  note: string
}

export interface Commitment {
  id: string
  engagementId: string
  stage: StageId
  audience: 'client' | 'provider'
  /** What is promised, as a noun phrase. */
  name: string
  /** The promise in one clause, as a contract would carry it. */
  promise: string
  measureId: string
  target: { value: number; direction: Direction }
  dueAt: string
  /** Where the engagement started from. Read from the history, or declared. */
  baseline: { value: number; display: string; source: string }
  consequence: Consequence
}

export const COMMITMENTS: Commitment[] = [
  /* --------------------------------- Kearney -------------------------------- */
  {
    id: 'cm_access', engagementId: 'eng_kearney', stage: 'improve', audience: 'client',
    name: 'Access and login demand removed, not absorbed',
    promise: 'Three in five access, login and password incidents gone by month 12, verified by the volume not arriving',
    measureId: 'access_removed', target: { value: 60, direction: 'at_least' }, dueAt: '2027-04-01',
    baseline: { value: 0, display: '1,354 a year, none removed', source: 'Ingested ticket history · 49.8% of in-scope incidents' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 5, note: '5% of the monthly charge at risk' },
  },
  {
    id: 'cm_clusters', engagementId: 'eng_kearney', stage: 'improve', audience: 'client',
    name: 'Every repeating failure carries a costed cause',
    promise: 'Every phrasing seen ten times or more has a named cause, an owner and a priced fix',
    measureId: 'cluster_cause_coverage', target: { value: 100, direction: 'at_least' }, dueAt: '2027-06-30',
    baseline: { value: 0, display: '22 clusters, 49 problem records in 12 months', source: 'Ingested ticket history · 42.1% of in-scope incidents sit in clusters no problem record was raised for' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 3, note: '3% of the monthly charge at risk' },
  },
  {
    id: 'cm_pipeline', engagementId: 'eng_kearney', stage: 'improve', audience: 'client',
    name: 'Pipeline and interface failures engineered out',
    promise: 'Half of job, batch, pipeline and interface failures removed at the cause by month 18',
    measureId: 'pipeline_removed', target: { value: 50, direction: 'at_least' }, dueAt: '2027-10-01',
    baseline: { value: 0, display: '173 a year, none removed', source: 'Ingested ticket history · 6.4% of in-scope incidents' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 3, note: '3% of the monthly charge at risk' },
  },
  {
    id: 'cm_unaided', engagementId: 'eng_kearney', stage: 'run', audience: 'client',
    name: 'Work closed without a person',
    promise: 'Seven in ten closed items resolved by an agent inside the autonomy the client granted',
    measureId: 'unaided_resolution', target: { value: 70, direction: 'at_least' }, dueAt: '2027-12-31',
    baseline: { value: 0, display: 'Every ticket touched by a person', source: 'Declared · incumbent operating model' },
    consequence: { kind: 'make_good', note: 'Shortfall delivered at our cost' },
  },
  {
    id: 'cm_cost', engagementId: 'eng_kearney', stage: 'improve', audience: 'client',
    name: 'The charge falls as the work disappears',
    promise: 'Charge down 12% against the countersigned baseline by month 24, banked from verified removals',
    measureId: 'cost_reduction', target: { value: 12, direction: 'at_least' }, dueAt: '2028-03-31',
    baseline: { value: 0, display: '214,000 hours a year', source: 'Declared · countersigned baseline, contract schedule' },
    consequence: { kind: 'make_good', note: 'Shortfall credited against the following quarter' },
  },
  {
    id: 'cm_change', engagementId: 'eng_kearney', stage: 'improve', audience: 'client',
    name: 'Half the spend becomes change, not support',
    promise: 'Half of every hour released goes back into building what the client does not have, by year three',
    measureId: 'change_share', target: { value: 50, direction: 'at_least' }, dueAt: '2029-03-31',
    baseline: { value: 0, display: 'Run work only', source: 'Declared · contract schedule' },
    consequence: { kind: 'make_good', note: 'Shortfall delivered at our cost' },
  },
  {
    id: 'cm_escalate', engagementId: 'eng_kearney', stage: 'run', audience: 'client',
    name: 'Agents escalate rather than guess',
    promise: 'No more than three runs in a hundred reach a person, and every reason published with what fixes it',
    measureId: 'escalation_rate', target: { value: 3, direction: 'at_most' }, dueAt: '2027-06-30',
    baseline: { value: 100, display: 'Every item handled by a person', source: 'Declared · incumbent operating model' },
    consequence: { kind: 'none', note: 'Reported, not charged' },
  },
  {
    id: 'cm_autonomy', engagementId: 'eng_kearney', stage: 'assure', audience: 'client',
    name: 'No autonomy without every readiness check',
    promise: 'No agent acts unsupervised while a readiness check is failing, and the client may demote any agent without a commercial conversation',
    measureId: 'autonomy_unproven', target: { value: 0, direction: 'at_most' }, dueAt: '2027-03-31',
    baseline: { value: 0, display: 'Automation asserted, not evidenced', source: 'Declared · market practice' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 2, note: '2% of the monthly charge at risk' },
  },
  {
    id: 'cm_availability', engagementId: 'eng_kearney', stage: 'run', audience: 'client',
    name: 'Business-critical data services stay available',
    promise: 'Every tier-one data service meets its availability target, with the error budget published monthly',
    measureId: 'data_services_meeting', target: { value: 100, direction: 'at_least' }, dueAt: '2027-03-31',
    baseline: { value: 0, display: 'Availability not measured', source: 'Declared · no telemetry on the Oracle datamart at takeover' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 4, note: '4% of the monthly charge at risk' },
  },
  {
    id: 'cm_notice', engagementId: 'eng_kearney', stage: 'assure', audience: 'client',
    name: 'The client is told inside its own clock',
    promise: 'Any incident touching client data notified within 24 hours, with the external recipients named',
    measureId: 'notice_on_time', target: { value: 100, direction: 'at_least' }, dueAt: '2027-03-31',
    baseline: { value: 0, display: 'Notice on discovery, unclocked', source: 'Declared · contract schedule, 24 h' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 5, note: '5% of the monthly charge at risk' },
  },
  {
    id: 'cm_inventory', engagementId: 'eng_kearney', stage: 'transition', audience: 'client',
    name: 'Nothing supported that the client does not know it owns',
    promise: 'Every application taken into support appears on the client’s own list, or is reported as found',
    measureId: 'inventory_reconciled', target: { value: 95, direction: 'at_least' }, dueAt: '2027-04-01',
    baseline: { value: 38.3, display: '61.7% of in-scope incidents hit unlisted applications', source: 'Ingested ticket history · 1,679 incidents against applications absent from Attachment C.4' },
    consequence: { kind: 'make_good', note: 'Reconciliation completed at our cost' },
  },
  {
    id: 'cm_knowledge', engagementId: 'eng_kearney', stage: 'transition', audience: 'client',
    name: 'Knowledge verified before it is relied on',
    promise: 'Nine tenths of volume covered by a claim someone named has confirmed, before the tower cuts over',
    measureId: 'knowledge_verified', target: { value: 90, direction: 'at_least' }, dueAt: '2027-01-31',
    baseline: { value: 0, display: 'Documents of unknown currency', source: 'Declared · transition lead' },
    consequence: { kind: 'make_good', note: 'Cutover held until met' },
  },
  {
    id: 'cm_exit', engagementId: 'eng_kearney', stage: 'exit', audience: 'client',
    name: 'Leaving is cheap, and proved before it is needed',
    promise: 'Everything the platform holds of the client can be handed back in a usable form or carries the reason it stays, tested each year rather than at exit',
    measureId: 'exit_path_proven', target: { value: 100, direction: 'at_least' }, dueAt: '2027-12-31',
    baseline: { value: 0, display: 'Inventory assembled at exit, contested', source: 'Declared · contract requirement' },
    consequence: { kind: 'make_good', note: 'Exit pack produced at our cost' },
  },
  {
    id: 'cm_successor', engagementId: 'eng_kearney', stage: 'exit', audience: 'client',
    name: 'The successor pack is produced, not promised',
    promise: 'The pack a successor would start from is produced and handed over every year of the term, so leaving is never a project',
    measureId: 'successor_pack_produced', target: { value: 1, direction: 'at_least' }, dueAt: '2027-03-31',
    baseline: { value: 0, display: 'Reverse transition from scratch', source: 'Declared · contract requirement' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 2, note: '2% of the monthly charge at risk' },
  },
  {
    id: 'cm_mttr', engagementId: 'eng_kearney', stage: 'run', audience: 'client',
    name: 'Resolution time against the incumbent',
    promise: 'Not offered: the extract carries no close timestamp, so the platform has nothing to measure a reduction against',
    measureId: 'handling_time_delta', target: { value: 25, direction: 'at_least' }, dueAt: '2027-09-30',
    baseline: { value: 0, display: '—', source: 'Ingested ticket history · no resolution or close timestamp supplied' },
    consequence: { kind: 'none', note: 'Measured from our own clocks from cutover, then offered' },
  },

    /* ----------------------------- Harbour Mutual ----------------------------- */
  {
    id: 'cm_h_access', engagementId: 'eng_harbour', stage: 'improve', audience: 'client',
    name: 'Access and login demand removed, not absorbed',
    promise: 'Three in five access, login and password incidents gone by month 12',
    measureId: 'access_removed', target: { value: 60, direction: 'at_least' }, dueAt: '2028-07-01',
    baseline: { value: 0, display: '—', source: 'No ticket extract ingested' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 5, note: '5% of the monthly charge at risk' },
  },
  {
    id: 'cm_h_cost', engagementId: 'eng_harbour', stage: 'improve', audience: 'client',
    name: 'The charge falls as the work disappears',
    promise: 'Charge down against a countersigned baseline, to be set from the client’s own history',
    measureId: 'cost_reduction', target: { value: 10, direction: 'at_least' }, dueAt: '2029-07-01',
    baseline: { value: 0, display: '—', source: 'No baseline countersigned' },
    consequence: { kind: 'make_good', note: 'Shortfall credited against the following quarter' },
  },
  {
    id: 'cm_h_notice', engagementId: 'eng_harbour', stage: 'assure', audience: 'client',
    name: 'The client is told inside its own clock',
    promise: 'Any incident touching client data notified within 12 hours, with the external recipients named',
    measureId: 'notice_on_time', target: { value: 100, direction: 'at_least' }, dueAt: '2027-10-01',
    baseline: { value: 0, display: '—', source: 'Declared · contract schedule, 12 h' },
    consequence: { kind: 'fee_at_risk', pctOfCharge: 5, note: '5% of the monthly charge at risk' },
  },
]

/* -------------------------------- The reading -------------------------------- */

export type Status = 'met' | 'on_track' | 'behind' | 'missed' | 'not_measurable'

export const STATUS_LABEL: Record<Status, string> = {
  met: 'Met',
  on_track: 'On track',
  behind: 'Behind',
  missed: 'Missed',
  not_measurable: 'Not measurable',
}

export interface CommitmentReading {
  commitment: Commitment
  measure: Measure
  reading: MeasureReading
  status: Status
  /** The straight line from baseline to target, where it should be today. */
  expected: number | null
  /** Distance from the target, in the measure's unit. Negative when past it. */
  gap: number | null
  daysLeft: number
  /** What stops the measure being read, where it cannot be. */
  blocked: string | null
  /** What would move it, named from the records the measure was read from. */
  recovery: RecoveryStep[]
  /** What has been recorded against it, newest first. */
  remedies: Remedy[]
  /** Not being met, and nothing recorded about it. The number that matters. */
  unanswered: boolean
}

export interface Ledger {
  engagement: Engagement
  history: TicketHistory | null
  rows: CommitmentReading[]
  byStatus: Record<Status, number>
  /** Share of the monthly charge riding on commitments not currently met. */
  chargeAtRiskPct: number
  /** Commitments whose baseline was read from the client's own records. */
  fromHistory: number
  /** Not being met, with nothing decided about it. */
  unanswered: number
  /** Steps named across every commitment that is not being met. */
  recoverySteps: number
  nextDue: CommitmentReading | null
}

function statusOf(c: Commitment, r: MeasureReading, expected: number | null, nowMs: number): Status {
  if (r.value === null) return 'not_measurable'
  const met = c.target.direction === 'at_least' ? r.value >= c.target.value : r.value <= c.target.value
  if (met) return 'met'
  if (nowMs > Date.parse(c.dueAt)) return 'missed'
  if (expected === null) return 'on_track'
  return (c.target.direction === 'at_least' ? r.value >= expected : r.value <= expected) ? 'on_track' : 'behind'
}

/** Where the straight line from baseline to target stands today. */
function expectedAt(c: Commitment, startMs: number, nowMs: number): number | null {
  const dueMs = Date.parse(c.dueAt)
  if (!Number.isFinite(dueMs) || dueMs <= startMs) return null
  const share = Math.min(1, Math.max(0, (nowMs - startMs) / (dueMs - startMs)))
  return c.baseline.value + (c.target.value - c.baseline.value) * share
}

export function readCommitment(c: Commitment, ctx: MeasureCtx): CommitmentReading {
  const engagement = ENGAGEMENT_BY_ID[c.engagementId]
  const measure = MEASURES[c.measureId]
  const history = historyFor(c.engagementId)
  const missing = measure.needs.filter((k) => !engagement?.ingested[k])
  const refused = (measure.needsDerivable ?? [])
    .map((d) => (history ? refusal(history, d) : 'No ticket history ingested'))
    .filter((x): x is string => Boolean(x))
  const blocked = missing.length
    ? `Not ingested for this engagement: ${missing.join(', ')}`
    : refused[0] ?? null

  const reading = blocked ? unreadable(blocked) : measure.read(ctx)
  const startMs = Date.parse(engagement?.contract.startsAt ?? '')
  const expected = Number.isFinite(startMs) ? expectedAt(c, startMs, ctx.nowMs) : null
  const status = statusOf(c, reading, expected, ctx.nowMs)
  const off = status === 'behind' || status === 'missed'
  const remedies = (ctx.remedies ?? []).filter((r) => r.commitmentId === c.id).sort((a, b) => b.at.localeCompare(a.at))
  return {
    commitment: c,
    measure,
    reading,
    status,
    expected,
    gap: reading.value === null ? null : Math.round((c.target.direction === 'at_least' ? c.target.value - reading.value : reading.value - c.target.value) * 10) / 10,
    daysLeft: Math.ceil((Date.parse(c.dueAt) - ctx.nowMs) / 86_400_000),
    blocked,
    recovery: off || status === 'not_measurable' ? RECOVERY[c.measureId]?.(ctx) ?? [] : [],
    remedies,
    unanswered: off && remedies.length === 0,
  }
}

const ORDER: Record<Status, number> = { missed: 0, behind: 1, not_measurable: 2, on_track: 3, met: 4 }

/**
 * The ledger for one engagement. A client role never sees a row written for
 * our own stages, in a screen or in a tool result.
 */
export function commitmentLedger(
  opts: {
    engagementId?: string; audience?: 'client' | 'all'; fleet?: FleetLifecycle
    remedies?: Remedy[]; packExports?: PackExport[]; nowMs?: number
  } = {},
): Ledger {
  const engagementId = opts.engagementId ?? ENGAGEMENT.id
  const engagement = ENGAGEMENT_BY_ID[engagementId] ?? ENGAGEMENT
  const ctx: MeasureCtx = { nowMs: opts.nowMs ?? NOW.getTime(), fleet: opts.fleet, remedies: opts.remedies, packExports: opts.packExports }
  const rows = COMMITMENTS
    .filter((c) => c.engagementId === engagementId)
    .filter((c) => (opts.audience ?? 'all') === 'all' || c.audience === 'client')
    .map((c) => readCommitment(c, ctx))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.daysLeft - b.daysLeft)

  const byStatus = rows.reduce(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { met: 0, on_track: 0, behind: 0, missed: 0, not_measurable: 0 } as Record<Status, number>,
  )
  return {
    engagement,
    history: historyFor(engagementId),
    rows,
    byStatus,
    chargeAtRiskPct: rows
      .filter((r) => r.status === 'behind' || r.status === 'missed')
      .reduce((n, r) => n + (r.commitment.consequence.pctOfCharge ?? 0), 0),
    fromHistory: rows.filter((r) => r.commitment.baseline.source.startsWith('Ingested')).length,
    unanswered: rows.filter((r) => r.unanswered).length,
    recoverySteps: rows.reduce((n, r) => n + r.recovery.length, 0),
    nextDue: rows.filter((r) => r.daysLeft >= 0 && r.status !== 'met').sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null,
  }
}
