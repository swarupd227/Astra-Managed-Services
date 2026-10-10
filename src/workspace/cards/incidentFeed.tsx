import React from 'react'
import { Inbox } from 'lucide-react'
import { ENGAGEMENT } from '@/domain/engagement'
import { feedReading } from '@/domain/ticketFeed'
import { historyFor } from '@/domain/ticketHistory'
import { ROLE_BY_ID } from '@/domain/reference'
import { Card, Chip, Empty, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { num } from '@/lib/format'
import { Band, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   The incident feed: where the client's arrivals come from and how they are
   read.

   This existed only as lines printed in the terminal of whoever ran the
   ingest, which is the wrong home for the provenance of the largest dataset
   the platform reads. Nothing on screen may be mistaken for measurement, and
   that obligation is hardest to meet for the dataset everything else is
   derived from.

   Placed and identified are kept apart throughout, because they are different
   claims. Placed means a component is declared, so an arrival lands on a
   tower under a policy with a service level and a knowledge pack. Identified
   means a costed class says what it is. Most of this book is placed and not
   identified, and collapsing the two into one coverage figure would be the
   flattering version of exactly the thing the platform refuses to do.
   ========================================================================== */

function useFeed() {
  return React.useMemo(() => feedReading(), [])
}

function FeedMetrics({ size }: CardProps) {
  const r = useFeed()
  const page = size === 'page'
  if (!r) return null
  return (
    <Band size={size} cols={page ? 6 : 4}>
      <Metric size="sm" label="Arrivals" value={num(r.arrivals)} hint={r.feed.system} />
      <Metric size="sm" label="Sub-categories" value={r.subCategories} />
      <Metric
        size="sm"
        label="Placed"
        value={`${r.placed.pct}%`}
        hint={`${num(r.placed.arrivals)} on a component`}
      />
      <Metric
        size="sm"
        label="Identified"
        value={`${r.identified.pct}%`}
        hint={`${num(r.identified.arrivals)} to a costed class`}
        deltaTone={r.identified.pct < r.placed.pct ? 'warn' : 'ok'}
      />
      {page && (
        <Metric
          size="sm"
          label="Unreadable"
          value={r.feed.loaded.unreadable}
          deltaTone={r.feed.loaded.unreadable ? 'warn' : 'ok'}
          hint="no reference or timestamp"
        />
      )}
      {page && (
        <Metric
          size="sm"
          label="Counted together"
          value={num(r.feed.loaded.foldedRows)}
          hint="differed only in case"
        />
      )}
    </Band>
  )
}

function FeedBody({ size }: CardProps) {
  const r = useFeed()
  const history = React.useMemo(() => historyFor(ENGAGEMENT.id), [])

  if (!r) {
    return (
      <Empty
        title="No incident feed is configured"
        body="Upload a dump from the client’s ticketing system and confirm how it should be read."
      />
    )
  }

  const confirmedBy = ROLE_BY_ID[r.feed.confirmedBy]?.title ?? r.feed.confirmedBy

  if (size !== 'page') {
    return (
      <Table>
        <thead><tr><Th>Field</Th><Th>Column</Th><Th>Matched on</Th></tr></thead>
        <tbody>
          {r.mapping.map((m) => (
            <Tr key={m.field}>
              <Td className="text-2xs text-ink">{m.field}</Td>
              <Td className="font-mono text-[10px] text-ink-2">{m.column}</Td>
              <Td className="text-2xs text-ink-3">
                {m.on ? `${m.on}${m.confidence === null ? '' : ` · ${m.confidence}%`}` : `confirmed by ${confirmedBy}`}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    )
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card
          title="How the dump is read"
          subtitle={`${r.feed.source ?? 'upload'} · confirmed by ${confirmedBy}`}
          right={<Inbox size={13} className="text-ink-3" />}
        >
          <Table>
            <thead><tr><Th>Field</Th><Th>Column</Th><Th>Matched on</Th></tr></thead>
            <tbody>
              {r.mapping.map((m) => (
                <Tr key={m.field}>
                  <Td className="text-2xs text-ink">{m.field}</Td>
                  <Td className="font-mono text-[10px] text-ink-2">{m.column}</Td>
                  <Td className="max-w-[260px] text-2xs text-ink-3">
                    {m.on
                      ? <>{m.on}{m.confidence !== null && <Chip className="ml-1.5">{m.confidence}%</Chip>}{m.why && <span className="block text-[10px] text-ink-3">{m.why}</span>}</>
                      : 'confirmed directly, without a recorded profile'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Priority vocabulary" subtitle="The client's words, and what each was declared to mean">
          <Table>
            <thead><tr><Th>As filed</Th><Th>Taken as</Th></tr></thead>
            <tbody>
              {r.priorities.map((p) => (
                <Tr key={p.value}>
                  <Td className="text-2xs text-ink">{p.value}</Td>
                  <Td><Chip tone="brand">{p.priority}</Chip></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {history?.cannot?.length ? (
            <div className="mt-3 space-y-1.5 border-t border-line pt-2.5">
              {history.cannot.map((c) => (
                <div key={c.what} className="flex items-start gap-2">
                  <Chip tone="warn">{c.what.replace(/_/g, ' ')}</Chip>
                  <span className="min-w-0 flex-1 text-[10px] leading-relaxed text-ink-3">{c.because}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Where the next declaration is worth most"
        subtitle={`${num(r.undeclaredArrivals)} arrivals across ${num(r.undeclared.length)} sub-categories carry neither a component nor a class`}
      >
        <Table>
          <thead><tr><Th>Sub-category</Th><Th align="right">Arrivals</Th></tr></thead>
          <tbody>
            {r.undeclared.slice(0, 12).map((s) => (
              <Tr key={s.key}>
                <Td className="text-2xs text-ink">
                  {s.subCategory}
                  <span className="block text-[10px] text-ink-3">{s.category}</span>
                </Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{num(s.incidents)}</Td>
              </Tr>
            ))}
            {!r.undeclared.length && <Tr><Td className="text-2xs text-ink-3">—</Td><Td /></Tr>}
          </tbody>
        </Table>
      </Card>
    </>
  )
}

export const incidentFeedView: ArtifactView = {
  Body: FeedBody,
  Metrics: FeedMetrics,
}
