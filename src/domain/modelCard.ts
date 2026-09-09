import { AC } from './reference'
import { SKILL_BY_ID, TOWER_BY_ID } from './estate'
import { SUITES } from './evaluationSeed'
import type { Agent } from './types'
import type { AiIncident } from './aiIncident'
import type { RedTeamResult } from './redTeam'
import type { BiasResult } from './biasSuite'
import type { DriftWindow } from './drift'
import type { ChangeEntry, RegistrySystemLike } from './changeLog'

/* ==========================================================================
   Model cards — generated, never written. A card is an assembly of records
   the platform already holds about an agent or a system: what it is for,
   what it may do, how it has been tested, what has gone wrong, how its data
   is handled, and what changed recently. No field on a card exists without a
   stored record behind it.
   ========================================================================== */

export interface CardSection {
  title: string
  rows: { label: string; value: string; tone?: 'ok' | 'warn' | 'crit' | 'neutral' }[]
}

export interface ModelCard {
  id: string
  kind: 'agent' | 'system'
  title: string
  subtitle: string
  sections: CardSection[]
  changes: ChangeEntry[]
}

export interface CardContext {
  redTeam?: { at: string; results: RedTeamResult[] } | null
  bias?: BiasResult | null
  drift?: DriftWindow[]
  incidents?: AiIncident[]
  systems?: (RegistrySystemLike & { status?: string; hosting?: string; region?: string; purposes?: string[]; attestations?: { zeroRetention: boolean; noTrainingOnCustomerData: boolean; ref: string } })[]
  changes?: ChangeEntry[]
  residency?: { allowedRegions?: string[]; zeroRetentionRequired?: boolean } | null
}

const d = (iso?: string) => (iso ? iso.slice(0, 10) : '—')

export function agentCard(agent: Agent, ctx: CardContext = {}): ModelCard {
  const suites = SUITES.filter((s) => s.coverage.some((c) => agent.grants[c]))
  const rt = ctx.redTeam
  const bias = ctx.bias
  const drift = ctx.drift?.find((w) => w.agentId === agent.id)
  const incidents = (ctx.incidents ?? []).filter((i) => i.agentId === agent.id)
  const approvedSystems = (ctx.systems ?? []).filter((s) => s.status === 'approved')
  const changes = (ctx.changes ?? []).filter((c) => c.kind !== 'registry' && (c.kind === 'policy' || c.kind === 'routing' || c.kind === 'model_change' || agent.skills.some((sk) => c.subject === SKILL_BY_ID[sk]?.name || c.subject.startsWith(sk.replace(/_v\d+$/, ''))))).slice(0, 5)

  return {
    id: agent.id,
    kind: 'agent',
    title: agent.name,
    subtitle: `${agent.codename} · ${agent.origin === 'client' ? 'client-owned, managed as a service' : 'Artizent'} · ${agent.nhi}`,
    sections: [
      {
        title: 'Purpose and scope',
        rows: [
          { label: 'Mission', value: agent.mission },
          { label: 'Towers', value: agent.towers.map((t) => TOWER_BY_ID[t]?.name ?? t).join('; ') },
          { label: 'Granted action classes', value: Object.entries(agent.grants).map(([ac, g]) => `${ac} ${AC[ac]?.name ?? ''} (grade ${g})`).join('; ') },
          { label: 'Prohibited', value: agent.prohibited.join(', ') || 'none' },
          { label: 'Autonomy ceiling', value: agent.ceiling.replace(/_/g, ' ') },
          { label: 'Skills', value: agent.skills.map((s) => `${SKILL_BY_ID[s]?.name ?? s} ${SKILL_BY_ID[s]?.version ?? ''}`.trim()).join('; ') },
          { label: 'Accountable human', value: agent.ownerHuman },
        ],
      },
      {
        title: 'Evaluation',
        rows: [
          { label: 'Replay suite', value: `${agent.evaluation.suiteId} — score ${agent.evaluation.score.toFixed(3)} over ${agent.evaluation.replayN.toLocaleString('en-GB')} cases, last ${d(agent.evaluation.lastRun)}`, tone: agent.evaluation.score >= 0.9 ? 'ok' : 'warn' },
          { label: 'Suites covering its classes', value: suites.length ? suites.map((s) => `${s.name} (${s.pass.toFixed(3)}, ${s.regression} regression${s.regression === 1 ? '' : 's'})`).join('; ') : 'none' },
          { label: 'Live success, 90 days', value: agent.evaluation.liveSuccess90d ? `${(agent.evaluation.liveSuccess90d * 100).toFixed(1)}%` : 'not yet live' },
          { label: 'Red team', value: rt ? `${rt.results.filter((r) => r.pass).length} of ${rt.results.length} controls held, ${d(rt.at)}` : 'not run this session', tone: rt ? (rt.results.every((r) => r.pass) ? 'ok' : 'crit') : 'neutral' },
          { label: 'Bias suite', value: bias ? `${bias.pairs} matched pairs, ${bias.disparities.length} disparities, ${d(bias.at)}` : 'not run this session', tone: bias ? (bias.invariant ? 'ok' : 'crit') : 'neutral' },
          { label: 'Drift', value: drift ? drift.reason : agent.driftAlarm ? 'Alarm raised (seeded state — run the monitor)' : 'No alarm', tone: (drift?.alarm ?? agent.driftAlarm) ? 'warn' : 'ok' },
          { label: 'Promotion review', value: d(agent.promotionReview) },
        ],
      },
      {
        title: 'Incidents',
        rows: [
          { label: 'Agent incidents on record', value: agent.incidents.length ? agent.incidents.map((i) => `${i.id} ${d(i.at)} — ${i.summary} (${i.actionClass}; ${i.outcome})`).join('; ') : 'none', tone: agent.incidents.length ? 'warn' : 'ok' },
          { label: 'AI Incidents attributed', value: incidents.length ? incidents.map((i) => `${i.id} ${i.class.replace(/_/g, ' ')} (${i.detector}) — ${i.state}`).join('; ') : 'none', tone: incidents.some((i) => i.state !== 'closed') ? 'crit' : 'ok' },
          { label: 'State', value: agent.state, tone: agent.state === 'active' ? 'ok' : agent.state === 'suspended' ? 'crit' : 'warn' },
        ],
      },
      {
        title: 'Data handling',
        rows: [
          { label: 'Approved AI systems it may run on', value: approvedSystems.length ? approvedSystems.map((s) => `${s.vendor} ${s.model} (${s.hosting?.replace(/_/g, ' ')}, ${s.region})`).join('; ') : 'registry not loaded' },
          { label: 'No training on customer data', value: approvedSystems.length ? (approvedSystems.every((s) => s.attestations?.noTrainingOnCustomerData) ? 'attested for every approved system' : 'NOT attested for every approved system') : '—', tone: approvedSystems.every((s) => s.attestations?.noTrainingOnCustomerData) ? 'ok' : 'crit' },
          { label: 'Zero retention', value: approvedSystems.length ? (approvedSystems.every((s) => s.attestations?.zeroRetention) ? 'configured for every approved system' : 'not on every approved system') : '—', tone: approvedSystems.every((s) => s.attestations?.zeroRetention) ? 'ok' : 'warn' },
          { label: 'Residency', value: ctx.residency ? `${(ctx.residency.allowedRegions ?? []).join(', ') || 'any region'}${ctx.residency.zeroRetentionRequired ? ' · zero retention required' : ''}` : 'no rules configured' },
          { label: 'Evidence', value: 'Every decision, approval, action and verification is a sealed, hash-linked record' },
        ],
      },
    ],
    changes,
  }
}

export function systemCard(system: NonNullable<CardContext['systems']>[number], ctx: CardContext = {}): ModelCard {
  const changes = (ctx.changes ?? []).filter((c) => (c.kind === 'registry' && c.summary.startsWith(system.id)) || (c.kind === 'model_change' && c.subject === system.id) || c.kind === 'routing').slice(0, 5)
  const rt = ctx.redTeam
  return {
    id: system.id,
    kind: 'system',
    title: `${system.vendor} ${system.model}`,
    subtitle: `${system.id} · ${system.version} · ${system.hosting?.replace(/_/g, ' ') ?? ''} · ${system.region ?? ''}`,
    sections: [
      {
        title: 'Purpose and scope',
        rows: [
          { label: 'Approved purposes', value: (system.purposes ?? []).join(', ') || 'none' },
          { label: 'Status', value: system.status ?? 'unknown', tone: system.status === 'approved' ? 'ok' : system.status === 'pending' ? 'warn' : 'crit' },
          { label: 'Version on record', value: system.version },
        ],
      },
      {
        title: 'Evaluation',
        rows: [
          { label: 'Red team (gateway controls)', value: rt ? `${rt.results.filter((r) => r.pass).length} of ${rt.results.length} controls held, ${d(rt.at)}` : 'not run this session', tone: rt ? (rt.results.every((r) => r.pass) ? 'ok' : 'crit') : 'neutral' },
          { label: 'Currency', value: 'Every completed call compares the served model with this record; a difference opens a model-change notice' },
        ],
      },
      {
        title: 'Data handling',
        rows: [
          { label: 'No training on customer data', value: system.attestations?.noTrainingOnCustomerData ? `attested — ${system.attestations.ref}` : 'NOT attested', tone: system.attestations?.noTrainingOnCustomerData ? 'ok' : 'crit' },
          { label: 'Zero retention', value: system.attestations?.zeroRetention ? 'configured' : 'not available', tone: system.attestations?.zeroRetention ? 'ok' : 'warn' },
          { label: 'Hosting and region', value: `${system.hosting?.replace(/_/g, ' ') ?? ''} · ${system.region ?? ''}` },
        ],
      },
    ],
    changes,
  }
}
