import React from 'react'
import { Scale } from 'lucide-react'
import { CAUSE_LABEL, KIND_LABEL, explainDifference } from '@/domain/finance'
import { useAstra } from '@/domain/store'
import { Card, Chip, Empty, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { cn } from '@/lib/format'
import { Band, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Why two reports disagree.

   The figure to look at is the last one: what the causes do not account for.
   A reconciliation that always reconciles is not checking anything, so the
   remainder is computed and shown whether it is zero or not.
   ========================================================================== */

const usd = (n: number) => {
  const a = Math.abs(n)
  const s = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `$${(a / 1_000).toFixed(0)}k` : `$${a.toFixed(0)}`
  return n < 0 ? `−${s}` : s
}
const when = (iso: string) => iso.slice(0, 16).replace('T', ' ')

function useDifference(props: Record<string, unknown>) {
  const refreshes = useAstra((s) => s.reportRefreshes)
  const client = (props.client as string) ?? 'Kearney Global'
  const period = (props.period as string) ?? '2026-Q3'
  return React.useMemo(() => {
    const refreshedAt: Record<string, string> = {}
    for (const r of refreshes) if (!refreshedAt[r.reportId] || r.at > refreshedAt[r.reportId]) refreshedAt[r.reportId] = r.at
    return explainDifference({ client, period, refreshedAt })
  }, [client, period, refreshes])
}

function DifferenceMetrics({ props, size }: CardProps) {
  const d = useDifference(props)
  return (
    <Band size={size} cols={4}>
      <Metric size="sm" label={d.a.view.name} value={usd(d.a.figure)} hint={`refreshed ${when(d.a.refreshedAt)}`} />
      <Metric size="sm" label={d.b.view.name} value={usd(d.b.figure)} hint={`refreshed ${when(d.b.refreshedAt)}`} />
      <Metric size="sm" label="Difference" value={usd(d.gap)} deltaTone={d.gap === 0 ? 'ok' : 'warn'} />
      <Metric
        size="sm"
        label="Unexplained"
        value={usd(d.unexplained)}
        deltaTone={d.unexplained === 0 ? 'ok' : 'crit'}
        hint={d.unexplained === 0 ? 'the causes account for all of it' : 'not accounted for'}
      />
    </Band>
  )
}

function DifferenceBody({ props }: CardProps) {
  const d = useDifference(props)
  if (d.gap === 0 && !d.causes.length) return <Empty title="Both reports give the same figure" />

  return (
    <>
      <Card title="What each report counts" subtitle="Two definitions of one measure">
        <Table>
          <thead><tr><Th>Report</Th><Th>Its definition includes</Th><Th>Last refreshed</Th><Th align="right">Figure</Th></tr></thead>
          <tbody>
            {[d.a, d.b].map((side) => (
              <Tr key={side.view.id}>
                <Td className="text-2xs text-ink">{side.view.name}</Td>
                <Td className="text-2xs text-ink-2">{side.view.includes.map((k) => KIND_LABEL[k]).join(', ')}</Td>
                <Td className="text-2xs text-ink-3">{when(side.refreshedAt)}</Td>
                <Td align="right" className="tnum text-2xs font-medium text-ink">{usd(side.figure)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-4" title="What the difference is made of" subtitle={`${usd(d.gap)} across ${d.causes.length} cause${d.causes.length === 1 ? '' : 's'}`} right={<Scale size={13} className="text-ink-3" />}>
        <Table>
          <thead><tr><Th>Worth</Th><Th>What</Th><Th>Why</Th><Th>Seen only by</Th><Th align="right">Rows</Th></tr></thead>
          <tbody>
            {d.causes.map((c) => (
              <Tr key={`${c.seenBy}:${c.entryKind}:${c.kind}`}>
                <Td className="tnum text-2xs font-medium text-ink">{usd(Math.abs(c.amount))}</Td>
                <Td className="text-2xs text-ink-2">{KIND_LABEL[c.entryKind]}</Td>
                <Td className="max-w-[260px] text-2xs text-ink-3">{CAUSE_LABEL[c.kind]}</Td>
                <Td className="text-2xs text-ink-2">{c.seenBy}</Td>
                <Td align="right" className="tnum text-2xs text-ink-3">{c.rows}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        <div className={cn('mt-3 rounded border p-2.5', d.unexplained === 0 ? 'border-ok/35 bg-ok/[0.05]' : 'border-crit/40 bg-crit/[0.06]')}>
          <div className="flex items-center gap-2">
            <Chip tone={d.unexplained === 0 ? 'ok' : 'crit'}>{d.unexplained === 0 ? 'They add up' : 'They do not add up'}</Chip>
            <span className="tnum text-2xs text-ink-2">
              {usd(d.causes.reduce((n, c) => n + (c.seenBy === d.a.view.name ? c.amount : -c.amount), 0))} accounted, {usd(d.unexplained)} not
            </span>
          </div>
        </div>
      </Card>

      <Card className="mt-4" title="The rows behind each cause" subtitle="So the arithmetic can be checked">
        <Table>
          <thead><tr><Th>Row</Th><Th>Cause</Th><Th align="right">Amount</Th><Th>Booked</Th></tr></thead>
          <tbody>
            {d.causes.flatMap((c) => c.examples.map((e) => (
              <Tr key={e.id}>
                <Td className="font-mono text-2xs text-ink-2">{e.id}</Td>
                <Td className="text-2xs text-ink-3">{KIND_LABEL[c.entryKind]}</Td>
                <Td align="right" className="tnum text-2xs text-ink">{usd(e.amount)}</Td>
                <Td className="text-2xs text-ink-3">{when(e.bookedAt)}</Td>
              </Tr>
            )))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}

export const differenceView: ArtifactView = {
  Body: DifferenceBody,
  Metrics: DifferenceMetrics,
  page: {
    title: 'Why they differ',
    subtitle: 'Two reports, one measure, and the rows that account for the gap between them',
    agents: ['agt_custodian'],
    what: 'partitioning the rows behind each figure',
  },
}
