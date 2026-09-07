import type { ISO } from './types'

/* ==========================================================================
   Suspensions — the autonomy brake, generalised.

   The brake used to be two booleans: platform-wide, or per tower. A customer
   may also direct that a single action class or a single AI function stop,
   and the record of who directed it matters commercially: a customer-directed
   suspension is not a breach. So every suspension is a record with a scope,
   a target, a reason and a flag — and the old brake shape is derived from it.
   ========================================================================== */

export type SuspensionScope = 'global' | 'tower' | 'agent' | 'actionClass' | 'function'

export interface Suspension {
  id: string
  scope: SuspensionScope
  /** Tower id, agent id, action-class code, or AI function id — by scope. */
  target: string
  /** For action-class scope: limit the suspension to one tower. */
  tower?: string
  by: string
  at: ISO
  reason: string
  directedByCustomer: boolean
}

/** The AI functions a customer may suspend as a unit. Ids match the gateway's phase map. */
export const AI_FUNCTIONS = [
  { id: 'copilot.plan', label: 'Copilot — intent routing and plan generation', phase: 'plan' },
  { id: 'herald.outcome', label: 'Herald — outcome narrative after an approved run', phase: 'outcome' },
  { id: 'herald.brief', label: 'Herald — executive brief', phase: 'brief' },
] as const

export type AiFunctionId = (typeof AI_FUNCTIONS)[number]['id']

export function isFunctionSuspended(list: Suspension[], fn: string): boolean {
  return list.some((s) => s.scope === 'function' && s.target === fn)
}

/** The shape the policy DSL reads: which suspensions bear on this action. */
export function suspensionContext(
  list: Suspension[],
  q: { tower: string; agentId: string; actionClass: string; fn: string; agentSuspended?: boolean },
) {
  const global = list.some((s) => s.scope === 'global')
  const tower = list.some((s) => s.scope === 'tower' && s.target === q.tower)
  const agent = Boolean(q.agentSuspended) || list.some((s) => s.scope === 'agent' && s.target === q.agentId)
  const actionClass = list.some((s) => s.scope === 'actionClass' && s.target === q.actionClass && (!s.tower || s.tower === q.tower))
  const fn = list.some((s) => s.scope === 'function' && s.target === q.fn)
  return { any: global || tower || agent || actionClass || fn, global, tower, agent, actionClass, function: fn }
}

/** The legacy brake shape, so every reader of `brake` keeps working. */
export function brakeOf(list: Suspension[]): { global: boolean; towers: string[] } {
  return {
    global: list.some((s) => s.scope === 'global'),
    towers: [...new Set(list.filter((s) => s.scope === 'tower').map((s) => s.target))],
  }
}
