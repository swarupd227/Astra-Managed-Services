import { DATA_LIFECYCLE, carriesSpecial, dataSummary, impact, isBreach, type DataReading } from './dataEstate'
import { reliabilitySummary } from './dataReliability'
import { dataQualityFindings } from './dataQualityWatch'
import { ENGAGEMENT } from './engagement'
import { escalationSummary, REASON_LABEL } from './escalations'
import { DEMAND_CLASSES, SLAS } from './ledgers'
import { DATASETS } from './provenance'
import { clustersWithCause, historyFor, recurring } from './ticketHistory'
import { thresholdsFor } from './thresholds'
import { WORK_OBJECTS } from './workSeed'

/* ==========================================================================
   The estate watches — one per improvement dimension the contract names.

   "Provide proactive recommendations" is the least falsifiable promise in a
   managed services contract, and the usual way of keeping it is two slides a
   quarter. The data-quality watch showed the alternative: read the register,
   state the conditions that hold, and let the list be the estate's state
   rather than a quota to fill. It was the only dimension with a watch behind
   it, so it was the only one that ever carried a recommendation — five of the
   six the contract names had never carried one, not because nothing was
   wrong but because nothing was looking.

   These are the other five. Every finding is derived from a register the
   platform already reads, carries what it was read from so it can be
   checked, and says what would end it. None carries a currency figure it
   cannot support: a count of datasets does not become dollars by being
   multiplied by something.

   A watch with nothing to say says nothing. A dimension stays silent when its
   register is empty, and the cadence measure reports that silence as ours to
   answer for — which is the point of counting it.
   ========================================================================== */

export interface Finding {
  id: string
  /** The standard dimension it serves. */
  dimensionId: string
  /** The agent whose watch derived it. */
  agentId: string
  /** The condition and the fix, in one line. */
  title: string
  /** How many things the condition holds for. */
  count: number
  /** What the condition was read from, precisely enough to be checked. */
  readFrom: string
  /** What ends it. */
  fix: string
  /** A few of them, named. */
  examples: string[]
  /** The page carrying the evidence. */
  route: string
  /** Downstream readers exposed, where the register knows. */
  exposure?: { consumers: number; largestAudience: number | null }
}

/** A finding, or nothing where the condition does not hold. */
function when(
  held: boolean,
  f: () => Omit<Finding, 'dimensionId' | 'agentId'>,
  dimensionId: string,
  agentId: string,
): Finding | null {
  return held ? { ...f(), dimensionId, agentId } : null
}

const kept = (xs: (Finding | null)[]) => xs.filter((f): f is Finding => f !== null)

/* --------------------------- Platform capabilities --------------------------- */

/**
 * What the platform cannot do yet that the estate needs.
 *
 * Read from the platform's own provenance register and from the limits the
 * ingested history states about itself. Both already exist to keep the
 * screens honest; they also happen to be the most precise statement of the
 * platform's own gaps that anyone could write, so the watch reads them rather
 * than somebody's roadmap.
 */
export function capabilityFindings(): Finding[] {
  const notBuilt = DATASETS.filter((d) => d.maturity === 'not_built')
  const partial = DATASETS.filter((d) => d.maturity === 'partial')
  const h = historyFor(ENGAGEMENT.id)
  const cannot = h?.cannot ?? []

  return kept([
    when(notBuilt.length > 0, () => ({
      id: 'cap_not_built',
      title: `Build the ${notBuilt.length} capabilit${notBuilt.length === 1 ? 'y' : 'ies'} the platform reports as not built — each one is a question it currently cannot answer`,
      count: notBuilt.length,
      readFrom: 'The provenance register: datasets whose maturity is not_built',
      fix: 'Instrument or ingest the records behind each, so the screens that depend on them read something',
      examples: notBuilt.slice(0, 3).map((d) => d.name),
      route: '/governance/provenance',
    }), 'platform_capability', 'agt_herald'),

    when(partial.length > 0, () => ({
      id: 'cap_partial',
      title: `Finish the ${partial.length} capabilities that are partial — each reads real figures over an incomplete source`,
      count: partial.length,
      readFrom: 'The provenance register: datasets whose maturity is partial, with the caution each one carries',
      fix: 'Close the stated gap in each source, or keep the caution on the screen that reads it',
      examples: partial.slice(0, 3).map((d) => d.name),
      route: '/governance/provenance',
    }), 'platform_capability', 'agt_herald'),

    when(cannot.length > 0, () => ({
      id: 'cap_extract_limits',
      title: `Get the ${cannot.length} missing field${cannot.length === 1 ? '' : 's'} into the ticket extract — ${cannot.map((c) => c.what.replace(/_/g, ' ')).join(' and ')} cannot be measured without them`,
      count: cannot.length,
      readFrom: 'The ingested ticket history: the limitations it states about itself',
      fix: 'Supply the fields in the next extract, and the measures that refuse today begin to read',
      examples: cannot.map((c) => c.because),
      route: '/governance/commitments',
    }), 'platform_capability', 'agt_herald'),
  ])
}

/* --------------------------------- Automation -------------------------------- */

/**
 * Work a person does today that an agent or a self-service path could take.
 *
 * Read from the costed demand classes, which already carry the volume, the
 * hours and the cause from the client's own ticket history. A class that
 * recurs, has a named cause and has not been eliminated is a candidate by
 * definition; the watch orders them by the effort they consume rather than by
 * how interesting they are.
 */
export function automationFindings(): Finding[] {
  const costed = DEMAND_CLASSES.filter((d) => d.volumeBasis !== 'sampled' && d.hoursYr > 0)
  const candidates = costed
    .filter((d) => d.eliminationState === 'candidate' && d.cause)
    .sort((a, b) => b.hoursYr - a.hoursYr)
  const top = candidates.slice(0, 5)
  const hours = top.reduce((n, d) => n + d.hoursYr, 0)
  const selfService = candidates.filter((d) => d.proposalType === 'self_service')
  const rising = costed.filter((d) => d.trend > 0).sort((a, b) => b.volumeYr * b.trend - a.volumeYr * a.trend)

  return kept([
    when(top.length > 0, () => ({
      id: 'auto_top_classes',
      title: `Automate the ${top.length} heaviest costed classes still handled by hand — ${hours.toLocaleString('en-GB')} hours a year between them`,
      count: top.length,
      readFrom: 'The demand ledger: classes costed from the client’s own ticket history, with a named cause and no elimination yet',
      fix: 'Approve a candidate per class, then bank the removal only once its volume has actually decayed',
      examples: top.map((d) => `${d.name} — ${d.volumeYr.toLocaleString('en-GB')}/yr, ${d.hoursYr.toLocaleString('en-GB')} h`),
      route: '/governance/elimination',
    }), 'automation', 'agt_prospect'),

    when(selfService.length > 0, () => ({
      id: 'auto_self_service',
      title: `Give requesters a self-service path for the ${selfService.length} class${selfService.length === 1 ? '' : 'es'} that needs no one in the middle`,
      count: selfService.length,
      readFrom: 'The demand ledger: classes whose costed candidate is a self-service path',
      fix: 'Publish the path and measure the demand that stops arriving, rather than the tickets closed faster',
      examples: selfService.slice(0, 3).map((d) => d.name),
      route: '/governance/elimination',
    }), 'automation', 'agt_prospect'),

    when(rising.length > 0, () => ({
      id: 'auto_rising',
      title: `Take the ${rising.length} rising class${rising.length === 1 ? '' : 'es'} first — they cost more every month they are left`,
      count: rising.length,
      readFrom: 'The demand ledger: costed classes whose trend is upward against their own history',
      fix: 'Treat the cause, and the trend is the measure of whether it worked',
      examples: rising.slice(0, 3).map((d) => `${d.name} — ${Math.round(d.trend * 100)}% and rising`),
      route: '/governance/elimination',
    }), 'automation', 'agt_prospect'),
  ])
}

/* -------------------------------- Performance -------------------------------- */

/**
 * Run duration, availability against target, and the headroom before a window
 * is missed.
 *
 * The strongest finding here is the one nobody asks for: a load whose fitted
 * duration is lengthening has a date on which it stops fitting its window,
 * and the reliability reader already computes it. Saying so before it happens
 * is the difference between a recommendation and a post-incident review.
 */
export function performanceFindings(): Finding[] {
  const r = reliabilitySummary()
  const lengthening = r.runs.filter((x) => x.duration.daysToMiss !== null).sort((a, b) => a.duration.daysToMiss! - b.duration.daysToMiss!)
  const exhausted = r.services.filter((s) => s.budget.state === 'exhausted')
  const blind = r.services.filter((s) => s.unobserved.length > 0)
  const noHeadroom = SLAS.filter((s) => s.kind === 'sla' && s.headroom === 0)

  return kept([
    when(lengthening.length > 0, () => ({
      id: 'perf_lengthening',
      title: `Shorten the ${lengthening.length} load${lengthening.length === 1 ? '' : 's'} that will stop fitting their window — the first in ${lengthening[0].duration.daysToMiss} days`,
      count: lengthening.length,
      readFrom: 'The reliability reader: fitted run duration against its window, with the slope per day',
      fix: 'Cut the duration or widen the window before the date, and keep the slope flat afterwards',
      examples: lengthening.slice(0, 3).map((x) => `${x.item.name} — ${x.duration.daysToMiss} days, +${x.duration.slopePerDay.toFixed(1)} min/day`),
      route: '/operate/data-reliability',
    }), 'performance', 'agt_custodian'),

    when(exhausted.length > 0, () => ({
      id: 'perf_budget',
      title: `Restore the ${exhausted.length} service${exhausted.length === 1 ? '' : 's'} whose error budget is spent — any further downtime is a breach, not a margin`,
      count: exhausted.length,
      readFrom: 'The reliability reader: error budget used against allowed, per data service',
      fix: 'Treat the cause of the largest outage, then hold the budget for a full period before relaxing',
      examples: exhausted.slice(0, 3).map((s) => s.service.name),
      route: '/operate/data-reliability',
    }), 'performance', 'agt_custodian'),

    when(blind.length > 0, () => ({
      id: 'perf_blind',
      title: `Instrument the chains behind ${blind.length} service${blind.length === 1 ? '' : 's'} — availability cannot be stated for a service built on something unwatched`,
      count: blind.length,
      readFrom: 'The reliability reader: services with an unobserved item anywhere in their chain',
      fix: 'Land run and freshness signals on each unobserved item, so the service becomes measurable',
      examples: blind.slice(0, 3).map((s) => `${s.service.name} — ${s.unobserved.length} unobserved upstream`),
      route: '/operate/data-reliability',
    }), 'performance', 'agt_custodian'),

    when(noHeadroom.length > 0, () => ({
      id: 'perf_headroom',
      title: `Buy back headroom on the ${noHeadroom.length} service level${noHeadroom.length === 1 ? '' : 's'} with none left this month — one more breach costs a credit`,
      count: noHeadroom.length,
      readFrom: 'The service level register: attainment against target with no breaches left in the month',
      fix: 'Reduce the demand that consumes the allowance, rather than working the queue harder',
      examples: noHeadroom.slice(0, 3).map((s) => s.name),
      route: '/governance/sla',
    }), 'performance', 'agt_custodian'),
  ])
}

/* --------------------------------- Security ---------------------------------- */

/** Downstream readers of a set of items, counted once each. */
function exposure(items: DataReading[]): { consumers: number; largestAudience: number | null } {
  const seen = new Set<string>()
  let largest: number | null = null
  for (const i of items) {
    const x = impact(i.id)
    for (const c of x.consumers) seen.add(c.id)
    if (x.largestAudience !== null) largest = Math.max(largest ?? 0, x.largestAudience)
  }
  return { consumers: seen.size, largestAudience: largest }
}

/**
 * Exposure, entitlement, patch currency and what an agent may do unattended.
 *
 * The retention finding is the one a client rarely gets told: the estate
 * register holds both the retention a dataset states and the age of the
 * oldest record in it, so holding data past its own stated limit is a
 * subtraction, not an audit.
 */
export function securityFindings(): Finding[] {
  const s = dataSummary()
  const restricted = s.items.filter((i) => i.classification === 'restricted')
  const unenforced = restricted.filter((i) => DATA_LIFECYCLE[i.kind].contracted && i.contractState !== 'enforced')
  const overRetained = s.items.filter((i) => i.retentionDays !== undefined && i.oldestRecordDays !== undefined && i.oldestRecordDays > i.retentionDays)
  const special = s.items.filter((i) => i.kind === 'recipient' && carriesSpecial(i))
  const breachingRestricted = restricted.filter((i) => isBreach(i.own))

  return kept([
    when(unenforced.length > 0, () => ({
      id: 'sec_unenforced_restricted',
      title: `Enforce the contracts on ${unenforced.length} item${unenforced.length === 1 ? '' : 's'} holding restricted data — nothing is checking what leaves them`,
      count: unenforced.length,
      readFrom: 'The estate register: items classified restricted whose contract is declared or absent',
      fix: 'Move each contract to enforced, so a breach stops the run rather than reaching a reader',
      examples: unenforced.slice(0, 3).map((i) => i.name),
      route: '/operate/data',
      exposure: exposure(unenforced),
    }), 'security', 'agt_warden'),

    when(overRetained.length > 0, () => ({
      id: 'sec_over_retained',
      title: `Delete what ${overRetained.length} item${overRetained.length === 1 ? '' : 's'} hold past their own stated retention — the oldest by ${Math.max(...overRetained.map((i) => i.oldestRecordDays! - i.retentionDays!))} days`,
      count: overRetained.length,
      readFrom: 'The estate register: the retention each item states against the age of the oldest record it holds',
      fix: 'Expire the surplus and schedule the deletion, backups included, then verify the oldest record moves',
      examples: overRetained.slice(0, 3).map((i) => `${i.name} — ${i.oldestRecordDays} days held against ${i.retentionDays} allowed`),
      route: '/operate/privacy',
    }), 'security', 'agt_warden'),

    when(special.length > 0, () => ({
      id: 'sec_special_recipients',
      title: `Re-test the basis for sending a special category of personal data to ${special.length} external part${special.length === 1 ? 'y' : 'ies'}`,
      count: special.length,
      readFrom: 'The estate register: external recipients whose categories include a special category',
      fix: 'Confirm the lawful basis and the minimum field set per recipient, and record both against the transfer',
      examples: special.slice(0, 3).map((i) => `${i.party ?? i.name}`),
      route: '/operate/privacy',
    }), 'security', 'agt_warden'),

    when(breachingRestricted.length > 0, () => ({
      id: 'sec_breaching_restricted',
      title: `Clear the ${breachingRestricted.length} restricted item${breachingRestricted.length === 1 ? '' : 's'} currently failing their checks — a breach on restricted data is an incident waiting to be classified`,
      count: breachingRestricted.length,
      readFrom: 'The estate register: items classified restricted and failing their own checks or freshness window',
      fix: 'Fix the cause, then confirm no personal data left the estate while the check was failing',
      examples: breachingRestricted.slice(0, 3).map((i) => i.name),
      route: '/operate/data',
      exposure: exposure(breachingRestricted),
    }), 'security', 'agt_warden'),
  ])
}

/* --------------------------- Operational efficiency -------------------------- */

/**
 * Hops, handoffs and rework that cost time without producing anything.
 *
 * Mostly read from the client's own ticket extract, which already states the
 * shape of its demand: how much of it repeats, how much arrives against
 * applications nobody lists, how much is still open. Those are their figures,
 * not ours, which is what makes them hard to argue with.
 */
export function efficiencyFindings(): Finding[] {
  const h = historyFor(ENGAGEMENT.id)
  const t = thresholdsFor(ENGAGEMENT.id)
  const clusters = h ? recurring(h) : []
  const uncaused = h ? clusters.length - clustersWithCause(h).length : 0
  const esc = escalationSummary()
  const gated = WORK_OBJECTS.filter((w) => w.state === 'gated')

  return kept([
    when(Boolean(h) && uncaused > 0, () => ({
      id: 'eff_uncaused_clusters',
      title: `Name a cause for the ${uncaused} repeating cluster${uncaused === 1 ? '' : 's'} that have none — every repeat is the same work done again`,
      count: uncaused,
      readFrom: `The ingested ticket history: phrasings recurring ${t.recurringClusterThreshold} times or more with no costed cause against them`,
      fix: 'A problem record per cluster with a named cause and a priced fix, then measure the repeats stopping',
      examples: clusters.filter((c) => !c.classId).slice(0, 3).map((c) => `${c.example} — ${c.incidents} across ${c.months} months`),
      route: '/governance/elimination',
    }), 'operational_efficiency', 'agt_prospect'),

    when(Boolean(h) && h!.shape.offInventory > 0, () => ({
      id: 'eff_off_inventory',
      title: `Reconcile the ${h!.shape.offInventory} applications taking support but absent from the client’s own list — ${h!.shape.offInventoryPct}% of in-scope incidents hit them`,
      count: h!.shape.offInventory,
      readFrom: 'The ingested ticket history: in-scope incidents against applications not in the supplied inventory',
      fix: 'Add each to the inventory or stop supporting it, so blast radius and attribution are computable',
      examples: [`${h!.shape.offInventoryPct}% of in-scope incidents`, `${h!.scope.inScope.toLocaleString('en-GB')} in-scope incidents in the period`],
      route: '/governance/portfolio',
    }), 'operational_efficiency', 'agt_prospect'),

    when(Boolean(h) && h!.shape.repeatPct > 0, () => ({
      id: 'eff_repeat_rate',
      title: `Cut the ${h!.shape.repeatPct}% of demand that is the same thing arriving again — rework nobody is charged for separately`,
      count: Math.round(h!.shape.repeatPct),
      readFrom: 'The ingested ticket history: the share of in-scope incidents repeating a phrasing already seen',
      fix: 'Treat the causes behind the largest clusters first; the repeat rate is the measure of whether it worked',
      examples: [`${h!.shape.clustersOverTen} clusters of ten or more`, `${h!.shape.clusterSharePct}% of in-scope volume inside them`],
      route: '/governance/elimination',
    }), 'operational_efficiency', 'agt_prospect'),

    when(esc.byReason.length > 0, () => ({
      id: 'eff_handbacks',
      title: `Close the gaps behind ${esc.total} hand-back${esc.total === 1 ? '' : 's'} to a person — the mix says which gap, and they are not the same work`,
      count: esc.total,
      readFrom: 'The escalation log: why each agent stopped, grouped by reason',
      fix: esc.byReason[0].fix,
      examples: esc.byReason.slice(0, 3).map((x) => `${REASON_LABEL[x.reason]} — ${x.count} across ${x.agents} agents`),
      route: '/atlas/lifecycle',
    }), 'operational_efficiency', 'agt_herald'),

    when(gated.length > 0, () => ({
      id: 'eff_gated',
      title: `Decide the ${gated.length} action${gated.length === 1 ? '' : 's'} waiting at a human gate — each one is an agent stopped mid-task`,
      count: gated.length,
      readFrom: 'The live queue: work objects in the gated state',
      fix: 'Clear the queue, then review which gates have never caught anything and are costing more than they catch',
      examples: gated.slice(0, 3).map((w) => `${w.ref} — ${w.title}`),
      route: '/operate/approvals',
    }), 'operational_efficiency', 'agt_herald'),
  ])
}

/* ---------------------------------- Together --------------------------------- */

/** Which agent's watch covers each dimension, for the record. */
export const WATCH_AGENT: Record<string, string> = {
  platform_capability: 'agt_herald',
  data_quality: 'agt_custodian',
  automation: 'agt_prospect',
  performance: 'agt_custodian',
  security: 'agt_warden',
  operational_efficiency: 'agt_prospect',
}

/** Custodian's data-quality findings, in the shape every other watch uses. */
function dataQualityAdapted(): Finding[] {
  return dataQualityFindings().map((f) => ({
    id: f.id,
    dimensionId: 'data_quality',
    agentId: 'agt_custodian',
    title: f.title,
    count: f.items,
    readFrom: f.readFrom,
    fix: f.fix,
    examples: f.examples,
    route: '/operate/data',
    exposure: { consumers: f.consumersExposed, largestAudience: f.largestAudience },
  }))
}

const WATCHES: { dimensionId: string; run: () => Finding[] }[] = [
  { dimensionId: 'data_quality', run: dataQualityAdapted },
  { dimensionId: 'platform_capability', run: capabilityFindings },
  { dimensionId: 'automation', run: automationFindings },
  { dimensionId: 'performance', run: performanceFindings },
  { dimensionId: 'security', run: securityFindings },
  { dimensionId: 'operational_efficiency', run: efficiencyFindings },
]

export interface EstateWatch {
  findings: Finding[]
  /**
   * The dimensions whose watch completed, whether or not it found anything.
   *
   * This has to be stated rather than inferred from the findings, because the
   * two cases it separates look identical in the output: a watch that ran and
   * found nothing left to report, and a watch that could not read its register
   * at all. Anything measuring a condition's disappearance — see
   * `src/domain/experiments.ts` — must only credit the first.
   */
  read: Set<string>
}

/**
 * Every standing finding the estate supports right now, across every
 * dimension that has a watch, and which watches managed to run.
 *
 * Empty where the estate is in order, which is the point: the list is the
 * estate's state and not a quota. A watch that throws takes its own dimension
 * silent rather than the whole register with it — a register that cannot be
 * read at all would otherwise lose five dimensions to one bad row — and is
 * left out of `read` so nothing downstream mistakes its silence for success.
 */
export function estateWatch(): EstateWatch {
  const findings: Finding[] = []
  const read = new Set<string>()
  for (const watch of WATCHES) {
    try {
      findings.push(...watch.run())
      read.add(watch.dimensionId)
    } catch {
      /* A register that cannot be read contributes nothing, and says nothing. */
    }
  }
  return { findings, read }
}

export const estateFindings = (): Finding[] => estateWatch().findings
