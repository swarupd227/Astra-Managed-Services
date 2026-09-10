import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Quote, Sparkles } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { objectiveLinks, objectiveProgress, unattributedAllocations, type MeasureState } from '@/domain/objectives'
import { DEMAND_CLASSES } from '@/domain/ledgers'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { ObjectiveCompilerDrawer } from './ObjectiveCompilerDrawer'
import { cn } from '@/lib/format'

/* ==========================================================================
   Objectives — the tier above missions.

   Every other screen reports mechanics: a tower, a class, an SLA. This one
   reports the thing the engagement was bought to achieve, and is candid
   where the platform cannot evidence it. An objective with an unmeasured
   half says so on its own card rather than in a footnote.
   ========================================================================== */

const MEASURE_TONE: Record<MeasureState, 'ok' | 'warn' | 'neutral'> = { on_track: 'ok', at_risk: 'warn', no_measure: 'neutral' }
const MEASURE_LABEL: Record<MeasureState, string> = { on_track: 'on track', at_risk: 'at risk', no_measure: 'no measure' }

export function Objectives() {
  const objectives = useAstra((s) => s.objectives)
  const accept = useAstra((s) => s.acceptObjective)
  const pushToast = useAstra((s) => s.pushToast)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  /**
   * What counts as the client's progress is the client's to accept. A
   * provider role may propose the mapping and must not sign it off — the
   * same separation the platform applies to a gated action.
   */
  const canAcceptObjectives = role.org === 'client' && role.canApprove
  const [compiling, setCompiling] = React.useState(false)

  const progress = React.useMemo(() => objectives.map(objectiveProgress), [objectives])
  const links = React.useMemo(
    () => Object.fromEntries(objectives.map((o) => [o.id, objectiveLinks(o.id)])),
    [objectives],
  )
  const orphaned = React.useMemo(() => unattributedAllocations(), [])
  const accepted = objectives.filter((o) => o.state === 'accepted').length
  const measures = progress.flatMap((p) => p.measures)
  const unmeasured = measures.filter((m) => m.state === 'no_measure').length
  const withGaps = objectives.filter((o) => o.gaps.length > 0).length
  const proxies = measures.filter((m) => m.proxy).length

  return (
    <>
      <PageHeader
        title="Objectives"
        subtitle="What the engagement was bought to achieve, and what the platform can evidence"
        actions={
          <>
            <Button size="sm" variant="default" onClick={() => setCompiling(true)}>
              <Sparkles size={12} /> Compile from a statement
            </Button>
            <Button
              size="sm" variant="default"
              onClick={() => pushToast({ title: 'Objective statement exported', body: 'Each objective with its measures, their current figures, the accepted proxies and the declared gaps.', tone: 'ok' })}
            >
              <ArrowUpRight size={12} /> Export statement
            </Button>
          </>
        }
      />

      <ObjectiveCompilerDrawer open={compiling} onClose={() => setCompiling(false)} />

      <ProducedBy agents={['agt_herald']} what="resolving each measure to a governed figure — never computing one of its own" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Objectives" value={objectives.length} />
        <Metric size="sm" label="Accepted" value={`${accepted} / ${objectives.length}`} deltaTone={accepted === objectives.length ? 'ok' : 'warn'} />
        <Metric size="sm" label="Measures on track" value={`${measures.filter((m) => m.state === 'on_track').length} / ${measures.filter((m) => m.state !== 'no_measure').length}`} deltaTone={measures.some((m) => m.state === 'at_risk') ? 'warn' : 'ok'} />
        <Metric size="sm" label="Unmeasured" value={unmeasured} deltaTone={unmeasured ? 'warn' : 'ok'} />
        <Metric size="sm" label="Objectives with gaps" value={withGaps} deltaTone={withGaps ? 'warn' : 'ok'} hint={`${proxies} accepted proxy measure${proxies === 1 ? '' : 's'}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">

        <div className="space-y-4">
          {progress.map((p) => {
            const o = p.objective
            return (
              <Card
                key={o.id}
                title={o.statement.split(':')[0]}
                subtitle={`${o.source} · owner ${o.owner} · ${o.horizon}`}
                right={
                  <span className="flex items-center gap-1.5">
                    <Chip tone={p.state === 'on_track' ? 'ok' : p.state === 'at_risk' ? 'warn' : 'neutral'}>
                      {p.state === 'unmeasurable' ? 'not measurable' : p.state === 'on_track' ? 'on track' : 'at risk'}
                    </Chip>
                    <Chip tone={o.state === 'accepted' ? 'ok' : 'info'}>{o.state}</Chip>
                  </span>
                }
              >
                <blockquote className="flex gap-2 rounded border border-line bg-sunken p-3">
                  <Quote size={12} className="mt-0.5 shrink-0 text-ink-3" />
                  <p className="text-2xs leading-relaxed text-ink-2">{o.statement}</p>
                </blockquote>

                <div className="mt-3">
                  <Table>
                    <thead>
                      <tr><Th>Measure</Th><Th align="right">Now</Th><Th align="right">Target</Th><Th>Source</Th><Th>State</Th></tr>
                    </thead>
                    <tbody>
                      {p.measures.map((m) => (
                        <Tr key={m.id} className={m.state === 'no_measure' ? 'bg-warn/[0.05]' : undefined}>
                          <Td className="max-w-[280px] text-2xs leading-snug text-ink">
                            {m.label}
                            {m.proxy && <Chip tone="warn" className="ml-1.5">proxy</Chip>}
                            {m.proxyNote && <span className="mt-0.5 block text-[10px] leading-snug text-ink-3">{m.proxyNote}</span>}
                          </Td>
                          <Td align="right" className={cn('tnum text-2xs', m.state === 'no_measure' ? 'text-ink-3' : 'text-ink')}>{m.display}</Td>
                          <Td align="right" className="tnum text-2xs text-ink-2">{m.target ?? '—'}</Td>
                          <Td className="max-w-[320px] text-2xs leading-snug text-ink-2">
                            {m.detail}
                            {m.href && m.state !== 'no_measure' && <Link to={m.href} className="ml-1 text-brand-ink hover:underline">open →</Link>}
                          </Td>
                          <Td><Chip tone={MEASURE_TONE[m.state]}>{MEASURE_LABEL[m.state]}</Chip></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </div>

                {o.gaps.length > 0 && (
                  <div className="mt-3 rounded border border-warn/40 bg-warn/[0.05] p-3">
                    <div className="label-cap text-warn">Declared gaps</div>
                    <ul className="mt-1.5 space-y-1">
                      {o.gaps.map((g) => <li key={g} className="text-2xs leading-relaxed text-ink-2">· {g}</li>)}
                    </ul>
                  </div>
                )}

                <div className="mt-3 grid gap-2 rounded border border-line bg-sunken p-3 sm:grid-cols-3">
                  <div>
                    <div className="label-cap">Standing missions</div>
                    {links[o.id].missions.length ? (
                      <ul className="mt-1 space-y-0.5">
                        {links[o.id].missions.slice(0, 4).map((m) => (
                          <li key={m.id} className="truncate text-2xs text-ink-2" title={m.goal}>· {m.name} — {m.tower.replace('twr_', '')}</li>
                        ))}
                        {links[o.id].missions.length > 4 && <li className="text-2xs text-ink-3">+{links[o.id].missions.length - 4} more</li>}
                      </ul>
                    ) : (
                      <p className="mt-1 text-2xs text-ink-3">None name this objective.</p>
                    )}
                    <Link to="/missions" className="mt-1 inline-block text-2xs text-brand-ink hover:underline">open missions →</Link>
                  </div>

                  <div>
                    <div className="label-cap">Credits committed</div>
                    {links[o.id].allocations.length ? (
                      <>
                        <p className="tnum mt-1 text-xs text-ink">{links[o.id].credits.toLocaleString('en-GB')}</p>
                        <p className="text-2xs leading-relaxed text-ink-3">
                          across {links[o.id].allocations.length} allocation{links[o.id].allocations.length === 1 ? '' : 's'} · {links[o.id].yieldRealised.toLocaleString('en-GB')} of {links[o.id].yieldPromised.toLocaleString('en-GB')} promised hours realised
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-2xs text-ink-3">No transform spend names this objective.</p>
                    )}
                    <Link to="/governance/glidepath" className="mt-1 inline-block text-2xs text-brand-ink hover:underline">open ledger →</Link>
                  </div>

                  <div>
                    <div className="label-cap">Demand classes</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(o.servedBy.demandClasses ?? []).map((id) => (
                        <Link key={id} to="/governance/elimination">
                          <Chip mono title={DEMAND_CLASSES.find((d) => d.id === id)?.name}>{id}</Chip>
                        </Link>
                      ))}
                      {!(o.servedBy.demandClasses ?? []).length && <span className="text-2xs text-ink-3">none linked</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="ml-auto flex items-center gap-2">
                    {o.state === 'accepted' ? (
                      <span className="text-2xs text-ink-3">accepted by {o.acceptedBy} · {o.acceptedAt?.slice(0, 10)}</span>
                    ) : (
                      <Button
                        size="sm" variant="primary" disabled={!canAcceptObjectives}
                        title={
                          canAcceptObjectives
                            ? 'Accept these measures — including the gaps — as what will count as progress'
                            : 'What counts as the client\'s progress is the client\'s to accept. The provider does not hold this pen.'
                        }
                        onClick={() => accept(o.id, role.person)}
                      >
                        <Check size={11} /> Accept measures
                      </Button>
                    )}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>

        {orphaned.length > 0 && (
          <Card className="mt-4" title="Transform spend with no stated objective" subtitle="Credits approved without naming what they are for">
            <ul className="space-y-1">
              {orphaned.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-2 text-2xs text-ink-2">
                  <Chip mono>{a.id}</Chip>
                  <span className="text-ink">{a.title}</span>
                  <span className="tnum ml-auto text-ink-3">{a.credits.toLocaleString('en-GB')} credits</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

      </div>
    </>
  )
}
