import React from 'react'
import { Bot, ListChecks } from 'lucide-react'
import { COVERED_BUNDLES, bundleCoverage, type CoverageState } from '@/domain/coverage'
import { BUNDLE_BY_ID, TOWER_BY_ID } from '@/domain/estate'
import { MODE_LABEL } from '@/domain/reference'
import { PageHeader } from '@/ui/domain'
import { Card, Chip, Metric, Table, Td, Th, Tr, selectClass } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   Capability coverage — the functions of a bundle and the agents behind
   each, derived from agent charters rather than asserted. An agent owns a
   function through a primary signal and assists through a useful one; a
   function with only assistants is reported as such.
   ========================================================================== */

const STATE_TONE: Record<CoverageState, 'ok' | 'warn' | 'crit'> = { owned: 'ok', assisted: 'warn', uncovered: 'crit' }
const STATE_LABEL: Record<CoverageState, string> = { owned: 'Owned', assisted: 'Assisted only', uncovered: 'Uncovered' }

export function Coverage() {
  const [bundle, setBundle] = React.useState(COVERED_BUNDLES[0] ?? '')
  const c = React.useMemo(() => bundleCoverage(bundle), [bundle])
  const fnName = (id: string) => c.functions.find((f) => f.fn.id === id)?.fn.name ?? id

  return (
    <>
      <PageHeader
        title="Capability coverage"
        subtitle={`${c.bundleName} · derived from agent charters`}
        actions={
          <select value={bundle} onChange={(e) => setBundle(e.target.value)} className={cn(selectClass, 'w-[260px]')}>
            {COVERED_BUNDLES.map((b) => <option key={b} value={b}>{b} · {BUNDLE_BY_ID[b]?.name ?? b}</option>)}
          </select>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Functions" value={c.functions.length} />
        <Metric size="sm" label="Owned by an agent" value={c.owned} deltaTone="ok" />
        <Metric size="sm" label="Assisted only" value={c.assisted} deltaTone={c.assisted ? 'warn' : 'ok'} />
        <Metric size="sm" label="Uncovered" value={c.uncovered} deltaTone={c.uncovered ? 'crit' : 'ok'} />
        <Metric size="sm" label="Agents serving" value={c.agents.length} hint={`${c.towers.length} tower${c.towers.length === 1 ? '' : 's'}`} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Functions" subtitle={`${c.functions.length} functions`} right={<ListChecks size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr><Th>Function</Th><Th>Coverage</Th><Th>Owned by</Th><Th>Assisted by</Th></tr>
            </thead>
            <tbody>
              {c.functions.map((f) => (
                <Tr key={f.fn.id} className={f.state !== 'owned' ? 'bg-warn/[0.05]' : undefined}>
                  <Td className="text-2xs text-ink">{f.fn.name}</Td>
                  <Td><Chip tone={STATE_TONE[f.state]}>{STATE_LABEL[f.state]}</Chip></Td>
                  <Td>
                    <div className="flex max-w-[320px] flex-wrap gap-1">
                      {f.owners.map((o) => (
                        <Chip key={o.agent.id} tone="agent" title={o.via.join(', ')}>{o.agent.name} · {MODE_LABEL[o.ceiling] ?? o.ceiling}</Chip>
                      ))}
                      {!f.owners.length && <span className="text-2xs text-ink-3">—</span>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex max-w-[280px] flex-wrap gap-1">
                      {f.assists.map((o) => (
                        <Chip key={o.agent.id} title={o.via.join(', ')}>{o.agent.name}</Chip>
                      ))}
                      {!f.assists.length && <span className="text-2xs text-ink-3">—</span>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card className="mt-4" title="Agents serving the bundle" subtitle={`${c.agents.length} agents`} right={<Bot size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr><Th>Agent</Th><Th>Owns</Th><Th>Assists</Th><Th>Ceiling</Th><Th>Deployed on</Th></tr>
            </thead>
            <tbody>
              {c.agents.map(({ agent, owns, assists }) => (
                <Tr key={agent.id}>
                  <Td className="text-2xs text-ink">
                    {agent.name}
                    <span className="block text-[10px] text-ink-3">{agent.codename}</span>
                  </Td>
                  <Td>
                    <div className="flex max-w-[300px] flex-wrap gap-1">
                      {owns.map((id) => <Chip key={id} tone="ok">{fnName(id)}</Chip>)}
                      {!owns.length && <span className="text-2xs text-ink-3">—</span>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {assists.map((id) => <Chip key={id}>{fnName(id)}</Chip>)}
                      {!assists.length && <span className="text-2xs text-ink-3">—</span>}
                    </div>
                  </Td>
                  <Td><Chip tone="agent">{MODE_LABEL[agent.ceiling] ?? agent.ceiling}</Chip></Td>
                  <Td className="text-2xs text-ink-2">
                    {agent.towers.length === 0
                      ? 'Fleet-wide'
                      : agent.towers.filter((t) => c.towers.includes(t)).map((t) => TOWER_BY_ID[t]?.name ?? t).join(', ')}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
