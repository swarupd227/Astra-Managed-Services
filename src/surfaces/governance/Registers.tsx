import React from 'react'
import { CalendarClock, GitPullRequest, ShieldQuestion } from 'lucide-react'
import { DECISIONS, OBLIGATIONS } from '@/domain/ledgers'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { followThroughRate } from '@/domain/metrics'
import { PageHeader, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { cn, dateShort, pct, until } from '@/lib/format'
import { FORUMS, RISKS } from '@/domain/governanceSeed'
import { ProducedBy } from '@/ui/ProducedBy'



export function Registers() {
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [tab, setTab] = React.useState<'decisions' | 'obligations' | 'risks' | 'cadence'>('decisions')

  const overdue = OBLIGATIONS.filter((o) => o.state === 'red')
  const openConditions = DECISIONS.filter((d) => d.followThrough && d.followThrough.state !== 'green')

  return (
    <>
      <PageHeader
        title="Decision, Obligation & Risk Registers"
        subtitle="Decisions, obligations and risks with tracked follow-through"
        actions={
          <Button size="sm" variant="default" onClick={() => pushToast({ title: 'Decision sheet assembled', body: 'The items requiring a decision at the next sitting, each with options, platform-computed implications and a recommendation.', tone: 'info' })}>
            <ShieldQuestion size={12} /> Build decision sheet
          </Button>
        }
      />

      <ProducedBy
        agents={["agt_herald"]}
        what="assembling decision sheets and tracking conditions"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Decisions recorded" value={DECISIONS.length} />
        <Metric size="sm" label="Conditions tracked" value={DECISIONS.filter((d) => d.followThrough).length} />
        <Metric size="sm" label="Conditions off-track" value={openConditions.length} deltaTone={openConditions.length ? 'warn' : 'ok'} />
        <Metric size="sm" label="Obligations overdue" value={overdue.length} deltaTone={overdue.length ? 'crit' : 'ok'} />
        <Metric size="sm" label="Follow-through on track" value={pct(followThroughRate(), 0)} deltaTone="ok" />
      </div>

      <div className="shrink-0 border-b border-line bg-surface px-4 py-1.5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'decisions', label: 'Decision Register', count: DECISIONS.length },
            { id: 'obligations', label: 'Obligations', count: OBLIGATIONS.length },
            { id: 'risks', label: 'Risk Register', count: RISKS.length },
            { id: 'cadence', label: 'Governance cadence' },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'decisions' && (
          <ul className="space-y-2.5">
            {DECISIONS.map((d) => (
              <li key={d.id}>
                <article className="rounded-md border border-line bg-surface">
                  <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                    <span className="font-mono text-2xs text-ink-2">{d.id}</span>
                    <Chip tone={d.decision === 'approved' ? 'ok' : d.decision === 'approved_with_condition' ? 'brand' : d.decision === 'rejected' ? 'crit' : 'neutral'}>
                      {d.decision.replace(/_/g, ' ')}
                    </Chip>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{d.subject}</span>
                    <span className="shrink-0 text-2xs text-ink-3">{dateShort(d.at)}</span>
                    <EvidenceLink id={d.evidenceId} />
                  </header>

                  <div className="grid gap-0 md:grid-cols-3">
                    <div className="border-b border-line px-3 py-2.5 md:border-b-0 md:border-r">
                      <div className="label-cap">Forum &amp; owner</div>
                      <p className="mt-1 text-2xs text-ink-2">{d.forum}</p>
                      <p className="mt-0.5 text-2xs text-ink-3">{d.owner}</p>
                    </div>
                    <div className="border-b border-line px-3 py-2.5 md:border-b-0 md:border-r">
                      <div className="label-cap">Inputs</div>
                      <ul className="mt-1 space-y-0.5">
                        {d.inputs.map((i) => <li key={i} className="font-mono text-2xs text-ink-3">{i}</li>)}
                      </ul>
                    </div>
                    <div className="px-3 py-2.5">
                      <div className="label-cap">Effect</div>
                      <p className="mt-1 text-2xs text-ink-2">{d.effective ?? '—'}</p>
                      {d.condition && <p className="mt-1 text-2xs text-ink-3">Condition: {d.condition}</p>}
                    </div>
                  </div>

                  {d.followThrough && (
                    <footer className={cn('flex flex-wrap items-center gap-2 border-t px-3 py-2', d.followThrough.state === 'green' ? 'border-ok/30 bg-ok/[0.04]' : d.followThrough.state === 'amber' ? 'border-warn/35 bg-warn/[0.05]' : 'border-crit/35 bg-crit/[0.05]')}>
                      <GitPullRequest size={11} className={d.followThrough.state === 'green' ? 'text-ok' : d.followThrough.state === 'amber' ? 'text-warn' : 'text-crit'} />
                      <span className="text-2xs text-ink-2">{d.followThrough.text}</span>
                      <span className="text-2xs text-ink-3">·</span>
                      <span className="text-2xs text-ink-2">{d.followThrough.progress}</span>
                      <Chip tone={d.followThrough.state === 'green' ? 'ok' : d.followThrough.state === 'amber' ? 'warn' : 'crit'} className="ml-auto">
                        {d.followThrough.state}
                      </Chip>
                    </footer>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}

        {tab === 'obligations' && (
          <Card title="Obligations register" subtitle="By due date">
            <Table>
              <thead>
                <tr>
                  <Th>Obligation</Th>
                  <Th>Owner</Th>
                  <Th>Cadence</Th>
                  <Th>Due</Th>
                  <Th>Evidence requirement</Th>
                  <Th>State</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {[...OBLIGATIONS].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()).map((o) => (
                  <Tr key={o.id}>
                    <Td className="text-ink">{o.title}</Td>
                    <Td>{o.owner}</Td>
                    <Td className="text-2xs">{o.cadence}</Td>
                    <Td className={cn('text-2xs', o.state === 'red' ? 'text-crit' : o.state === 'amber' ? 'text-warn' : 'text-ink-2')}>
                      {dateShort(o.dueAt)} · {until(o.dueAt)}
                    </Td>
                    <Td className="max-w-[260px] truncate text-2xs text-ink-3">{o.evidenceRequirement}</Td>
                    <Td><Chip tone={o.state === 'green' ? 'ok' : o.state === 'amber' ? 'warn' : 'crit'}>{o.state}</Chip></Td>
                    <Td>
                      {o.state === 'red' ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!role.canApprove}
                          onClick={() => pushToast({ title: 'Escalation raised', body: `${o.title} escalated to the executive sponsor with a response-time commitment.`, tone: 'crit' })}
                        >
                          Escalate
                        </Button>
                      ) : (
                        <span className="text-2xs text-ink-3">On track</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {tab === 'risks' && (
          <Card title="Risk register, evidence-fed" subtitle="Linked to live telemetry">
            <ul className="space-y-2">
              {RISKS.map((r) => (
                <li key={r.id} className={cn('rounded border p-3', r.state === 'red' ? 'border-crit/40 bg-crit/[0.05]' : r.state === 'amber' ? 'border-warn/35 bg-warn/[0.04]' : 'border-ok/35 bg-ok/[0.04]')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-2xs text-ink-3">{r.id}</span>
                    <Chip tone={r.state === 'red' ? 'crit' : r.state === 'amber' ? 'warn' : 'ok'}>{r.state}</Chip>
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">{r.title}</span>
                    <span className="shrink-0 text-2xs text-ink-3">{r.owner}</span>
                    <Chip tone={r.trend === 'improving' ? 'ok' : r.trend === 'worsening' ? 'crit' : 'neutral'}>{r.trend}</Chip>
                  </div>
                  <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
                    <span className="text-ink-3">Live evidence: </span>{r.link}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {tab === 'cadence' && (
          <Card title="Governance cadence" subtitle="Forums, inputs and standing outputs">
            <Table>
              <thead>
                <tr>
                  <Th>Forum</Th>
                  <Th>Cadence</Th>
                  <Th>Chair</Th>
                  <Th>Platform-generated inputs</Th>
                  <Th>Standing outputs</Th>
                </tr>
              </thead>
              <tbody>
                {FORUMS.map((f) => (
                  <Tr key={f.name}>
                    <Td className="text-ink">{f.name}</Td>
                    <Td><Chip tone="neutral">{f.cadence}</Chip></Td>
                    <Td className="text-2xs">{f.chair}</Td>
                    <Td className="max-w-[360px] text-2xs text-ink-3">{f.inputs}</Td>
                    <Td className="max-w-[240px] text-2xs text-ink-3">{f.outputs}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-line bg-sunken p-3">
                <div className="flex items-center gap-1.5"><CalendarClock size={11} className="text-brand-ink" /><span className="label-cap">Pack timetable</span></div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                  Frozen T-2 · distributed T-1
                </p>
              </div>
              <div className="rounded border border-line bg-sunken p-3">
                <div className="flex items-center gap-1.5"><ShieldQuestion size={11} className="text-brand-ink" /><span className="label-cap">Governance of the AI itself</span></div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  )
}
