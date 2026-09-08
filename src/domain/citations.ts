import { AGENT_BY_ID, GRAPH_NODES, POLICY_BY_ID, SKILL_BY_ID, TOWER_BY_ID } from './estate'
import { DEMAND_CLASSES } from './ledgers'
import { AC } from './reference'
import type { Assertion } from './types'

/* ==========================================================================
   Citations — resolving the ids an agent says it relied on.

   The retrieve beat used to report counts: twelve assertions, one runbook.
   A count is not a citation. These resolve the ids the model actually named
   back to the record, its narrative and the screen where a human can go and
   check it — and an id that resolves to nothing is a fabrication signal
   rather than a rendering problem.
   ========================================================================== */

export interface Citation {
  id: string
  kind: 'assertion' | 'runbook' | 'known_error' | 'graph' | 'demand_class' | 'tower' | 'agent' | 'skill' | 'policy' | 'action_class' | 'unresolved'
  label: string
  excerpt: string
  href?: string
  /** Verification state, where the cited record carries one. */
  verification?: Assertion['verification']
}

export function resolveCitation(id: string, assertions: Assertion[]): Citation {
  const a = assertions.find((x) => x.id === id)
  if (a) {
    return {
      id, kind: 'assertion',
      label: `${a.subject} ${a.predicate} ${a.object}`,
      excerpt: a.narrative,
      href: '/transition/verify',
      verification: a.verification,
    }
  }
  const n = GRAPH_NODES.find((x) => x.id === id)
  if (n) {
    const kind = n.type === 'Runbook' ? 'runbook' : n.type === 'KnownError' ? 'known_error' : 'graph'
    return {
      id, kind,
      label: n.name,
      excerpt: Object.entries(n.attrs).map(([k, v]) => `${k}: ${v}`).join(' · '),
      href: '/operate/graph',
    }
  }
  const d = DEMAND_CLASSES.find((x) => x.id === id)
  if (d) {
    return { id, kind: 'demand_class', label: d.name, excerpt: d.cause, href: '/governance/elimination' }
  }
  // The rest of the universe the estate digest hands the model. This list must
  // stay level with estateIds() in aiIncident.ts: an id the fabrication
  // detector accepts as real must not read here as one that does not exist.
  const t = TOWER_BY_ID[id]
  if (t) {
    return { id, kind: 'tower', label: t.name, excerpt: `State ${t.state} · criticality ${t.criticality} · owner ${t.owner} · ${t.autonomyEligibleVolume}% autonomy-eligible, ${t.verificationCoverage}% verified`, href: `/operate/board?tower=${t.id}` }
  }
  const ag = AGENT_BY_ID[id]
  if (ag) {
    return { id, kind: 'agent', label: ag.name, excerpt: ag.mission, href: `/atlas/agent/${ag.id}` }
  }
  const sk = SKILL_BY_ID[id]
  if (sk) {
    return { id, kind: 'skill', label: `${sk.name} ${sk.version}`, excerpt: `${sk.actionClasses.join(', ')} · ${(sk.successRate * 100).toFixed(1)}% over ${sk.runs} runs · verification ${sk.verificationPack}`, href: '/atlas/evaluation' }
  }
  const pol = POLICY_BY_ID[id]
  if (pol) {
    return { id, kind: 'policy', label: `${pol.name} ${pol.version}`, excerpt: `${pol.rules.length} rules · applies to ${pol.appliesTo.towers.length} tower(s)`, href: '/atlas/policy' }
  }
  const ac = AC[id]
  if (ac) {
    return { id, kind: 'action_class', label: ac.name, excerpt: `${ac.reversibility.replace(/_/g, ' ')} · floor ${ac.floor.replace(/_/g, '-')}${ac.fourEyes ? ' · four-eyes' : ''} · verification ${ac.verificationPack}`, href: '/governance/autonomy' }
  }
  return { id, kind: 'unresolved', label: id, excerpt: 'This identifier does not resolve in the estate.' }
}

export function resolveCitations(ids: string[], assertions: Assertion[]): Citation[] {
  return [...new Set(ids)].map((id) => resolveCitation(id, assertions))
}
