import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BookCheck, TriangleAlert } from 'lucide-react'
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
  { id: 'GOVERN', blurb: 'Who decides, on what authority, and how that authority is bounded' },
  { id: 'MAP', blurb: 'What the system is, what it acts on, and where its knowledge came from' },
  { id: 'MEASURE', blurb: 'How the controls are tested, by whom, and how recently' },
  { id: 'MANAGE', blurb: 'What happens when something goes wrong, and what is done about it' },
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
        subtitle={`NIST AI RMF and ISO/IEC 42001 mapped to the records this platform holds · ${CLIENT.name}`}
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

      <ProducedBy agents={['agt_herald']} what="assembling the pack from stored records at view time — no field is written by hand" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-4">
        <Metric size="sm" label="Controls mapped" value={pack.length} />
        <Metric size="sm" label="Evidenced" value={count('evidenced')} deltaTone="ok" />
        <Metric size="sm" label="Not exercised" value={count('not_exercised')} deltaTone={unexercised.length ? 'warn' : 'ok'} hint="not run this period" />
        <Metric size="sm" label="Gaps" value={count('gap')} deltaTone={gaps.length ? 'crit' : 'ok'} hint="failed or not configured" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {(gaps.length > 0 || unexercised.length > 0) && (
          <div className="mb-4 rounded-md border border-warn/40 bg-warn/[0.06] p-3">
            <div className="flex items-center gap-1.5">
              <TriangleAlert size={12} className="text-warn" />
              <span className="label-cap">Pack scope</span>
            </div>
            <p className="mt-1.5 text-2xs leading-relaxed text-ink-2">
              {gaps.length > 0 && <>{gaps.length} control{gaps.length === 1 ? '' : 's'} {gaps.length === 1 ? 'is' : 'are'} a gap: {gaps.map((g) => g.control.split('.')[0]).join('; ')}. </>}
              {unexercised.length > 0 && <>{unexercised.length} control{unexercised.length === 1 ? '' : 's'} exist{unexercised.length === 1 ? 's' : ''} but {unexercised.length === 1 ? 'has' : 'have'} not been exercised this period — run {unexercised.length === 1 ? 'it' : 'them'} from the <Link to="/governance/assurance" className="text-brand-ink hover:underline">Assurance Sandbox</Link>, or from the linked screen where the control is not read-only, and the figures here will fill in. </>}
              A pack that reported these as satisfied would not be evidence.
            </p>
          </div>
        )}

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

        <Card title="Pack structure" subtitle="What it is, and what it is not" right={<BookCheck size={13} className="text-ink-3" />}>
          <ul className="space-y-1 text-2xs leading-relaxed text-ink-2">
            <li>· Every figure is read from stored records at the moment you open the page. Nothing on this page is authored, so it cannot drift from the system it describes.</li>
            <li>· A control that has not been run this period says so. {role.readOnly ? 'You can run any of them yourself' : 'They can be run'} from the <Link to="/governance/assurance" className="text-brand-ink hover:underline">Assurance Sandbox</Link>, and the state here changes to match.</li>
            <li>· ISO/IEC 42001 clause references map the platform's controls onto the standard's structure. They are a mapping, not a certification: certification is an organisational undertaking, and this pack is the evidence it would rest on.</li>
            <li>· The frameworks named in the AI schedule are NIST AI RMF and ISO/IEC 42001; the four sections above are the RMF's functions.</li>
          </ul>
        </Card>
      </div>
    </>
  )
}
