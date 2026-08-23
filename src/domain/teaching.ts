import type { Assertion, ISO, WorkObject } from './types'

/* ==========================================================================
   The Teach loop (Addendum A D8, AG-12).

   "When a human corrects an agent, the platform visibly absorbs it — and says
   what else the correction reaches."

   The blast radius is the whole point, and it is the part that is easy to
   fake. Nothing here is asserted: every count below is derived from the store
   at the moment of teaching, by the same predicate that decides which objects
   a lesson actually applies to. If a correction reaches nothing, the lesson
   says so.
   ========================================================================== */

export type LessonKind = 'assertion_corrected' | 'assertion_rejected' | 'plan_rejected' | 'plan_modified'

export interface LessonReach {
  /** What the correction generalises over, in words the operator can check. */
  basis: string
  /** Ids the lesson was applied to. Length is the blast radius. */
  ids: string[]
  /** What kind of object those ids are. */
  kind: 'assertion' | 'work'
}

export interface Lesson {
  id: string
  at: ISO
  kind: LessonKind
  /** The agent whose output was corrected. */
  agentId: string
  taughtBy: string
  /** What the human changed, in one sentence. */
  correction: string
  /** What the platform did with it. */
  absorbed: string
  reach: LessonReach
  evidenceId?: string
}

export const LESSON_KIND_LABEL: Record<LessonKind, string> = {
  assertion_corrected: 'Assertion corrected',
  assertion_rejected: 'Assertion rejected',
  plan_rejected: 'Plan rejected',
  plan_modified: 'Plan modified',
}

/**
 * Which other assertions a correction to `a` reaches.
 *
 * An assertion is corrected because the way it was derived produced something
 * false. That failure belongs to the extraction method operating on this
 * estate, not to the kind of statement it happened to make — if AST analysis
 * misread the claims codebase once, its other unverified claims about that
 * codebase deserve another look whatever they assert. So the reach is method
 * and tower, deliberately not predicate.
 */
export function assertionReach(a: Assertion, all: Assertion[]): LessonReach {
  const ids = all
    .filter((o) => o.id !== a.id && o.verification === 'unverified' && o.method === a.method && o.tower === a.tower)
    .map((o) => o.id)

  return {
    basis: `unverified assertions in ${a.tower} derived by ${a.method}`,
    ids,
    kind: 'assertion',
  }
}

/**
 * Which other work a rejected or modified plan reaches.
 *
 * A plan is rejected because it was wrong for this class of demand on this
 * kind of service — so the lesson reaches open work sharing that demand class.
 */
export function planReach(wo: WorkObject, all: WorkObject[]): LessonReach {
  const open = ['detected', 'triaged', 'planned', 'gated']
  const ids = all
    .filter((o) => o.id !== wo.id && o.demandClass === wo.demandClass && open.includes(o.state))
    .map((o) => o.id)

  return {
    basis: `open work in demand class ${wo.demandClass}`,
    ids,
    kind: 'work',
  }
}

/**
 * The sentence shown back to the human. Written from the reach, so it cannot
 * claim a blast radius the platform did not compute — including the honest
 * case where the correction reaches nothing else.
 */
export function absorbedText(kind: LessonKind, reach: LessonReach): string {
  const n = reach.ids.length
  const noun = reach.kind === 'assertion' ? 'assertion' : 'open work object'
  const plural = n === 1 ? noun : `${noun}s`

  if (n === 0) {
    return `Recorded against the agent's evaluation record. Nothing else currently matches ${reach.basis}, so this correction applies to it alone.`
  }

  switch (kind) {
    case 'assertion_corrected':
      return `Correction recorded and ${n} similar ${plural} re-queued for review — ${reach.basis}.`
    case 'assertion_rejected':
      return `Rejection recorded and ${n} ${plural} from the same derivation flagged for re-checking — ${reach.basis}.`
    case 'plan_rejected':
      return `Rejection fed to the evaluation service; ${n} ${plural} in the same class will be re-planned before they gate — ${reach.basis}.`
    case 'plan_modified':
      return `Modification recorded as a preference; ${n} ${plural} in the same class inherit it — ${reach.basis}.`
  }
}
