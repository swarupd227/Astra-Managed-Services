import { SLAS, DEMAND_CLASSES } from './ledgers'
import { TOWERS } from './estate'
import { ATTESTATION_DAYS, EFFORT_DECLARATIONS } from './clientEffort'
import { PROGRAMMES } from './programmes'
import { DEFLECTION_BASELINES } from './deflection'
import { DEMAND_DRIVERS } from './headroom'
import { runCost, streamGateway } from './agentRuntime'
import type { MeasureSource, Objective, ObjectiveMeasure } from './objectives'

/* ==========================================================================
   The objective compiler.

   Given the objectives a client states — the words from their RFP or SOW —
   propose how each one will be measured from what this platform already
   holds. The compiler proposes; a named client owner accepts. It configures
   nothing on its own.

   One constraint carries the whole design: it may only propose measures that
   exist. The model is handed a catalogue of real ids and every measure it
   returns is resolved against that catalogue; anything invented is dropped
   and reported. A compiler that always finds a measure is lying, so the
   schema forces the alternative — an explicit "no measure" with a reason,
   and a list of what it would take to close the gap.
   ========================================================================== */

export interface CatalogueEntry {
  kind: MeasureSource['kind']
  ref: string
  label: string
  detail: string
}

/**
 * Tower ids are stable internal keys and deliberately outlive any renaming of
 * the tower itself, so they say nothing about whose estate this is. Showing
 * one to the model invites it to read the key as the client's own naming and
 * flag a mapping problem that does not exist — which is exactly what happened
 * the first time this ran. The catalogue shows names.
 */
const towerName = (id: string) => TOWERS.find((t) => t.id === id)?.name ?? id

/** Every measure the platform can actually take, as the model is shown them. */
export function measureCatalogue(): CatalogueEntry[] {
  return [
    ...SLAS.map((s) => ({
      kind: 'sla' as const,
      ref: s.id,
      label: s.name,
      detail: `${s.kind.toUpperCase()} on ${towerName(s.tower)} · target ${s.attainmentTarget} · metric ${s.metric}`,
    })),
    ...DEMAND_CLASSES.map((d) => ({
      kind: 'demand_class' as const,
      ref: d.id,
      label: d.name,
      detail: `${d.volumeYr}/yr, ${d.hoursYr}h on ${towerName(d.tower)} · elimination ${d.eliminationState}`,
    })),
    {
      kind: 'tower_avg', ref: 'autonomyEligibleVolume',
      label: 'Volume eligible for autonomous handling',
      detail: `Mean across towers in run · currently ${TOWERS.filter((t) => t.state === 'S4').length} towers`,
    },
    {
      kind: 'tower_avg', ref: 'verificationCoverage',
      label: 'Knowledge verification coverage',
      detail: 'Share of historical volume covered by human-verified knowledge',
    },
    { kind: 'glidepath_banked', ref: '', label: 'Effort banked, all causes', detail: 'Verified hours removed from the run model' },
    { kind: 'glidepath_banked', ref: 'automation', label: 'Effort banked through automation', detail: 'An agent now does it' },
    { kind: 'glidepath_banked', ref: 'elimination', label: 'Effort banked through elimination', detail: 'The demand no longer arrives' },
    { kind: 'glidepath_banked', ref: 'acceleration', label: 'Effort banked through acceleration', detail: 'The same work, faster' },
    { kind: 'glidepath_banked', ref: 'avoidance', label: 'Effort banked through avoidance', detail: 'It never became work' },
    { kind: 'glidepath_trajectory', ref: '', label: 'Glidepath actual against contracted', detail: 'Weighted by baseline hours across towers in run' },
    { kind: 'innovation_verified', ref: '', label: 'Innovation value realised and verified', detail: 'From the innovation register, failures included' },
    { kind: 'spend_ratio', ref: '', label: 'Model spend against human cost displaced', detail: 'Fleet-wide, 30 days' },
    {
      kind: 'client_effort', ref: 'released',
      label: 'Client staff released from run-the-business work (FTE)',
      detail: `Declared and signed by the client's own function leads, not measured by this platform · ${EFFORT_DECLARATIONS.length} declarations across ${new Set(EFFORT_DECLARATIONS.map((d) => d.function)).size} functions · declarations older than ${ATTESTATION_DAYS} days are excluded rather than carried forward`,
    },
    {
      kind: 'client_effort', ref: 'strategic_gained',
      label: 'Client staff now on strategic work (FTE)',
      detail: 'The other half of the same declaration. Released and redeployed are different facts: people can leave rather than move.',
    },
    ...PROGRAMMES.map((p) => ({
      kind: 'programme_burndown' as const,
      ref: p.id,
      label: `${p.name} — scope remaining`,
      detail: `${p.items.length} scope items, target ${p.targetEndAt.slice(0, 7)} · counts only items evidenced gone, not items declared done`,
    })),
    {
      kind: 'deflection_rate', ref: 'attributed',
      label: 'Deflection rate — the attributed fall only',
      detail: `Share of arrivals no longer arriving that the glidepath ledger can attribute · across ${DEFLECTION_BASELINES.length} agreed baselines · the defensible one of the two`,
    },
    {
      kind: 'deflection_rate', ref: 'total',
      label: 'Deflection rate — total fall against agreed baselines',
      detail: 'Includes the fall nobody can explain. Larger, and weaker: an unexplained fall is a question, not evidence.',
    },
    {
      kind: 'growth', ref: 'absorption',
      label: 'Growth absorbed without a proportional rise in effort',
      detail: 'Backward-looking and honest about not having been tested: only demand caused by the client growing counts, and transition friction and service defects are excluded rather than summed in. May report that absorption has not been tested at all.',
    },
    {
      kind: 'growth', ref: 'headroom',
      label: 'Forecast growth the service could take at flat effort',
      detail: `Forward-looking, against ${DEMAND_DRIVERS.length} client-declared business driver${DEMAND_DRIVERS.length === 1 ? '' : 's'} · withheld entirely where no driver is declared, since extrapolating the observed curve forecasts the transition rather than the business`,
    },
  ]
}

/* ------------------------------ What the model returns ---------------------- */

export interface CompiledMeasure {
  label: string
  kind: string
  /** SLA id, demand-class id, tower field or attribution. Empty where the kind needs none. */
  ref: string
  /** -1 means no target. */
  target: number
  direction: 'up' | 'down'
  proxy: boolean
  proxyNote: string
  /** Required when kind is 'none'. */
  why: string
}

export interface CompiledObjective {
  statement: string
  shortName: string
  owner: string
  horizon: string
  measures: CompiledMeasure[]
  demandClasses: string[]
  gaps: string[]
}

export interface CompilerOutput {
  objectives: CompiledObjective[]
  note: string
}

export interface Rejection {
  objective: string
  measure: string
  reason: string
}

export interface CompileResult {
  objectives: Objective[]
  rejections: Rejection[]
  note: string
}

const KINDS = new Set([
  'sla', 'demand_class', 'tower_avg', 'glidepath_banked', 'glidepath_trajectory',
  'innovation_verified', 'spend_ratio', 'client_effort', 'programme_burndown', 'deflection_rate', 'growth', 'none',
])
const GROWTH_FIELDS = new Set(['absorption', 'headroom'])
const ATTRIBUTIONS = new Set(['automation', 'elimination', 'acceleration', 'avoidance'])
const TOWER_FIELDS = new Set(['autonomyEligibleVolume', 'verificationCoverage'])
const EFFORT_FIELDS = new Set(['released', 'strategic_gained'])
const DEFLECTION_REFS = new Set(['attributed', 'total'])

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28)

/**
 * Turns one proposed measure into a real one, or explains why it cannot be.
 * This is the guard: an id the platform does not hold never becomes a measure.
 */
function validateMeasure(m: CompiledMeasure, index: number): { measure?: ObjectiveMeasure; reason?: string } {
  if (!KINDS.has(m.kind)) return { reason: `unknown measure kind "${m.kind}"` }

  const id = `om_${slug(m.label) || `m${index}`}`
  const commonUnvalidated = {
    id,
    label: m.label,
    direction: m.direction === 'down' ? ('down' as const) : ('up' as const),
    ...(m.proxy ? { proxy: true, proxyNote: m.proxyNote || 'Proposed as a stand-in; no note given.' } : {}),
    ...(m.target >= 0 ? { target: m.target } : {}),
  }

  switch (m.kind) {
    case 'sla': {
      if (!SLAS.some((s) => s.id === m.ref)) return { reason: `no SLA or XLA with id "${m.ref}" exists` }
      return { measure: { ...commonUnvalidated, source: { kind: 'sla', id: m.ref } } }
    }
    case 'demand_class': {
      if (!DEMAND_CLASSES.some((d) => d.id === m.ref)) return { reason: `no demand class with id "${m.ref}" exists` }
      return { measure: { ...commonUnvalidated, source: { kind: 'demand_class', id: m.ref } } }
    }
    case 'tower_avg': {
      if (!TOWER_FIELDS.has(m.ref)) return { reason: `"${m.ref}" is not a tower field the platform reports` }
      return { measure: { ...commonUnvalidated, source: { kind: 'tower_avg', field: m.ref as 'autonomyEligibleVolume' | 'verificationCoverage' } } }
    }
    case 'glidepath_banked': {
      if (m.ref && !ATTRIBUTIONS.has(m.ref)) return { reason: `"${m.ref}" is not an attribution class` }
      return { measure: { ...commonUnvalidated, source: m.ref ? { kind: 'glidepath_banked', attribution: m.ref as 'automation' } : { kind: 'glidepath_banked' } } }
    }
    case 'glidepath_trajectory':
      return { measure: { ...commonUnvalidated, source: { kind: 'glidepath_trajectory' } } }
    case 'innovation_verified':
      return { measure: { ...commonUnvalidated, source: { kind: 'innovation_verified' } } }
    case 'spend_ratio':
      return { measure: { ...commonUnvalidated, source: { kind: 'spend_ratio' } } }
    case 'client_effort': {
      if (!EFFORT_FIELDS.has(m.ref)) return { reason: `"${m.ref}" is not a client-effort field — use "released" or "strategic_gained"` }
      return { measure: { ...commonUnvalidated, source: { kind: 'client_effort', field: m.ref as 'released' } } }
    }
    case 'programme_burndown': {
      if (!PROGRAMMES.some((p) => p.id === m.ref)) return { reason: `no programme with id "${m.ref}" exists` }
      return { measure: { ...commonUnvalidated, source: { kind: 'programme_burndown', id: m.ref } } }
    }
    case 'deflection_rate': {
      if (!DEFLECTION_REFS.has(m.ref)) return { reason: `"${m.ref}" is not a deflection variant — use "attributed" or "total"` }
      return { measure: { ...commonUnvalidated, source: { kind: 'deflection_rate', attributedOnly: m.ref === 'attributed' } } }
    }
    case 'growth': {
      if (!GROWTH_FIELDS.has(m.ref)) return { reason: `"${m.ref}" is not a growth field — use "absorption" or "headroom"` }
      return { measure: { ...commonUnvalidated, source: { kind: 'growth', field: m.ref as 'absorption' } } }
    }
    case 'none': {
      if (!m.why?.trim()) return { reason: 'declared unmeasurable without saying why' }
      return { measure: { ...commonUnvalidated, source: { kind: 'none', why: m.why } } }
    }
    default:
      return { reason: `unhandled kind "${m.kind}"` }
  }
}

/**
 * Validates the model's proposal into objectives the platform can hold.
 * Everything dropped is reported rather than silently discarded — a compiler
 * whose failures are invisible would be worse than no compiler.
 */
export function validateCompilation(out: CompilerOutput): CompileResult {
  const rejections: Rejection[] = []
  const objectives: Objective[] = []

  for (const o of out.objectives ?? []) {
    const measures: ObjectiveMeasure[] = []
    for (const [i, m] of (o.measures ?? []).entries()) {
      const { measure, reason } = validateMeasure(m, i)
      if (measure) measures.push(measure)
      else rejections.push({ objective: o.shortName || o.statement.slice(0, 40), measure: m.label || `measure ${i + 1}`, reason: reason! })
    }

    const demandClasses = (o.demandClasses ?? []).filter((id) => {
      const ok = DEMAND_CLASSES.some((d) => d.id === id)
      if (!ok) rejections.push({ objective: o.shortName || o.statement.slice(0, 40), measure: id, reason: `no demand class with id "${id}" exists` })
      return ok
    })

    // An objective the compiler could not measure at all must still say so
    // rather than arriving empty and looking merely unfinished.
    if (!measures.length) {
      measures.push({
        id: `om_${slug(o.shortName)}_none`,
        label: 'No measure proposed',
        direction: 'up',
        source: { kind: 'none', why: 'The compiler proposed no measure this platform could resolve for this objective.' },
      })
    }

    objectives.push({
      id: `obj_${slug(o.shortName) || `o${objectives.length + 1}`}`,
      statement: o.statement,
      source: 'Compiled from the objectives supplied',
      owner: o.owner || 'unassigned',
      horizon: o.horizon || 'not stated',
      measures,
      servedBy: { demandClasses },
      state: 'proposed',
      gaps: o.gaps ?? [],
    })
  }

  return { objectives, rejections, note: out.note ?? '' }
}

/* --------------------------------- The run ---------------------------------- */

export interface CompileRun {
  result: CompileResult | null
  /** Set when the gateway refused before any model call, or a detector fired. */
  refusal?: { text: string; rule: string }
  usd?: number
  model?: string
}

/**
 * Runs the compiler. The objectives text is pasted, untrusted content, so it
 * travels as the utterance and passes through the gateway's injection
 * classifier before a model sees it — a supplier's document is exactly the
 * place an instruction would be hidden.
 */
export async function compileObjectives(
  text: string,
  onThinking: (full: string) => void,
  signal: AbortSignal,
): Promise<CompileRun> {
  let thinking = ''
  let output: CompilerOutput | null = null
  let usd: number | undefined
  let model: string | undefined

  for await (const ev of streamGateway({ phase: 'compile', utterance: text, catalogue: measureCatalogue() }, signal)) {
    if (ev.type === 'thinking') {
      thinking += ev.text
      onThinking(thinking)
    } else if (ev.type === 'objectives') {
      output = ev.input as CompilerOutput
    } else if (ev.type === 'refuse') {
      return { result: null, refusal: { text: ev.text, rule: ev.rule } }
    } else if (ev.type === 'incident') {
      return { result: null, refusal: { text: ev.summary, rule: `AI Incident — ${ev.class.replace(/_/g, ' ')} (${ev.detector})` } }
    } else if (ev.type === 'usage') {
      usd = runCost(ev.inputTokens, ev.outputTokens)
      model = ev.model
    } else if (ev.type === 'error') {
      throw new Error(ev.message)
    }
  }

  if (!output) return { result: null, usd, model }
  return { result: validateCompilation(output), usd, model }
}
