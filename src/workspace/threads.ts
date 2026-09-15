import { BUNDLES, TOWERS, TOWER_BY_ID } from '@/domain/estate'
import type { Mission } from '@/domain/missions'

/* ==========================================================================
   The standing conversations. One with Astra about the whole service, one
   per contract bundle, one per active mission and one for an open major
   incident. They are derived from the engagement, not authored: another
   client's bundles produce another client's threads.
   ========================================================================== */

export interface ThreadDef {
  id: string
  title: string
  group: 'astra' | 'bundle' | 'mission' | 'incident' | 'view'
  /** What the orchestrator is told the conversation is about. */
  scope?: string
}

/** Conversations embedded in the pages where decisions are made. */
export const VIEW_THREADS = {
  approvals: { id: 'view-approvals', title: 'Approvals', group: 'view', scope: 'The approval inbox: plans held at human gates, and the decision on each' },
  proposals: { id: 'view-proposals', title: 'Proposals', group: 'view', scope: 'Proposals the workforce raised, and whether to accept or reject each' },
  privacy: { id: 'view-privacy', title: 'Privacy requests', group: 'view', scope: 'Privacy requests, holds and retention' },
  workOrders: { id: 'view-work-orders', title: 'Work orders', group: 'view', scope: 'Separately authorised development orders, their authorisation and burn' },
} satisfies Record<string, ThreadDef>

export function threadDefs(missions: Mission[], mi: { active: boolean; title: string }): ThreadDef[] {
  const out: ThreadDef[] = [{ id: 'astra', title: 'Ask Astra', group: 'astra' }]
  if (mi.active) out.push({ id: 'incident', title: 'Major incident', group: 'incident', scope: `The open major incident: ${mi.title}` })
  for (const b of BUNDLES) {
    const towers = TOWERS.filter((t) => t.bundle === b.id)
    if (!towers.length) continue
    out.push({ id: `bundle-${b.id.toLowerCase()}`, title: `${b.id} · ${b.name}`, group: 'bundle', scope: `Bundle ${b.id} ${b.name}; towers ${towers.map((t) => `${t.id} (${t.name})`).join(', ')}` })
  }
  for (const m of missions.filter((x) => x.state === 'active')) {
    const tower = TOWER_BY_ID[m.tower]
    out.push({ id: `mission-${m.id}`, title: `${m.name} · ${tower?.name.replace(/\s*\(B\d\)$/, '') ?? m.tower}`, group: 'mission', scope: `Mission ${m.id} "${m.name}" on ${tower?.name ?? m.tower}: ${m.goal}` })
  }
  return out
}
