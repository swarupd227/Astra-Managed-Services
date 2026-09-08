import { AGENTS, TOWERS } from './estate'
import { DEMAND_CLASSES, GLIDEPATH, INNOVATION, SLAS, bankedHours } from './ledgers'
import type { GlidepathEntry, ISO } from './types'

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
  servedBy: { missions?: string[]; transformAllocations?: string[]; demandClasses?: string[] }
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

const runTowers = () => TOWERS.filter((t) => !['S0', 'S1'].includes(t.state))
const fmtPct = (n: number, dp = 1) => `${n.toFixed(dp)}%`
const fmtHrs = (n: number) => `${Math.round(n).toLocaleString()} h`
const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`

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
        detail: `${sla.name} · ${sla.kind.toUpperCase()} · ${sla.volumeMtd.toLocaleString()} in scope this month, ${sla.breachesMtd} breach${sla.breachesMtd === 1 ? '' : 'es'}`,
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
      const moving = ['approved', 'verifying', 'eliminated'].includes(dc.eliminationState)
      return {
        ...base,
        display: fmtHrs(dc.hoursYr),
        detail: `${dc.name} · ${dc.volumeYr.toLocaleString()}/yr · elimination ${dc.eliminationState.replace(/_/g, ' ')}${dc.projectedRemoval ? ` · ${Math.round(dc.projectedRemoval * 100)}% projected removal` : ''}`,
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
  }
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
