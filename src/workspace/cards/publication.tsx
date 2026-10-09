import React from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import { PUBLISH_LABEL, publicationSummary, type PublicationReading } from '@/domain/publication'
import { useAstra } from '@/domain/store'
import { Card, Chip, Empty, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num } from '@/lib/format'
import { Band, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   What a consumer is reading, and whether it is the latest.

   This is the banner the whole gate exists to put on a report: verified and
   when, or held with the date of the figures being shown instead. Both say
   the same thing in different words — here is what you are reading and here
   is how far you can trust it — which is why neither is ever absent.
   ========================================================================== */

function usePublication(itemId?: string) {
  const log = useAstra((s) => s.publishLog)
  return React.useMemo(() => {
    const ids = itemId ? [itemId] : [...new Set(log.map((p) => p.itemId))]
    return publicationSummary(log, ids)
  }, [log, itemId])
}

const when = (iso: string) => iso.slice(0, 16).replace('T', ' ')

function PublicationMetrics({ props, size }: CardProps) {
  const s = usePublication(props.item as string | undefined)
  return (
    <Band size={size} cols={3}>
      <Metric size="sm" label="Held" value={s.held} deltaTone={s.held ? 'crit' : 'ok'} hint={s.held ? 'consumers on earlier figures' : undefined} />
      <Metric size="sm" label="Verified" value={s.published} deltaTone={s.published ? 'ok' : undefined} />
      <Metric size="sm" label="Never gated" value={s.ungated} hint="not held, and not verified either" />
    </Band>
  )
}

/** One item's banner: the sentence a reader of that report needs. */
function Banner({ r }: { r: PublicationReading }) {
  const held = r.state === 'held'
  return (
    <div className={held ? 'rounded border border-crit/40 bg-crit/[0.06] p-2.5' : 'rounded border border-ok/35 bg-ok/[0.05] p-2.5'}>
      <div className="flex flex-wrap items-center gap-2">
        {held ? <ShieldAlert size={13} className="shrink-0 text-crit" /> : <ShieldCheck size={13} className="shrink-0 text-ok" />}
        <span className="min-w-0 flex-1 truncate text-2xs font-medium text-ink">{r.name}</span>
        <Chip tone={held ? 'crit' : 'ok'}>{PUBLISH_LABEL[r.state]}</Chip>
      </div>
      <p className="mt-1 text-2xs leading-relaxed text-ink-2">
        {held
          ? r.lastGood
            ? `Showing the load of ${when(r.lastGood.at)}, which reconciled. ${r.last?.reason}`
            : `Nothing has reconciled yet, so there is nothing to show. ${r.last?.reason}`
          : `Verified ${r.last ? when(r.last.at) : ''}`}
      </p>
    </div>
  )
}

function PublicationBody({ props, size }: CardProps) {
  const s = usePublication(props.item as string | undefined)
  if (!s.readings.length) return <Empty title="The gate has seen no load" />

  return (
    <>
      <div className="space-y-2">
        {s.readings.slice(0, size === 'card' ? 2 : s.readings.length).map((r) => <Banner key={r.itemId} r={r} />)}
      </div>

      {size !== 'card' && s.readings.some((r) => r.last?.breaks.length) && (
        <Card className="mt-4" title="What did not reconcile" subtitle="Declared by the source against counted after the load">
          <Table>
            <thead><tr><Th>Item</Th><Th>Measure</Th><Th align="right">Declared</Th><Th align="right">Counted</Th><Th align="right">Gap</Th><Th>Ticket</Th></tr></thead>
            <tbody>
              {s.readings.flatMap((r) => (r.last?.breaks ?? []).map((b) => (
                <Tr key={`${r.itemId}:${b.measure}`}>
                  <Td className="text-2xs text-ink">{r.name}</Td>
                  <Td className="font-mono text-2xs text-ink-2">{b.measure}</Td>
                  <Td align="right" className="tnum text-2xs text-ink-2">{num(Math.round(b.expected))}</Td>
                  <Td align="right" className="tnum text-2xs text-crit">{num(Math.round(b.observed))}</Td>
                  <Td align="right" className="tnum text-2xs text-crit">{b.deltaPct === null ? '—' : `${b.deltaPct.toFixed(1)}%`}</Td>
                  <Td className="font-mono text-2xs text-ink-3">{r.last?.workObjectId ?? '—'}</Td>
                </Tr>
              )))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  )
}

export const publicationView: ArtifactView = {
  Body: PublicationBody,
  Metrics: PublicationMetrics,
  page: {
    title: 'Publish gate',
    subtitle: 'What each consumer is reading, whether it is the latest load, and every measure that did not reconcile against what the source declared',
    agents: ['agt_custodian'],
    what: 'reconciling each load before anything downstream reads it',
  },
}
