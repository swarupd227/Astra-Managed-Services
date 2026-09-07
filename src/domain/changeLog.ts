import { POLICIES, SKILLS } from './estate'
import { REGRESSION } from './evaluationSeed'
import { ROUTING_TABLE } from './ledgers'
import type { ISO } from './types'

/* ==========================================================================
   The change log — every version-linked change to what the AI does, in one
   place: registry status changes, policy versions, skill versions, routing
   refits, regression verdicts and vendor model changes. It is assembled from
   the records the platform already keeps, not written separately, so it
   cannot drift from them.
   ========================================================================== */

export type ChangeKind = 'registry' | 'policy' | 'skill' | 'routing' | 'regression' | 'model_change'

export interface ChangeEntry {
  id: string
  at: ISO
  kind: ChangeKind
  subject: string
  version?: string
  by?: string
  summary: string
  ref?: string
}

/** The slice of a registry system the log needs — the shape the gateway publishes. */
export interface RegistrySystemLike {
  id: string
  vendor: string
  model: string
  version: string
  history?: { at: string; by: string; from: string; to: string; reason: string; override?: boolean }[]
}

/** A served model that differed from the registered one. */
export interface ModelChange {
  id: string
  systemId: string
  registered: string
  served: string
  detectedAt: ISO
  /** The notice clock — the agreed period for telling the customer. */
  noticeDueAt: ISO
  state: 'detected' | 'notified' | 'accepted'
  notifiedAt?: ISO
  acceptedAt?: ISO
  evidenceIds: string[]
}

export const MODEL_CHANGE_NOTICE_DAYS = 7

export function modelChangeClocks(detectedAt: ISO): { noticeDueAt: ISO } {
  return { noticeDueAt: new Date(new Date(detectedAt).getTime() + MODEL_CHANGE_NOTICE_DAYS * 86400000).toISOString() }
}

export function changeLog(input: { registrySystems?: RegistrySystemLike[]; modelChanges?: ModelChange[] } = {}): ChangeEntry[] {
  const out: ChangeEntry[] = []

  for (const p of POLICIES) {
    out.push({ id: `chg_pol_${p.id}_${p.version}`, at: p.updatedAt, kind: 'policy', subject: p.name, version: p.version, by: p.updatedBy, summary: `Policy ${p.name} at ${p.version} — ${p.rules.length} rules, budget $${p.budgets.tokensUsdPerRun}/run`, ref: p.source })
  }
  for (const s of SKILLS) {
    out.push({ id: `chg_sk_${s.id}`, at: s.updatedAt, kind: 'skill', subject: s.name, version: s.version, by: s.owner, summary: `Skill ${s.id} at ${s.version} — ${s.actionClasses.join(', ')}, verification ${s.verificationPack}` })
  }
  for (const r of ROUTING_TABLE) {
    out.push({ id: `chg_rt_${r.step.replace(/\W+/g, '_').toLowerCase()}`, at: r.refitAt, kind: 'routing', subject: r.step, summary: `Routing refit — ${r.step} on the ${r.tier} tier at ${r.share}% share (quality Δ ${r.qualityDelta >= 0 ? '+' : ''}${r.qualityDelta.toFixed(3)})` })
  }
  for (const r of REGRESSION) {
    // Regression verdicts carry no date of their own; they belong to the version they judged.
    const skill = SKILLS.find((s) => r.to.startsWith(s.id.replace(/_v\d+$/, '')))
    out.push({ id: `chg_rg_${r.id}`, at: skill?.updatedAt ?? new Date(0).toISOString(), kind: 'regression', subject: r.to, version: r.to, summary: `${r.metric}: ${r.before.toFixed(3)} → ${r.after.toFixed(3)} (${r.verdict}) against ${r.from}` })
  }
  for (const s of input.registrySystems ?? []) {
    for (const h of s.history ?? []) {
      out.push({ id: `chg_reg_${s.id}_${h.at}`, at: h.at, kind: 'registry', subject: `${s.vendor} ${s.model}`, version: s.version, by: h.by, summary: `${s.id}: ${h.from} → ${h.to}${h.override ? ' (override)' : ''} — ${h.reason}` })
    }
  }
  for (const m of input.modelChanges ?? []) {
    out.push({ id: `chg_mc_${m.id}`, at: m.detectedAt, kind: 'model_change', subject: m.systemId, version: m.served, summary: `Served model ${m.served} differs from registered ${m.registered} — ${m.state}${m.state === 'detected' ? `, notice due ${m.noticeDueAt.slice(0, 10)}` : ''}` })
  }

  return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
