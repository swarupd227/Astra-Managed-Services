import { bundleCoverage, COVERED_BUNDLES } from './coverage'
import { reliabilitySummary } from './dataReliability'
import { ENGAGEMENT, STAGES, type StageId } from './engagement'
import { DEMAND_CLASSES } from './ledgers'
import { COVERAGE, HANDOVER, SHADOW } from './knowledge'
import { OPERATIONAL, autonomyEligible, glidepathAttainment, verifiedVolumeCoverage, volumeRemoved } from './metrics'
import { debtSummary } from './techDebt'
import { EVIDENCE, WORK_OBJECTS } from './workSeed'

/* ==========================================================================
   Acceleration — what the platform makes faster at each stage of an
   engagement, and what the claim rests on.

   The platform is client-facing, so every row also says whose time it
   gives back — the client's people, ours, or both. A row belonging to a
   stage that is ours alone is never shown to the client's roles.

   Every row carries two figures and refuses to blur them. The baseline is
   how long the work takes without the platform, and it is always someone's
   statement — a bid team's estimate, a client's own account — never
   something measured here. The platform figure is read from the platform
   where the platform can read it, projected where the mechanism exists but
   the outcome has not happened yet, and reported as not measured where
   nothing has been instrumented. A row whose capability is not built says
   so and shows no figure at all: an unbuilt thing accelerates nothing.
   ========================================================================== */

export type Basis = 'measured' | 'projected' | 'declared' | 'not_measured'

export const BASIS_LABEL: Record<Basis, string> = {
  measured: 'Measured here',
  projected: 'Projected',
  declared: 'Declared',
  not_measured: 'Not measured',
}

export type BuildState = 'live' | 'partial' | 'not_built'

export const BUILD_LABEL: Record<BuildState, string> = { live: 'Live', partial: 'Partial', not_built: 'Not built' }

export interface Reading {
  value: string
  basis: Basis
  /** Where the figure comes from, or what is missing. */
  note: string
}

/** Whose effort the accelerator removes. */
export type Saves = 'client' | 'provider' | 'both'

export const SAVES_LABEL: Record<Saves, string> = { client: 'Client', provider: 'Service', both: 'Both' }

export interface Accelerator {
  id: string
  stage: StageId
  name: string
  saves: Saves
  /** What the platform does instead of the manual work. */
  does: string
  agents: string[]
  /** How the work is done without the platform. Always someone's statement. */
  baseline: { value: string; source: string }
  state: BuildState
  /** The page that carries the evidence. */
  route?: string
  read: () => Reading
}

const pct1 = (n: number) => `${n.toFixed(1)}%`
const declared = (value: string, note: string): Reading => ({ value, basis: 'declared', note })
const notBuilt: Reading = { value: '—', basis: 'not_measured', note: 'Not built' }

/* --------------------------------- The rows --------------------------------- */

export const ACCELERATORS: Accelerator[] = [
  /* ----------------------------------- Bid ---------------------------------- */
  {
    id: 'acc_scope', saves: 'provider', stage: 'bid', name: 'Scope read into service packs',
    does: 'Reads the scope documents and maps every service function to a pack, naming the agent that would own it and the functions no agent covers',
    agents: ['agt_prospect', 'agt_archivist'],
    baseline: { value: '2–3 weeks', source: 'Bid team estimate' },
    state: 'partial', route: '/atlas/coverage',
    read: () => {
      const rows = COVERED_BUNDLES.map(bundleCoverage)
      const fns = rows.reduce((n, c) => n + c.functions.length, 0)
      const owned = rows.reduce((n, c) => n + c.owned, 0)
      return { value: `${owned}/${fns} functions owned`, basis: 'measured', note: 'Read from agent charters, once the scope is loaded by hand' }
    },
  },
  {
    id: 'acc_volume', saves: 'provider', stage: 'bid', name: 'Automatable volume from ticket history',
    does: 'Sorts a ticket extract into classes of work and reports the share agents could take, instead of sampling by hand',
    agents: ['agt_prospect'],
    baseline: { value: '2 weeks of sampling', source: 'Bid team estimate' },
    state: 'partial', route: '/governance/elimination',
    read: () => ({ value: `${autonomyEligible().toFixed(0)}% of volume`, basis: 'measured', note: `Across ${DEMAND_CLASSES.length} demand classes; no ingestion of a raw extract yet` }),
  },
  {
    id: 'acc_commitment', saves: 'provider', stage: 'bid', name: 'Cost-reduction commitment with evidence behind it',
    does: 'Prices the elimination candidates and proposes the reduction curve the bid can commit to',
    agents: ['agt_prospect', 'agt_bursar'],
    baseline: { value: 'Judgement, defended in review', source: 'Bid team estimate' },
    state: 'partial', route: '/governance/glidepath',
    read: () => {
      const candidates = DEMAND_CLASSES.filter((d) => d.eliminationState === 'candidate')
      const value = candidates.reduce((n, d) => n + (d.npv36m ?? 0), 0)
      return { value: `$${Math.round(value / 1000)}k over 36 months`, basis: 'projected', note: `${candidates.length} costed candidates, not yet delivered` }
    },
  },

  /* -------------------------------- Transition ------------------------------ */
  {
    id: 'acc_discovery', saves: 'both', stage: 'transition', name: 'Estate discovered instead of interviewed',
    does: 'Reverse-engineers the estate from the systems themselves and reports what remains dark',
    agents: ['agt_archivist'],
    baseline: { value: '8–12 weeks of SME interviews', source: 'Transition lead estimate' },
    state: 'live', route: '/transition/coverage',
    read: () => {
      const entities = COVERAGE.reduce((n, c) => n + c.entities, 0)
      const dark = COVERAGE.reduce((n, c) => n + c.dark, 0)
      return { value: `${(((entities - dark) / entities) * 100).toFixed(1)}% mapped`, basis: 'measured', note: `${dark.toLocaleString('en-GB')} entities still dark` }
    },
  },
  {
    id: 'acc_verify', saves: 'client', stage: 'transition', name: 'Knowledge verified one claim at a time',
    does: 'Puts each claim to the person who knows, and records the verdict as a fact agents may cite',
    agents: ['agt_archivist'],
    baseline: { value: 'Workshops and documents of unknown currency', source: 'Transition lead estimate' },
    state: 'live', route: '/transition/verify',
    read: () => ({ value: `${pct1(verifiedVolumeCoverage())} of volume`, basis: 'measured', note: `Median ${OPERATIONAL.medianVerificationSec} s per verdict` }),
  },
  {
    id: 'acc_shadow', saves: 'provider', stage: 'transition', name: 'Takeover proven before cutover',
    does: 'Runs agents in shadow against the incumbent and grades agreement per action class, so autonomy is earned rather than asserted',
    agents: ['agt_sentinel', 'agt_diagnost', 'agt_remedian'],
    baseline: { value: 'Hypercare and hope', source: 'Transition lead estimate' },
    state: 'live', route: '/transition/shadow',
    read: () => {
      const met = SHADOW.filter((s) => s.readiness === 'met').length
      const weighted = SHADOW.reduce((n, s) => n + s.agreement * s.proposals, 0) / SHADOW.reduce((n, s) => n + s.proposals, 0)
      return { value: `${pct1(weighted)} agreement`, basis: 'measured', note: `${met}/${SHADOW.length} action classes at threshold` }
    },
  },
  {
    id: 'acc_cutover', saves: 'both', stage: 'transition', name: 'Cutover gates checked, not asserted',
    does: 'Holds each handover artefact to a machine-checked acceptance test, so a gate cannot be signed on a slide',
    agents: ['agt_herald'],
    baseline: { value: 'Document review and sign-off meetings', source: 'Transition lead estimate' },
    state: 'live', route: '/transition/cutover',
    read: () => {
      const pass = HANDOVER.filter((h) => h.state === 'pass').length
      return { value: `${pass}/${HANDOVER.length} gates passing`, basis: 'measured', note: `${HANDOVER.filter((h) => h.state === 'fail').length} failing on their own test` }
    },
  },

  /* ----------------------------------- Run ---------------------------------- */
  {
    id: 'acc_unaided', saves: 'provider', stage: 'run', name: 'Work resolved without a person',
    does: 'Agents triage, diagnose and resolve within the autonomy the policy engine allows',
    agents: ['agt_sentinel', 'agt_diagnost', 'agt_remedian'],
    baseline: { value: 'Every ticket touched by a person', source: 'Incumbent operating model' },
    state: 'live', route: '/operate/room',
    read: () => {
      const closed = WORK_OBJECTS.filter((w) => ['resolved', 'learned'].includes(w.state))
      const unaided = closed.filter((w) => w.autonomy?.mode === 'autonomous')
      return closed.length
        ? { value: `${((unaided.length / closed.length) * 100).toFixed(0)}% of closed work`, basis: 'measured', note: `${unaided.length} of ${closed.length} closed items in the window` }
        : { value: '—', basis: 'not_measured', note: 'No closed work in the window' }
    },
  },
  {
    id: 'acc_prework', saves: 'provider', stage: 'run', name: 'Diagnosis done before a resolver opens the ticket',
    does: 'Assembles context, cause and a proposed plan on arrival, so the queue starts at a decision',
    agents: ['agt_diagnost'],
    baseline: { value: 'Resolver starts from the ticket text', source: 'Shadow-period comparison' },
    state: 'live', route: '/operate/resolver',
    read: () => ({ value: `${OPERATIONAL.preWorkSavingMins} min saved per item`, basis: 'measured', note: `Plan taken unchanged ${OPERATIONAL.planAdoptRate}% of the time` }),
  },
  {
    id: 'acc_gate', saves: 'client', stage: 'run', name: 'Approval in seconds, not days',
    does: 'Brings the decision to the approver with the blast radius, the action class and the evidence already attached',
    agents: ['astra'],
    baseline: { value: 'Change board, weekly', source: 'Client-stated' },
    state: 'live', route: '/operate/approvals',
    read: () => ({ value: `${OPERATIONAL.medianDecisionSec} s median`, basis: 'measured', note: 'Card opened to decision recorded, 30 days' }),
  },
  {
    id: 'acc_recover', saves: 'both', stage: 'run', name: 'Failures recovered without a person',
    does: 'Detects a failed run, decides within policy, reruns or backfills, and proves the data landed inside its window',
    agents: ['agt_custodian'],
    baseline: { value: 'Morning triage after the business notices', source: 'Client-stated' },
    state: 'live', route: '/operate/data-reliability',
    read: () => {
      const s = reliabilitySummary()
      return s.withoutPersonPct === null
        ? { value: '—', basis: 'not_measured', note: 'No failures in the window' }
        : { value: `${s.withoutPersonPct.toFixed(0)}% of failures`, basis: 'measured', note: `Median ${s.medianRestartMins ?? '—'} min to restart` }
    },
  },
  {
    id: 'acc_predict', saves: 'both', stage: 'run', name: 'Breach seen before it happens',
    does: 'Projects each run and each clock against its window and raises the ones that will miss',
    agents: ['agt_custodian', 'agt_sentinel'],
    baseline: { value: 'Breach reported after the fact', source: 'Client-stated' },
    state: 'live', route: '/operate/data-reliability',
    read: () => {
      const s = reliabilitySummary()
      const atRisk = WORK_OBJECTS.filter((w) => w.breachProbability >= 0.5 && !['resolved', 'learned'].includes(w.state)).length
      return { value: `${s.atRisk} runs · ${atRisk} items`, basis: 'measured', note: 'Flagged before the window closed' }
    },
  },

  /* --------------------------------- Improve -------------------------------- */
  {
    id: 'acc_eliminate', saves: 'both', stage: 'improve', name: 'Recurring demand removed, not absorbed',
    does: 'Mines recurrence into classes, costs the fix, and verifies the volume actually went away',
    agents: ['agt_prospect'],
    baseline: { value: 'Improvement promised annually, rarely evidenced', source: 'Client-stated' },
    state: 'live', route: '/governance/elimination',
    read: () => ({ value: `${pct1(volumeRemoved())} of the book`, basis: 'measured', note: 'Only classes verified as eliminated count' }),
  },
  {
    id: 'acc_glidepath', saves: 'client', stage: 'improve', name: 'Savings banked against the committed curve',
    does: 'Holds the countersigned baseline, banks verified savings and reports attainment against the contracted reduction',
    agents: ['agt_bursar', 'agt_herald'],
    baseline: { value: 'Benefit claimed in a deck', source: 'Client-stated' },
    state: 'live', route: '/governance/glidepath',
    read: () => {
      const g = glidepathAttainment()
      return { value: `${g.actual.toFixed(1)}% vs ${g.contracted.toFixed(1)}% contracted`, basis: 'measured', note: 'Weighted by baseline hours' }
    },
  },
  {
    id: 'acc_debt', saves: 'both', stage: 'improve', name: 'Debt priced by the demand it causes',
    does: 'Attributes recurring work to the debt behind it and ranks payback against declared capacity',
    agents: ['agt_prospect', 'agt_archivist'],
    baseline: { value: 'Debt listed, never costed', source: 'Client-stated' },
    state: 'live', route: '/transform/debt',
    read: () => {
      const d = debtSummary()
      return { value: `${d.interestHrs.toLocaleString('en-GB')} h/yr interest`, basis: 'measured', note: `${d.unmeasured} items not measured, and reported as such` }
    },
  },

  /* --------------------------------- Assure --------------------------------- */
  {
    id: 'acc_evidence', saves: 'client', stage: 'assure', name: 'Audit answered from the record',
    does: 'Seals every action, decision and approval into a verifiable chain, so a question is a query rather than a sampling exercise',
    agents: ['agt_herald', 'agt_archivist'],
    baseline: { value: 'Days per audit question, by sampling', source: 'Client-stated' },
    state: 'live', route: '/governance/evidence',
    read: () => ({ value: `${EVIDENCE.length.toLocaleString('en-GB')} sealed records`, basis: 'measured', note: `Retrieval under ${OPERATIONAL.evidenceRetrievalSec} s` }),
  },
  {
    id: 'acc_dispute', saves: 'both', stage: 'assure', name: 'Service level disputes closed on the clock audit',
    does: 'Replays the clock event by event — start, pauses and stop — so attainment is arithmetic rather than argument',
    agents: ['agt_herald'],
    baseline: { value: 'Weeks of reconciliation per dispute', source: 'Commercial register' },
    state: 'live', route: '/governance/sla',
    read: () => declared(`${OPERATIONAL.disputeFirstReviewClosure}% closed at first review`, `${OPERATIONAL.openDisputes} dispute open`),
  },
  {
    id: 'acc_ai_gov', saves: 'client', stage: 'assure', name: 'AI governance evidenced, not described',
    does: 'Maps the AI control frameworks to the records the platform already holds, and runs the conformance set on demand',
    agents: ['agt_warden', 'agt_herald'],
    baseline: { value: 'Policy documents and questionnaires', source: 'Client-stated' },
    state: 'live', route: '/governance/ai-pack',
    read: () => declared('Two frameworks mapped', 'NIST AI RMF and ISO/IEC 42001, against stored records'),
  },

  /* ------------------------------ Renew or exit ----------------------------- */
  {
    id: 'acc_benchmark', saves: 'client', stage: 'exit', name: 'Benchmark answered from the ledger',
    does: 'Supplies the benchmarker measured effort, volume and attainment instead of a reconstruction',
    agents: ['agt_herald', 'agt_bursar'],
    baseline: { value: 'Data pack rebuilt by hand per review', source: 'Commercial register' },
    state: 'not_built',
    read: () => notBuilt,
  },
  {
    id: 'acc_exit', saves: 'client', stage: 'exit', name: 'Data returned and destruction certified',
    does: 'Holds what the platform itself keeps of the client, returns it and certifies destruction, backups included',
    agents: ['agt_archivist'],
    baseline: { value: 'Manual inventory, contested at exit', source: 'Contract requirement' },
    state: 'not_built',
    read: () => notBuilt,
  },
  {
    id: 'acc_reverse', saves: 'client', stage: 'exit', name: 'Knowledge handed to the next provider',
    does: 'Exports the verified estate knowledge, runbooks and demand classes as the successor’s starting position',
    agents: ['agt_archivist', 'agt_herald'],
    baseline: { value: 'Reverse transition from scratch', source: 'Contract requirement' },
    state: 'not_built',
    read: () => notBuilt,
  },
]

/* --------------------------------- Readings --------------------------------- */

export interface AcceleratorReading extends Accelerator {
  reading: Reading
}

export interface StageReading {
  stage: (typeof STAGES)[number]
  accelerators: AcceleratorReading[]
  live: number
  partial: number
  notBuilt: number
  /** The first live row's figure: what this stage can show today. */
  headline: AcceleratorReading | null
}

export interface AccelerationSummary {
  stages: StageReading[]
  /** Rows whose time is given back to the client, or to both. */
  forClient: number
  accelerators: AcceleratorReading[]
  live: number
  partial: number
  notBuilt: number
  measured: number
  /** Stages with nothing built at all. */
  stagesUncovered: number
}

/**
 * Read for one audience. The client's people see the stages of their own
 * engagement; our own stages are ours to look at.
 */
export function accelerationSummary(audience: 'client' | 'all' = 'all'): AccelerationSummary {
  const visible = STAGES.filter((s) => audience === 'all' || s.audience === 'client')
  const rows: AcceleratorReading[] = ACCELERATORS
    .filter((a) => visible.some((s) => s.id === a.stage))
    .map((a) => ({ ...a, reading: a.read() }))
  const stages: StageReading[] = visible.map((stage) => {
    const accelerators = rows.filter((r) => r.stage === stage.id)
    return {
      stage,
      accelerators,
      live: accelerators.filter((r) => r.state === 'live').length,
      partial: accelerators.filter((r) => r.state === 'partial').length,
      notBuilt: accelerators.filter((r) => r.state === 'not_built').length,
      headline: accelerators.find((r) => r.state === 'live' && r.reading.basis === 'measured') ?? accelerators.find((r) => r.state !== 'not_built') ?? null,
    }
  })
  return {
    stages,
    accelerators: rows,
    forClient: rows.filter((r) => r.saves !== 'provider').length,
    live: rows.filter((r) => r.state === 'live').length,
    partial: rows.filter((r) => r.state === 'partial').length,
    notBuilt: rows.filter((r) => r.state === 'not_built').length,
    measured: rows.filter((r) => r.reading.basis === 'measured').length,
    stagesUncovered: stages.filter((s) => s.live === 0 && s.partial === 0).length,
  }
}

/** The engagement these readings belong to. Another engagement reads its own, once ingested. */
export const READ_FOR = ENGAGEMENT
