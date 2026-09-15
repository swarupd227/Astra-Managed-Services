import { clientEffortSummary } from '@/domain/clientEffort'
import { deflectionSummary } from '@/domain/deflection'
import { AGENT_BY_ID, TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { headroomSummary } from '@/domain/headroom'
import { RECONCILIATION_LABEL, KIND_LABEL, inventorySummary, ungovernedAi } from '@/domain/inventory'
import { AUTONOMY_SCHEDULE } from '@/domain/knowledge'
import { DEMAND_CLASSES, TRANSFORM, bankedHours, verifyingHours } from '@/domain/ledgers'
import { glidepathAttainment } from '@/domain/metrics'
import { budgetUse } from '@/domain/missions'
import { portfolioProgress } from '@/domain/objectives'
import { allBurnDowns } from '@/domain/programmes'
import { AC, AUTONOMY_LEVELS } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { vendorSummary } from '@/domain/vendors'
import { CONSUMER, cohortExperience, issuesAffecting, selfServeOffers } from '@/domain/workplace'
import { PWO_FLAG_LABEL, PWO_STATE_LABEL, workOrderSummary } from '@/domain/workOrders'
import type { Artifact } from './types'
import type { Cell, Figure, FiguresProps } from './cards/figures'

/* ==========================================================================
   Read tools for the registers and instruments. Each builds its payload
   and its figures card from one reading, so the words the agent writes and
   the card beside them come from the same numbers.
   ========================================================================== */

interface Outcome { payload: unknown; artifacts: Artifact[] }
type Executor = (input: Record<string, unknown>) => Outcome

let seq = 0
const figures = (title: string, route: string, props: FiguresProps): Artifact =>
  ({ id: `art_${Date.now().toString(36)}_r${(seq++).toString(36)}`, kind: 'figures', title, props: props as Record<string, unknown>, route })

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const pct = (n: number | null, dp = 1) => (n === null ? '—' : `${(n * 100).toFixed(dp)}%`)
const chip = (text: string, tone?: 'ok' | 'warn' | 'crit' | 'neutral'): Cell => ({ chip: text, tone })
const fig = (label: string, value: string | number, tone?: Figure['tone'], hint?: string, unit?: string): Figure => ({ label, value, tone, hint, unit })

export const REGISTER_EXECUTORS: Record<string, Executor> = {
  get_objectives: () => {
    const progress = portfolioProgress(useAstra.getState().objectives)
    const measures = progress.flatMap((p) => p.measures)
    return {
      payload: {
        objectives: progress.map((p) => ({
          id: p.objective.id, statement: p.objective.statement, owner: p.objective.owner, state: p.state, accepted: p.objective.state === 'accepted',
          measures: p.measures.map((m) => ({ label: m.label, value: m.display, target: m.target, state: m.state, proxy: m.proxy })),
          gaps: p.objective.gaps,
        })),
      },
      artifacts: [figures('Objectives', '/governance/objectives', {
        figures: [
          fig('Objectives', progress.length, undefined, `${progress.filter((p) => p.objective.state === 'accepted').length} accepted`),
          fig('At risk', progress.filter((p) => p.state === 'at_risk').length, progress.some((p) => p.state === 'at_risk') ? 'warn' : 'ok'),
          fig('Measures on track', `${measures.filter((m) => m.state === 'on_track').length}/${measures.length}`),
          fig('Unmeasured', measures.filter((m) => m.state === 'no_measure').length, measures.some((m) => m.state === 'no_measure') ? 'warn' : 'ok'),
        ],
        columns: ['Objective', 'State', 'On track', 'At risk', 'Unmeasured'], numeric: [2, 3, 4],
        rows: progress.map((p) => [p.objective.statement, chip(p.state.replace('_', ' '), p.state === 'on_track' ? 'ok' : p.state === 'at_risk' ? 'warn' : 'crit'), p.onTrack, p.atRisk, p.unmeasured]),
      })],
    }
  },

  get_programmes: () => {
    const burns = allBurnDowns()
    return {
      payload: {
        programmes: burns.map((b) => ({
          id: b.programme.id, name: b.programme.name, total: b.total, remainingEvidenced: b.remainingEvidenced, remainingIfDeclarationsCount: b.remainingAsserted,
          declaredNotEvidenced: b.assertedOnly.map((i) => i.name), overdue: b.overdue.map((i) => i.name), projectedEndAt: b.projectedEndAt, onSchedule: b.onSchedule,
        })),
      },
      artifacts: [figures('Programmes', '/governance/programmes', {
        columns: ['Programme', 'Remaining (evidenced)', 'If declarations count', 'Declared, not evidenced', 'Schedule'], numeric: [1, 2],
        rows: burns.map((b) => [b.programme.name, `${b.remainingEvidenced}/${b.total}`, `${b.remainingAsserted}/${b.total}`, { chips: b.assertedOnly.map((i) => ({ text: i.name, tone: 'warn' as const })) }, b.onSchedule === null ? chip('no rate', 'neutral') : chip(b.onSchedule ? 'on schedule' : 'behind', b.onSchedule ? 'ok' : 'crit')]),
      })],
    }
  },

  get_client_effort: () => {
    const s = clientEffortSummary()
    return {
      payload: {
        releasedFte: s.releasedFte, releasedFteStale: s.releasedFteStale, strategicGained: s.strategicGained, staleFunctions: s.staleCount, estimatedFunctions: s.estimatedCount,
        corroboratingProviderHours: s.corroboratingHours, basis: 'declared by the client, not measured by the platform',
        functions: s.functions.map((f) => ({ function: f.function, runReleased: f.runReleased, strategicGained: f.strategicGained, stale: f.stale, neverReattested: f.neverReattested, strength: f.strength, ageDays: f.ageDays })),
      },
      artifacts: [figures('Client effort', '/governance/client-effort', {
        figures: [fig('Released', s.releasedFte.toFixed(1), undefined, 'declared', 'FTE'), fig('Strategic gained', s.strategicGained.toFixed(1), undefined, undefined, 'FTE'), fig('Stale', s.staleCount, s.staleCount ? 'warn' : 'ok'), fig('Estimated', s.estimatedCount, s.estimatedCount ? 'warn' : 'ok')],
        columns: ['Function', 'Run released', 'Strategic gained', 'Basis', 'Currency'], numeric: [1, 2],
        rows: s.functions.map((f) => [f.function, f.runReleased.toFixed(1), f.strategicGained.toFixed(1), chip(f.strength, f.strength === 'measured' ? 'ok' : 'warn'), chip(f.stale ? 'stale' : f.neverReattested ? 'never re-attested' : `${f.ageDays} d`, f.stale ? 'crit' : 'neutral')]),
      })],
    }
  },

  get_deflection: () => {
    const s = deflectionSummary()
    return {
      payload: {
        totalRate: s.rate, attributedRate: s.attributedRate, withheld: s.withheldCount, fallVolumeYr: s.fallVolume, attributedVolumeYr: s.attributedVolume, unexplainedVolumeYr: s.unexplainedVolume,
        classes: s.readings.map((r) => ({ name: r.className, tower: r.tower, rate: r.rate, attributedShare: r.attributedShare, basis: r.baseline.basis })),
      },
      artifacts: [figures('Deflection', '/governance/objectives', {
        figures: [fig('Attributed', pct(s.attributedRate)), fig('Total fall', pct(s.rate), undefined, 'proxy'), fig('Unexplained', s.unexplainedVolume.toLocaleString('en-GB'), 'warn', 'a year'), fig('Withheld', s.withheldCount, s.withheldCount ? 'warn' : 'ok')],
        columns: ['Class', 'Rate', 'Attributed share', 'Baseline'], numeric: [1, 2],
        rows: s.readings.map((r) => [r.className, pct(r.rate), pct(r.attributedShare, 0), chip(r.baseline.basis.replace(/_/g, ' '), 'neutral')]),
      })],
    }
  },

  get_headroom: () => {
    const s = headroomSummary()
    return {
      payload: {
        demandChangePct: s.demandChangePct, effortChangePct: s.effortChangePct, businessGrowthPct: s.businessGrowthPct, absorption: s.absorption,
        headroomPct: s.headroomPct, headroomWithheld: s.headroomWithheld, selfInflictedShareOfRising: s.selfInflictedShare,
        rising: s.rising.map((r) => ({ cause: r.cause, volumeYr: r.volumeYr, incrementalYr: r.incrementalYr })),
      },
      artifacts: [figures('Growth headroom', '/governance/headroom', {
        figures: [fig('Headroom', s.headroomPct === null ? '—' : `${s.headroomPct.toFixed(1)}%`), fig('Absorption', s.absorption.replace('_', ' '), s.absorption === 'absorbed' ? 'ok' : 'warn'), fig('Business growth', `${s.businessGrowthPct.toFixed(1)}%`), fig('Not client growth', pct(s.selfInflictedShare, 0), 'warn', 'of rising volume')],
        columns: ['Cause of rising demand', 'Volume a year', 'Incremental a year'], numeric: [1, 2],
        rows: s.rising.map((r) => [r.cause.replace(/_/g, ' '), r.volumeYr.toLocaleString('en-GB'), r.incrementalYr.toLocaleString('en-GB')]),
      })],
    }
  },

  get_glidepath: () => {
    const att = glidepathAttainment()
    const towers = TOWERS.filter((t) => t.glidepathContracted)
    return {
      payload: {
        deliveredPct: att.actual, contractedPct: att.contracted, ahead: att.actual <= att.contracted, bankedHours: bankedHours(), verifyingHours: verifyingHours(),
        towers: towers.map((t) => ({ id: t.id, name: t.name, actualPct: t.glidepathActual, contractedPct: t.glidepathContracted })),
        credits: TRANSFORM.map((l) => ({ tower: l.tower, accrued: l.creditsAccrued, consumed: l.creditsConsumed, frozen: l.freezeState === 'frozen', freezeReason: l.freezeReason ?? null })),
      },
      artifacts: [figures('Glidepath', '/governance/glidepath', {
        figures: [fig('Delivered', `${att.actual.toFixed(1)}%`, att.actual <= att.contracted ? 'ok' : 'warn', `contracted ${att.contracted.toFixed(1)}%`), fig('Banked', bankedHours().toLocaleString('en-GB'), undefined, undefined, 'h'), fig('Verifying', verifyingHours().toLocaleString('en-GB'), undefined, undefined, 'h'), fig('Credits frozen', TRANSFORM.filter((l) => l.freezeState === 'frozen').length, TRANSFORM.some((l) => l.freezeState === 'frozen') ? 'crit' : 'ok')],
        columns: ['Tower', 'Actual', 'Contracted', 'Position'], numeric: [1, 2],
        rows: towers.map((t) => [t.name, `${t.glidepathActual}%`, `${t.glidepathContracted}%`, chip(t.glidepathActual <= t.glidepathContracted ? 'ahead' : 'behind', t.glidepathActual <= t.glidepathContracted ? 'ok' : 'warn')]),
      })],
    }
  },

  get_demand: (input) => {
    const tower = str(input.tower)
    const rows = DEMAND_CLASSES.filter((d) => d.volumeBasis !== 'sampled' && (!tower || d.tower === tower)).sort((a, b) => b.hoursYr - a.hoursYr)
    return {
      payload: { classes: rows.slice(0, 20).map((d) => ({ id: d.id, name: d.name, tower: d.tower, volumeYr: d.volumeYr, hoursYr: d.hoursYr, trend: d.trend, cause: d.cause, eliminationState: d.eliminationState, npv36m: d.npv36m ?? null })), sampledClassesNotCosted: DEMAND_CLASSES.filter((d) => d.volumeBasis === 'sampled' && (!tower || d.tower === tower)).length },
      artifacts: [figures(tower ? `Demand · ${TOWER_BY_ID[tower]?.name ?? tower}` : 'Demand classes', '/governance/elimination', {
        columns: ['Class', 'Volume a year', 'Hours a year', 'Elimination'], numeric: [1, 2],
        rows: rows.map((d) => [d.name, d.volumeYr.toLocaleString('en-GB'), d.hoursYr.toLocaleString('en-GB'), chip(d.eliminationState, d.eliminationState === 'eliminated' ? 'ok' : d.eliminationState === 'none' ? 'neutral' : 'warn')]),
      })],
    }
  },

  get_proposals: () => {
    const open = Object.values(useAstra.getState().proposals).filter((p) => p.state === 'open')
    return {
      payload: { open: open.map((p) => ({ id: p.id, kind: p.kind, from: AGENT_BY_ID[p.from]?.name ?? p.from, claim: p.claim, requestedDecision: p.requestedDecision, expiresAt: p.expiresAt })) },
      artifacts: [figures('Open proposals', '/governance/proposals', {
        figures: [fig('Open', open.length)],
        columns: ['Proposal', 'From', 'Kind'],
        rows: open.map((p) => [p.claim, AGENT_BY_ID[p.from]?.name ?? p.from, chip(p.kind.replace(/_/g, ' '), 'neutral')]),
      })],
    }
  },

  get_vendors: () => {
    const s = vendorSummary()
    return {
      payload: { heldItems: s.heldItems, beyondContractedResponse: s.beyondResponse, renewalsWithin90d: s.renewalsWithin90d, noContract: s.noContract, vendors: s.positions.map((p) => ({ name: p.vendor.name, tier: p.vendor.supportTier, contract: p.vendor.contractRef || null, responseHrs: p.vendor.responseHrs, held: p.held.length, renewalDays: p.renewalDays, applications: p.apps.map((a) => a.name) })) },
      artifacts: [figures('Vendors', '/operate/vendors', {
        figures: [fig('Held on a vendor', s.heldItems, s.heldItems ? 'warn' : 'ok'), fig('Beyond response', s.beyondResponse, s.beyondResponse ? 'crit' : 'ok'), fig('Renewals ≤ 90 d', s.renewalsWithin90d, s.renewalsWithin90d ? 'warn' : 'ok'), fig('No contract', s.noContract, s.noContract ? 'crit' : 'ok')],
        columns: ['Vendor', 'Contract', 'Held', 'Renewal'], numeric: [2, 3],
        rows: s.positions.map((p) => [p.vendor.name, p.vendor.contractRef ? p.vendor.contractRef : chip('none on file', 'crit'), p.held.length || '—', `${p.renewalDays} d`]),
      })],
    }
  },

  get_work_orders: () => {
    const s = workOrderSummary()
    return {
      payload: { open: s.open, inDelivery: s.inDelivery, unauthorisedInDelivery: s.unauthorisedInDelivery, overrun: s.overrun, awaitingAuthorisation: s.awaitingAuthorisation, orders: s.readings.map((r) => ({ id: r.pwo.id, title: r.pwo.title, item: r.pwo.itemId, state: r.pwo.state, authorisedBy: r.pwo.authorisedBy ?? null, estimateHrs: r.pwo.estimateHrs, burnHrs: r.pwo.burnHrs, flags: r.flags })) },
      artifacts: [figures('Work orders', '/transform/work-orders', {
        figures: [fig('Open', s.open), fig('Unauthorised in delivery', s.unauthorisedInDelivery, s.unauthorisedInDelivery ? 'crit' : 'ok'), fig('Overrun', s.overrun, s.overrun ? 'warn' : 'ok'), fig('Awaiting authorisation', s.awaitingAuthorisation)],
        columns: ['Order', 'State', 'Burn', 'Flags'],
        rows: s.readings.map((r) => [`${r.pwo.id} · ${r.pwo.title}`, chip(PWO_STATE_LABEL[r.pwo.state], 'neutral'), r.burnPct === null ? '—' : `${Math.round(r.burnPct)}%`, { chips: r.flags.map((f) => ({ text: PWO_FLAG_LABEL[f], tone: f === 'unauthorised_delivery' ? 'crit' as const : 'warn' as const })) }]),
      })],
    }
  },

  get_portfolio: () => {
    const s = inventorySummary()
    return {
      payload: { underSupport: s.denominator, isFloor: true, recordAgreesShare: s.reconciledShare, disputedIncidentsYr: s.disputedIncidents, drifted: s.drifted, noBaseline: s.noBaseline, ungovernedAi: s.ungovernedAi, applications: s.items.map((i) => ({ name: i.name, kind: i.kind, record: i.clientRecord, observed: i.observed, reconciliation: i.reconciliation, drift: i.config.drift, ungovernedAi: ungovernedAi(i) })) },
      artifacts: [figures('Application portfolio', '/governance/portfolio', {
        figures: [fig('Under support', s.denominator, undefined, 'floor'), fig('Record agrees', pct(s.reconciledShare, 0), s.reconciledShare >= 0.9 ? 'ok' : 'warn'), fig('Incidents in dispute', s.disputedIncidents.toLocaleString('en-GB'), 'warn'), fig('Ungoverned AI', s.ungovernedAi, s.ungovernedAi ? 'crit' : 'ok')],
        columns: ['Application', 'Kind', 'Verdict'],
        rows: [...s.items].sort((a, b) => Number(a.reconciliation === 'reconciled') - Number(b.reconciliation === 'reconciled')).map((i) => [i.name, KIND_LABEL[i.kind], chip(RECONCILIATION_LABEL[i.reconciliation], i.reconciliation === 'reconciled' ? 'ok' : 'warn')]),
      })],
    }
  },

  get_agents: () => {
    const agents = Object.values(useAstra.getState().agents)
    return {
      payload: { agents: agents.map((a) => ({ id: a.id, name: a.name, codename: a.codename, origin: a.origin, state: a.state, ceiling: a.ceiling, towers: a.towers, liveSuccess90d: a.evaluation.liveSuccess90d, driftAlarm: a.driftAlarm, costUsd30d: a.economics.costUsd30d, incidents: a.incidents.length })) },
      artifacts: [figures('Agent fleet', '/atlas/fleet', {
        figures: [fig('Agents', agents.length), fig('Suspended', agents.filter((a) => a.state === 'suspended').length, agents.some((a) => a.state === 'suspended') ? 'crit' : 'ok'), fig('Drift alarms', agents.filter((a) => a.driftAlarm).length, agents.some((a) => a.driftAlarm) ? 'warn' : 'ok'), fig('On probation', agents.filter((a) => a.state === 'probation').length)],
        columns: ['Agent', 'State', 'Ceiling', 'Live success'], numeric: [3],
        rows: agents.map((a) => [`${a.name} · ${a.codename}`, chip(a.state, a.state === 'active' ? 'ok' : a.state === 'suspended' ? 'crit' : 'warn'), AUTONOMY_LEVELS.find((l) => l.mode === a.ceiling)?.label ?? a.ceiling, pct(a.evaluation.liveSuccess90d)]),
      })],
    }
  },

  get_autonomy: (input) => {
    const tower = str(input.tower)
    const cells = AUTONOMY_SCHEDULE.filter((c) => !tower || c.tower === tower)
    const below = cells.filter((c) => c.current < c.target)
    return {
      payload: { cells: below.map((c) => ({ tower: c.tower, actionClass: c.actionClass, current: AUTONOMY_LEVELS[c.current].label, target: AUTONOMY_LEVELS[c.target].label, blocked: c.blocked ?? null })), atTarget: cells.length - below.length, belowTarget: below.length },
      artifacts: [figures(tower ? `Autonomy · ${TOWER_BY_ID[tower]?.name ?? tower}` : 'Autonomy below target', '/governance/autonomy', {
        figures: [fig('At target', cells.length - below.length), fig('Below target', below.length, below.length ? 'warn' : 'ok'), fig('Blocked', below.filter((c) => c.blocked).length, below.some((c) => c.blocked) ? 'crit' : 'ok')],
        columns: ['Tower', 'Action class', 'Current', 'Target', 'Blocker'],
        rows: below.map((c) => [TOWER_BY_ID[c.tower]?.name ?? c.tower, `${c.actionClass} · ${AC[c.actionClass]?.name ?? ''}`, AUTONOMY_LEVELS[c.current].label, AUTONOMY_LEVELS[c.target].label, c.blocked ?? null]),
      })],
    }
  },

  get_ai_incidents: () => {
    const list = useAstra.getState().aiIncidents
    const open = list.filter((i) => i.state !== 'closed')
    return {
      payload: { open: open.length, incidents: list.slice(0, 20).map((i) => ({ id: i.id, class: i.class, severity: i.severity, detector: i.detector, summary: i.summary, state: i.state, notifyDueAt: i.notifyDueAt, rcaDueAt: i.rcaDueAt, agent: i.agentId ?? null })) },
      artifacts: [figures('AI incidents', '/governance/ai-incidents', {
        figures: [fig('Open', open.length, open.length ? 'warn' : 'ok'), fig('Total', list.length)],
        columns: ['Incident', 'Class', 'Severity', 'State'],
        rows: list.map((i) => [i.summary, i.class.replace(/_/g, ' '), chip(i.severity, i.severity === 'P1' ? 'crit' : 'warn'), chip(i.state.replace('_', ' '), i.state === 'closed' ? 'ok' : 'warn')]),
      })],
    }
  },

  get_missions: () => {
    const missions = Object.values(useAstra.getState().missions)
    return {
      payload: { missions: missions.map((m) => ({ id: m.id, name: m.name, tower: m.tower, state: m.state, goal: m.goal, workforce: m.workforce, budgetUsed: Math.round(budgetUse(m).worst * 100) })) },
      artifacts: [figures('Missions', '/missions', {
        figures: [fig('Active', missions.filter((m) => m.state === 'active').length), fig('Near budget', missions.filter((m) => budgetUse(m).worst >= 0.8).length, missions.some((m) => budgetUse(m).worst >= 0.8) ? 'warn' : 'ok')],
        columns: ['Mission', 'Tower', 'State', 'Budget used'], numeric: [3],
        rows: missions.map((m) => [m.name, TOWER_BY_ID[m.tower]?.name ?? m.tower, chip(m.state, m.state === 'active' ? 'ok' : 'neutral'), `${Math.round(budgetUse(m).worst * 100)}%`]),
      })],
    }
  },

  search_evidence: (input) => {
    const q = str(input.query).toLowerCase()
    const all = useAstra.getState().evidence
    const hits = (q ? all.filter((e) => [e.id, e.summary, e.actor, e.workObjectId ?? '', e.agentId ?? '', e.actionClass ?? ''].some((f) => f.toLowerCase().includes(q))) : all).slice(-25).reverse()
    return {
      payload: { query: q, matches: hits.length, records: hits.map((e) => ({ id: e.id, at: e.at, kind: e.kind, actor: e.actor, summary: e.summary, sealed: e.sealed, workObjectId: e.workObjectId ?? null })) },
      artifacts: [figures(q ? `Evidence · “${q}”` : 'Latest evidence', `/governance/evidence${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
        columns: ['Record', 'Kind', 'Actor', 'Seal'],
        rows: hits.map((e) => [e.summary, e.kind, e.actor, chip(e.sealed ? 'sealed' : 'unsealed', e.sealed ? 'ok' : 'crit')]),
      })],
    }
  },

  get_my_workplace: () => {
    const issues = issuesAffecting()
    const offers = selfServeOffers()
    const cohort = cohortExperience()
    return {
      payload: {
        person: CONSUMER.name,
        issuesAffectingYou: issues.map((i) => ({ title: i.work.title, state: i.work.state, via: i.viaNames })),
        selfService: offers.map((o) => ({ name: o.name, available: o.available, unavailableReason: o.unavailableReason })),
        serviceForYourCohort: cohort.map((c) => ({ name: c.name, attainment: c.attainment, target: c.target, meeting: c.meeting, note: 'cohort figure, not personal' })),
      },
      artifacts: [figures('My workplace', '/workplace', {
        figures: [fig('Issues affecting you', issues.length, issues.length ? 'warn' : 'ok'), fig('Self-service available', offers.filter((o) => o.available).length)],
        columns: ['Issue', 'State', 'Through'],
        rows: issues.map((i) => [i.work.title, chip(i.work.state, 'neutral'), i.viaNames.join(', ')]),
      })],
    }
  },

  get_verification_queue: () => {
    const pending = useAstra.getState().assertions.filter((a) => a.verification !== 'human_verified')
    return {
      payload: { pending: pending.length, assertions: pending.slice(0, 20).map((a) => ({ id: a.id, claim: `${a.subject} ${a.predicate} ${a.object}`, tower: a.tower, verification: a.verification, confidence: a.confidence, tier: a.tier })) },
      artifacts: [figures('Knowledge awaiting verification', '/transition/verify', {
        figures: [fig('Awaiting', pending.length, pending.length ? 'warn' : 'ok'), fig('Tier 0', pending.filter((a) => a.tier === 0).length, pending.some((a) => a.tier === 0) ? 'crit' : 'ok')],
        columns: ['Claim', 'Tier', 'State'],
        rows: pending.map((a) => [`${a.subject} ${a.predicate} ${a.object}`, `T${a.tier}`, chip(a.verification.replace(/_/g, ' '), a.verification === 'stale' ? 'crit' : 'warn')]),
      })],
    }
  },
}
