import { CLIENT, TOWERS } from './estate'
import { DECISIONS, INNOVATION, OBLIGATIONS, SLAS, TRANSFORM, bankedHours } from './ledgers'
import { daysOpen, type Proposal } from './proposals'
import { objectiveProgress, type Objective } from './objectives'
import type { WorkObject } from './types'

/* ==========================================================================
   The portfolio Herald briefs from (Addendum A §A3.2).

   Assembled from the ledgers only — the same governed figures the semantic
   layer serves, never a separate reckoning. Herald may interpret these and
   may not invent others; the prompt says so and the numbers below are the
   only ones it is given.
   ========================================================================== */

export interface Portfolio {
  client: string
  contract: string
  monthElapsed: number
  /**
   * Progress against what the client is buying, not only against the towers.
   * `unmeasured` is carried deliberately: a brief that reported only the
   * measurable half of an objective would read better and be worth less.
   */
  objectives: {
    statement: string
    owner: string
    state: 'on_track' | 'at_risk' | 'unmeasurable'
    accepted: boolean
    measures: { label: string; now: string; target: string | null; state: string; proxy: boolean }[]
    unmeasured: string[]
  }[]
  service: {
    slasMet: number
    slasTotal: number
    breaching: { name: string; attainment: number; target: number }[]
    xlasBreaching: { name: string; attainment: number; target: number }[]
  }
  workforce: {
    resolvedThisWindow: number
    autonomousShare: number
    hoursDisplaced: number
    autonomyEligibleVolume: number
    towersInRun: number
  }
  commercial: {
    glidepathContracted: number
    glidepathActual: number
    bankedHours: number
    creditsAvailable: number
    creditsFrozenTowers: string[]
    verifiedInnovationUsd: number
  }
  awaiting: {
    decisionsOffTrack: { subject: string; owner: string; progress: string }[]
    obligationsOverdue: { title: string; owner: string; dueIn: string }[]
    proposals: { claim: string; from: string; daysOpen: number; expired: boolean; value: string; requested: string }[]
  }
}

export function buildPortfolio(work: WorkObject[], proposals: Proposal[], objectives: Objective[] = []): Portfolio {
  const runTowers = TOWERS.filter((t) => t.state === 'S4')
  const baseline = runTowers.reduce((s, t) => s + t.baselineHrsPerQtr, 0) || 1

  const closed = work.filter((w) => w.state === 'resolved' || w.state === 'learned')
  const autonomous = closed.filter((w) => w.economics.attribution === 'automation').length
  const hoursDisplaced =
    closed.reduce((s, w) => s + Math.max(0, w.economics.estManualMins - w.economics.actualAgentMins), 0) / 60

  const slas = SLAS.filter((s) => s.kind === 'sla')
  const breaching = slas.filter((s) => s.attainmentMtd < s.attainmentTarget)
  const xlasBreaching = SLAS.filter((s) => s.kind === 'xla' && s.attainmentMtd < s.attainmentTarget)

  const open = proposals.filter((p) => p.state === 'open')

  return {
    client: CLIENT.name,
    contract: CLIENT.contract,
    monthElapsed: CLIENT.monthsElapsed,
    objectives: objectives.map((o) => {
      const p = objectiveProgress(o)
      return {
        statement: o.statement.split(':')[0],
        owner: o.owner,
        state: p.state,
        accepted: o.state === 'accepted',
        measures: p.measures
          .filter((m) => m.state !== 'no_measure')
          .map((m) => ({ label: m.label, now: m.display, target: m.target, state: m.state, proxy: m.proxy })),
        unmeasured: p.measures.filter((m) => m.state === 'no_measure').map((m) => m.label),
      }
    }),
    service: {
      slasMet: slas.length - breaching.length,
      slasTotal: slas.length,
      breaching: breaching.map((s) => ({ name: s.name, attainment: s.attainmentMtd, target: s.attainmentTarget })),
      xlasBreaching: xlasBreaching.map((s) => ({ name: s.name, attainment: s.attainmentMtd, target: s.attainmentTarget })),
    },
    workforce: {
      resolvedThisWindow: closed.length,
      autonomousShare: closed.length ? Math.round((autonomous / closed.length) * 100) : 0,
      hoursDisplaced: Math.round(hoursDisplaced * 10) / 10,
      autonomyEligibleVolume:
        Math.round((runTowers.reduce((s, t) => s + t.autonomyEligibleVolume, 0) / (runTowers.length || 1)) * 10) / 10,
      towersInRun: runTowers.length,
    },
    commercial: {
      glidepathContracted:
        Math.round((runTowers.reduce((s, t) => s + t.glidepathContracted * t.baselineHrsPerQtr, 0) / baseline) * 10) / 10,
      glidepathActual:
        Math.round((runTowers.reduce((s, t) => s + t.glidepathActual * t.baselineHrsPerQtr, 0) / baseline) * 10) / 10,
      bankedHours: Math.round(bankedHours()),
      creditsAvailable: TRANSFORM.reduce((s, t) => s + (t.creditsAccrued + t.creditsCarriedIn - t.creditsConsumed), 0),
      creditsFrozenTowers: TRANSFORM.filter((t) => t.freezeState === 'frozen').map((t) => t.tower),
      verifiedInnovationUsd: INNOVATION.filter((i) => i.verdict === 'verified').reduce((s, i) => s + (i.realisedValueUsd ?? 0), 0),
    },
    awaiting: {
      decisionsOffTrack: DECISIONS.filter((d) => d.followThrough?.state === 'red').map((d) => ({
        subject: d.subject,
        owner: d.owner,
        progress: d.followThrough!.progress,
      })),
      obligationsOverdue: OBLIGATIONS.filter((o) => o.state === 'red').map((o) => ({
        title: o.title,
        owner: o.owner,
        dueIn: new Date(o.dueAt) < new Date() ? 'overdue' : 'due shortly',
      })),
      proposals: open.map((p) => ({
        claim: p.claim,
        from: p.from.replace('agt_', ''),
        daysOpen: daysOpen(p),
        expired: daysOpen(p) > 0 && new Date(p.expiresAt) < new Date(),
        value: p.value.note,
        requested: p.requestedDecision,
      })),
    },
  }
}
