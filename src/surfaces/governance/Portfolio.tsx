import React from 'react'
import { Boxes, Layers, TriangleAlert } from 'lucide-react'
import {
  DRIFT_LABEL, KIND_LABEL, LIFECYCLE, OBSERVED_LABEL, RECONCILIATION_LABEL, RECORD_LABEL,
  inventorySummary, ungovernedAi, type AppKind, type ConfigDrift, type Reconciliation,
} from '@/domain/inventory'
import { VENDOR_BY_ID } from '@/domain/vendors'
import { PageHeader } from '@/ui/domain'
import { ProducedBy } from '@/ui/ProducedBy'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn, num, pct } from '@/lib/format'

/* ==========================================================================
   Application portfolio.

   One row per application: its kind, who supplies it, where its
   configuration stands against baseline, whether it embeds a governed model,
   and whether the client's record agrees with what the platform observes.
   The lifecycle panel is the reason kind is shown at all — it decides who
   ships code, whether code can be rolled back, and what a configuration
   baseline records.
   ========================================================================== */

const REC_TONE: Record<Reconciliation, 'ok' | 'warn' | 'crit'> = {
  reconciled: 'ok', ghost: 'crit', unrecorded: 'crit', orphan: 'warn', invisible: 'warn',
}
const ORDER: Reconciliation[] = ['ghost', 'unrecorded', 'invisible', 'orphan', 'reconciled']
const DRIFT_TONE: Record<ConfigDrift, 'ok' | 'warn' | 'neutral'> = { in_baseline: 'ok', drifted: 'warn', unknown: 'neutral' }
const KINDS: AppKind[] = ['saas', 'commercial', 'custom', 'integration']

const shipsCode = (k: AppKind) =>
  LIFECYCLE[k].codeReleasedBy === 'vendor' ? 'Vendor ships code' : LIFECYCLE[k].codeReleasedBy === 'us' ? 'We ship code' : 'Vendor and us ship code'

export function Portfolio() {
  const inv = React.useMemo(() => inventorySummary(), [])
  const disagreeing = inv.items.filter((i) => i.reconciliation !== 'reconciled').length
  const rows = React.useMemo(
    () => [...inv.items].sort((a, b) => ORDER.indexOf(a.reconciliation) - ORDER.indexOf(b.reconciliation)),
    [inv],
  )

  return (
    <>
      <PageHeader
        title="Application portfolio"
        subtitle="Kind, vendor, configuration baseline and record reconciliation per application"
      />

      <ProducedBy agents={['agt_archivist']} what="reconciling the client's application record against observed demand" />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-6">
        <Metric size="sm" label="Systems under support" value={inv.denominator} />
        <Metric size="sm" label="Record agrees with reality" value={pct(inv.reconciledShare * 100, 0)} deltaTone={inv.reconciledShare >= 0.9 ? 'ok' : 'warn'} hint={`${disagreeing} disagree`} />
        <Metric size="sm" label="Incidents in dispute" value={num(inv.disputedIncidents)} deltaTone="warn" />
        <Metric size="sm" label="Configuration drifted" value={inv.drifted} deltaTone={inv.drifted ? 'warn' : 'ok'} hint={`${inv.noBaseline} with no baseline`} />
        <Metric size="sm" label="Ungoverned AI" value={inv.ungovernedAi} deltaTone={inv.ungovernedAi ? 'crit' : 'ok'} hint={`of ${inv.aiEnabled} AI-enabled`} />
        <Metric size="sm" label="In a retirement programme" value={inv.inProgramme} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Reconciliation" right={<TriangleAlert size={13} className="text-warn" />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {ORDER.filter((r) => r !== 'reconciled').map((r) => (
                <div key={r} className={cn('flex items-baseline gap-2 rounded border p-2.5', inv.byReconciliation[r] ? 'border-warn/40 bg-warn/[0.05]' : 'border-line bg-sunken')}>
                  <Chip tone={REC_TONE[r]}>{RECONCILIATION_LABEL[r]}</Chip>
                  <span className="tnum ml-auto text-xs text-ink">{inv.byReconciliation[r]}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Lifecycle by kind" right={<Layers size={13} className="text-ink-3" />}>
            <div className="space-y-1.5">
              {KINDS.map((k) => (
                <div key={k} className="flex flex-wrap items-center gap-1.5 rounded border border-line bg-sunken px-2.5 py-1.5">
                  <Chip tone="brand">{KIND_LABEL[k]}</Chip>
                  <span className="tnum text-2xs text-ink">{inv.byKind[k]}</span>
                  <span className="ml-auto flex flex-wrap gap-1">
                    <Chip>{shipsCode(k)}</Chip>
                    <Chip tone={LIFECYCLE[k].canRollBackCode ? 'neutral' : 'warn'}>{LIFECYCLE[k].canRollBackCode ? 'Code rollback' : 'No code rollback'}</Chip>
                    <Chip>Baseline: {LIFECYCLE[k].configScope}</Chip>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mt-4" title="Applications" subtitle={`${inv.items.length} applications, disagreements first`} right={<Boxes size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr>
                <Th>Application</Th><Th>Kind</Th><Th>Vendor</Th><Th>Their record</Th><Th>We observe</Th>
                <Th>Verdict</Th><Th>Configuration</Th><Th>AI</Th><Th align="right">Incidents/yr</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <Tr key={i.id} className={i.reconciliation !== 'reconciled' ? 'bg-warn/[0.05]' : undefined}>
                  <Td className="max-w-[210px] text-2xs leading-snug text-ink">
                    {i.name}
                    <span className="mt-0.5 block text-[10px] text-ink-3">Tier {i.tier} · {i.owner}</span>
                  </Td>
                  <Td><Chip tone="brand">{KIND_LABEL[i.kind]}</Chip></Td>
                  <Td className="text-2xs text-ink-2">{i.vendorId ? VENDOR_BY_ID[i.vendorId]?.name ?? i.vendorId : '—'}</Td>
                  <Td className="text-2xs text-ink-2">{RECORD_LABEL[i.clientRecord]}</Td>
                  <Td className="text-2xs text-ink-2">{OBSERVED_LABEL[i.observed]}</Td>
                  <Td><Chip tone={REC_TONE[i.reconciliation]}>{RECONCILIATION_LABEL[i.reconciliation]}</Chip></Td>
                  <Td className="max-w-[190px] text-2xs text-ink-2">
                    <span className="block truncate">{i.config.baseline || '—'}</span>
                    <Chip tone={DRIFT_TONE[i.config.drift]} className="mt-0.5">{DRIFT_LABEL[i.config.drift]}</Chip>
                  </Td>
                  <Td>
                    {i.aiEnabled
                      ? <Chip tone={ungovernedAi(i) ? 'crit' : 'ok'}>{ungovernedAi(i) ? 'Ungoverned' : 'Registered'}</Chip>
                      : <span className="text-2xs text-ink-3">—</span>}
                  </Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{i.annualIncidents ? num(i.annualIncidents) : '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  )
}
