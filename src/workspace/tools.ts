import { buildBrief, readLastSeen } from '@/domain/brief'
import { runConformance } from '@/domain/conformance'
import { COVERED_BUNDLES, bundleCoverage } from '@/domain/coverage'
import { DATA_ITEMS, DATA_ITEM_BY_ID, DATA_LIFECYCLE, ancestors, dataSummary, descendants, impact, isBreach } from '@/domain/dataEstate'
import { AGENT_BY_ID, BUNDLE_BY_ID, TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { SLAS } from '@/domain/ledgers'
import { holdsOn, privacySummary, readRequest, REQUESTS } from '@/domain/privacy'
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
        unclassified: s.unclassified, noSteward: s.noSteward, lineageGaps: s.lineageGaps,
        items: rows.map((i) => {
          const reach = impact(i.id)
          return {
            id: i.id, name: i.name, kind: i.kind, platform: i.platform, ownState: i.own, inherited: i.inherited ? { state: i.inherited.state, via: i.inherited.via.id } : null,
            contract: i.contractState, classification: i.classification ?? 'unclassified', steward: i.steward ?? null,
            reportsAffected: reach.reports.map((r) => r.name), largestAudience: reach.largestAudience,
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
        landedHrsAgo: i.lastLandedHrsAgo ?? null, runs30d: i.runs30d ?? null, lineage: i.lineage, telemetry: i.telemetry,
        upstream: ancestors(i.id).map((a) => a.id), feeds: descendants(i.id).map((d) => d.id),
        holds: holdsOn(i.id).map((h) => h.id), recovery: DATA_LIFECYCLE[i.kind].recovery,
      },
      artifacts: [card('dataItem', i.name, { id: i.id }, '/operate/data')],
    }
  },

  get_privacy_requests: (input) => {
    const id = str(input.id)
    if (id) {
      const req = REQUESTS.find((r) => r.id.toLowerCase() === id.toLowerCase())
      if (!req) throw new ToolError(`No privacy request has the id "${id}".`)
      const r = readRequest(req)
      return {
        payload: {
          id: req.id, kind: req.kind, subject: req.subject, subjectType: req.subjectType, state: req.state, daysLeft: r.daysLeft, extended: Boolean(req.extended),
          approvedBy: req.approvedBy ?? null, refusal: req.refusal ?? null, flags: r.flags, searchGaps: r.gaps.map((g) => g.id),
          stores: r.items.map((i) => ({ id: i.item.id, verdict: i.verdict, records: i.records, holds: i.holds.map((h) => h.id), action: i.action?.outcome ?? null, backupsUntil: i.residualUntil ?? null })),
        },
        artifacts: [card('privacyRequest', `${req.id} · ${req.kind}`, { id: req.id }, '/operate/privacy')],
      }
    }
    const s = privacySummary()
    return {
      payload: {
        open: s.open, dueWithin7Days: s.dueSoon, overdue: s.overdue, withSearchGaps: s.withGaps, processBreaches: s.breaches, holds: s.holds,
        requests: s.readings.map((r) => ({ id: r.request.id, kind: r.request.kind, state: r.request.state, daysLeft: r.open ? r.daysLeft : null, flags: r.flags })),
        pastRetention: s.retention.filter((x) => x.state === 'past').map((x) => ({ id: x.item.id, overDays: x.overDays })),
      },
      artifacts: [card('privacyRequests', 'Privacy requests', {}, '/operate/privacy')],
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
