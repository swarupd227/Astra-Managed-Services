import { readReadiness } from './readiness'
import { TOOL_BY_NAME, roleHolds } from './catalogue'
import { commitmentLedger } from '@/domain/commitments'
import { dataSummary } from '@/domain/dataEstate'
import { reliabilitySummary } from '@/domain/dataReliability'
import { ENGAGEMENT } from '@/domain/engagement'
import { escalationSummary } from '@/domain/escalations'
import { readExit } from '@/domain/exit'
import { privacySummary } from '@/domain/privacy'
import { readProcedures } from '@/domain/procedures'
import { readRecommendations } from '@/domain/recommendations'
import { readControl } from '@/domain/clientControl'
import { useAstra } from '@/domain/store'

/* ==========================================================================
   Openers — the first thing a person sees who does not know what to ask.

   There is no navigation to the platform's capabilities by design, so these
   carry the whole weight of discovery. A list of polite questions would not:
   "which service levels are below target" tells nobody that anything is
   wrong, and nobody clicks it.

   So each opener states a fact first and asks second, and the facts are read
   from the registers at the moment the thread opens. A number that should
   alarm somebody outranks one that should not, which is why the ordering is
   by weight rather than by the order they are written here.

   Every reading is guarded. An opener that cannot be computed is simply not
   offered — a failure here must cost a suggestion, never the conversation.
   ========================================================================== */

interface Opener {
  text: string
  /** Higher first. A fact that should worry someone outranks one that should not. */
  weight: number
}

/** Runs a reading, and drops the opener rather than the thread if it throws. */
function attempt(out: Opener[], f: () => Opener | null) {
  try {
    const o = f()
    if (o) out.push(o)
  } catch {
    /* A register that cannot be read offers nothing, and says nothing. */
  }
}

export function groundedOpeners(roleId: string): string[] {
  const has = (tool: string) => Boolean(TOOL_BY_NAME[tool] && roleHolds(roleId, TOOL_BY_NAME[tool]))
  const out: Opener[] = []
  const s = useAstra.getState()

  if (has('get_privacy_obligations')) {
    attempt(out, () => {
      const p = privacySummary(undefined, s.privacyLog, s.incidentNotices)
      if (p.noticeOwed) return { text: `${p.noticeOwed} data incident${p.noticeOwed === 1 ? ' still owes' : 's still owe'} the client a notice — how long is left?`, weight: 95 }
      if (p.overdue) return { text: `${p.overdue} privacy request${p.overdue === 1 ? '' : 's'} are past the statutory clock — which?`, weight: 90 }
      return null
    })
  }

  if (has('get_commitments')) {
    attempt(out, () => {
      const l = commitmentLedger({
        remedies: s.commitmentLog, packExports: s.packExports,
        procedures: { loads: s.areaLoads, reviews: s.procedureReviews },
        privacy: { log: s.privacyLog, notices: s.incidentNotices }, exitLog: s.exitLog, experiments: s.experiments,
      })
      if (l.byStatus.missed) return { text: `${l.byStatus.missed} commitment${l.byStatus.missed === 1 ? ' is past its' : 's are past their'} date — which, and what happens now?`, weight: 92 }
      if (l.unanswered) return { text: `${l.unanswered} commitments are behind with nothing decided, ${l.chargeAtRiskPct}% of the charge at risk — show me`, weight: 88 }
      return { text: 'What have we committed to, and are we meeting it?', weight: 40 }
    })
  }

  if (has('get_recommendations')) {
    attempt(out, () => {
      const r = readRecommendations({ experiments: s.experiments })
      const x = r.experiments
      // An experiment that concluded without moving anything outranks
      // everything else here: it is the one finding nobody else would report.
      if (x.noMovement) return { text: `${x.noMovement} funded experiment${x.noMovement === 1 ? '' : 's'} reached the end of the window without moving anything — what happened?`, weight: 87 }
      const standing = r.all.filter((y) => y.standing).length
      if (standing) return { text: `${standing} standing defects across the ${r.dimensions.length} areas your contract names — what do you suggest we do?`, weight: 86 }
      if (x.resolved) return { text: `${x.resolved} experiment${x.resolved === 1 ? ' has' : 's have'} cleared the condition they were struck against — show me what moved`, weight: 72 }
      if (r.expiredUndecided.length) return { text: `${r.expiredUndecided.length} recommendation${r.expiredUndecided.length === 1 ? '' : 's'} expired with nobody deciding — show me`, weight: 80 }
      return { text: 'What are you recommending we improve?', weight: 45 }
    })
  }

  if (has('get_agent_readiness')) {
    attempt(out, () => {
      const e = escalationSummary()
      if (e.waiting) return { text: `${e.waiting} agent escalations are waiting on a person — what are they stuck on?`, weight: 84 }
      return { text: 'What is stopping our agents from being promoted?', weight: 42 }
    })
  }

  if (has('get_data_estate')) {
    attempt(out, () => {
      const d = dataSummary()
      if (d.breaches) return { text: `${d.breaches} data items are in breach and ${d.unobserved} have no telemetry at all — what is the root of it?`, weight: 82 }
      return null
    })
  }

  if (has('get_data_reliability')) {
    attempt(out, () => {
      const r = reliabilitySummary()
      if (r.atRisk) return { text: `${r.atRisk} data loads are projected to miss tonight — which, and who reads them?`, weight: 81 }
      return { text: 'Will tonight’s data loads land on time?', weight: 44 }
    })
  }

  if (has('get_procedures')) {
    attempt(out, () => {
      const p = readProcedures({ loads: s.areaLoads, reviews: s.procedureReviews })
      if (!p.load) return { text: `The contract names ${ENGAGEMENT.procedureAreas?.areas.length ?? 0} procedure areas and none are adopted yet — what is missing?`, weight: 70 }
      if (p.gaps.length || p.staleCount) return { text: `${p.gaps.length} procedure areas have nothing current and ${p.staleCount} reviews are overdue — show me`, weight: 72 }
      return null
    })
  }

  if (has('get_client_control')) {
    attempt(out, () => {
      const c = readControl(s.clientDirectives)
      if (!c.directives.length) return { text: 'What can I stop or cap on the agent workforce without asking you?', weight: 76 }
      return { text: `${c.capped + c.stopped} agents are held below their grant by our own directives — show me`, weight: 74 }
    })
  }

  if (has('get_approvals')) {
    attempt(out, () => {
      const gated = Object.values(s.work).filter((w) => w.state === 'gated').length
      return gated
        ? { text: `${gated} runs are waiting at a human gate — which carry the widest blast radius?`, weight: 85 }
        : { text: 'What is waiting for my approval?', weight: 46 }
    })
  }

  if (has('get_exit_readiness')) {
    attempt(out, () => {
      const r = readExit(s.exitLog)
      const unproven = r.holdings.filter((h) => !h.returnable && !h.mustKeep).length
      return unproven
        ? { text: `${unproven} of the things we hold of yours can neither be returned nor explained — what are they?`, weight: 68 }
        : { text: 'What would we have to hand back at exit?', weight: 38 }
    })
  }

  if (has('get_successor_pack')) {
    attempt(out, () => (s.packExports.length
      ? null
      : { text: 'If we left, what would you walk away with?', weight: 66 }))
  }

  if (has('get_my_workplace')) out.push({ text: 'Is anything affecting the systems I use?', weight: 60 })
  if (has('get_provenance')) out.push({ text: 'Which of these figures are real, and which are demonstration data?', weight: 55 })
  if (has('get_acceleration')) out.push({ text: 'Where does this platform actually save time?', weight: 50 })
  if (has('get_estate_overview')) out.push({ text: 'How is the service running overall?', weight: 35 })

  return out.sort((a, b) => b.weight - a.weight).slice(0, 6).map((o) => o.text)
}

/** Kept warm so the first opening does not pay for the readiness fetch. */
export const warmReadiness = () => { void readReadiness().catch(() => undefined) }
