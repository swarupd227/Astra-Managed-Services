import React from 'react'
import { Link } from 'react-router-dom'
import { Boxes, TriangleAlert } from 'lucide-react'
import {
  OBSERVED_LABEL, RECONCILIATION_LABEL, RECORD_LABEL,
  inventorySummary, type Reconciliation,
} from '@/domain/inventory'
import { DEMAND_CLASSES } from '@/domain/ledgers'
import { PageHeader } from '@/ui/domain'
import { Card, Chip, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num, pct } from '@/lib/format'
import { cn } from '@/lib/format'

/* ==========================================================================
   Application inventory.

   Two columns, not one. A count of systems would have been the easy answer
   and the wrong one, because this client's own record is demonstrably
   incorrect about its own estate. So the page reports what their record
   says beside what the platform observes, and where they disagree the
   disagreement is the finding rather than something to reconcile away.
   ========================================================================== */

const REC_TONE: Record<Reconciliation, 'ok' | 'warn' | 'crit' | 'info'> = {
  reconciled: 'ok',
  ghost: 'crit',
  unrecorded: 'crit',
  orphan: 'warn',
  invisible: 'warn',
}

const ORDER: Reconciliation[] = ['ghost', 'unrecorded', 'invisible', 'orphan', 'reconciled']

export function Inventory() {
  const inv = React.useMemo(() => inventorySummary(), [])
  const disagreeing = inv.items.filter((i) => i.reconciliation !== 'reconciled')

  return (
    <>
      <PageHeader
        title="Application inventory"
        subtitle="Client record against platform observation"
      />

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-line bg-surface px-4 py-2.5 md:grid-cols-5">
        <Metric size="sm" label="Systems under support" value={inv.denominator} />
        <Metric size="sm" label="Their record lists" value={inv.recordedInSupport} />
        <Metric size="sm" label="Record agrees with reality" value={pct(inv.reconciledShare * 100, 0)} deltaTone={inv.reconciledShare >= 0.9 ? 'ok' : 'warn'} hint={`${disagreeing.length} disagree`} />
        <Metric size="sm" label="Incidents in dispute" value={num(inv.disputedIncidents)} deltaTone="warn" />
        <Metric size="sm" label="In a retirement programme" value={inv.inProgramme} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Card title="Reconciliation" right={<TriangleAlert size={13} className="text-warn" />}>
          <div className="grid gap-2 sm:grid-cols-2">
            {ORDER.filter((r) => r !== 'reconciled').map((r) => (
              <div key={r} className={cn('rounded border p-3', inv.byReconciliation[r] ? 'border-warn/40 bg-warn/[0.05]' : 'border-line bg-sunken')}>
                <div className="flex items-baseline gap-2">
                  <Chip tone={REC_TONE[r]}>{RECONCILIATION_LABEL[r]}</Chip>
                  <span className="tnum ml-auto text-xs text-ink">{inv.byReconciliation[r]}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-4" title="The estate" subtitle={`${inv.items.length} applications, disagreements first`} right={<Boxes size={13} className="text-ink-3" />}>
          <Table>
            <thead>
              <tr>
                <Th>Application</Th><Th>Their record</Th><Th>We observe</Th>
                <Th>Verdict</Th><Th align="right">Incidents/yr</Th><Th>Demand it causes</Th>
              </tr>
            </thead>
            <tbody>
              {[...inv.items]
                .sort((a, b) => ORDER.indexOf(a.reconciliation) - ORDER.indexOf(b.reconciliation))
                .map((i) => (
                  <Tr key={i.id} className={i.reconciliation !== 'reconciled' ? 'bg-warn/[0.05]' : undefined}>
                    <Td className="max-w-[230px] text-2xs leading-snug text-ink">
                      {i.name}
                      <span className="mt-0.5 block text-[10px] leading-snug text-ink-3">Tier {i.tier} · {i.owner}</span>
                    </Td>
                    <Td className="text-2xs text-ink-2">{RECORD_LABEL[i.clientRecord]}</Td>
                    <Td className="text-2xs text-ink-2">{OBSERVED_LABEL[i.observed]}</Td>
                    <Td><Chip tone={REC_TONE[i.reconciliation]}>{RECONCILIATION_LABEL[i.reconciliation]}</Chip></Td>
                    <Td align="right" className="tnum text-2xs text-ink-2">{i.annualIncidents ? num(i.annualIncidents) : '—'}</Td>
                    <Td className="max-w-[180px]">
                      <div className="flex flex-wrap gap-1">
                        {i.demandClasses.map((id) => (
                          <Link key={id} to="/governance/elimination">
                            <Chip mono title={DEMAND_CLASSES.find((d) => d.id === id)?.name}>{id}</Chip>
                          </Link>
                        ))}
                        {!i.demandClasses.length && <span className="text-2xs text-ink-3">none recorded</span>}
                      </div>
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
