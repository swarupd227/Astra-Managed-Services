import { AGENTS, TOWERS } from './estate'
import { DEMAND_CLASSES, GLIDEPATH, INNOVATION, SLAS, TRANSFORM, bankedHours } from './ledgers'
import { MISSIONS } from './missions'
import { ATTESTATION_DAYS, clientEffortSummary } from './clientEffort'
import { PROGRAMMES, burnDown } from './programmes'
import { deflectionSummary } from './deflection'
import { headroomSummary } from './headroom'
import { inventorySummary } from './inventory'
import { num, usd } from '@/lib/format'
import type { GlidepathEntry, ISO, TransformAllocation } from './types'

/* ==========================================================================
   Objectives — what the client is actually buying.

   Everything else in this platform is measured bottom-up: a tower, a demand
   class, an SLA. An engagement is bought top-down, on objectives, and until
   now the translation between the two happened in someone's head and a
   slide. An Objective makes that translation an object: the statement as the
   client wrote it, the governed measures that evidence it, the work that
   serves it, and — the part that matters — what it needs that this platform
   cannot measure.

   A measure never computes a figure of its own. It resolves to one the
   ledgers already serve, so an objective can never report progress the rest
   of the platform would contradict.
   ========================================================================== */

export type MeasureSource =
  /** An SLA or XLA by id — attainment against its own target. */
  | { kind: 'sla'; id: string }
  /** A tower field, averaged across the towers that carry one. */
  | { kind: 'tower_avg'; field: 'autonomyEligibleVolume' | 'verificationCoverage' }
  /** Hours banked in the glidepath, optionally by attribution class. */
  | { kind: 'glidepath_banked'; attribution?: GlidepathEntry['attribution'] }
  /** Glidepath actual against contracted, weighted by baseline. */
  | { kind: 'glidepath_trajectory' }
  /** A demand class — its remaining effort and where it is in elimination. */
  | { kind: 'demand_class'; id: string }
  /** Innovation value realised and verified. */
  | { kind: 'innovation_verified' }
  /** Model spend against human cost displaced, across the fleet. */
  | { kind: 'spend_ratio' }
  /** Client-declared FTE released from run work. Their book, not ours. */
  | { kind: 'client_effort'; field: 'released' | 'strategic_gained' }
  /** A programme's remaining scope — evidenced completion only. */
  | { kind: 'programme_burndown'; id: string }
  /** Share of arrivals no longer arriving, against agreed baselines. */
  | { kind: 'deflection_rate'; attributedOnly: boolean }
  /** Whether growth was absorbed, or capacity for forecast growth. */
  | { kind: 'growth'; field: 'absorption' | 'headroom' }
  /** Systems under support, or how far the client's record matches reality. */
  | { kind: 'inventory'; field: 'under_support' | 'record_accuracy' }
  /** No measure exists. The reason is required: this is the honest case, not the empty one. */
  | { kind: 'none'; why: string }

export interface ObjectiveMeasure {
  id: string
  label: string
  source: MeasureSource
  target?: number
  /** Which way is good. */
  direction: 'up' | 'down'
  /**
   * True where the client accepted this as a stand-in for something the
   * platform cannot measure directly. A proxy is legitimate; an unlabelled
   * proxy is not.
   */
  proxy?: boolean
  proxyNote?: string
}

export interface Objective {
  id: string
  /** The client's words, not ours. */
  statement: string
  /** Where the statement came from — the document and clause. */
  source: string
  /** Client-side owner. */
  owner: string
  horizon: string
  measures: ObjectiveMeasure[]
  /**
   * Demand classes are curated here because one class legitimately serves
   * several objectives. Missions and transform allocations are not listed:
   * each names the single objective it is for, so the link has one source of
   * truth and cannot contradict itself. See objectiveLinks().
   */
  servedBy: { demandClasses?: string[] }
  state: 'proposed' | 'accepted'
  acceptedBy?: string
  acceptedAt?: ISO
  /** What this objective needs that the platform cannot evidence today. */
  gaps: string[]
}

export type MeasureState = 'on_track' | 'at_risk' | 'no_measure'

export interface ResolvedMeasure {
  id: string
  label: string
  display: string
  detail: string
  target: string | null
  state: MeasureState
  proxy: boolean
  proxyNote?: string
  href?: string
}

/**
 * Towers in run — the same population buildPortfolio() uses for the
 * commercial and workforce figures. It must stay identical: a measure that
 * averaged over a different set would report a rival number for the same
 * concept, which is exactly what this layer exists to prevent.
 */
const runTowers = () => TOWERS.filter((t) => t.state === 'S4')
const fmtPct = (n: number, dp = 1) => `${n.toFixed(dp)}%`
const fmtHrs = (n: number) => `${num(Math.round(n))} h`
const fmtUsd = (n: number) => usd(Math.round(n), 0)

/**
 * Resolves a measure to the figure the ledgers already serve. Never computes
 * a number the rest of the platform does not also report.
 */
export function resolveMeasure(m: ObjectiveMeasure): ResolvedMeasure {
  const base = { id: m.id, label: m.label, proxy: Boolean(m.proxy), proxyNote: m.proxyNote }

  switch (m.source.kind) {
    case 'none':
      return { ...base, display: 'no measure', detail: m.source.why, target: null, state: 'no_measure' }

    case 'sla': {
      const sla = SLAS.find((s) => s.id === (m.source as { id: string }).id)
      if (!sla) return { ...base, display: 'unresolved', detail: `No SLA with id ${(m.source as { id: string }).id}.`, target: null, state: 'no_measure' }
      const ok = sla.attainmentMtd >= sla.attainmentTarget
      return {
        ...base,
        display: sla.metric === 'nps_score' || sla.metric === 'trust_score' || sla.metric === 'friction_index' ? sla.attainmentMtd.toFixed(1) : fmtPct(sla.attainmentMtd),
        detail: `${sla.name} · ${sla.kind.toUpperCase()} · ${sla.volumeMtd.toLocaleString('en-GB')} in scope this month, ${sla.breachesMtd} breach${sla.breachesMtd === 1 ? '' : 'es'}`,
        target: String(sla.attainmentTarget),
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/sla',
      }
    }

    case 'tower_avg': {
      const field = m.source.field
      const towers = runTowers().filter((t) => t[field] > 0)
      const value = towers.length ? towers.reduce((s, t) => s + t[field], 0) / towers.length : 0
      const ok = m.target === undefined ? true : m.direction === 'up' ? value >= m.target : value <= m.target
      return {
        ...base,
        display: fmtPct(value),
        detail: `Mean across ${towers.length} tower${towers.length === 1 ? '' : 's'} carrying a figure`,
        target: m.target === undefined ? null : fmtPct(m.target),
        state: ok ? 'on_track' : 'at_risk',
        href: '/transition/coverage',
      }
    }

    case 'glidepath_banked': {
      const attribution = m.source.attribution
      const value = attribution
        ? GLIDEPATH.filter((g) => g.state === 'banked' && g.attribution === attribution).reduce((s, g) => s + g.hoursSaved, 0)
        : bankedHours()
      const ok = m.target === undefined ? value > 0 : value >= m.target
      return {
        ...base,
        display: fmtHrs(value),
        detail: attribution
          ? `Banked and verified, attributed to ${attribution}`
          : 'Banked and verified across every attribution class',
        target: m.target === undefined ? null : fmtHrs(m.target),
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/glidepath',
      }
    }

    case 'glidepath_trajectory': {
      const towers = runTowers()
      const baseline = towers.reduce((s, t) => s + t.baselineHrsPerQtr, 0) || 1
      const actual = towers.reduce((s, t) => s + t.glidepathActual * t.baselineHrsPerQtr, 0) / baseline
      const contracted = towers.reduce((s, t) => s + t.glidepathContracted * t.baselineHrsPerQtr, 0) / baseline
      // These are reductions, so more negative is better.
      const ok = actual <= contracted
      return {
        ...base,
        display: fmtPct(actual),
        detail: `Weighted by baseline hours across ${towers.length} towers in run · ${ok ? 'ahead of' : 'behind'} the contracted curve`,
        target: fmtPct(contracted),
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/glidepath',
      }
    }

    case 'demand_class': {
      const id = m.source.id
      const dc = DEMAND_CLASSES.find((d) => d.id === id)
      if (!dc) return { ...base, display: 'unresolved', detail: `No demand class with id ${id}.`, target: null, state: 'no_measure' }
      // Seen in the live queue but never costed: there is no annual figure to report.
      if (dc.volumeBasis === 'sampled') {
        return { ...base, display: 'sampled', detail: `${dc.name} · ${dc.sampleCount ?? 0} items sampled`, target: null, state: 'no_measure', href: '/governance/elimination' }
      }
      const moving = ['approved', 'verifying', 'eliminated'].includes(dc.eliminationState)
      return {
        ...base,
        display: fmtHrs(dc.hoursYr),
        detail: `${dc.name} · ${dc.volumeYr.toLocaleString('en-GB')}/yr · elimination ${dc.eliminationState.replace(/_/g, ' ')}${dc.projectedRemoval ? ` · ${Math.round(dc.projectedRemoval * 100)}% projected removal` : ''}`,
        target: dc.projectedRemoval ? fmtHrs(dc.hoursYr * (1 - dc.projectedRemoval)) : null,
        state: moving ? 'on_track' : 'at_risk',
        href: '/governance/elimination',
      }
    }

    case 'innovation_verified': {
      const value = INNOVATION.filter((i) => i.verdict === 'verified').reduce((s, i) => s + (i.realisedValueUsd ?? 0), 0)
      const verified = INNOVATION.filter((i) => i.verdict === 'verified').length
      const failed = INNOVATION.filter((i) => i.verdict === 'failed').length
      const ok = m.target === undefined ? value > 0 : value >= m.target
      return {
        ...base,
        display: fmtUsd(value),
        detail: `${verified} verified of ${INNOVATION.length} in the register · ${failed} recorded as failed rather than quietly dropped`,
        target: m.target === undefined ? null : fmtUsd(m.target),
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/innovation',
      }
    }

    case 'spend_ratio': {
      const cost = AGENTS.reduce((s, a) => s + a.economics.costUsd30d, 0)
      const displacedUsd = (AGENTS.reduce((s, a) => s + a.economics.humanMinsDisplaced30d, 0) / 60) * 78
      const value = displacedUsd ? (cost / displacedUsd) * 100 : 0
      const target = m.target ?? 6
      return {
        ...base,
        display: fmtPct(value, 1),
        detail: `${fmtUsd(cost)} of model spend against ${fmtUsd(displacedUsd)} of human cost displaced, 30 days`,
        target: `≤ ${fmtPct(target, 0)}`,
        state: value <= target ? 'on_track' : 'at_risk',
        href: '/atlas/tokenops',
      }
    }

    /**
     * The client's own declaration about their own staff. The platform holds
     * it and ages it; it does not measure it. A figure whose declarations
     * have gone stale is withheld rather than carried forward, which is why
     * this measure can legitimately resolve to no measure at all.
     */
    case 'client_effort': {
      const s = clientEffortSummary()
      const value = m.source.field === 'released' ? s.releasedFte : s.strategicGained
      const live = s.functions.length - s.staleCount
      if (live === 0) {
        return {
          ...base,
          display: 'no measure', target: null, state: 'no_measure',
          detail: `Every client function's declaration is beyond the ${ATTESTATION_DAYS}-day attestation window. The last figures are not reported as current.`,
        }
      }
      const ok = m.target === undefined ? value > 0 : value >= m.target
      const caveat = s.staleCount ? `, ${s.staleCount} excluded as stale` : ''
      const weak = s.estimatedCount ? ` · ${s.estimatedCount} resting on an estimate` : ''
      return {
        ...base,
        display: `${value.toFixed(1)} FTE`,
        detail: `Declared by ${live} of ${s.functions.length} client functions${caveat}${weak} · corroborated by ${Math.round(s.corroboratingHours).toLocaleString('en-GB')} h banked in the classes they name`,
        target: m.target === undefined ? null : `${m.target.toFixed(1)} FTE`,
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/client-effort',
      }
    }

    /** Remaining scope, counting only what is evidenced gone. */
    case 'programme_burndown': {
      const id = m.source.id
      const p = PROGRAMMES.find((x) => x.id === id)
      if (!p) return { ...base, display: 'unresolved', detail: `No programme with id ${id}.`, target: null, state: 'no_measure' }
      const b = burnDown(p)
      const asserted = b.assertedOnly.length
      // Descoped items leave the denominator, so the display must use the
      // live count rather than the original total — quoting "of 8" against a
      // remaining figure measured out of 7 would misstate both.
      const live = b.total - b.descoped.length
      return {
        ...base,
        display: `${b.remainingEvidenced} of ${live}`,
        detail: `${p.name} · ${b.overdue.length} past target date${asserted ? ` · ${asserted} declared done but not evidenced` : ''}${b.descoped.length ? ` · ${b.descoped.length} descoped and out of the denominator` : ''} · ${b.projectedEndAt ? `at the observed rate, complete ${b.projectedEndAt.slice(0, 7)}` : 'nothing evidenced complete yet, so no rate to project from'}`,
        target: p.targetEndAt.slice(0, 7),
        state: b.onSchedule === true ? 'on_track' : 'at_risk',
        href: '/governance/programmes',
      }
    }

    /**
     * Only the attributed half of a fall is evidence that anything was
     * deflected. Both are offered because a client is entitled to see the
     * gap between them, and the unattributed variant carries the warning.
     */
    case 'deflection_rate': {
      const s = deflectionSummary()
      const value = m.source.attributedOnly ? s.attributedRate : s.rate
      if (value === null) {
        return { ...base, display: 'no measure', target: null, state: 'no_measure', detail: 'No demand class has both an agreed baseline and a long enough observation window to state a rate.' }
      }
      const pct = value * 100
      const ok = m.target === undefined ? pct > 0 : pct >= m.target
      const unattributed = Math.round(s.unexplainedVolume).toLocaleString('en-GB')
      return {
        ...base,
        display: fmtPct(pct),
        detail: m.source.attributedOnly
          ? `Attributed fall only, weighted by baseline volume · ${s.withheldCount} class${s.withheldCount === 1 ? '' : 'es'} withheld for too short a window`
          : `Total fall against agreed baselines · ${unattributed} of ${Math.round(s.fallVolume).toLocaleString('en-GB')} fewer arrivals a year are unattributed and are not evidence of deflection`,
        target: m.target === undefined ? null : fmtPct(m.target),
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/elimination',
      }
    }

    /**
     * Absorption is measurable and may honestly report that it has not been
     * tested; headroom needs a declared business driver and withholds
     * itself where there is none. Both routes can end in no measure, and
     * that is the correct answer rather than a failure of the measure.
     */
    case 'growth': {
      const h = headroomSummary()
      if (m.source.field === 'absorption') {
        if (h.absorption === 'untested') {
          return {
            ...base, display: 'no measure', target: null, state: 'no_measure',
            detail: h.absorptionNote,
          }
        }
        return {
          ...base,
          display: fmtPct(h.businessGrowthPct),
          detail: `Business-caused demand against ${fmtPct(h.effortChangePct)} effort · ${Math.round(h.selfInflictedShare * 100)}% of rising volume is not the client growing`,
          target: m.target === undefined ? null : fmtPct(m.target),
          state: h.absorption === 'absorbed' ? 'on_track' : 'at_risk',
          href: '/governance/headroom',
        }
      }
      if (h.headroomPct === null) {
        return { ...base, display: 'no measure', target: null, state: 'no_measure', detail: h.headroomWithheld ?? 'No forecast to hold capacity against.' }
      }
      const ok = m.target === undefined ? h.headroomPct >= 50 : h.headroomPct >= m.target
      return {
        ...base,
        display: fmtPct(h.headroomPct),
        detail: `Of ${num(Math.round(h.forecastIncrementalYr))} incremental arrivals a year implied by ${h.drivers.length} declared driver${h.drivers.length === 1 ? '' : 's'} · ${h.undeclared.length} further drivers named but unquantified`,
        target: m.target === undefined ? null : fmtPct(m.target),
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/headroom',
      }
    }

    /**
     * The denominator modernisation never had — reported as a floor, since
     * the applications nobody has found are by definition not in it.
     */
    case 'inventory': {
      const inv = inventorySummary()
      if (m.source.field === 'under_support') {
        const ok = m.target === undefined ? true : inv.denominator <= m.target
        return {
          ...base,
          display: `${inv.denominator}`,
          detail: `${inv.recordedInSupport} the client's record lists, plus ${inv.byReconciliation.unrecorded} found and not listed · a floor, not a total · ${inv.inProgramme} of them in a retirement programme`,
          target: m.target === undefined ? null : String(m.target),
          state: ok ? 'on_track' : 'at_risk',
          href: '/governance/portfolio',
        }
      }
      const share = inv.reconciledShare * 100
      const disagreeing = inv.items.length - inv.byReconciliation.reconciled
      const ok = m.target === undefined ? share >= 90 : share >= m.target
      return {
        ...base,
        display: fmtPct(share),
        detail: `${disagreeing} of ${inv.items.length} applications where the client's record and this platform disagree · ${num(inv.disputedIncidents)} incidents a year attach to them`,
        target: m.target === undefined ? null : fmtPct(m.target),
        state: ok ? 'on_track' : 'at_risk',
        href: '/governance/portfolio',
      }
    }
  }
}

export interface ObjectiveLinks {
  missions: { id: string; name: string; tower: string; goal: string }[]
  allocations: (TransformAllocation & { tower: string })[]
  /** Credits committed to this objective, and what they have returned so far. */
  credits: number
  yieldPromised: number
  yieldRealised: number
}

/**
 * What is actually working towards an objective, read from the things that
 * name it rather than from a list kept alongside it.
 */
export function objectiveLinks(objectiveId: string): ObjectiveLinks {
  const missions = MISSIONS.filter((m) => m.objectiveId === objectiveId).map((m) => ({ id: m.id, name: m.name, tower: m.tower, goal: m.goal }))
  const allocations = TRANSFORM.flatMap((t) => t.allocations.filter((a) => a.objectiveId === objectiveId).map((a) => ({ ...a, tower: t.tower })))
  return {
    missions,
    allocations,
    credits: allocations.reduce((s, a) => s + a.credits, 0),
    yieldPromised: allocations.reduce((s, a) => s + a.yieldPromised, 0),
    yieldRealised: allocations.reduce((s, a) => s + (a.yieldRealised ?? 0), 0),
  }
}

/** Transform spend approved without naming an objective — spend with no stated purpose. */
export function unattributedAllocations(): (TransformAllocation & { tower: string })[] {
  return TRANSFORM.flatMap((t) => t.allocations.filter((a) => !a.objectiveId).map((a) => ({ ...a, tower: t.tower })))
}

export interface ObjectiveProgress {
  objective: Objective
  measures: ResolvedMeasure[]
  onTrack: number
  atRisk: number
  unmeasured: number
  /** An objective with no measure at all cannot be reported on, and says so. */
  state: 'on_track' | 'at_risk' | 'unmeasurable'
}

export function objectiveProgress(o: Objective): ObjectiveProgress {
  const measures = o.measures.map(resolveMeasure)
  const onTrack = measures.filter((m) => m.state === 'on_track').length
  const atRisk = measures.filter((m) => m.state === 'at_risk').length
  const unmeasured = measures.filter((m) => m.state === 'no_measure').length
  const state = onTrack + atRisk === 0 ? 'unmeasurable' : atRisk > 0 ? 'at_risk' : 'on_track'
  return { objective: o, measures, onTrack, atRisk, unmeasured, state }
}

export function portfolioProgress(objectives: Objective[]): ObjectiveProgress[] {
  return objectives.map(objectiveProgress)
}
