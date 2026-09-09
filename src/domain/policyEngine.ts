import { AC, MODE_TO_LEVEL, LEVEL_TO_MODE } from './reference'
import type { AutonomyDecision, ExecutionMode, Grade, Policy, PolicyRule } from './types'

/* ==========================================================================
   A real evaluator for the policy DSL (spec §7.3).

   Policies are authored as text and compiled to a decision function. The
   Policy Simulator in Atlas Workbench runs this exact code path, which is
   why "what would the engine decide?" is answerable rather than illustrative.
   ========================================================================== */

export interface ActionContext {
  action: { class: string; env: 'prod' | 'nonprod'; irreversible?: boolean; hasCompensation?: boolean }
  blast: { tier: number; services: number; dependents: number; dataMutation: boolean }
  agent: { id: string; grade: Record<string, Grade>; drift?: boolean }
  plan: { confidence: number; verificationPack: string | null }
  incident: { major_active: boolean }
  calendar: { freeze: boolean }
  asset?: { contract: string | null; pii: string | null }
  retrieval?: { minVerification: 'unverified' | 'machine_corroborated' | 'human_verified' }
  /** The AI system the gateway resolved for this run, and whether the registry lists it. */
  model?: { id: string; vendor: string; version: string; whitelisted: boolean; changed?: boolean }
  /** Which suspensions bear on this action. `any` is what most rules want. */
  suspensions?: { any: boolean; global: boolean; tower: boolean; agent: boolean; actionClass: boolean; function: boolean }
  /**
   * Whether the output of this action reaches an end user directly. Every
   * other path in this platform puts an operator between the model and the
   * person who acts on what it said; that operator is the last place a
   * fabrication gets caught. When the answer goes straight to a consultant
   * there is no such place, and the verification floor has to rise to
   * compensate.
   */
  audience?: { endUser: boolean }
}

const GRADE_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 }

/* ------------------------------- Expression -------------------------------- */

type Tok = { t: 'id' | 'num' | 'op' | 'punct' | 'kw'; v: string }

function lex(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  const isIdCh = (c: string) => /[A-Za-z0-9_.\-]/.test(c)
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if ('[](),'.includes(c)) { out.push({ t: 'punct', v: c }); i++; continue }
    const two = src.slice(i, i + 2)
    if (['==', '!=', '>=', '<='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue }
    if ('><'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    if (isIdCh(c)) {
      let j = i
      while (j < src.length && isIdCh(src[j])) j++
      const word = src.slice(i, j)
      i = j
      if (['and', 'or', 'in', 'not'].includes(word)) out.push({ t: 'kw', v: word })
      else if (/^-?\d+(\.\d+)?$/.test(word)) out.push({ t: 'num', v: word })
      else out.push({ t: 'id', v: word })
      continue
    }
    i++ // skip anything unrecognised rather than throwing at authoring time
  }
  return out
}

function resolvePath(path: string, ctx: unknown): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, ctx)
}

function literal(tok: Tok, ctx: ActionContext): unknown {
  if (tok.t === 'num') return Number(tok.v)
  const v = tok.v
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null') return null
  // A dotted identifier is a context path; a bare word is a symbol (AC-31, B, restricted).
  if (v.includes('.')) {
    const resolved = resolvePath(v, ctx)
    return resolved === undefined ? v : resolved
  }
  return v
}

function compare(op: string, left: unknown, right: unknown): boolean {
  // Grades are ordinal, not lexical: B >= C must be true.
  const lg = typeof left === 'string' ? GRADE_RANK[left] : undefined
  const rg = typeof right === 'string' ? GRADE_RANK[right] : undefined
  if (lg !== undefined && rg !== undefined && ['>=', '<=', '>', '<'].includes(op)) {
    left = lg
    right = rg
  }
  switch (op) {
    case '==': return left === right
    case '!=': return left !== right
    case '>=': return Number(left) >= Number(right)
    case '<=': return Number(left) <= Number(right)
    case '>': return Number(left) > Number(right)
    case '<': return Number(left) < Number(right)
    default: return false
  }
}

/**
 * Evaluates one clause. Returns the boolean plus a human-readable trace line,
 * because the console must always be able to answer "why did it decide that?".
 */
function evalClause(toks: Tok[], ctx: ActionContext): { ok: boolean; trace: string } {
  if (toks.length === 0) return { ok: true, trace: '(empty)' }

  // path [ indexExpr ] op value
  let cursor = 0
  const head = toks[cursor++]
  if (!head) return { ok: true, trace: '(empty)' }

  let leftPath = head.v
  let leftValue: unknown

  if (toks[cursor]?.v === '[') {
    // e.g. agent.grade[action.class]
    cursor++
    const idxTok = toks[cursor++]
    const idx = String(literal(idxTok, ctx))
    if (toks[cursor]?.v === ']') cursor++
    const base = resolvePath(leftPath, ctx)
    leftValue = base && typeof base === 'object' ? (base as Record<string, unknown>)[idx] : undefined
    leftPath = `${leftPath}[${idx}]`
  } else {
    leftValue = resolvePath(leftPath, ctx)
  }

  const opTok = toks[cursor]
  if (!opTok) {
    const ok = Boolean(leftValue)
    return { ok, trace: `${leftPath} → ${fmt(leftValue)} ⇒ ${ok}` }
  }

  if (opTok.t === 'kw' && opTok.v === 'in') {
    cursor++
    if (toks[cursor]?.v === '[') cursor++
    const list: unknown[] = []
    while (cursor < toks.length && toks[cursor].v !== ']') {
      if (toks[cursor].v !== ',') list.push(literal(toks[cursor], ctx))
      cursor++
    }
    const ok = list.some((x) => x === leftValue)
    return { ok, trace: `${leftPath} (${fmt(leftValue)}) in [${list.join(', ')}] ⇒ ${ok}` }
  }

  cursor++
  const rightTok = toks[cursor]
  const rightValue = rightTok ? literal(rightTok, ctx) : undefined
  const ok = compare(opTok.v, leftValue, rightValue)
  return { ok, trace: `${leftPath} (${fmt(leftValue)}) ${opTok.v} ${fmt(rightValue)} ⇒ ${ok}` }
}

function fmt(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null) return 'null'
  if (typeof v === 'number') return String(Math.round(v * 1000) / 1000)
  return String(v)
}

export function evaluateExpression(src: string, ctx: ActionContext): { ok: boolean; trace: string[] } {
  const toks = lex(src)
  // Split on top-level and/or, tracking bracket depth so `in [..]` lists survive.
  const groups: { joiner: 'and' | 'or' | null; toks: Tok[] }[] = []
  let depth = 0
  let current: Tok[] = []
  let joiner: 'and' | 'or' | null = null
  for (const tk of toks) {
    if (tk.v === '[') depth++
    if (tk.v === ']') depth--
    if (depth === 0 && tk.t === 'kw' && (tk.v === 'and' || tk.v === 'or')) {
      groups.push({ joiner, toks: current })
      joiner = tk.v as 'and' | 'or'
      current = []
      continue
    }
    current.push(tk)
  }
  groups.push({ joiner, toks: current })

  const trace: string[] = []
  let result: boolean | null = null
  for (const g of groups) {
    const { ok, trace: line } = evalClause(g.toks, ctx)
    trace.push(`${g.joiner ? g.joiner.toUpperCase() + ' ' : ''}${line}`)
    if (result === null) result = ok
    else if (g.joiner === 'or') result = result || ok
    else result = result && ok
  }
  return { ok: result ?? true, trace }
}

/* --------------------------------- Engine ---------------------------------- */

export interface EngineResult extends AutonomyDecision {
  trace: { ruleId: string; when: string; matched: boolean; lines: string[]; effect: string }[]
  floorApplied: ExecutionMode
  ceilingApplied: ExecutionMode | null
}

/**
 * Evaluates a proposed action against a policy and returns the execution mode.
 * Order of authority: platform action-class floor → matching rules → global
 * overrides (max_mode) → agent ceiling. Nothing can loosen a platform floor.
 */
export function evaluate(policy: Policy, ctx: ActionContext, agentCeiling?: ExecutionMode): EngineResult {
  const t0 = performance.now()
  const cls = AC[ctx.action.class]
  const trace: EngineResult['trace'] = []
  const reasons: string[] = []
  const overrides: string[] = []

  // 1. Platform floor for the action class — the strictest starting point.
  let floor: ExecutionMode = cls?.floor ?? 'advise'
  if (cls?.tier0Floor && ctx.blast.tier === 0) {
    floor = cls.tier0Floor
    reasons.push(`Tier-0 blast radius raises the ${cls.id} floor to ${LABEL[floor]}`)
  } else if (cls) {
    reasons.push(`${cls.id} platform floor is ${LABEL[floor]} (${cls.reversibility.replace(/_/g, ' ')})`)
  }

  let mode: ExecutionMode = floor
  let capped: ExecutionMode | null = null

  // 2. Rules, in authored order. A matching rule sets the mode; max_mode caps it.
  for (const rule of policy.rules) {
    const whenResult = evaluateExpression(rule.when, ctx)
    const lines = [...whenResult.trace]
    let matched = whenResult.ok
    let effect = 'no effect'

    if (matched && rule.require) {
      const req = evaluateExpression(rule.require, ctx)
      lines.push(`REQUIRE ${req.trace.join(' ')}`)
      if (!req.ok) {
        matched = false
        effect = 'matched but requirement failed — falls through to a stricter rule'
        reasons.push(`Rule ${rule.id} matched but its requirement was not met`)
      }
    }

    if (matched) {
      if (rule.maxMode) {
        // The lowest cap seen binds for the whole evaluation, whatever comes
        // after it — a later rule that sets a mode may not lift a cap.
        if (!capped || MODE_TO_LEVEL[rule.maxMode] < MODE_TO_LEVEL[capped]) capped = rule.maxMode
        if (MODE_TO_LEVEL[rule.maxMode] < MODE_TO_LEVEL[mode]) {
          mode = rule.maxMode
          overrides.push(`${rule.when} → capped at ${LABEL[rule.maxMode]}`)
          effect = `override: max mode ${LABEL[rule.maxMode]}`
        } else {
          effect = `override active, no reduction needed`
        }
      } else if (rule.mode) {
        const proposed = rule.mode
        // A rule may not grant more autonomy than the platform floor allows.
        const chosen = MODE_TO_LEVEL[proposed] > MODE_TO_LEVEL[floor] ? proposed : floor
        mode = chosen
        effect = proposed === chosen ? `mode ${LABEL[proposed]}` : `mode ${LABEL[proposed]} clamped to floor ${LABEL[floor]}`
        reasons.push(`Rule ${rule.id} sets ${LABEL[chosen]}`)
      }
    }
    trace.push({ ruleId: rule.id, when: rule.when, matched, lines, effect })
  }

  // A cap is an order of authority, not an order of authoring: re-apply the
  // lowest one after every rule has spoken, so a mode rule cannot outrank it.
  if (capped && MODE_TO_LEVEL[mode] > MODE_TO_LEVEL[capped]) {
    mode = capped
    reasons.push(`Cap at ${LABEL[capped]} binds over later mode rules`)
  }

  // 3. Prohibited combination: irreversible and unattended (design principle P4).
  if (cls?.reversibility === 'irreversible' && MODE_TO_LEVEL[mode] > 1) {
    mode = 'advise'
    overrides.push('P4 — irreversible action may never be agent-executed')
    reasons.push('Irreversible action class: platform forces Advise')
  }
  if (!ctx.action.hasCompensation && MODE_TO_LEVEL[mode] >= 3 && cls && cls.reversibility !== 'read_only') {
    mode = 'approve_first'
    overrides.push('No declared compensation — mutating step forced through a gate')
    reasons.push('Run Orchestrator refuses unattended mutating steps without rollback')
  }

  // 4. Agent ceiling.
  const ceiling = agentCeiling ?? 'autonomous'
  if (MODE_TO_LEVEL[mode] > MODE_TO_LEVEL[ceiling]) {
    mode = ceiling
    overrides.push(`Agent ceiling ${LABEL[ceiling]}`)
    reasons.push(`Agent is capped at ${LABEL[ceiling]} for this action class`)
  }

  // 5. Four-eyes.
  const gates: AutonomyDecision['gates'] = []
  const gateRule = policy.rules.find(
    (r: PolicyRule) => r.gate && evaluateExpression(r.when, ctx).ok,
  )
  if (MODE_TO_LEVEL[mode] === 2) {
    if (gateRule?.gate) {
      gates.push({ role: gateRule.gate.approverRole, timeoutSec: gateRule.gate.timeoutSec, escalatesTo: gateRule.gate.escalatesTo })
    } else {
      gates.push({ role: 'sdm', timeoutSec: 600, escalatesTo: 'duty_manager' })
    }
    if (cls?.fourEyes) {
      gates.push({ role: 'second_control', timeoutSec: 1800, escalatesTo: 'security_lead' })
      reasons.push(`${cls.id} requires a second human control (four-eyes)`)
    }
  }

  const elapsed = Math.max(1, Math.round((performance.now() - t0) * 100) / 100)

  return {
    mode,
    policyId: policy.id,
    policyVersion: policy.version,
    actionClasses: [ctx.action.class],
    blastRadius: {
      services: ctx.blast.services,
      dependents: ctx.blast.dependents,
      maxTier: ctx.blast.tier,
      dataMutation: ctx.blast.dataMutation,
    },
    agentGrades: ctx.agent.grade as Record<string, Grade>,
    planConfidence: ctx.plan.confidence,
    gates,
    reasons,
    evaluatedInMs: elapsed,
    overrides,
    trace,
    floorApplied: floor,
    ceilingApplied: capped,
  }
}

const LABEL: Record<ExecutionMode, string> = {
  manual: 'L0 Manual',
  advise: 'L1 Advise',
  approve_first: 'L2 Approve-first',
  supervised: 'L3 Supervised',
  autonomous: 'L4 Autonomous',
}

export const modeLabel = (m: ExecutionMode) => LABEL[m]
export const modeLevel = (m: ExecutionMode) => MODE_TO_LEVEL[m]
export const levelMode = (n: number) => LEVEL_TO_MODE[Math.max(0, Math.min(4, n))]
