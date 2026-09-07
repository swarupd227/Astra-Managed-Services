import React from 'react'
import { Bell, Check, FlaskConical, GitCommit, RotateCcw } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { NOW } from '@/domain/workSeed'
import { changeLog, type ChangeKind, type RegistrySystemLike } from '@/domain/changeLog'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr, selectClass } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   Change Log — every version-linked change to what the AI does, assembled
   from the records the platform already keeps, plus the model-change notices
   the currency check opens when a vendor serves something other than what
   the registry approved.
   ========================================================================== */

const KIND_TONE: Record<ChangeKind, 'brand' | 'info' | 'neutral' | 'warn' | 'ok' | 'crit'> = {
  registry: 'brand', policy: 'info', skill: 'neutral', routing: 'ok', regression: 'warn', model_change: 'crit',
}
const KINDS: ChangeKind[] = ['registry', 'policy', 'skill', 'routing', 'regression', 'model_change']

type RegistrySystem = RegistrySystemLike & { status: string }

export function ChangeLog() {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const modelChanges = useAstra((s) => s.modelChanges)
  const notify = useAstra((s) => s.notifyModelChange)
  const accept = useAstra((s) => s.acceptModelChange)
  const simulate = useAstra((s) => s.simulateModelChange)
  const clockOffset = useAstra((s) => s.clockOffsetMins)
  const now = new Date(NOW.getTime() + clockOffset * 60000)

  const [systems, setSystems] = React.useState<RegistrySystem[]>([])
  const [filter, setFilter] = React.useState<ChangeKind | 'all'>('all')
  const [simTarget, setSimTarget] = React.useState('')

  const load = React.useCallback(() => {
    fetch('/api/agent/registry').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { setSystems(j.systems); if (!simTarget && j.systems[0]) setSimTarget(j.systems.find((s: RegistrySystem) => s.status === 'approved')?.id ?? j.systems[0].id) } }).catch(() => {})
  }, [simTarget])
  React.useEffect(() => { load() }, [load])

  const entries = React.useMemo(() => changeLog({ registrySystems: systems, modelChanges }), [systems, modelChanges])
  const shown = filter === 'all' ? entries : entries.filter((e) => e.kind === filter)
  const open = modelChanges.filter((m) => m.state !== 'accepted')
  const overdue = open.filter((m) => m.state === 'detected' && new Date(m.noticeDueAt) < now)

  return (
    <>
      <PageHeader
        title="Change Log"
        subtitle="Registry, policy, skill, routing and regression changes — and vendor model changes with their notice clocks"
        actions={<Button size="sm" variant="ghost" onClick={load}><RotateCcw size={12} /> Refresh</Button>}
      />
      <ProducedBy agents={['agt_herald']} what="assembling the log from stored records — nothing here is written by hand" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Entries" value={entries.length} hint="across six sources" />
        <Metric size="sm" label="Registry revisions" value={entries.filter((e) => e.kind === 'registry').length} hint="status changes with history" />
        <Metric size="sm" label="Open model changes" value={open.length} deltaTone={open.length ? 'warn' : 'ok'} hint="served ≠ registered, not yet accepted" />
        <Metric size="sm" label="Notice overdue" value={overdue.length} deltaTone={overdue.length ? 'crit' : 'ok'} hint="agreed notice period elapsed" />
        <Metric size="sm" label="Policies at version" value={entries.filter((e) => e.kind === 'policy').length} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card
          title="Model changes"
          subtitle="A served model that differs from the registered one — routing capped at Advise until accepted"
          right={<GitCommit size={13} className="text-ink-3" />}
        >
          {modelChanges.length === 0 ? (
            <p className="text-2xs text-ink-3">None detected. The currency check runs on every completed call.</p>
          ) : (
            <Table>
              <thead>
                <tr><Th>Change</Th><Th>System</Th><Th>Registered</Th><Th>Served</Th><Th>Detected</Th><Th>Notice by</Th><Th>State</Th><Th></Th></tr>
              </thead>
              <tbody>
                {modelChanges.map((m) => {
                  const late = m.state === 'detected' && new Date(m.noticeDueAt) < now
                  return (
                    <Tr key={m.id} className={m.state === 'detected' ? 'bg-warn/[0.05]' : undefined}>
                      <Td className="font-mono text-2xs">{m.id}</Td>
                      <Td className="font-mono text-2xs">{m.systemId}</Td>
                      <Td className="text-2xs">{m.registered}</Td>
                      <Td className="text-2xs text-ink">{m.served}</Td>
                      <Td className="text-2xs text-ink-2">{m.detectedAt.slice(0, 16).replace('T', ' ')}</Td>
                      <Td className={cn('text-2xs', late ? 'text-crit' : 'text-ink-2')}>{m.noticeDueAt.slice(0, 10)}{late ? ' · overdue' : ''}</Td>
                      <Td><Chip tone={m.state === 'accepted' ? 'ok' : m.state === 'notified' ? 'info' : 'warn'}>{m.state}</Chip></Td>
                      <Td>
                        {role.canApprove && (
                          <span className="flex gap-1">
                            {m.state === 'detected' && <Button size="sm" variant="ghost" onClick={() => notify(m.id, role.person)}><Bell size={11} /> Notify</Button>}
                            {m.state !== 'accepted' && <Button size="sm" variant="ghost" onClick={() => accept(m.id, role.person)}><Check size={11} /> Accept</Button>}
                          </span>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={simTarget} onChange={(e) => setSimTarget(e.target.value)} className={cn(selectClass, 'w-[220px]')}>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.model}</option>)}
            </select>
            <Button size="sm" variant="ghost" disabled={!role.canApprove || !simTarget} title="Demonstration control: records a served model that differs from the registered one" onClick={() => simulate(simTarget)}>
              <FlaskConical size={11} /> Simulate a vendor model change
            </Button>
          </div>
        </Card>

        <Card className="mt-4" title="Change log" subtitle="Newest first">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button onClick={() => setFilter('all')} className={cn('rounded border px-2 py-0.5 text-2xs', filter === 'all' ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line text-ink-2')}>all</button>
            {KINDS.map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={cn('rounded border px-2 py-0.5 font-mono text-2xs', filter === k ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line text-ink-2')}>{k}</button>
            ))}
          </div>
          <Table>
            <thead>
              <tr><Th>When</Th><Th>Kind</Th><Th>Subject</Th><Th>Version</Th><Th>By</Th><Th>Change</Th></tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <Tr key={e.id}>
                  <Td className="text-2xs text-ink-2">{e.at.slice(0, 10)}</Td>
                  <Td><Chip tone={KIND_TONE[e.kind]} mono>{e.kind}</Chip></Td>
                  <Td className="text-2xs text-ink">{e.subject}</Td>
                  <Td className="font-mono text-2xs text-ink-2">{e.version ?? '—'}</Td>
                  <Td className="text-2xs text-ink-2">{e.by ?? '—'}</Td>
                  <Td className="max-w-[420px] text-2xs leading-snug text-ink-2">{e.summary}{e.ref && <span className="block font-mono text-[10px] text-ink-3">{e.ref}</span>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
