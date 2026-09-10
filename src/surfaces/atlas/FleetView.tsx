import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Pause, Play, Search } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID, ACTION_CLASSES } from '@/domain/reference'
import { TOWER_BY_ID } from '@/domain/estate'
import { PageHeader, GradeChip, AutonomyChip } from '@/ui/domain'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr, inputClass, selectClass } from '@/ui/primitives'
import { Sparkline } from '@/ui/charts'
import { cn, ago, num, pct, usd } from '@/lib/format'
import { ProducedBy } from '@/ui/ProducedBy'

export function FleetView() {
  const nav = useNavigate()
  const agents = useAstra((s) => s.agents)
  const suspend = useAstra((s) => s.suspendAgent)
  const reinstate = useAstra((s) => s.reinstateAgent)
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]

  const [q, setQ] = React.useState('')
  const [origin, setOrigin] = React.useState<'all' | 'artizent' | 'client'>('all')
  const [sort, setSort] = React.useState<'name' | 'success' | 'cost' | 'displaced'>('displaced')

  const list = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return Object.values(agents)
      .filter((a) => (origin === 'all' || a.origin === origin))
      .filter((a) => !needle || `${a.name} ${a.codename} ${a.mission} ${a.ownerHuman}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        // Demoted and suspended agents pin to the top: they need attention, not alphabetical order.
        const pin = (x: typeof a) => (x.state === 'suspended' ? 0 : x.state === 'probation' ? 1 : x.driftAlarm ? 2 : 3)
        if (pin(a) !== pin(b)) return pin(a) - pin(b)
        if (sort === 'name') return a.name.localeCompare(b.name)
        if (sort === 'success') return b.evaluation.liveSuccess90d - a.evaluation.liveSuccess90d
        if (sort === 'cost') return b.economics.costUsd30d - a.economics.costUsd30d
        return b.economics.humanMinsDisplaced30d - a.economics.humanMinsDisplaced30d
      })
  }, [agents, q, origin, sort])

  const all = Object.values(agents)
  const totalCost = all.reduce((s, a) => s + a.economics.costUsd30d, 0)
  const totalDisplaced = all.reduce((s, a) => s + a.economics.humanMinsDisplaced30d, 0)
  const displacedUsd = (totalDisplaced / 60) * 78
  const attention = all.filter((a) => a.state !== 'active' || a.driftAlarm)

  return (
    <>
      <PageHeader
        title="Fleet View"
        subtitle="All agents under this service, Artizent and client-owned"
        actions={
          <>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={cn(selectClass, 'w-[150px]')}>
              <option value="displaced">Sort by impact</option>
              <option value="success">Sort by live success</option>
              <option value="cost">Sort by cost</option>
              <option value="name">Sort by name</option>
            </select>
            <select value={origin} onChange={(e) => setOrigin(e.target.value as typeof origin)} className={cn(selectClass, 'w-[140px]')}>
              <option value="all">All agents</option>
              <option value="artizent">Artizent</option>
              <option value="client">Client-owned</option>
            </select>
          </>
        }
      />

      <ProducedBy
        agents={["agt_herald"]}
        what="compiling each agent's employment record"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Agents in fleet" value={all.length} hint={`${all.filter((a) => a.origin === 'client').length} client-owned`} />
        <Metric size="sm" label="Needing attention" value={attention.length} deltaTone={attention.length ? 'warn' : 'ok'} hint="suspended, on probation, or drifting" />
        <Metric size="sm" label="Model spend, 30d" value={usd(totalCost)} />
        <Metric size="sm" label="Human cost displaced, 30d" value={usd(displacedUsd)} hint={`${num(Math.round(totalDisplaced / 60))} hours`} />
        <Metric
          size="sm"
          label="Spend vs. displaced"
          value={pct((totalCost / displacedUsd) * 100, 1)}
          deltaTone={(totalCost / displacedUsd) * 100 <= 6 ? 'ok' : 'warn'}
          hint="target ≤ 4–6%"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <Search size={13} className="shrink-0 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, mission or owner…" className={cn(inputClass, 'flex-1')} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <thead>
            <tr>
              <Th>Agent</Th>
              <Th>Owner</Th>
              <Th>Ceiling</Th>
              <Th>Grants</Th>
              <Th align="right">Eval score</Th>
              <Th align="right">Live success 90d</Th>
              <Th>Trend</Th>
              <Th align="right">Cost 30d</Th>
              <Th align="right">Displaced</Th>
              <Th>State</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <Tr key={a.id} onClick={() => nav(`/atlas/agent/${a.id}`)} className={a.state === 'suspended' ? 'bg-crit/[0.06]' : a.state === 'probation' ? 'bg-warn/[0.05]' : undefined}>
                <Td>
                  <span className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', a.origin === 'client' ? 'bg-info' : 'bg-agent')} />
                    <span className="text-ink">{a.name}</span>
                    {a.origin === 'client' && <Chip tone="info">client</Chip>}
                    {a.driftAlarm && <Chip tone="warn"><AlertTriangle size={9} />drift</Chip>}
                  </span>
                  <span className="mt-0.5 block max-w-[280px] truncate text-[10px] text-ink-3">{a.codename}</span>
                </Td>
                <Td className="max-w-[150px] truncate text-2xs">{a.ownerHuman}</Td>
                <Td><AutonomyChip mode={a.ceiling} /></Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {Object.entries(a.grants).slice(0, 4).map(([ac, g]) => <GradeChip key={ac} grade={g} ac={ac} />)}
                    {Object.keys(a.grants).length > 4 && <span className="text-2xs text-ink-3">+{Object.keys(a.grants).length - 4}</span>}
                  </span>
                </Td>
                <Td align="right" className={a.evaluation.score >= 0.9 ? 'text-ok' : a.evaluation.score >= 0.8 ? 'text-warn' : 'text-crit'}>
                  {a.evaluation.score.toFixed(3)}
                </Td>
                <Td align="right" className={a.evaluation.liveSuccess90d >= 0.97 ? 'text-ok' : a.evaluation.liveSuccess90d > 0 ? 'text-warn' : 'text-ink-3'}>
                  {a.evaluation.liveSuccess90d ? pct(a.evaluation.liveSuccess90d * 100) : '—'}
                </Td>
                <Td><Sparkline data={a.trend.filter((x) => x > 0)} tone={a.driftAlarm ? 'warn' : 'ok'} width={52} height={15} showLast /></Td>
                <Td align="right">{usd(a.economics.costUsd30d)}</Td>
                <Td align="right">{num(Math.round(a.economics.humanMinsDisplaced30d / 60))} h</Td>
                <Td>
                  <Chip tone={a.state === 'active' ? 'ok' : a.state === 'probation' ? 'warn' : a.state === 'suspended' ? 'crit' : 'info'}>{a.state}</Chip>
                </Td>
                <Td>
                  {role.canApprove && (
                    a.state === 'suspended' ? (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); reinstate(a.id, role.person) }}>
                        <Play size={11} /> Reinstate
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); suspend(a.id, role.person, 'manual suspension from fleet view') }}>
                        <Pause size={11} /> Suspend
                      </Button>
                    )
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="shrink-0 border-t border-line bg-surface p-4">
      </div>
    </>
  )
}
