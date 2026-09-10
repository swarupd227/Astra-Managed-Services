import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookCheck } from 'lucide-react'
import { useAstra } from '@/domain/store'
import { ROLE_BY_ID } from '@/domain/reference'
import { CLIENT } from '@/domain/estate'
import { NOW } from '@/domain/workSeed'
import { STATE_LABEL, buildPack, type ControlState, type PackContext, type RmfFunction } from '@/domain/evidencePack'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Button, Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn } from '@/lib/format'

/* ==========================================================================
   The AI governance pack — the mapping a certification body reads, with a
   live figure on every row and an honest state where a control exists but
   has not been exercised. It is assembled from stored records at view time,
   so it cannot drift from the system it describes.
   ========================================================================== */

const FUNCTIONS: { id: RmfFunction; blurb: string }[] = [
  { id: 'GOVERN', blurb: 'Authority and accountability' },
  { id: 'MAP', blurb: 'Scope and knowledge provenance' },
  { id: 'MEASURE', blurb: 'Control testing' },
  { id: 'MANAGE', blurb: 'Incident response' },
]

const STATE_TONE: Record<ControlState, 'ok' | 'warn' | 'neutral' | 'crit'> = {
  evidenced: 'ok', partial: 'warn', not_exercised: 'neutral', gap: 'crit',
}

export function AiGovernancePack() {
  const roleId = useAstra((s) => s.roleId)
  const role = ROLE_BY_ID[roleId]
  const pushToast = useAstra((s) => s.pushToast)
  const clockOffset = useAstra((s) => s.clockOffsetMins)

  const evidence = useAstra((s) => s.evidence)
  const assertions = useAstra((s) => s.assertions)
  const verification = useAstra((s) => s.verification)
  const suspensions = useAstra((s) => s.suspensions)
  const aiIncidents = useAstra((s) => s.aiIncidents)
  const modelChanges = useAstra((s) => s.modelChanges)
  const attestations = useAstra((s) => s.attestations)
  const deletions = useAstra((s) => s.deletions)
  const redTeam = useAstra((s) => s.redTeam)
  const bias = useAstra((s) => s.bias)
  const drift = useAstra((s) => s.drift)
  const conformance = useAstra((s) => s.conformance)

  const [registry, setRegistry] = React.useState<PackContext['registry']>(null)
  React.useEffect(() => {
    fetch('/api/agent/registry').then((r) => (r.ok ? r.json() : null)).then((j) => setRegistry(j)).catch(() => setRegistry(null))
  }, [])

  const pack = React.useMemo(
    () => buildPack({
      evidence, assertions, verification, suspensions, aiIncidents, modelChanges,
      attestations, deletions, redTeam, bias, drift, conformance, registry,
      now: new Date(NOW.getTime() + clockOffset * 60000),
    }),
    [evidence, assertions, verification, suspensions, aiIncidents, modelChanges, attestations, deletions, redTeam, bias, drift, conformance, registry, clockOffset],
  )

  const count = (s: ControlState) => pack.filter((c) => c.state === s).length
  const gaps = pack.filter((c) => c.state === 'gap')
  const unexercised = pack.filter((c) => c.state === 'not_exercised')

  return (
    <>
      <PageHeader
        title="AI Governance Pack"
        subtitle={`NIST AI RMF · ISO/IEC 42001 · ${CLIENT.name}`}
        actions={
          <Button
            size="sm" variant="default"
            onClick={() => pushToast({
              title: 'Governance pack exported',
              body: `${pack.length} controls with their live figures and the evidence ids behind them, as at ${new Date(NOW.getTime() + clockOffset * 60000).toISOString().slice(0, 10)}.`,
              tone: 'ok',
            })}
          >
            <ArrowUpRight size={12} /> Export pack
          </Button>
        }
      />

      <ProducedBy agents={['agt_herald']} what="assembling the pack from stored records" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Controls mapped" value={pack.length} />
        <Metric size="sm" label="Evidenced" value={count('evidenced')} deltaTone="ok" />
        <Metric size="sm" label="Not exercised" value={count('not_exercised')} deltaTone={unexercised.length ? 'warn' : 'ok'} hint="not run this period" />
        <Metric size="sm" label="Gaps" value={count('gap')} deltaTone={gaps.length ? 'crit' : 'ok'} hint="failed or not configured" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">

        {FUNCTIONS.map((f) => {
          const rows = pack.filter((c) => c.fn === f.id)
          return (
            <Card key={f.id} className="mb-4" title={f.id} subtitle={f.blurb} right={<Chip mono>{rows.length}</Chip>}>
              <Table>
                <thead>
                  <tr><Th>Control</Th><Th>ISO/IEC 42001</Th><Th>Evidence</Th><Th>Figure</Th><Th>State</Th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <Tr key={c.id} className={c.state === 'gap' ? 'bg-crit/[0.05]' : c.state === 'not_exercised' ? 'bg-warn/[0.04]' : undefined}>
                      <Td className="max-w-[340px] text-2xs leading-snug text-ink">{c.control}</Td>
                      <Td className="text-2xs text-ink-3">{c.iso}</Td>
                      <Td className="max-w-[280px] text-2xs leading-snug text-ink-2">{c.evidence}</Td>
                      <Td className="text-2xs text-ink-2">{c.figure}</Td>
                      <Td>
                        {c.href ? (
                          <Link to={c.href}><Chip tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Chip></Link>
                        ) : (
                          <Chip tone={STATE_TONE[c.state]}>{STATE_LABEL[c.state]}</Chip>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )
        })}

      </div>
    </>
  )
}
