import React from 'react'
import { Link } from 'react-router-dom'
import { Boxes, CircleDollarSign, Lightbulb, Recycle } from 'lucide-react'
import { DEMAND_CLASSES, GLIDEPATH } from '@/domain/ledgers'
import { TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { PageHeader, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Drawer, Metric, Table, Td, Th, Tr, selectClass } from '@/ui/primitives'
import { Funnel, Sparkline, CHART_COLORS } from '@/ui/charts'
import { cn, num, pct, usd } from '@/lib/format'
import type { DemandClassRec } from '@/domain/types'
import { volumeRemoved } from '@/domain/metrics'
import { proposalFor } from '@/domain/proposals'
import { ProducedBy } from '@/ui/ProducedBy'
import { DeflectionPanel } from './DeflectionPanel'

const STATE_TONE: Record<DemandClassRec['eliminationState'], 'neutral' | 'info' | 'brand' | 'agent' | 'ok'> = {
  none: 'neutral', candidate: 'info', approved: 'brand', verifying: 'agent', eliminated: 'ok',
}

const PROPOSAL_LABEL: Record<NonNullable<DemandClassRec['proposalType']>, string> = {
  engineering_fix: 'Engineering fix',
  automation: 'Automation',
  self_service: 'Self-service',
  policy_change: 'Policy change',
  modernisation: 'Modernisation',
}

export function DemandElimination() {
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [tower, setTower] = React.useState('all')
  const [selected, setSelected] = React.useState<DemandClassRec | null>(null)
  const [sort, setSort] = React.useState<'npv' | 'hours' | 'volume'>('npv')

  const list = React.useMemo(() => {
    const filtered = DEMAND_CLASSES.filter((d) => tower === 'all' || d.tower === tower)
    return filtered.sort((a, b) =>
      sort === 'npv' ? (b.npv36m ?? 0) - (a.npv36m ?? 0) : sort === 'hours' ? b.hoursYr - a.hoursYr : b.volumeYr - a.volumeYr,
    )
  }, [tower, sort])

  const stages = [
    { label: 'Identified', count: DEMAND_CLASSES.length, tone: CHART_COLORS.ink3 },
    { label: 'Candidate', count: DEMAND_CLASSES.filter((d) => ['candidate', 'approved', 'verifying', 'eliminated'].includes(d.eliminationState)).length, tone: CHART_COLORS.info },
    { label: 'Approved', count: DEMAND_CLASSES.filter((d) => ['approved', 'verifying', 'eliminated'].includes(d.eliminationState)).length, tone: CHART_COLORS.brand },
    { label: 'Verifying', count: DEMAND_CLASSES.filter((d) => ['verifying', 'eliminated'].includes(d.eliminationState)).length, tone: CHART_COLORS.agent },
    { label: 'Banked', count: DEMAND_CLASSES.filter((d) => d.eliminationState === 'eliminated').length, tone: CHART_COLORS.ok },
  ]

  const totalHours = DEMAND_CLASSES.reduce((s, d) => s + d.hoursYr, 0)
  const proposalList = Object.values(useAstra((s) => s.proposals))
  const removedHours = DEMAND_CLASSES.filter((d) => d.eliminationState === 'eliminated').reduce((s, d) => s + d.hoursYr * (d.projectedRemoval ?? 0), 0)
  const pipelineNpv = DEMAND_CLASSES.filter((d) => d.eliminationState !== 'eliminated').reduce((s, d) => s + (d.npv36m ?? 0), 0)

  return (
    <>
      <PageHeader
        title="Demand Elimination Engine"
        subtitle="Recurrence mining and the costed elimination backlog"
        actions={
          <>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={cn(selectClass, 'w-[150px]')}>
              <option value="npv">Sort by NPV</option>
              <option value="hours">Sort by effort</option>
              <option value="volume">Sort by volume</option>
            </select>
            <select value={tower} onChange={(e) => setTower(e.target.value)} className={cn(selectClass, 'w-[190px]')}>
              <option value="all">All towers</option>
              {TOWERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        }
      />

      <ProducedBy
        agents={["agt_prospect"]}
        what="mining recurrence into demand classes and costing the elimination backlog"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Demand classes" value={DEMAND_CLASSES.length} hint={`${DEMAND_CLASSES.filter((d) => d.volumeBasis === 'sampled').length} sampled, not yet costed`} />
        <Metric size="sm" label="Annual effort in scope" value={`${num(totalHours)} h`} hint="measured, not estimated" />
        <Metric size="sm" label="Verified removed" value={`${num(Math.round(removedHours))} h`} deltaTone="ok" hint="banked after 60–90 days of decay" />
        <Metric size="sm" label="Pipeline NPV (36m)" value={usd(pipelineNpv)} hint="candidates and approved items not yet banked" />
        <Metric size="sm" label="Year-1 volume removed" value={pct(volumeRemoved(), 1)} deltaTone="ok" hint="target ≥ 15%" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card title="The loop" subtitle="Stage counts">
            <Funnel stages={stages} />
          </Card>

          <Card title="Demand classes and elimination backlog" subtitle="Costed candidates">
            <Table>
              <thead>
                <tr>
                  <Th>Class</Th>
                  <Th>Tower</Th>
                  <Th align="right">Volume /yr</Th>
                  <Th align="right">Effort /yr</Th>
                  <Th>Trend</Th>
                  <Th>Proposal</Th>
                  <Th align="right">NPV 36m</Th>
                  <Th>State</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <Tr key={d.id} onClick={() => setSelected(d)}>
                    <Td>
                      <span className="block truncate text-ink">{d.name}</span>
                      <span className="block font-mono text-[10px] text-ink-3">{d.id}</span>
                    </Td>
                    <Td>{TOWER_BY_ID[d.tower]?.name}</Td>
                    <Td align="right">{d.volumeBasis === 'sampled' ? <Chip>sampled · {d.sampleCount}</Chip> : num(d.volumeYr)}</Td>
                    <Td align="right">{d.volumeBasis === 'sampled' ? '—' : `${num(d.hoursYr)} h`}</Td>
                    <Td>
                      <span className="flex items-center gap-1.5">
                        <Sparkline
                          data={[1, 1 + d.trend * 0.2, 1 + d.trend * 0.5, 1 + d.trend * 0.75, 1 + d.trend]}
                          tone={d.trend < -0.4 ? 'ok' : d.trend < 0 ? 'info' : 'crit'}
                          width={42}
                          height={14}
                        />
                        <span className={cn('tnum text-2xs', d.trend < 0 ? 'text-ok' : 'text-crit')}>{pct(d.trend * 100, 0)}</span>
                      </span>
                    </Td>
                    <Td className="text-2xs">{d.proposalType ? PROPOSAL_LABEL[d.proposalType] : '—'}</Td>
                    <Td align="right">{d.npv36m ? usd(d.npv36m) : '—'}</Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1">
                        <Chip tone={STATE_TONE[d.eliminationState]}>{d.eliminationState}</Chip>
                        {/* One object owns the argument for eliminating this
                            class; this row links to it rather than restating it. */}
                        {proposalFor(proposalList, 'demand_class', d.id) && (
                          <Link
                            to="/governance/proposals"
                            onClick={(e) => e.stopPropagation()}
                            title="An agent has raised a proposal about this class"
                            className="inline-flex items-center gap-1 rounded-xs border border-brand/50 bg-brand/10 px-1.5 text-2xs font-medium leading-[16px] text-brand-ink hover:bg-brand/20"
                          >
                            <Lightbulb size={9} />proposed
                          </Link>
                        )}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <DeflectionPanel />
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.id} · ${TOWER_BY_ID[selected.tower]?.name}` : ''}
        width="max-w-[560px]"
        footer={
          selected && ['candidate'].includes(selected.eliminationState) ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={!role.canApprove}
                onClick={() => { setSelected(null); pushToast({ title: 'Elimination candidate approved', body: 'Becomes a Work Object executed through the same governed fabric, with the same evidence and gates as Run.', tone: 'ok' }) }}
              >
                Approve for the backlog
              </Button>
              <span className="text-2xs text-ink-3">Joint improvement backlog · reviewed in service governance</span>
            </div>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric size="sm" label="Volume /yr" value={selected.volumeBasis === 'sampled' ? `sampled · ${selected.sampleCount}` : num(selected.volumeYr)} />
              <Metric size="sm" label="Effort /yr" value={`${num(selected.hoursYr)} h`} />
              <Metric size="sm" label="NPV 36m" value={selected.npv36m ? usd(selected.npv36m) : '—'} />
            </div>

            <div className="rounded border border-line bg-sunken p-3">
              <div className="flex items-center gap-1.5"><Boxes size={11} className="text-brand-ink" /><span className="label-cap">Attributed cause</span></div>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{selected.cause}</p>
            </div>

            {selected.proposalType && (
              <div className="rounded border border-line p-3">
                <div className="flex items-center gap-1.5"><Recycle size={11} className="text-brand-ink" /><span className="label-cap">Proposal</span></div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
                  <span className="text-ink">{PROPOSAL_LABEL[selected.proposalType]}</span> · estimated {selected.effortDays} engineering days ·
                  projected removal {pct((selected.projectedRemoval ?? 0) * 100, 0)} of class volume
                </p>
                {selected.proposalType === 'modernisation' && (
                  <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                    Routes to the transform backlog, funded by capacity credits.
                  </p>
                )}
              </div>
            )}

            {selected.eliminationState === 'verifying' && (
              <div className="rounded border border-agent/35 bg-agent/[0.06] p-3">
                <div className="label-cap">Verification in progress</div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
                  Day {selected.verifyDay} of 60. Observed volume decay {pct((selected.observedDecay ?? 0) * 100, 0)} against the trailing mean,
                  versus a {pct((selected.projectedRemoval ?? 0) * 100, 0)} projection.
                </p>
                <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full bg-sunken">
                  <div className="h-full rounded-full bg-agent" style={{ width: `${((selected.verifyDay ?? 0) / 60) * 100}%` }} />
                </div>
                <p className="mt-2 text-2xs text-ink-3">Not banked until the window closes green.</p>
              </div>
            )}

            {selected.eliminationState === 'eliminated' && (
              <div className="rounded border border-ok/40 bg-ok/[0.06] p-3">
                <div className="flex items-center gap-1.5"><CircleDollarSign size={11} className="text-ok" /><span className="label-cap">Banked</span></div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
                  Class volume decayed {pct(Math.abs(selected.observedDecay ?? 0) * 100, 0)} and held for the full window.{' '}
                  {num(Math.round(selected.hoursYr * (selected.projectedRemoval ?? 0)))} hours entered the Glidepath Ledger, converting to capacity
                  credits at the contracted rate.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {GLIDEPATH.filter((g) => g.demandClass === selected.id).slice(0, 4).map((g) => (
                    <EvidenceLink key={g.id} id={g.evidenceId} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  )
}
