import { buildBrief, readLastSeen } from '@/domain/brief'
import { runConformance } from '@/domain/conformance'
import { COVERED_BUNDLES, bundleCoverage } from '@/domain/coverage'
import { DATA_ITEMS, DATA_ITEM_BY_ID, DATA_LIFECYCLE, ancestors, dataSummary, descendants, impact, isBreach } from '@/domain/dataEstate'
import { accelerationSummary } from '@/domain/acceleration'
import { PHASE_LABEL, fleetLifecycle, readAgent } from '@/domain/agentLifecycle'
import { reliabilitySummary, type ServiceReading } from '@/domain/dataReliability'
import { ENGAGEMENT, ENGAGEMENTS, PACK_BY_ID, SERVICE_PACKS, STAGES, notIngested } from '@/domain/engagement'
import { EXIT_OBLIGATIONS, HOLDINGS, readExit } from '@/domain/exit'
import { AGENT_BY_ID, BUNDLE_BY_ID, TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { SLAS } from '@/domain/ledgers'
import { INCIDENTS, holdsOn, privacySummary, readIncident, readRequest, REQUESTS } from '@/domain/privacy'
import { NOW } from '@/domain/workSeed'
import { ROLE_BY_ID } from '@/domain/reference'
import { releaseSummary } from '@/domain/releases'
import { useAstra } from '@/domain/store'
import { debtSummary } from '@/domain/techDebt'
import type { WorkObject } from '@/domain/types'
import { startRun } from './runs'
import { REGISTER_EXECUTORS } from './toolsRegisters'
import type { Artifact } from './types'

/* ==========================================================================
   The tools, as the browser runs them.

   Each one reads the same domain function its page reads, and returns two
   things: a compact payload the model reasons over, and the card the user
   sees. The payload carries ids, figures and states — never prose the
   model could repeat as if it had checked it.
   ========================================================================== */

export interface ToolOutcome {
  payload: unknown
  artifacts: Artifact[]
}

type Input = Record<string, unknown>
/** `publish` shows a card before the tool returns, for work that narrates itself while it runs. */
type Executor = (input: Input, ctx: { threadId: string; signal: AbortSignal; publish: (a: Artifact) => void }) => ToolOutcome | Promise<ToolOutcome>

let seq = 0
const artifactId = () => `art_${Date.now().toString(36)}_${(seq++).toString(36)}`
const card = (kind: Artifact['kind'], title: string, props: Record<string, unknown> = {}, route?: string): Artifact => ({ id: artifactId(), kind, title, props, route })

const OPEN = ['detected', 'triaged', 'planned', 'gated', 'executing', 'verifying']
const slaUsed = (w: WorkObject) => (w.slaTargetMins ? Math.round((w.slaElapsedMins / w.slaTargetMins) * 100) : 0)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export class ToolError extends Error {}

function findWork(idOrRef: string): WorkObject {
  const work = Object.values(useAstra.getState().work)
  const key = idOrRef.toLowerCase()
  const w = work.find((x) => x.id.toLowerCase() === key || x.ref.toLowerCase() === key)
  if (!w) throw new ToolError(`No work item has the id or reference "${idOrRef}".`)
  return w
}

const person = () => ROLE_BY_ID[useAstra.getState().roleId]?.person ?? 'operator'

function findAgent(idOrName: string) {
  const key = idOrName.toLowerCase()
  const agent = Object.values(useAstra.getState().agents).find((a) => a.id.toLowerCase() === key || a.name.toLowerCase() === key)
  if (!agent) throw new ToolError(`No agent has the id or name "${idOrName}".`)
  return agent
}

function findData(idOrName: string) {
  const key = idOrName.toLowerCase()
  const item = DATA_ITEM_BY_ID[idOrName] ?? DATA_ITEMS.find((i) => i.name.toLowerCase() === key || (i.aliases ?? []).some((a) => a.toLowerCase() === key))
  if (!item) throw new ToolError(`No data item has the id or name "${idOrName}".`)
  return item
}

export const EXECUTORS: Record<string, Executor> = {
  ...REGISTER_EXECUTORS,

  get_estate_overview: () => {
    const work = Object.values(useAstra.getState().work)
    const towers = TOWERS.map((t) => {
      const open = work.filter((w) => w.tower === t.id && OPEN.includes(w.state))
      const slas = SLAS.filter((s) => s.tower === t.id)
      return {
        id: t.id, name: t.name, bundle: t.bundle, bundleName: BUNDLE_BY_ID[t.bundle]?.name, state: t.state,
        openWork: open.length, awaitingApproval: open.filter((w) => w.state === 'gated').length, p1Open: open.filter((w) => w.priority === 'P1').length,
        serviceLevels: slas.map((s) => ({ id: s.id, name: s.name, attainmentMtd: s.attainmentMtd, target: s.attainmentTarget, belowTarget: s.attainmentMtd < s.attainmentTarget })),
        glidepath: { contractedPct: t.glidepathContracted, actualPct: t.glidepathActual },
      }
    })
    return { payload: { towers }, artifacts: [card('estateOverview', 'Estate overview', {}, '/operate/board')] }
  },

  get_brief: () => {
    const s = useAstra.getState()
    const role = ROLE_BY_ID[s.roleId]
    const brief = buildBrief({ work: Object.values(s.work), assertions: s.assertions, proposals: Object.values(s.proposals), role, ...readLastSeen() })
    return {
      payload: {
        since: brief.since, firstVisit: brief.firstVisit, closed: brief.resolved, closedUnaided: brief.autonomous,
        hoursDisplaced: Math.round(brief.hoursSaved * 10) / 10, avoided: brief.prevented, proposalsOpen: brief.proposed,
        asksYours: brief.asks.filter((a) => a.yours).length, asksOthers: brief.asks.filter((a) => !a.yours).length,
        asks: brief.asks.slice(0, 10).map((a) => ({ kind: a.kind, title: a.title, ref: a.ref, yours: a.yours })),
      },
      artifacts: [card('brief', 'While you were away', { since: brief.since, firstVisit: brief.firstVisit }, '/brief')],
    }
  },

  get_work_queue: (input) => {
    const tower = str(input.tower), priority = str(input.priority), state = str(input.state)
    const limit = Math.min(50, Math.max(1, Number(input.limit) || 12))
    if (tower && !TOWER_BY_ID[tower]) throw new ToolError(`No tower has the id "${tower}".`)
    const rows = Object.values(useAstra.getState().work)
      .filter((w) => OPEN.includes(w.state) && (!tower || w.tower === tower) && (!priority || w.priority === priority) && (!state || w.state === state))
      .sort((a, b) => b.breachProbability - a.breachProbability || slaUsed(b) - slaUsed(a))
    return {
      payload: {
        total: rows.length,
        items: rows.slice(0, limit).map((w) => ({ id: w.id, ref: w.ref, title: w.title, tower: w.tower, priority: w.priority, state: w.state, slaUsedPct: slaUsed(w), breachProbability: Math.round(w.breachProbability * 100) / 100, assignee: w.assignee })),
      },
      artifacts: [card('workQueue', tower ? `Queue · ${TOWER_BY_ID[tower].name}` : 'Open work', { tower, priority, state, limit }, tower ? `/operate/board?tower=${tower}` : '/operate/board')],
    }
  },

  get_work_item: (input) => {
    const w = findWork(str(input.id))
    return {
      payload: {
        id: w.id, ref: w.ref, type: w.type, title: w.title, tower: w.tower, service: w.service, demandClass: w.demandClass,
        priority: w.priority, state: w.state, slaUsedPct: slaUsed(w), slaPaused: w.slaPaused, pauseReason: w.pauseReason ?? null,
        assignee: w.assignee, autonomy: w.autonomy ? { mode: w.autonomy.mode, policy: `${w.autonomy.policyId} ${w.autonomy.policyVersion}`, actionClasses: w.autonomy.actionClasses, gates: w.autonomy.gates.map((g) => g.role) } : null,
        timeline: w.narrative.slice(-5).map((n) => ({ at: n.at, text: n.text })),
      },
      artifacts: [card('workItem', `${w.ref} · ${w.title}`, { id: w.id }, `/operate/work/${w.id}`)],
    }
  },

  get_approvals: () => {
    const rows = Object.values(useAstra.getState().work).filter((w) => w.state === 'gated').sort((a, b) => slaUsed(b) - slaUsed(a))
    return {
      payload: {
        total: rows.length,
        items: rows.slice(0, 15).map((w) => ({ id: w.id, ref: w.ref, title: w.title, tower: w.tower, priority: w.priority, slaUsedPct: slaUsed(w), actionClasses: w.autonomy?.actionClasses ?? [], gate: w.autonomy?.gates[0] ? { role: w.autonomy.gates[0].role, timeoutSec: w.autonomy.gates[0].timeoutSec } : null, blastTier: w.autonomy?.blastRadius.maxTier ?? null })),
      },
      artifacts: [card('approvals', 'Awaiting approval', {}, '/operate/approvals')],
    }
  },

  get_sla: (input) => {
    const tower = str(input.tower)
    if (tower && !TOWER_BY_ID[tower]) throw new ToolError(`No tower has the id "${tower}".`)
    const rows = SLAS.filter((s) => (!tower || s.tower === tower) && (!input.atRiskOnly || s.attainmentMtd < s.attainmentTarget || s.headroom === 0))
    return {
      payload: { items: rows.map((s) => ({ id: s.id, name: s.name, kind: s.kind, tower: s.tower, attainmentMtd: s.attainmentMtd, target: s.attainmentTarget, breachesMtd: s.breachesMtd, volumeMtd: s.volumeMtd, headroom: s.headroom, credit: s.credit })) },
      artifacts: [card('sla', tower ? `Service levels · ${TOWER_BY_ID[tower].name}` : 'Service levels', { tower, atRiskOnly: Boolean(input.atRiskOnly) }, '/governance/sla')],
    }
  },

  get_data_estate: (input) => {
    const filter = (str(input.filter) || 'breaches') as 'breaches' | 'unobserved' | 'uncontracted' | 'all'
    const s = dataSummary()
    const rows = s.items.filter((i) =>
      filter === 'all' ? true : filter === 'breaches' ? isBreach(i.own) : filter === 'unobserved' ? i.own === 'unobserved' : DATA_LIFECYCLE[i.kind].contracted && i.contractState !== 'enforced')
    return {
      payload: {
        breaches: s.breaches, exposedDownstream: s.exposed, noTelemetry: s.unobserved, contracts: s.contracts,
        externalRecipients: s.recipients, externalRecipientsWithSpecialCategory: s.specialRecipients,
        unclassified: s.unclassified, noSteward: s.noSteward, lineageGaps: s.lineageGaps,
        items: rows.map((i) => {
          const reach = impact(i.id)
          return {
            id: i.id, name: i.name, kind: i.kind, platform: i.platform, ownState: i.own, inherited: i.inherited ? { state: i.inherited.state, via: i.inherited.via.id } : null,
            contract: i.contractState, classification: i.classification ?? 'unclassified', steward: i.steward ?? null,
            reportsAffected: reach.reports.map((r) => r.name), applicationsAffected: reach.applications.map((a) => a.name),
            externalRecipientsAffected: reach.recipients.map((r) => ({ id: r.id, party: r.party ?? null, categories: r.categories ?? [] })),
            largestAudience: reach.largestAudience,
            recovery: DATA_LIFECYCLE[i.kind].recovery,
          }
        }),
      },
      artifacts: [card('dataEstate', filter === 'breaches' ? 'Data breaches' : 'Data estate', { filter }, '/operate/data')],
    }
  },

  get_data_item: (input) => {
    const i = findData(str(input.id))
    const reading = dataSummary().items.find((x) => x.id === i.id)!
    return {
      payload: {
        id: i.id, name: i.name, kind: i.kind, platform: i.platform, owner: i.owner, steward: i.steward ?? null, classification: i.classification ?? 'unclassified',
        ownState: reading.own, inherited: reading.inherited ? { state: reading.inherited.state, via: reading.inherited.via.id } : null,
        contract: i.contract ? { id: i.contract.id, state: i.contract.state, freshnessHrs: i.contract.freshnessHrs ?? null, checks: i.contract.checks } : null,
        landedHrsAgo: i.lastLandedHrsAgo ?? null, runs30d: reading.level.runs, lineage: i.lineage, telemetry: i.telemetry,
        upstream: ancestors(i.id).map((a) => a.id), feeds: descendants(i.id).map((d) => d.id),
        holds: holdsOn(i.id).map((h) => h.id), recovery: DATA_LIFECYCLE[i.kind].recovery,
        party: i.party ?? null, receives: i.categories ?? null, transfer: i.transfer ?? null, discoveredAt: i.discoveredAt ?? null,
        consumers: impact(i.id).consumers.map((c) => ({ id: c.id, kind: c.kind, party: c.party ?? null })),
      },
      artifacts: [card('dataItem', i.name, { id: i.id }, '/operate/data')],
    }
  },

  get_data_reliability: (input) => {
    const focus = (str(input.focus) || 'services') as 'services' | 'tonight' | 'failures'
    const want = str(input.service).toLowerCase()
    const s = reliabilitySummary()
    const service = want ? s.services.find((x) => x.service.id === want || x.service.name.toLowerCase() === want) : undefined
    if (want && !service) throw new ToolError(`No data service is called "${input.service}". Known: ${s.services.map((x) => x.service.id).join(', ')}.`)
    const readService = (x: ServiceReading) => ({
      id: x.service.id, name: x.service.name, tier: x.service.tier, declaredBy: x.service.declaredBy, due: `${x.service.due} ${x.service.tz}`,
      target: x.service.target, availabilityPct: x.availabilityPct === null ? null : Math.round(x.availabilityPct * 100) / 100,
      measured: x.measured, unplannedMins: x.unplannedMins, plannedMins: x.plannedMins, degradedMins: x.degradedMins,
      budget: x.budget, openOutage: x.open ? { since: x.open.since, cause: x.open.cause?.id ?? null } : null,
      noTelemetryUpstream: x.unobserved.map((i) => i.id), slaId: x.service.slaId ?? null,
    })
    const totals = {
      servicesMeasured: s.measured, servicesOnTarget: s.meetingTarget, servicesNotMeasured: s.services.length - s.measured,
      openOutages: s.openOutages, runs: s.totalRuns, runsOnTime: s.onTime, failuresByRecovery: s.byPath,
      recoveredWithoutAPersonPct: s.withoutPersonPct === null ? null : Math.round(s.withoutPersonPct),
      medianRestartMins: s.medianRestartMins, medianMinsToLanding: s.medianRecoverMins, atRiskTonight: s.atRisk, lengthening: s.lengthening,
    }
    const payload =
      service ? { totals, service: { ...readService(service), outages: service.outages.map((o) => ({ ...o, cause: o.cause?.id ?? null })) } }
      : focus === 'tonight' ? {
        totals,
        runs: s.runs.map((r) => ({
          id: r.item.id, name: r.item.name, platform: r.item.platform, window: `${r.schedule.start}–${r.schedule.due} ${r.schedule.tz}`,
          state: r.tonight.state, risk: r.tonight.risk, projectedAt: r.tonight.projectedAt, marginMins: r.tonight.marginMins,
          blockedBy: r.tonight.blockedBy?.id ?? null, fittedMins: r.duration.fittedMins, slopeMinsPerNight: r.duration.slopePerDay,
          daysToMiss: r.duration.daysToMiss, capacity: r.capacity.map((c) => ({ id: c.id, metric: `${c.platform} ${c.metric}`, peakPct: c.peakPct, thresholdPct: c.thresholdPct, window: c.window })),
        })),
      }
      : focus === 'failures' ? {
        totals,
        failures: s.failures.map((f) => ({
          item: f.item.id, scheduledAt: f.run.scheduledAt, error: f.error, recovery: f.path, recoveredBy: f.recoveredBy,
          restartMins: f.restartMins, minsToLanding: f.recoverMins, inWindow: f.onTime,
        })),
      }
      : { totals, services: s.services.map(readService) }
    const title = service ? service.service.name : focus === 'tonight' ? 'Tonight’s runs' : focus === 'failures' ? 'Data failures · 30 days' : 'Data services'
    return {
      payload,
      artifacts: [card('dataReliability', title, service ? { service: service.service.id } : { focus }, '/operate/data-reliability')],
    }
  },

  get_privacy_requests: (input) => {
    const id = str(input.id)
    if (id) {
      const req = REQUESTS.find((r) => r.id.toLowerCase() === id.toLowerCase())
      if (!req) throw new ToolError(`No privacy request has the id "${id}".`)
      const r = readRequest(req, NOW.getTime(), useAstra.getState().privacyLog)
      return {
        payload: {
          id: req.id, kind: req.kind, subject: req.subject, subjectType: req.subjectType, state: req.state, daysLeft: r.daysLeft, extended: Boolean(req.extended),
          approvedBy: req.approvedBy ?? null, refusal: req.refusal ?? null, flags: r.flags, searchGaps: r.gaps.map((g) => g.id),
          stores: r.items.map((i) => ({ id: i.item.id, verdict: i.verdict, records: i.records, holds: i.holds.map((h) => h.id), action: i.action?.outcome ?? null, backupsUntil: i.residualUntil ?? null })),
          externalRecipients: r.recipients.map((x) => ({
            id: x.item.id, party: x.item.party ?? null, receives: x.item.categories ?? [], specialCategory: x.special,
            via: x.via.map((v) => v.id), told: x.notice ? { by: x.notice.by, at: x.notice.at } : null,
          })),
        },
        artifacts: [card('privacyRequest', `${req.id} · ${req.kind}`, { id: req.id }, '/operate/privacy')],
      }
    }
    const s = privacySummary(NOW.getTime(), useAstra.getState().privacyLog, useAstra.getState().incidentNotices)
    return {
      payload: {
        open: s.open, dueWithin7Days: s.dueSoon, overdue: s.overdue, withSearchGaps: s.withGaps, processBreaches: s.breaches, holds: s.holds,
        requests: s.readings.map((r) => ({ id: r.request.id, kind: r.request.kind, intake: r.request.intake, state: r.request.state, daysLeft: r.open ? r.daysLeft : null, flags: r.flags })),
        pastRetention: s.retention.filter((x) => x.state === 'past').map((x) => ({ id: x.item.id, overDays: x.overDays })),
      },
      artifacts: [card('privacyRequests', 'Privacy requests', {}, '/operate/privacy')],
    }
  },

  get_acceleration: (input) => {
    // The platform is client-facing: the client's own people are never told about our stages.
    const clientSide = ROLE_BY_ID[useAstra.getState().roleId]?.org !== 'artizent'
    const visible = STAGES.filter((x) => !clientSide || x.audience === 'client')
    const stage = str(input.stage)
    if (stage && !visible.some((x) => x.id === stage)) throw new ToolError(`No stage is called "${stage}". Stages: ${visible.map((x) => x.id).join(', ')}.`)
    const s = accelerationSummary(clientSide ? 'client' : 'all')
    const rows = (stage ? s.accelerators.filter((a) => a.stage === stage) : s.accelerators).map((a) => ({
      id: a.id, stage: a.stage, name: a.name, does: a.does, agents: a.agents, state: a.state, givesTimeBackTo: a.saves,
      withoutThePlatform: a.baseline, withIt: { value: a.reading.value, basis: a.reading.basis, note: a.reading.note }, page: a.route ?? null,
    }))
    return {
      payload: {
        engagementRead: { id: ENGAGEMENT.id, client: ENGAGEMENT.client, stage: ENGAGEMENT.stage },
        engagements: ENGAGEMENTS.map((e) => ({
          id: e.id, client: e.client, industry: e.industry, stage: e.stage, currency: e.currency,
          serviceLines: e.serviceLines.map((l) => ({ name: l.name, pack: PACK_BY_ID[l.packId]?.name ?? l.packId })),
          regime: e.regime.name, notIngested: notIngested(e),
        })),
        servicePacks: SERVICE_PACKS.map((p) => ({ id: p.id, name: p.name, covers: p.covers, agents: p.agents, depth: p.depth })),
        stages: s.stages.map((x) => ({ id: x.stage.id, name: x.stage.name, question: x.stage.question, outcome: x.stage.outcome, live: x.live, partial: x.partial, notBuilt: x.notBuilt })),
        totals: { live: s.live, partial: s.partial, notBuilt: s.notBuilt, measuredHere: s.measured, givingTheClientTimeBack: s.forClient, stagesWithNothingBuilt: s.stagesUncovered },
        accelerators: rows,
      },
      artifacts: [card('acceleration', stage ? `Acceleration · ${stage}` : 'Engagement and acceleration', stage ? { stage } : {}, '/governance/acceleration')],
    }
  },

  get_agent_readiness: async (input, ctx) => {
    const who = str(input.agent)
    const agents = Object.values(useAstra.getState().agents)
    // The model check reads the registry the gateway enforces. Unreachable is
    // reported as not known, which is the honest answer, but it must be tried.
    const approved = await fetch('/api/agent/registry', { signal: ctx.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { systems?: { status: string; model: string }[] } | null) =>
        j?.systems ? j.systems.filter((x) => x.status === 'approved').map((x) => x.model) : undefined)
      .catch(() => undefined)
    const f = fleetLifecycle(approved, agents)
    const view = (r: ReturnType<typeof readAgent>) => ({
      id: r.agent.id, name: r.agent.name, owner: r.agent.ownerHuman, origin: r.agent.origin, stage: r.stage,
      checksPassed: r.passed, checksTotal: r.checks.length, nextStage: r.next,
      blockedBy: r.blockers.map((b) => ({ check: b.name, phase: PHASE_LABEL[b.phase], detail: b.detail, readFrom: b.source })),
      couldNotBeChecked: r.unverified.map((b) => ({ check: b.name, phase: PHASE_LABEL[b.phase], detail: b.detail, readFrom: b.source })),
      budgetPct: r.budgetPct,
      setUp: r.ops ? {
        identity: r.agent.nhi, identityScope: r.ops.identityScope, model: r.ops.servedModel, budgetUsd30d: r.ops.budgetUsd30d,
        maxSteps: r.ops.maxSteps, escalatesTo: r.ops.escalateTo, stopTestedAt: r.ops.killSwitchTestedAt ?? null,
        changeRecord: r.ops.changeRef ?? null, contextSources: r.ops.contextSources,
      } : null,
    })
    if (who) {
      const one = f.agents.find((r) => r.agent.id.toLowerCase() === who.toLowerCase() || r.agent.name.toLowerCase() === who.toLowerCase())
      if (!one) throw new ToolError(`No agent has the id or name "${who}". Agents: ${f.agents.map((r) => r.agent.id).join(', ')}.`)
      return {
        payload: {
          ...view(one),
          checks: one.checks.map((c) => ({ check: c.name, phase: PHASE_LABEL[c.phase], state: c.state, detail: c.detail, readFrom: c.source, requiredFrom: c.requiredFrom })),
        },
        artifacts: [card('agentLifecycle', `${one.agent.name} · readiness`, { agent: one.agent.id }, '/atlas/lifecycle')],
      }
    }
    return {
      payload: {
        byStage: f.byStage,
        readyToPromote: f.readyToPromote.map((r) => ({ id: r.agent.id, name: r.agent.name, to: r.next })),
        overBudget: f.overBudget.map((r) => ({ id: r.agent.id, name: r.agent.name, budgetPct: r.budgetPct })),
        fleetGaps: f.commonGaps.map((g) => ({ check: g.check, phase: PHASE_LABEL[g.phase], agentsFailing: g.agents })),
        agents: f.agents.map(view),
      },
      artifacts: [card('agentLifecycle', 'Agent lifecycle and readiness', {}, '/atlas/lifecycle')],
    }
  },

  get_exit_readiness: () => {
    const st = useAstra.getState()
    const r = readExit(st.exitLog, st.assertions.filter((x) => x.verification === 'human_verified').length)
    return {
      payload: {
        monthsLeftOnTerm: r.monthsLeft,
        obligations: r.obligations.map((o) => ({ id: o.obligation.id, clause: o.obligation.clause, obligation: o.obligation.obligation, owner: o.obligation.owner, state: o.state, note: o.note })),
        platformHoldings: r.holdings.map((h) => ({
          id: h.holding.id, name: h.holding.name, kind: h.holding.kind, contains: h.holding.what, location: h.holding.location,
          records: h.count, returnable: h.returnable, state: h.state,
          retainedBecause: h.mustKeep ? `${h.mustKeep.reason} · ${h.mustKeep.until}` : null,
          settled: h.settlement ? { action: h.settlement.action, at: h.settlement.at, by: h.settlement.by, reference: h.settlement.reference, method: h.settlement.method ?? null } : null,
        })),
        returned: r.returned, destroyed: r.destroyed, retained: r.residual.length,
        benchmarkPack: r.benchmark,
        successorPack: r.reverse,
      },
      artifacts: [card('exit', 'Renew or exit', {}, '/governance/exit')],
    }
  },

  record_data_return: (input) => {
    const id = str(input.holding_id), reference = str(input.reference)
    const holding = HOLDINGS.find((h) => h.id === id || h.name.toLowerCase() === id.toLowerCase())
    if (!holding) throw new ToolError(`The platform holds nothing called "${id}". Holdings: ${HOLDINGS.map((h) => h.id).join(', ')}.`)
    if (!holding.returnable) throw new ToolError(`${holding.name} cannot be returned in a usable form; it can only be destroyed.`)
    if (!reference) throw new ToolError('A return needs the reference of the handover.')
    const st = useAstra.getState()
    if (st.exitLog.some((x) => x.holdingId === holding.id && x.action === 'returned')) throw new ToolError(`${holding.name} was already returned.`)
    st.recordDataReturn(holding.id, person(), reference)
    const after = readExit(useAstra.getState().exitLog)
    return {
      payload: { holding: holding.id, recordedBy: person(), reference, outstanding: after.holdings.filter((h) => h.returnable && !h.settlement).map((h) => h.holding.id) },
      artifacts: [card('exit', 'Renew or exit', {}, '/governance/exit')],
    }
  },

  certify_destruction: (input) => {
    const id = str(input.holding_id), reference = str(input.reference), method = str(input.method)
    const holding = HOLDINGS.find((h) => h.id === id || h.name.toLowerCase() === id.toLowerCase())
    if (!holding) throw new ToolError(`The platform holds nothing called "${id}". Holdings: ${HOLDINGS.map((h) => h.id).join(', ')}.`)
    if (holding.mustKeep) throw new ToolError(`${holding.name} is retained: ${holding.mustKeep.reason} · ${holding.mustKeep.until}.`)
    if (!reference || !method) throw new ToolError('A certificate needs the reference and the method of destruction.')
    const st = useAstra.getState()
    const before = readExit(st.exitLog).holdings.find((h) => h.holding.id === holding.id)!
    if (before.destroyRecord) throw new ToolError(`${holding.name} was already destroyed on ${before.destroyRecord.at.slice(0, 10)}.`)
    if (holding.returnable && !before.returnRecord) throw new ToolError(`${holding.name} has not been returned yet. Return it before destroying it, or record the client's waiver first.`)
    st.certifyHoldingDestruction(holding.id, person(), reference, method)
    const after = readExit(useAstra.getState().exitLog)
    return {
      payload: {
        holding: holding.id, certifiedBy: person(), method, reference,
        destroyed: after.destroyed, retained: after.residual.map((h) => ({ id: h.holding.id, because: h.mustKeep?.reason ?? null })),
        obligations: after.obligations.map((o) => ({ id: o.obligation.id, state: o.state })),
      },
      artifacts: [card('exit', 'Renew or exit', {}, '/governance/exit')],
    }
  },

  get_privacy_obligations: (input) => {
    const focus = str(input.focus) === 'records' ? 'records' : 'incidents'
    const st = useAstra.getState()
    const s = privacySummary(NOW.getTime(), st.privacyLog, st.incidentNotices)
    const payload = focus === 'incidents'
      ? {
        clientNoticeHrs: 24, noticeOwed: s.noticeOwed,
        incidents: s.incidents.map((x) => ({
          id: x.incident.id, kind: x.incident.kind, title: x.incident.title, detectedAt: x.incident.detectedAt, people: x.incident.subjects,
          categories: x.incident.categories, items: x.incident.itemIds, closed: Boolean(x.incident.closedAt),
          clientNoticeDueAt: x.clientDueAt, hoursLeft: x.hoursLeft, notified: x.notice, clientRegulatorDueAt: x.regulatorDueAt,
          externalParties: x.recipients.map((r) => r.party ?? r.id), flags: x.flags,
        })),
      }
      : {
        records: s.records.map((x) => ({
          id: x.record.id, activity: x.record.activity, basis: x.record.basis, owner: x.record.owner, categories: x.record.categories,
          declaredRecipients: x.record.recipientIds, reachedByLineage: x.reached.map((r) => r.id), undeclared: x.undeclared.map((r) => r.id),
          transfers: x.record.transfers, unassessedTransfers: x.unassessed.map((r) => ({ id: r.id, country: r.country })),
          dpia: x.record.dpia, specialCategory: x.special, storesWithoutRetention: x.unscheduled.map((i) => i.id), flags: x.flags,
        })),
        recipientsWithNoRecord: s.unrecorded.map((r) => ({ id: r.id, party: r.party ?? null })),
      }
    return {
      payload,
      artifacts: [card('privacyObligations', focus === 'incidents' ? 'Data incidents' : 'Records of processing', { focus }, '/operate/privacy')],
    }
  },

  record_recipient_notice: (input) => {
    const reqId = str(input.request_id), rcpt = str(input.recipient_id), reference = str(input.reference)
    const req = REQUESTS.find((r) => r.id.toLowerCase() === reqId.toLowerCase())
    if (!req) throw new ToolError(`No privacy request has the id "${reqId}".`)
    if (req.kind !== 'erasure') throw new ToolError(`${req.id} is ${req.kind === 'access' ? 'an access' : 'a retrieval'} request; only an erasure is notified to recipients.`)
    const st = useAstra.getState()
    const reading = readRequest(req, NOW.getTime(), st.privacyLog)
    const target = reading.recipients.find((x) => x.item.id === rcpt || x.item.party?.toLowerCase() === rcpt.toLowerCase())
    if (!target) throw new ToolError(`${rcpt} did not receive ${req.id}'s records. Recipients: ${reading.recipients.map((x) => x.item.id).join(', ') || 'none'}.`)
    if (target.notice) throw new ToolError(`${target.item.party ?? target.item.id} was already told, on ${target.notice.at.slice(0, 10)}.`)
    if (!reference) throw new ToolError('A notice needs the reference of the message sent.')
    st.recordRecipientNotice(req.id, target.item.id, person(), reference)
    const after = readRequest(req, NOW.getTime(), useAstra.getState().privacyLog)
    return {
      payload: { request: req.id, recipient: target.item.id, party: target.item.party ?? null, recordedBy: person(), stillNotTold: after.recipients.filter((x) => !x.notice).map((x) => x.item.id), flags: after.flags },
      artifacts: [card('privacyRequest', `${req.id} · erasure`, { id: req.id }, '/operate/privacy')],
    }
  },

  record_incident_notice: (input) => {
    const id = str(input.incident_id), reference = str(input.reference)
    const inc = INCIDENTS.find((i) => i.id.toLowerCase() === id.toLowerCase())
    if (!inc) throw new ToolError(`No data incident has the id "${id}".`)
    const st = useAstra.getState()
    const before = readIncident(inc, NOW.getTime(), st.incidentNotices)
    if (before.notice) throw new ToolError(`${inc.id} was already notified to the client, on ${before.notice.at.slice(0, 16).replace('T', ' ')}.`)
    if (!reference) throw new ToolError('A notice needs the reference of the message sent to the client.')
    st.recordIncidentNotice(inc.id, person(), reference)
    const after = readIncident(inc, NOW.getTime(), useAstra.getState().incidentNotices)
    return {
      payload: { incident: inc.id, notifiedAt: after.notice?.at, by: person(), reference, late: after.flags.includes('notice_late'), clientRegulatorDueAt: after.regulatorDueAt },
      artifacts: [card('privacyObligations', 'Data incidents', { focus: 'incidents' }, '/operate/privacy')],
    }
  },

  get_releases: () => {
    const s = releaseSummary()
    return {
      payload: {
        upcoming: s.upcoming, next14Days: s.next14d, failingRegression: s.gateFail, blocked: s.blocked, insideFreeze: s.inFreeze, changeSuccessPct: s.changeSuccessPct,
        releases: s.readings.map((r) => ({ id: r.release.id, version: r.release.version, item: r.item?.name ?? r.release.itemId, kind: r.item?.kindLabel ?? null, state: r.release.state, window: r.release.windowStart, gate: r.gate, flags: r.flags, blocked: r.blocked })),
      },
      artifacts: [card('releases', 'Releases', {}, '/operate/releases')],
    }
  },

  get_tech_debt: () => {
    const s = debtSummary()
    return {
      payload: {
        live: s.live, measuredInterestHrsYr: s.interestHrs, unmeasured: s.unmeasured, endOfSupportWithin180d: s.endOfSupport, reviewOverdue: s.reviewOverdue,
        recommendation: { hours: s.recommendation.hours, relievedHrsYr: s.recommendation.relievedHrs, items: s.recommendation.recommended.map((r) => r.debt.id), deferred: s.recommendation.deferred.map((d) => ({ id: d.reading.debt.id, reason: d.reason })) },
        items: s.readings.map((r) => ({ id: r.debt.id, title: r.debt.title, category: r.debt.category, state: r.debt.state, interestHrsYr: r.interestBasis === 'unmeasured' ? 'not measured' : r.interestHrs, interestBasis: r.interestBasis, estimateHrs: r.debt.estimateHrs, paybackYrs: r.paybackYrs, flags: r.flags })),
      },
      artifacts: [card('techDebt', 'Technical debt', {}, '/transform/debt')],
    }
  },

  get_coverage: (input) => {
    const bundle = str(input.bundle).toUpperCase()
    if (!COVERED_BUNDLES.includes(bundle)) throw new ToolError(`Bundle "${bundle}" has no service functions defined. Defined: ${COVERED_BUNDLES.join(', ')}.`)
    const c = bundleCoverage(bundle)
    return {
      payload: {
        bundle, name: c.bundleName, owned: c.owned, assistedOnly: c.assisted, uncovered: c.uncovered,
        functions: c.functions.map((f) => ({ name: f.fn.name, state: f.state, owners: f.owners.map((o) => o.agent.name), assists: f.assists.map((o) => o.agent.name) })),
      },
      artifacts: [card('coverage', `Coverage · ${bundle}`, { bundle }, '/atlas/coverage')],
    }
  },

  run_agent: async (input, ctx) => {
    const intent = str(input.intent)
    if (!intent) throw new ToolError('No intent was given.')
    const runId = `run_${Date.now().toString(36)}`
    ctx.publish(card('agentRun', intent, { runId, intent }, '/copilot'))
    const out = await startRun(runId, ctx.threadId, intent, ctx.signal)
    const refusal = out.beats.find((b) => b.t === 'refuse')
    const error = out.beats.find((b) => b.t === 'error')
    const finding = out.proposal?.finding
    return {
      payload: {
        runId,
        routedAgent: out.proposal ? AGENT_BY_ID[out.proposal.routed_agent]?.name ?? out.proposal.routed_agent : null,
        finding: finding ? { title: finding.title, detail: finding.detail, severity: finding.severity, confidence: finding.confidence } : null,
        proposedChange: out.proposal?.requires_action ? { actionClass: out.proposal.action_class, steps: out.proposal.steps.map((s) => s.label) } : null,
        mode: out.mode,
        outcome: error && error.t === 'error' ? `failed: ${error.message}` : refusal && refusal.t === 'refuse' ? `refused: ${refusal.rule}` : out.mode === 'approve_first' ? 'held at a human gate in the run card' : out.proposal?.requires_action ? 'executed and verified' : 'diagnosis only',
        incidents: out.beats.filter((b) => b.t === 'incident').map((b) => (b.t === 'incident' ? b.summary : '')),
      },
      artifacts: [],
    }
  },

  approve_gate: (input) => {
    const w = findWork(str(input.work_item_id))
    if (w.state !== 'gated') throw new ToolError(`${w.ref} is not held at a gate; it is ${w.state}.`)
    const s = useAstra.getState()
    s.approve(w.id, ROLE_BY_ID[s.roleId].person, str(input.note) || undefined)
    const after = useAstra.getState().work[w.id]
    return { payload: { id: w.id, ref: w.ref, approvedBy: ROLE_BY_ID[s.roleId].person, stateNow: after?.state }, artifacts: [card('workItem', `${w.ref} · ${w.title}`, { id: w.id }, `/operate/work/${w.id}`)] }
  },

  decide_proposal: (input) => {
    const s = useAstra.getState()
    const p = s.proposals[str(input.id)]
    if (!p) throw new ToolError(`No proposal has the id "${str(input.id)}".`)
    if (p.state !== 'open') throw new ToolError(`Proposal ${p.id} is already ${p.state}.`)
    const verdict = str(input.verdict) === 'accepted' ? 'accepted' : 'rejected'
    s.decideProposal(p.id, verdict, person(), str(input.note) || undefined)
    return { payload: { id: p.id, state: useAstra.getState().proposals[p.id]?.state, decidedBy: person() }, artifacts: [] }
  },

  set_brake: (input) => {
    const on = Boolean(input.on)
    const s = useAstra.getState()
    s.setBrake('global', on, person())
    const after = useAstra.getState()
    return { payload: { globalBrake: after.suspensions.some((x) => x.scope === 'global'), by: person() }, artifacts: [] }
  },

  suspend_agent: (input) => {
    const agent = findAgent(str(input.agent_id))
    if (agent.state === 'suspended') throw new ToolError(`${agent.name} is already suspended.`)
    const reason = str(input.reason)
    if (!reason) throw new ToolError('A suspension needs a reason.')
    useAstra.getState().suspendAgent(agent.id, person(), reason)
    return { payload: { agent: agent.name, stateNow: useAstra.getState().agents[agent.id]?.state }, artifacts: [] }
  },

  reinstate_agent: (input) => {
    const agent = findAgent(str(input.agent_id))
    if (agent.state !== 'suspended') throw new ToolError(`${agent.name} is not suspended; it is ${agent.state}.`)
    useAstra.getState().reinstateAgent(agent.id, person())
    return { payload: { agent: agent.name, stateNow: useAstra.getState().agents[agent.id]?.state }, artifacts: [] }
  },

  declare_major_incident: (input) => {
    const w = findWork(str(input.work_item_id))
    const s = useAstra.getState()
    if (s.mi.active) throw new ToolError(`A major incident is already open: ${s.mi.title}.`)
    s.declareMi(w.id, person())
    return { payload: { declaredOn: w.ref, majorIncidentOpen: useAstra.getState().mi.active }, artifacts: [card('workItem', `${w.ref} · ${w.title}`, { id: w.id }, '/operate/mim')] }
  },

  run_conformance: () => {
    const run = runConformance()
    useAstra.getState().recordConformance(run, person())
    return {
      payload: { held: run.held, total: run.total, failing: run.results.filter((r) => !r.holds).map((r) => ({ id: r.caseId, commitment: r.commitment, expected: r.expected, observed: r.observed })) },
      artifacts: [],
    }
  },

  accept_objective: (input) => {
    const s = useAstra.getState()
    const o = s.objectives.find((x) => x.id === str(input.id))
    if (!o) throw new ToolError(`No objective has the id "${str(input.id)}".`)
    if (o.state === 'accepted') throw new ToolError(`${o.id} is already accepted.`)
    s.acceptObjective(o.id, person())
    return { payload: { id: o.id, state: useAstra.getState().objectives.find((x) => x.id === o.id)?.state, acceptedBy: person(), gapsAccepted: o.gaps }, artifacts: [] }
  },

  verify_assertion: (input) => {
    const s = useAstra.getState()
    const a = s.assertions.find((x) => x.id === str(input.id))
    if (!a) throw new ToolError(`No assertion has the id "${str(input.id)}".`)
    if (a.verification === 'human_verified' || a.verification === 'stale') throw new ToolError(`${a.id} is ${a.verification.replace(/_/g, ' ')} and cannot be ruled on again.`)
    const verdict = (['verify', 'correct', 'reject'].includes(str(input.verdict)) ? str(input.verdict) : 'verify') as 'verify' | 'correct' | 'reject'
    if (verdict === 'correct' && !str(input.correction)) throw new ToolError('A correction needs the corrected claim.')
    s.verifyAssertion(a.id, verdict, person(), str(input.correction) || undefined)
    return { payload: { id: a.id, verificationNow: useAstra.getState().assertions.find((x) => x.id === a.id)?.verification }, artifacts: [] }
  },

  reject_gate: (input) => {
    const w = findWork(str(input.work_item_id))
    if (w.state !== 'gated') throw new ToolError(`${w.ref} is not held at a gate; it is ${w.state}.`)
    const reason = str(input.reason)
    if (!reason) throw new ToolError('A rejection needs a reason.')
    const s = useAstra.getState()
    s.reject(w.id, ROLE_BY_ID[s.roleId].person, reason)
    const after = useAstra.getState().work[w.id]
    return { payload: { id: w.id, ref: w.ref, rejectedBy: ROLE_BY_ID[s.roleId].person, reason, stateNow: after?.state }, artifacts: [card('workItem', `${w.ref} · ${w.title}`, { id: w.id }, `/operate/work/${w.id}`)] }
  },
}
