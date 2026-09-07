import React from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCopy, FileText, Users } from 'lucide-react'
import { useAstra, useWorkList } from '@/domain/store'
import { TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { ROLE_BY_ID } from '@/domain/reference'
import { HISTORY } from '@/domain/metrics'
import { PageHeader, PriorityChip, SlaClock, StateChip, Assignee } from '@/ui/domain'
import { Button, Card, Chip, Drawer, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { StackedBars, CHART_COLORS } from '@/ui/charts'
import { cn, ago, mins, num, pct } from '@/lib/format'

export function ShiftBoard() {
  const work = useWorkList()
  const roleId = useAstra((s) => s.roleId)
  const pushToast = useAstra((s) => s.pushToast)
  const role = ROLE_BY_ID[roleId]
  const [handoverOpen, setHandoverOpen] = React.useState(false)

  const open = work.filter((w) => !['resolved', 'learned'].includes(w.state))
  const byTower = TOWERS.filter((t) => !['S0', 'S1'].includes(t.state)).map((t) => {
    const items = open.filter((w) => w.tower === t.id)
    return {
      tower: t,
      open: items.length,
      jeopardy: items.filter((w) => w.breachProbability > 0.6).length,
      agent: items.filter((w) => w.assigneeKind === 'agent').length,
      human: items.filter((w) => w.assigneeKind === 'human').length,
      gated: items.filter((w) => w.state === 'gated').length,
      aging: items.filter((w) => w.slaElapsedMins > w.slaTargetMins * 0.85).length,
    }
  })

  const aging = open
    .filter((w) => w.slaElapsedMins / w.slaTargetMins > 0.8)
    .sort((a, b) => b.slaElapsedMins / b.slaTargetMins - a.slaElapsedMins / a.slaTargetMins)
    .slice(0, 12)

  const totalAgent = open.filter((w) => w.assigneeKind === 'agent').length
  const totalHuman = open.filter((w) => w.assigneeKind === 'human').length

  const hours = ['06', '07', '08', '09', '10', '11', '12', '13']
  const loadStacks = [
    { key: 'agent', label: 'Agent-executed', color: CHART_COLORS.agent, values: [...HISTORY.shiftAgentExecuted] },
    { key: 'assisted', label: 'Human, agent-assisted', color: CHART_COLORS.brand, values: [...HISTORY.shiftAgentAssisted] },
    { key: 'human', label: 'Human only', color: CHART_COLORS.ink3, values: [...HISTORY.shiftHumanOnly] },
  ]

  const handover = React.useMemo(
    () => ({
      shift: 'Early (06:00–14:00 CT) → Late (14:00–22:00 CT)',
      lead: role.person,
      openRisks: aging.slice(0, 4),
      gated: open.filter((w) => w.state === 'gated').slice(0, 5),
      exceptions: [
        'Data Platform credit allocation remains frozen — XLA trust score 68.2 against a target of 75 (§12.5).',
        'Bursar carries a drift alarm; sampled review doubled until the next evaluation suite completes.',
        'Kearney IEM Time-Entry Bot is on probation after air_0019. Its AC-58 proposals remain four-eyes gated.',
      ],
      watch: [
        'Quarter-end volume ramp begins Thursday — Sentinel thresholds are calendar-aware from 2027-02-20.',
        'ta_031 (decommission legacy report estate) starts executing this week; expect BI queue noise.',
      ],
    }),
    [aging, open, role.person],
  )

  const handoverText = [
    `SHIFT HANDOVER — ${handover.shift}`,
    `Outgoing lead: ${handover.lead}`,
    '',
    `OPEN: ${open.length} work objects · ${totalAgent} agent-held · ${totalHuman} human-held`,
    `IN JEOPARDY: ${open.filter((w) => w.breachProbability > 0.6).length}`,
    '',
    'GATED RUNS AWAITING DECISION:',
    ...handover.gated.map((w) => `  - ${w.ref} ${w.title} (${w.priority}, ${mins(w.slaTargetMins - w.slaElapsedMins)} remaining)`),
    '',
    'AGEING OUTLIERS:',
    ...handover.openRisks.map((w) => `  - ${w.ref} ${w.title} — ${pct((w.slaElapsedMins / w.slaTargetMins) * 100, 0)} of target elapsed`),
    '',
    'EXCEPTIONS SINCE LAST SHIFT:',
    ...handover.exceptions.map((e) => `  - ${e}`),
    '',
    'WATCH ITEMS:',
    ...handover.watch.map((e) => `  - ${e}`),
  ].join('\n')

  return (
    <>
      <PageHeader
        title="Shift Board & Handover"
        subtitle="Early shift · 06:00–14:00 CT"
        actions={
          <Button size="sm" variant="primary" onClick={() => setHandoverOpen(true)}>
            <FileText size={12} /> Generate handover
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Load split across the shift" subtitle="Closed per hour by executor" className="lg:col-span-2">
            <StackedBars labels={hours} stacks={loadStacks} height={190} />
            <div className="mt-2 flex flex-wrap gap-3 text-2xs text-ink-3">
              {loadStacks.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </Card>

          <Card title="Right now" subtitle="Across every tower in Run">
            <div className="grid grid-cols-2 gap-3">
              <Metric size="sm" label="Open" value={open.length} />
              <Metric size="sm" label="Gated" value={open.filter((w) => w.state === 'gated').length} deltaTone="warn" />
              <Metric size="sm" label="Agent-held" value={pct((totalAgent / Math.max(1, open.length)) * 100, 0)} />
              <Metric size="sm" label="In jeopardy" value={open.filter((w) => w.breachProbability > 0.6).length} deltaTone="crit" />
            </div>
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <div className="flex items-center gap-1.5 text-2xs text-ink-3"><Users size={11} /> On shift</div>
              {['A. Fernandes · L3 apps', 'K. Mehta · client co-delivery', 'P. Raghavan · SME verifier', 'M. Okonkwo · shift lead'].map((p) => (
                <div key={p} className="flex items-center justify-between gap-2 text-2xs">
                  <span className="truncate text-ink-2">{p}</span>
                  <Chip tone="ok">available</Chip>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mt-4" title="Queue health by tower" subtitle="By tower">
          <Table>
            <thead>
              <tr>
                <Th>Tower</Th>
                <Th>State</Th>
                <Th align="right">Open</Th>
                <Th align="right">Gated</Th>
                <Th align="right">Ageing</Th>
                <Th align="right">Jeopardy</Th>
                <Th>Agent / human split</Th>
                <Th>Next action</Th>
              </tr>
            </thead>
            <tbody>
              {byTower.map((r) => (
                <Tr key={r.tower.id}>
                  <Td className="text-ink">{r.tower.name}</Td>
                  <Td><Chip tone={r.tower.state === 'S4' ? 'ok' : 'warn'}>{r.tower.state}</Chip></Td>
                  <Td align="right">{r.open}</Td>
                  <Td align="right" className={r.gated ? 'text-warn' : ''}>{r.gated}</Td>
                  <Td align="right" className={r.aging ? 'text-warn' : ''}>{r.aging}</Td>
                  <Td align="right" className={r.jeopardy ? 'text-crit' : ''}>{r.jeopardy}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <span className="flex h-[6px] w-24 overflow-hidden rounded-full bg-sunken">
                        <span className="h-full bg-agent" style={{ width: `${(r.agent / Math.max(1, r.agent + r.human)) * 100}%` }} />
                        <span className="h-full bg-ink-3" style={{ width: `${(r.human / Math.max(1, r.agent + r.human)) * 100}%` }} />
                      </span>
                      <span className="tnum text-2xs text-ink-3">{pct((r.agent / Math.max(1, r.agent + r.human)) * 100, 0)}</span>
                    </span>
                  </Td>
                  <Td>
                    {r.gated ? (
                      <Link to="/operate/approvals" className="text-brand-ink hover:underline">Clear {r.gated} gate{r.gated > 1 ? 's' : ''}</Link>
                    ) : r.jeopardy ? (
                      <Link to={`/operate/board?tower=${r.tower.id}`} className="text-warn hover:underline">Rebalance jeopardy</Link>
                    ) : (
                      <span className="text-ink-3">Healthy — no action</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card className="mt-4" title="Ageing outliers" subtitle="Past 80% of target">
          <Table>
            <thead>
              <tr>
                <Th>Ref</Th>
                <Th>Work object</Th>
                <Th>Pri</Th>
                <Th>State</Th>
                <Th>Holder</Th>
                <Th align="right">Elapsed</Th>
                <Th>Clock</Th>
              </tr>
            </thead>
            <tbody>
              {aging.map((w) => (
                <Tr key={w.id}>
                  <Td className="font-mono text-ink-2">{w.ref}</Td>
                  <Td className="max-w-[340px] truncate text-ink">
                    <Link to={`/operate/work/${w.id}`} className="hover:text-brand-ink hover:underline">{w.title}</Link>
                  </Td>
                  <Td><PriorityChip p={w.priority} /></Td>
                  <Td><StateChip state={w.state} /></Td>
                  <Td><Assignee id={w.assignee} kind={w.assigneeKind} /></Td>
                  <Td align="right" className={w.slaElapsedMins > w.slaTargetMins ? 'text-crit' : 'text-warn'}>
                    {pct((w.slaElapsedMins / w.slaTargetMins) * 100, 0)}
                  </Td>
                  <Td className="w-[90px]"><SlaClock elapsed={w.slaElapsedMins} target={w.slaTargetMins} paused={w.slaPaused} compactMode /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <Drawer
        open={handoverOpen}
        onClose={() => setHandoverOpen(false)}
        title="Shift handover pack"
        subtitle={handover.shift}
        width="max-w-[620px]"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => {
                navigator.clipboard?.writeText(handoverText)
                pushToast({ title: 'Handover copied', body: 'Also posted to the shift channel and attached to the tower board state.', tone: 'ok' })
              }}
            >
              <ClipboardCopy size={12} /> Copy pack
            </Button>
            <span className="text-2xs text-ink-3">Generated from board state — nothing typed, nothing forgotten.</span>
          </div>
        }
      >
        <div className="space-y-4 p-4">
          <section>
            <h3 className="label-cap">Position at handover</h3>
            <div className="mt-2 grid grid-cols-4 gap-3">
              <Metric size="sm" label="Open" value={open.length} />
              <Metric size="sm" label="Agent-held" value={totalAgent} />
              <Metric size="sm" label="Gated" value={handover.gated.length} />
              <Metric size="sm" label="Jeopardy" value={open.filter((w) => w.breachProbability > 0.6).length} />
            </div>
          </section>

          <section>
            <h3 className="label-cap">Gated runs awaiting decision</h3>
            <ul className="mt-2 space-y-1.5">
              {handover.gated.map((w) => (
                <li key={w.id} className="flex items-center gap-2 rounded border border-line bg-sunken px-2 py-1.5 text-2xs">
                  <PriorityChip p={w.priority} />
                  <span className="font-mono text-ink-3">{w.ref}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-2">{w.title}</span>
                  <span className="tnum shrink-0 text-warn">{mins(w.slaTargetMins - w.slaElapsedMins)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="label-cap">Exceptions since last shift</h3>
            <ul className="mt-2 space-y-1.5 text-2xs leading-relaxed text-ink-2">
              {handover.exceptions.map((e) => <li key={e} className="flex gap-2"><span className="text-warn">·</span>{e}</li>)}
            </ul>
          </section>

          <section>
            <h3 className="label-cap">Watch items</h3>
            <ul className="mt-2 space-y-1.5 text-2xs leading-relaxed text-ink-2">
              {handover.watch.map((e) => <li key={e} className="flex gap-2"><span className="text-info">·</span>{e}</li>)}
            </ul>
          </section>

          <pre className="overflow-x-auto rounded border border-line bg-sunken p-3 font-mono text-[10px] leading-relaxed text-ink-3">
{handoverText}
          </pre>
        </div>
      </Drawer>
    </>
  )
}
