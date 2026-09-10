import React from 'react'
import { Check, Clock, Lightbulb, ShieldCheck, TrendingUp, X } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import {
  PROPOSAL_KIND_META, daysOpen, initiativeShare, proposalAge, proposalValue,
  type Proposal, type ProposalKind,
} from '@/domain/proposals'
import { AgentChip, AutonomyChip, EvidenceLink, PageHeader } from '@/ui/domain'
import { Button, Card, Chip, Dot, Empty, Metric, Tabs } from '@/ui/primitives'
import { cn, num, pct, usd } from '@/lib/format'

/* ==========================================================================
   The Proposal stream (Addendum A §A5.1).

   Everything an agent raises unprompted, in one place, ranked and ageing.
   The ageing is the point: a proposal that has sat for 23 days past its
   expiry is a fact about the organisation, and the platform is allowed to
   show it.
   ========================================================================== */

function AgeBar({ p }: { p: Proposal }) {
  const age = proposalAge(p)
  const overdue = age >= 1
  const tone = overdue ? 'crit' : age >= 0.7 ? 'warn' : 'ok'
  const bar = { crit: 'bg-crit', warn: 'bg-warn', ok: 'bg-ok' }[tone]
  const days = daysOpen(p)

  return (
    <span className="inline-flex min-w-0 flex-col gap-1" title={overdue ? 'Past its expiry and still unactioned' : 'Time remaining before this proposal expires'}>
      <span className={cn('tnum inline-flex items-center gap-1 text-2xs font-medium leading-none', overdue ? 'text-crit' : 'text-ink-2')}>
        <Clock size={10} />
        {days}d open{overdue && ' · expired'}
      </span>
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-sunken">
        <span className={cn('block h-full rounded-full transition-[width] duration-700 ease-snap', bar)} style={{ width: `${Math.min(100, age * 100)}%` }} />
      </span>
    </span>
  )
}

function ProposalCard({ p }: { p: Proposal }) {
  const decide = useAstra((s) => s.decideProposal)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const meta = PROPOSAL_KIND_META[p.kind]
  const open = p.state === 'open'
  const value = proposalValue(p)

  return (
    <Card
      title={p.claim}
      subtitle={p.detail}
      right={
        <span className="flex shrink-0 items-center gap-1.5">
          <Chip tone={meta.tone}>{meta.label}</Chip>
          {p.state === 'accepted' && <Chip tone="ok"><Dot tone="ok" />accepted</Chip>}
          {p.state === 'rejected' && <Chip tone="crit"><Dot tone="crit" />rejected</Chip>}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-3">
        <span className="flex items-center gap-1.5">
          raised by <AgentChip id={p.from} />
        </span>
        <span>·</span>
        <span>to {p.to}</span>
        <span className="ml-auto w-[110px] shrink-0">
          <AgeBar p={p} />
        </span>
      </div>

      {/* §A5.2 — the agent's own case for more autonomy, with its simulation. */}
      {p.permission && (
        <div className="mt-3 rounded border border-agent/40 bg-agent/[0.06] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ShieldCheck size={12} className="shrink-0 text-agent" />
            <span className="label-cap">Permission request</span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="font-mono text-2xs text-ink-2">{p.permission.actionClass}</span>
              <AutonomyChip mode={p.permission.from} />
              <span className="text-ink-3">→</span>
              <AutonomyChip mode={p.permission.to} />
            </span>
          </div>
          <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{p.permission.scope}</p>
          <p className="mt-1 text-2xs leading-relaxed text-ink-3">
            <span className="font-medium text-ink-2">Simulation:</span> {p.permission.simulation}
          </p>
          <p className="mt-1 text-2xs leading-relaxed text-ink-3">
            <span className="font-medium text-ink-2">Conditions proposed:</span> {p.permission.conditions}
          </p>
        </div>
      )}

      <div className="mt-3 border-t border-line pt-3">
        <p className="label-cap mb-1.5">Evidence</p>
        <ul className="space-y-1">
          {p.evidence.map((e) => (
            <li key={e.label} className="flex items-start gap-1.5 text-2xs leading-relaxed text-ink-2">
              <span className="text-ink-3">·</span>
              <span className="min-w-0 flex-1">{e.label}</span>
              {e.ref && <EvidenceLink id={e.ref} compactMode />}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        {value.hoursYr !== undefined && <Metric size="sm" label="Hours / yr" value={num(value.hoursYr)} />}
        {value.projectedUsd !== undefined && <Metric size="sm" label="Projected value" value={usd(value.projectedUsd)} />}
        <p className="min-w-[180px] flex-1 text-2xs leading-relaxed text-ink-3">{value.note}</p>
        {p.source && (
          <span className="text-2xs text-ink-3" title="Figures are read from this record, not restated here">
            from <span className="font-mono text-agent">{p.source.id}</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="min-w-0 flex-1 text-2xs text-ink-2">
          <span className="text-ink-3">Requested:</span> {p.requestedDecision}
        </span>
        {open ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => decide(p.id, 'rejected', role.person)}>
              <X size={11} /> Reject
            </Button>
            <Button size="sm" variant="primary" onClick={() => decide(p.id, 'accepted', role.person)}>
              <Check size={11} /> Accept
            </Button>
          </span>
        ) : (
          <span className="shrink-0 text-2xs text-ink-3">
            {p.state} by {p.decidedBy}
            {p.decidedNote ? ` — ${p.decidedNote}` : ''}
          </span>
        )}
      </div>
    </Card>
  )
}

const FILTERS: { id: 'open' | 'all' | ProposalKind; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'permission', label: 'Permission' },
  { id: 'elimination', label: 'Elimination' },
  { id: 'risk', label: 'Risk' },
  { id: 'all', label: 'All' },
]

export function Proposals() {
  const proposals = useAstra((s) => s.proposals)
  const [filter, setFilter] = React.useState<'open' | 'all' | ProposalKind>('open')

  const all = Object.values(proposals)
  const open = all.filter((p) => p.state === 'open')
  const overdue = open.filter((p) => proposalAge(p) >= 1)
  const initiative = initiativeShare(all)

  const shown = all
    .filter((p) => (filter === 'open' ? p.state === 'open' : filter === 'all' ? true : p.kind === filter))
    .sort((a, b) => proposalAge(b) - proposalAge(a))

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Raised by agents — claim, evidence, value, decision"
        meta={
          <Chip tone={overdue.length ? 'crit' : 'brand'}>
            <Dot tone={overdue.length ? 'crit' : 'brand'} pulse={open.length > 0} />
            {open.length} open
          </Chip>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              size="sm"
              label="Initiative share"
              value={pct(initiative.share * 100, 0)}
              hint={`${initiative.agentOriginated} of ${initiative.total} decision items`}
            />
            <Metric size="sm" label="Open" value={open.length} />
            <Metric size="sm" label="Aged out" value={overdue.length} />
            <Metric
              size="sm"
              label="Value on the table"
              value={usd(open.reduce((s, p) => s + (proposalValue(p).projectedUsd ?? 0), 0))}
            />
          </div>

          {/* AG-3 is the point of this surface existing, so it is stated plainly. */}
          <div className="flex items-start gap-2 rounded-md border border-line bg-sunken px-3 py-2.5">
            <TrendingUp size={13} className="mt-px shrink-0 text-brand-ink" />
            <p className="text-2xs leading-relaxed text-ink-2">
              AG-3 target: <span className="font-medium text-ink">≥ 40%</span> of governance decision items originated by agent proposals by R2.
            </p>
          </div>

          <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />

          {shown.length === 0 ? (
            <Empty title="Nothing here" body="No proposals match this filter." />
          ) : (
            shown.map((p) => <ProposalCard key={p.id} p={p} />)
          )}
        </div>
      </div>
    </>
  )
}
