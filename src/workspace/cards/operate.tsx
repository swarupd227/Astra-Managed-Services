import React from 'react'
import { buildBrief } from '@/domain/brief'
import { BUNDLE_BY_ID, TOWERS, TOWER_BY_ID } from '@/domain/estate'
import { SLAS } from '@/domain/ledgers'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { AskRow } from '@/ui/NeedsYou'
import { AutonomyChip, PriorityChip, SlaClock, StateChip } from '@/ui/domain'
import { Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { BeatBlock } from '@/surfaces/copilot/Copilot'
import { cn, dateTime, pct, timeShort } from '@/lib/format'
import { decideRunGate, useRuns } from '../runs'
import type { WorkObject } from '@/domain/types'
import { More, type CardProps } from './frame'

const OPEN = ['detected', 'triaged', 'planned', 'gated', 'executing', 'verifying']
const used = (w: WorkObject) => (w.slaTargetMins ? w.slaElapsedMins / w.slaTargetMins : 0)

export function EstateOverviewCard({ size }: CardProps) {
  const work = useAstra((s) => s.work)
  const rows = React.useMemo(() => TOWERS.map((t) => {
    const open = Object.values(work).filter((w) => w.tower === t.id && OPEN.includes(w.state))
    const slas = SLAS.filter((s) => s.tower === t.id)
    const below = slas.filter((s) => s.attainmentMtd < s.attainmentTarget).length
    return { t, open: open.length, gated: open.filter((w) => w.state === 'gated').length, p1: open.filter((w) => w.priority === 'P1').length, slas: slas.length, below }
  }).sort((a, b) => b.below - a.below || b.gated - a.gated || b.p1 - a.p1), [work])
  const shown = size === 'card' ? rows.slice(0, 6) : rows
  return (
    <>
      <Table>
        <thead><tr><Th>Tower</Th><Th>State</Th><Th align="right">Open</Th><Th align="right">Gated</Th><Th>Service levels</Th><Th align="right">Glidepath</Th></tr></thead>
        <tbody>
          {shown.map(({ t, open, gated, p1, slas, below }) => (
            <Tr key={t.id}>
              <Td className="max-w-[220px] text-2xs text-ink">
                <span className="block truncate">{t.name}</span>
                <span className="block text-[10px] text-ink-3">{BUNDLE_BY_ID[t.bundle]?.name ?? t.bundle}</span>
              </Td>
              <Td><Chip mono>{t.state}</Chip></Td>
              <Td align="right" className="tnum text-2xs text-ink-2">{open}{p1 ? <span className="ml-1 text-crit">·{p1} P1</span> : null}</Td>
              <Td align="right" className={cn('tnum text-2xs', gated ? 'text-warn' : 'text-ink-3')}>{gated || '—'}</Td>
              <Td>{slas ? <Chip tone={below ? 'crit' : 'ok'}>{below ? `${below}/${slas} below` : `${slas}/${slas} on target`}</Chip> : <span className="text-2xs text-ink-3">—</span>}</Td>
              <Td align="right" className={cn('tnum text-2xs', t.glidepathActual <= t.glidepathContracted ? 'text-ok' : 'text-warn')}>
                {t.glidepathContracted ? `${pct(t.glidepathActual)} / ${pct(t.glidepathContracted)}` : '—'}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

export function BriefCard({ props, size }: CardProps) {
  // An account of a moment: read once, so the figures match the words beside them.
  const [brief] = React.useState(() => {
    const s = useAstra.getState()
    return buildBrief({
      work: Object.values(s.work), assertions: s.assertions, proposals: Object.values(s.proposals), role: ROLE_BY_ID[s.roleId],
      since: String(props.since ?? new Date().toISOString()), firstVisit: Boolean(props.firstVisit),
    })
  })
  const yours = brief.asks.filter((a) => a.yours)
  const shown = yours.slice(0, size === 'card' ? 3 : 10)
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Metric size="sm" label="Closed" value={brief.resolved} hint={`${brief.autonomous} unaided`} />
        <Metric size="sm" label="Hours displaced" value={brief.hoursSaved.toFixed(1)} />
        <Metric size="sm" label="Avoided" value={brief.prevented} />
        <Metric size="sm" label="Proposed" value={brief.proposed} />
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5">
        <span className="label-cap">Awaiting you</span>
        <Chip tone={yours.length ? 'warn' : 'ok'}>{yours.length}</Chip>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {shown.map((a) => <AskRow key={`${a.kind}-${a.id}`} ask={a} compact />)}
      </div>
      <More shown={shown.length} total={yours.length} />
    </>
  )
}

function WorkRows({ rows, size }: { rows: WorkObject[]; size: CardProps['size'] }) {
  const shown = size === 'card' ? rows.slice(0, 6) : rows
  return (
    <>
      <Table>
        <thead><tr><Th>Item</Th><Th>Priority</Th><Th>State</Th><Th>SLA</Th></tr></thead>
        <tbody>
          {shown.map((w) => (
            <Tr key={w.id}>
              <Td className="max-w-[260px] text-2xs text-ink">
                <span className="block truncate">{w.title}</span>
                <span className="block font-mono text-[10px] text-ink-3">{w.ref} · {TOWER_BY_ID[w.tower]?.name ?? w.tower}</span>
              </Td>
              <Td><PriorityChip p={w.priority} /></Td>
              <Td><StateChip state={w.state} /></Td>
              <Td className="w-[90px]"><SlaClock elapsed={w.slaElapsedMins} target={w.slaTargetMins} paused={w.slaPaused} compactMode /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

export function WorkQueueCard({ props, size }: CardProps) {
  const work = useAstra((s) => s.work)
  const rows = React.useMemo(() => Object.values(work)
    .filter((w) => OPEN.includes(w.state) && (!props.tower || w.tower === props.tower) && (!props.priority || w.priority === props.priority) && (!props.state || w.state === props.state))
    .sort((a, b) => b.breachProbability - a.breachProbability || used(b) - used(a)), [work, props.tower, props.priority, props.state])
  return <WorkRows rows={rows} size={size} />
}

export function ApprovalsCard({ size }: CardProps) {
  const work = useAstra((s) => s.work)
  const rows = React.useMemo(() => Object.values(work).filter((w) => w.state === 'gated').sort((a, b) => used(b) - used(a)), [work])
  const shown = size === 'card' ? rows.slice(0, 6) : rows
  return (
    <>
      <Table>
        <thead><tr><Th>Item</Th><Th>Action</Th><Th>Gate</Th><Th>SLA</Th></tr></thead>
        <tbody>
          {shown.map((w) => (
            <Tr key={w.id}>
              <Td className="max-w-[240px] text-2xs text-ink">
                <span className="block truncate">{w.title}</span>
                <span className="block font-mono text-[10px] text-ink-3">{w.ref} · {w.id}</span>
              </Td>
              <Td><div className="flex flex-wrap gap-1">{(w.autonomy?.actionClasses ?? []).map((c) => <Chip key={c} mono>{c}</Chip>)}</div></Td>
              <Td className="text-2xs text-ink-2">{w.autonomy?.gates[0]?.role ?? '—'}</Td>
              <Td className="w-[90px]"><SlaClock elapsed={w.slaElapsedMins} target={w.slaTargetMins} paused={w.slaPaused} compactMode /></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

export function WorkItemCard({ props, size }: CardProps) {
  const w = useAstra((s) => s.work[String(props.id)])
  if (!w) return <span className="text-2xs text-ink-3">—</span>
  const timeline = size === 'card' ? w.narrative.slice(-3) : w.narrative.slice(-12)
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityChip p={w.priority} />
        <StateChip state={w.state} />
        {w.autonomy && <AutonomyChip mode={w.autonomy.mode} />}
        {(w.autonomy?.actionClasses ?? []).map((c) => <Chip key={c} mono>{c}</Chip>)}
        <span className="ml-auto w-[110px]"><SlaClock elapsed={w.slaElapsedMins} target={w.slaTargetMins} paused={w.slaPaused} /></span>
      </div>
      <dl className="mt-2.5 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-2xs">
        <dt className="text-ink-3">Service</dt><dd className="text-ink-2">{w.service}</dd>
        <dt className="text-ink-3">Tower</dt><dd className="text-ink-2">{TOWER_BY_ID[w.tower]?.name ?? w.tower}</dd>
        <dt className="text-ink-3">Demand class</dt><dd className="font-mono text-ink-2">{w.demandClass}</dd>
        {w.autonomy?.gates[0] && <><dt className="text-ink-3">Gate</dt><dd className="text-ink-2">{w.autonomy.gates[0].role}</dd></>}
      </dl>
      <ol className="mt-2.5 space-y-1 border-t border-line pt-2">
        {timeline.map((n) => (
          <li key={n.id} className="flex gap-2 text-2xs">
            <span className="tnum shrink-0 text-ink-3" title={dateTime(n.at)}>{timeShort(n.at)}</span>
            <span className="text-ink-2">{n.text}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

export function SlaCard({ props, size }: CardProps) {
  const rows = SLAS.filter((s) => (!props.tower || s.tower === props.tower) && (!props.atRiskOnly || s.attainmentMtd < s.attainmentTarget || s.headroom === 0))
    .sort((a, b) => (a.attainmentMtd - a.attainmentTarget) - (b.attainmentMtd - b.attainmentTarget))
  const shown = size === 'card' ? rows.slice(0, 6) : rows
  return (
    <>
      <Table>
        <thead><tr><Th>Service level</Th><Th align="right">Attainment</Th><Th align="right">Breaches</Th><Th>Status</Th></tr></thead>
        <tbody>
          {shown.map((s) => {
            const below = s.attainmentMtd < s.attainmentTarget
            return (
              <Tr key={s.id}>
                <Td className="max-w-[280px] text-2xs text-ink"><span className="block truncate">{s.name}</span><span className="block text-[10px] uppercase text-ink-3">{s.kind}</span></Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{s.attainmentMtd} / {s.attainmentTarget}</Td>
                <Td align="right" className={cn('tnum text-2xs', s.breachesMtd ? 'text-warn' : 'text-ink-3')}>{s.breachesMtd}</Td>
                <Td><Chip tone={below ? 'crit' : s.headroom === 0 ? 'warn' : 'ok'}>{below ? 'Below target' : s.headroom === 0 ? 'No headroom' : 'On target'}</Chip></Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
      <More shown={shown.length} total={rows.length} />
    </>
  )
}

export function AgentRunCard({ props }: CardProps) {
  const run = useRuns((s) => s.runs[String(props.runId)])
  if (!run) return <span className="text-2xs text-ink-3">Run record not held in this session</span>
  const lastGate = run.beats.map((b) => b.t).lastIndexOf('gate')
  return (
    <div className="space-y-2">
      {run.beats.filter((b) => b.t !== 'think' && b.t !== 'system').map((b, i, list) => (
        <BeatBlock
          key={i}
          beat={b}
          live={i === list.length - 1 && run.running}
          onGate={b.t === 'gate' && run.gate && !run.verdict && run.beats.indexOf(b) === lastGate ? (d) => void decideRunGate(run.id, d) : undefined}
        />
      ))}
      {run.running && !run.beats.length && <Chip tone="neutral">Reaching the agent runtime</Chip>}
    </div>
  )
}
