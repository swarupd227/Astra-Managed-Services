import { ROLES, ROLE_BY_ID } from './reference'
import type { Role } from './types'

/* ==========================================================================
   Who a decision goes up to.

   The platform could escalate and it meant nothing. `escalate()` wrote an
   evidence record saying "escalated to duty manager", left the gate open,
   left the same approver on it, and told the operator the clock was still
   running. There is no duty manager: `escalatesTo` was a free string that
   resolved to no role, no person and no approval right, and the role model
   was flat — `canApprove` as a boolean with nothing above it.

   So each role now names the role above it, and an escalation moves the gate
   to that role's holder. Two rules make it mean something.

   A target that cannot approve is not a target. Several roles sit in the
   chain for reporting rather than deciding — a Resolver Engineer and an SME
   hold no approval pen — so the walk continues past them to the first role
   that actually holds one. Escalating into somebody who cannot decide would
   have been the same defect in a new place.

   An escalation of last resort says so. The chain ends at the client's
   executive, and when there is nobody above, the platform refuses to pretend:
   the gate stays where it is and the refusal names why, rather than writing a
   record that looks like a hand-off.
   ========================================================================== */

export interface Escalation {
  /** The role the gate sits with now. */
  from: Role
  /** The role it moves to. */
  to: Role
  /** Roles passed over because they hold no approval right. */
  skipped: Role[]
}

/**
 * The first role above this one that can actually approve.
 *
 * Returns null at the top of a chain, and null for a role that names no one
 * above it. Both are "nobody to escalate to", and the caller has to say so
 * rather than inventing a manager.
 */
export function managerOf(roleId: string): Escalation | null {
  const from = ROLE_BY_ID[roleId]
  if (!from) return null

  const skipped: Role[] = []
  const seen = new Set<string>([roleId])
  let next = from.escalatesTo

  while (next) {
    // A cycle in the chain would hang the walk. Configuration can be wrong;
    // it must not be able to wedge an approval.
    if (seen.has(next)) return null
    seen.add(next)
    const role = ROLE_BY_ID[next]
    if (!role) return null
    if (role.canApprove) return { from, to: role, skipped }
    skipped.push(role)
    next = role.escalatesTo
  }
  return null
}

/** The whole chain above a role, for a screen that has to show the path. */
export function chainFrom(roleId: string): Role[] {
  const out: Role[] = []
  const seen = new Set<string>([roleId])
  let next = ROLE_BY_ID[roleId]?.escalatesTo
  while (next && !seen.has(next)) {
    seen.add(next)
    const role = ROLE_BY_ID[next]
    if (!role) break
    out.push(role)
    next = role.escalatesTo
  }
  return out
}

/**
 * Chains that do not resolve.
 *
 * The role model is configuration, and configuration is wrong sometimes. This
 * is what the readiness screens read so a broken escalation path is a finding
 * rather than something discovered the first time somebody escalates.
 */
export function brokenChains(): { role: Role; because: string }[] {
  const out: { role: Role; because: string }[] = []
  for (const r of ROLES) {
    if (!r.escalatesTo) continue
    if (!ROLE_BY_ID[r.escalatesTo]) {
      out.push({ role: r, because: `escalates to "${r.escalatesTo}", which is not a role` })
      continue
    }
    if (!managerOf(r.id)) {
      out.push({ role: r, because: 'nothing above it holds an approval right, so an escalation would go nowhere' })
    }
  }
  return out
}
