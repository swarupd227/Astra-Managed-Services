import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Ban, Pause, Play, ShieldQuestion, TrendingDown, TrendingUp } from 'lucide-react'
import { AUTONOMY_SCHEDULE } from '@/domain/knowledge'
import { AI_FUNCTIONS } from '@/domain/suspensions'
import { ACTION_CLASSES, AC, AUTONOMY_LEVELS, ROLE_BY_ID } from '@/domain/reference'
import { TOWERS, TOWER_BY_ID, AGENTS } from '@/domain/estate'
import { useAstra } from '@/domain/store'
import { PageHeader, AutonomyChip, AgentChip, EvidenceLink } from '@/ui/domain'
import { Button, Card, Chip, Drawer, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { Heatmap } from '@/ui/charts'
import { cn, ago, num, pct } from '@/lib/format'
import { PROMOTIONS } from '@/domain/autonomySeed'
import { daysOpen } from '@/domain/proposals'
import { AutonomyForecast } from '@/ui/AutonomyForecast'


export function AutonomyPosture() {
  const proposals = useAstra((s) => s.proposals)
  const pendingRequests = Object.values(proposals).filter((p) => p.permission && p.state === 'open')

  const pushToast = useAstra((s) => s.pushToast)
  const suspensions = useAstra((s) => s.suspensions)
  const suspend = useAstra((s) => s.suspend)
  const release = useAstra((s) => s.release)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const [cell, setCell] = React.useState<{ tower: string; ac: string } | null>(null)

  const classSuspension = (ac: string, tower: string) =>
    suspensions.find((x) => x.scope === 'actionClass' && x.target === ac && (!x.tower || x.tower === tower))
  const functionSuspension = (fn: string) => suspensions.find((x) => x.scope === 'function' && x.target === fn)

  const runTowers = TOWERS.filter((t) => !['S0', 'S1'].includes(t.state))
  const byKey = React.useMemo(() => {
    const m: Record<string, (typeof AUTONOMY_SCHEDULE)[number]> = {}
    AUTONOMY_SCHEDULE.forEach((c) => { m[`${c.tower}|${c.actionClass}`] = c })
    return m
  }, [])

  const gaps = AUTONOMY_SCHEDULE.filter((c) => c.current < c.target && runTowers.some((t) => t.id === c.tower))
  const blocked = gaps.filter((c) => c.blocked)
  const atTarget = AUTONOMY_SCHEDULE.filter((c) => c.current >= c.target && runTowers.some((t) => t.id === c.tower))

  const selected = cell ? byKey[`${cell.tower}|${cell.ac}`] : null

  return (
    <>
      <PageHeader
        title="Autonomy Posture"
        subtitle="Tower × action class · current against target"
        actions={
          <Button size="sm" variant="default" onClick={() => pushToast({ title: 'Autonomy schedule exported', body: 'Signed extract with the evidence pack behind every grade.', tone: 'ok' })}>
            <ArrowUpRight size={12} /> Export schedule
          </Button>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Cells at target" value={`${atTarget.length} / ${atTarget.length + gaps.length}`} hint="tower × action class in Run" />
        <Metric size="sm" label="Below target" value={gaps.length} deltaTone="warn" />
        <Metric size="sm" label="Blocked by the estate" value={blocked.length} deltaTone="crit" />
        <Metric size="sm" label="Promotions this quarter" value={PROMOTIONS.filter((p) => p.dir === 'up').length} deltaTone="ok" />
        <Metric size="sm" label="Automatic demotions" value={PROMOTIONS.filter((p) => p.dir === 'down').length} deltaTone="crit" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Tower × action-class heatmap"
          subtitle="Amber marks a gap to target; red marks an estate blocker"
        >
          <Heatmap
            rows={runTowers.map((t) => ({ id: t.id, label: t.name }))}
            cols={ACTION_CLASSES.map((a) => ({ id: a.id, label: a.id.replace('AC-', '') }))}
            value={(r, c) => {
              const v = byKey[`${r}|${c}`]
              return v ? { level: v.current, target: v.target, blocked: Boolean(v.blocked) } : null
            }}
            onCell={(tower, ac) => setCell({ tower, ac })}
            cellTitle={(r, c) => {
              const v = byKey[`${r}|${c}`]
              return v ? `${TOWER_BY_ID[r].name} · ${c} ${AC[c]?.name}\nCurrent L${v.current} · target L${v.target}${v.blocked ? `\nBlocked: ${v.blocked}` : ''}` : ''
            }}
            legend={
              <div className="mt-3 flex flex-wrap items-center gap-4 text-2xs text-ink-3">
                {AUTONOMY_LEVELS.map((l) => (
                  <span key={l.level} className="flex items-center gap-1.5">
                    <span className={cn('h-3 w-4 rounded-xs', ['bg-sunken', 'bg-brand/15', 'bg-brand/35', 'bg-brand/60', 'bg-brand/90'][l.level])} />
                    {l.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warn" />gap to target</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-crit" />blocked by the estate</span>
              </div>
            }
          />
        </Card>

        {/* §A5.3 — the heatmap above says where autonomy is; this says when
            it moves, and what is stopping the classes that are not moving. */}
        <div className="mt-4">
          <AutonomyForecast />
        </div>

        {/* Requests the workforce has made of the board, above the log of
            what the board has already decided. The two were previously
            unconnected: an agent could be asking for a level the register
            showed it had been granted. */}
        {pendingRequests.length > 0 && (
          <Card
            className="mt-4"
            title="Requested by the workforce"
            subtitle="Open permission requests — agents making their own case for trust (§A5.2)"
            right={<Chip tone="agent">{pendingRequests.length}</Chip>}
          >
            <ul className="space-y-2">
              {pendingRequests.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-agent/35 bg-agent/[0.05] p-3">
                  <ShieldQuestion size={13} className="shrink-0 text-agent" />
                  <AgentChip id={p.from} />
                  <Chip mono>{p.permission!.actionClass}</Chip>
                  <span className="flex items-center gap-1 text-2xs">
                    <AutonomyChip mode={p.permission!.from} />
                    <span className="text-ink-3">→</span>
                    <AutonomyChip mode={p.permission!.to} />
                  </span>
                  <span className="min-w-[180px] flex-1 text-2xs leading-relaxed text-ink-2">{p.permission!.scope}</span>
                  <span className="text-2xs text-ink-3">{daysOpen(p)}d open</span>
                  <Link
                    to="/governance/proposals"
                    className="rounded-xs border border-line-strong px-2 py-0.5 text-2xs text-ink-2 hover:border-brand hover:text-brand-ink"
                  >
                    Decide
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_400px]">
          <Card title="Promotion and demotion log" subtitle="Last five schedule changes">
            <ul className="space-y-2">
              {PROMOTIONS.map((p) => (
                <li key={p.id} className={cn('rounded border p-3', p.dir === 'up' ? 'border-ok/35 bg-ok/[0.05]' : 'border-crit/40 bg-crit/[0.06]')}>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.dir === 'up' ? <TrendingUp size={13} className="text-ok" /> : <TrendingDown size={13} className="text-crit" />}
                    <span className="font-mono text-2xs text-ink-2">{p.id}</span>
                    <span className="text-xs text-ink">{TOWER_BY_ID[p.tower]?.name}</span>
                    <Chip mono>{p.ac}</Chip>
                    <span className="flex items-center gap-1 text-2xs">
                      <span className="text-ink-3">L{p.from}</span>
                      <span className="text-ink-3">→</span>
                      <span className={p.dir === 'up' ? 'text-ok' : 'text-crit'}>L{p.to}</span>
                    </span>
                    <span className="ml-auto text-2xs text-ink-3">{ago(new Date(Date.now() - p.at * 86400000).toISOString(), new Date())}</span>
                  </div>
                  <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{p.why}</p>
                  <EvidenceLink id={p.evidence} className="mt-1" />
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-4">
            <Card title="Autonomy blockers" subtitle="Constraints in the estate, not the agents">
              {blocked.length === 0 ? (
                <p className="text-2xs text-ink-3">No blocked classes in Run towers.</p>
              ) : (
                <ul className="space-y-2">
                  {[...new Set(blocked.map((b) => b.blocked))].map((reason) => {
                    const affected = blocked.filter((b) => b.blocked === reason)
                    return (
                      <li key={reason} className="rounded border border-crit/35 bg-crit/[0.05] p-2.5">
                        <div className="flex items-start gap-2">
                          <Ban size={11} className="mt-[3px] shrink-0 text-crit" />
                          <div className="min-w-0">
                            <p className="text-2xs leading-relaxed text-ink-2">{reason}</p>
                            <p className="mt-1 text-2xs text-ink-3">
                              Affects {affected.length} cell{affected.length > 1 ? 's' : ''} across {new Set(affected.map((a) => a.tower)).size} tower
                              {new Set(affected.map((a) => a.tower)).size > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card title="Permanent caps" subtitle="Ceilings set by decision">
              <ul className="space-y-2 text-2xs leading-relaxed text-ink-2">
                <li className="flex gap-2">
                  <Chip tone="crit" mono>AC-71</Chip>
                  <span>Data deletion and purge is irreversible. Never agent-executed at any level, on any tower, by platform rule.</span>
                </li>
                <li className="flex gap-2">
                  <Chip tone="warn" mono>AC-58</Chip>
                  <span>IAM and entitlement change is capped at L2 with a four-eyes second control — a client decision recorded in dec_2027_010 on segregation-of-duties grounds.</span>
                </li>
                <li className="flex gap-2">
                  <Chip tone="warn" mono>AC-37</Chip>
                  <span>Human pull-request review on code fixes is a permanent floor across every service line. Forge accelerates the work; it never merges it.</span>
                </li>
              </ul>
            </Card>

            {/* A customer may direct that one AI function stop. The gateway
                refuses the function before any model call; the record says
                who directed it, because a customer-directed stop is not a
                breach. */}
            <Card title="AI function suspensions" subtitle="Stop one function without stopping the platform">
              <ul className="space-y-2">
                {AI_FUNCTIONS.map((f) => {
                  const active = functionSuspension(f.id)
                  return (
                    <li key={f.id} className={cn('flex items-center gap-2 rounded border p-2.5', active ? 'border-crit/40 bg-crit/[0.06]' : 'border-line')}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs text-ink-2">{f.id}</span>
                          {active && <Chip tone="crit">suspended</Chip>}
                        </div>
                        <p className="mt-0.5 text-2xs leading-relaxed text-ink-3">{f.label}</p>
                        {active && <p className="mt-0.5 text-2xs text-ink-3">{active.by} · {active.reason}{active.directedByCustomer ? ' · customer-directed' : ''}</p>}
                      </div>
                      {active ? (
                        <Button size="sm" variant="ghost" disabled={!role.canApprove} onClick={() => release(active.id, role.person)}>
                          <Play size={11} /> Release
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!role.canApprove}
                          onClick={() => suspend('function', f.id, role.person, 'Suspended from the autonomy posture', { directedByCustomer: role.org === 'client' })}
                        >
                          <Pause size={11} /> Suspend
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          </div>
        </div>
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setCell(null)}
        title={selected ? `${TOWER_BY_ID[selected.tower]?.name} · ${selected.actionClass}` : ''}
        subtitle={selected ? AC[selected.actionClass]?.name : ''}
        width="max-w-[520px]"
      >
        {selected && (
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric size="sm" label="Current" value={`L${selected.current}`} />
              <Metric size="sm" label="Target" value={`L${selected.target}`} />
              <Metric size="sm" label="Platform floor" value={AC[selected.actionClass]?.floor.replace(/_/g, '-')} />
            </div>

            <div className="rounded border border-line bg-sunken p-3">
              <div className="label-cap">Evidence behind the current grade</div>
              <p className="mt-1.5 font-mono text-2xs text-ink-2">{selected.evidence}</p>
            </div>

            <div className="rounded border border-line p-3">
              <div className="label-cap">Action-class characteristics</div>
              <dl className="mt-1.5 space-y-1 text-2xs">
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Reversibility</dt><dd className="text-ink-2">{AC[selected.actionClass]?.reversibility.replace(/_/g, ' ')}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Verification pack</dt><dd className="font-mono text-ink-2">{AC[selected.actionClass]?.verificationPack}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Four-eyes</dt><dd className="text-ink-2">{AC[selected.actionClass]?.fourEyes ? 'required' : 'not required'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-3">Domain</dt><dd className="text-ink-2">{AC[selected.actionClass]?.domain}</dd></div>
              </dl>
            </div>

            <div className="rounded border border-line p-3">
              <div className="label-cap">Agents graded on this class</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {AGENTS.filter((a) => a.grants[selected.actionClass] && a.towers.includes(selected.tower)).map((a) => (
                  <AgentChip key={a.id} id={a.id} showGrade={selected.actionClass} />
                ))}
              </div>
            </div>

            {selected.blocked && (
              <div className="rounded border border-crit/40 bg-crit/[0.06] p-3">
                <div className="label-cap text-crit">Blocked</div>
                <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">{selected.blocked}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={!role.canApprove || selected.current >= selected.target || Boolean(selected.blocked)}
                onClick={() => { setCell(null); pushToast({ title: 'Schedule change proposed', body: 'Promotion pack assembled with replay, shadow and live evidence. Lands on the next service governance board decision sheet.', tone: 'ok' }) }}
              >
                Propose promotion
              </Button>
              <Button variant="default" disabled={!role.canApprove} onClick={() => { setCell(null); pushToast({ title: 'Review requested', body: 'Added to the governance pack for the next sitting.', tone: 'info' }) }}>
                Request review
              </Button>
              {(() => {
                const active = classSuspension(selected.actionClass, selected.tower)
                return active ? (
                  <Button variant="ghost" disabled={!role.canApprove} onClick={() => release(active.id, role.person)}>
                    <Play size={11} /> Release class
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    disabled={!role.canApprove}
                    onClick={() => suspend('actionClass', selected.actionClass, role.person, `Suspended from the autonomy posture — ${selected.actionClass} on ${TOWER_BY_ID[selected.tower]?.name}`, { tower: selected.tower, directedByCustomer: role.org === 'client' })}
                  >
                    <Pause size={11} /> Suspend class here
                  </Button>
                )
              })()}
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}
