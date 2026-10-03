import React from 'react'
import { Hand, KeySquare, ShieldOff } from 'lucide-react'
import {
  DIRECTIVE_LABEL, SCOPE_LABEL, describeDirective, modeLabel, readControl,
  type AgentControl, type Directive, type FleetControl, type Right,
} from '@/domain/clientControl'
import { MODE_TO_LEVEL, ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   What the client controls.

   The rights the client holds over the workforce, what each one does not
   change, and the state those rights have left every agent in: what we
   granted, what the client has capped or stopped, and what the agent may
   therefore actually do.

   The supplier's own roles can read this screen and cannot act on it. The
   right is exercised by a typed sentence from a client role, and the gateway
   refuses the call from anyone else.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const day = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function useControl(): FleetControl {
  const directives = useAstra((s) => s.clientDirectives)
  return React.useMemo(() => readControl(directives), [directives])
}

function ControlMetrics({ size }: CardProps) {
  const c = useControl()
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Rights held" value={c.rights.length} hint="exercisable without us" />
      <Metric size="sm" label="Notice we may require" value="None" hint="effective on the spot" />
      <Metric size="sm" label="Agents as granted" value={`${c.untouched}/${c.agents.length}`} />
      <Metric size="sm" label="Capped by the client" value={c.capped} deltaTone={c.capped ? 'warn' : 'ok'} />
      <Metric size="sm" label="Stopped by the client" value={c.stopped} deltaTone={c.stopped ? 'crit' : 'ok'} />
      <Metric
        size="sm" label="Last exercised"
        value={c.lastExercised ? day(c.lastExercised).split(',')[0] : 'Never'}
        hint={c.exercisedBy.length ? c.exercisedBy.join(', ') : 'the right has not been used'}
      />
    </Band>
  )
}

function RightsTable({ rows }: { rows: Right[] }) {
  return (
    <Table>
      <thead>
        <tr><Th>The client may</Th><Th>Held by</Th><Th>What happens</Th><Th>Notice</Th><Th>Lifted by</Th><Th>Does not change</Th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="max-w-[210px] text-2xs text-ink">{r.name}</Td>
            <Td>
              <div className="flex max-w-[170px] flex-wrap gap-1">
                {r.heldBy.map((id) => <Chip key={id} tone="brand">{ROLE_BY_ID[id]?.title ?? id}</Chip>)}
              </div>
            </Td>
            <Td className="max-w-[280px] text-2xs leading-snug text-ink-2">{r.effect}</Td>
            <Td><Chip tone={r.noticeHrs === 0 ? 'ok' : 'warn'}>{r.noticeHrs === 0 ? 'None' : `${r.noticeHrs} h`}</Chip></Td>
            <Td><Chip tone="brand">The client</Chip></Td>
            <Td className="max-w-[280px] text-2xs leading-snug text-ink-3">{r.doesNotChange}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function AgentsTable({ rows, full }: { rows: AgentControl[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr><Th>Agent</Th><Th>We granted</Th><Th>The client set</Th><Th>It may actually</Th>{full && <Th>Why</Th>}</tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const held = a.stopped || Boolean(a.clientCap)
          const tone: Tone = a.stopped ? 'crit' : a.clientCap ? 'warn' : 'ok'
          return (
            <Tr key={a.agent.id} className={held ? undefined : 'opacity-80'}>
              <Td className="max-w-[170px] text-2xs text-ink">
                {a.agent.name}
                <span className="block text-[10px] text-ink-3">{a.agent.towers.length} tower{a.agent.towers.length === 1 ? '' : 's'}</span>
              </Td>
              <Td className="text-2xs text-ink-2">{modeLabel(a.granted)}</Td>
              <Td>
                {a.stopped
                  ? <Chip tone="crit">Stopped</Chip>
                  : a.clientCap ? <Chip tone="warn">{modeLabel(a.clientCap)}</Chip> : <span className="text-2xs text-ink-3">—</span>}
              </Td>
              <Td>
                <Chip tone={tone} className="whitespace-nowrap">
                  {a.stopped ? 'Nothing' : modeLabel(a.effective)}
                </Chip>
                {!a.stopped && a.clientCap && MODE_TO_LEVEL[a.effective] < MODE_TO_LEVEL[a.granted] && (
                  <span className="ml-1 text-[10px] text-ink-3">below its grant</span>
                )}
              </Td>
              {full && (
                <Td className="max-w-[260px] text-2xs leading-snug text-ink-3">
                  {a.directives.length ? a.directives.map((d) => d.reason).join(' · ') : '—'}
                </Td>
              )}
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function DirectivesTable({ rows }: { rows: Directive[] }) {
  return (
    <Table>
      <thead>
        <tr><Th>Directive</Th><Th>Scope</Th><Th>Set by</Th><Th>Reason</Th><Th>At</Th><Th>Sealed</Th></tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <Tr key={d.id}>
            <Td className="max-w-[230px] text-2xs text-ink">
              {describeDirective(d)}
              <span className="block text-[10px] text-ink-3">{DIRECTIVE_LABEL[d.kind]}</span>
            </Td>
            <Td className="text-2xs text-ink-2">{SCOPE_LABEL[d.scope]}</Td>
            <Td className="max-w-[160px] text-2xs text-ink-2">
              {d.by}
              <span className="block text-[10px] text-ink-3">{ROLE_BY_ID[d.role]?.title ?? d.role}</span>
            </Td>
            <Td className="max-w-[240px] text-2xs leading-snug text-ink-2">{d.reason}</Td>
            <Td className="tnum whitespace-nowrap text-2xs text-ink-3">{day(d.at)}</Td>
            <Td>{d.evidenceId ? <Chip tone="ok">{d.evidenceId}</Chip> : <span className="text-2xs text-ink-3">—</span>}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function ControlBody({ props, size }: CardProps) {
  const c = useControl()
  const focus = String(props.focus ?? '')

  if (size !== 'page') {
    if (focus === 'rights') return <RightsTable rows={c.rights} />
    const rows = focus === 'held' ? c.agents.filter((a) => a.stopped || a.clientCap) : c.agents
    const shown = limit(rows, size, 6)
    return <><AgentsTable rows={shown} full={size === 'pane'} /><More shown={shown.length} total={rows.length} /></>
  }

  return (
    <>
      <Card
        title="The client’s rights over the workforce"
        subtitle={`${c.rights.length} rights · no notice to the supplier · lifted only by the client`}
        right={<KeySquare size={13} className="text-ink-3" />}
      >
        <RightsTable rows={c.rights} />
      </Card>

      <Card
        className="mt-4"
        title="What each agent may actually do"
        subtitle={`${c.untouched} as granted · ${c.capped} capped · ${c.stopped} stopped`}
        right={<ShieldOff size={13} className="text-ink-3" />}
      >
        <AgentsTable rows={c.agents} full />
      </Card>

      <Card
        className="mt-4"
        title="Directives in force"
        subtitle={c.directives.length ? `${c.directives.length} standing · last exercised ${day(c.lastExercised!)}` : 'None: the right stands unexercised'}
        right={<Hand size={13} className="text-ink-3" />}
      >
        {c.directives.length
          ? <DirectivesTable rows={c.directives} />
          : (
            <Table>
              <thead><tr><Th>Right</Th><Th>State</Th></tr></thead>
              <tbody>
                {c.rights.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-2xs text-ink">{r.name}</Td>
                    <Td><Chip>Never exercised</Chip></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
      </Card>
    </>
  )
}

export const clientControlView: ArtifactView = {
  Body: ControlBody,
  Metrics: ControlMetrics,
  page: {
    title: 'What the client controls',
    subtitle: 'The rights the client holds over the agent workforce, what each agent may therefore do, and every directive in force',
    agents: ['agt_herald', 'agt_warden'],
    what: 'reading the client’s directives over our own grants',
  },
}
