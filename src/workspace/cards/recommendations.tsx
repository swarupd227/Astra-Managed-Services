import React from 'react'
import { Lightbulb, MessageSquareWarning, TrendingUp } from 'lucide-react'
import {
  ORIGIN_LABEL, PROGRESS_LABEL, readRecommendations,
  type DimensionReading, type Progress, type Recommendation, type RecommendationLedger,
} from '@/domain/recommendations'
import { Card, Chip, Hint, Metric, Table, Td, Th, Tr } from '@/ui/primitives'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Recommendations.

   What was proposed without being asked, against the improvement dimensions
   the contract names, and what the delivered ones returned against what they
   promised.

   Two figures here are uncomfortable by design. A dimension nobody has
   raised anything on in the window is ours to answer for. A recommendation
   that expired without a decision is theirs. Both are on the same screen,
   because a proactivity figure showing only one side is an advertisement.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const PROGRESS_TONE: Record<Progress, Tone> = {
  open: 'info', accepted: 'brand', delivered: 'ok', realised: 'ok',
  failed: 'warn', declined: 'neutral', expired: 'crit',
}

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `$${Math.round(n / 1000)}k` : n ? `$${n}` : '—'
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

function useLedger(props: CardProps['props']): RecommendationLedger {
  const engagementId = String(props.engagement ?? '') || undefined
  return React.useMemo(() => readRecommendations({ engagementId }), [engagementId])
}

function RecommendationMetrics({ props, size }: CardProps) {
  const r = useLedger(props)
  const covered = r.dimensions.length - r.silentDimensions.length
  return (
    <Band size={size} cols={6}>
      <Metric
        size="sm" label={`Raised in ${r.windowDays} days`} value={r.raisedInWindow}
        hint={`${r.unpromptedInWindow} without being asked`}
      />
      <Metric
        size="sm" label="Dimensions covered"
        value={r.reference ? `${covered}/${r.dimensions.length}` : '—'}
        deltaTone={r.reference ? (r.silentDimensions.length ? 'warn' : 'ok') : 'neutral'}
        hint={r.reference ? `${r.silentDimensions.length} silent` : 'none filed in the contract'}
      />
      <Metric size="sm" label="Awaiting a decision" value={r.awaitingDecision.length} />
      <Metric
        size="sm" label="Expired undecided" value={r.expiredUndecided.length}
        deltaTone={r.expiredUndecided.length ? 'crit' : 'ok'} hint="never answered"
      />
      <Metric size="sm" label="Value realised" value={usd(r.realisedUsd)} hint={`${usd(r.projectedUsd)} projected across all`} />
      <Metric
        size="sm" label="Realised vs projected"
        value={r.realisedVsProjectedPct === null ? '—' : `${r.realisedVsProjectedPct.toFixed(0)}%`}
        deltaTone={r.realisedVsProjectedPct !== null && r.realisedVsProjectedPct >= 100 ? 'ok' : 'warn'}
        hint="on everything that reached a value"
      />
    </Band>
  )
}

function DimensionsTable({ rows, windowDays, full }: { rows: DimensionReading[]; windowDays: number; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>The contract’s words</Th>{full && <Th>What a recommendation here is about</Th>}
          <Th align="right">In {windowDays} d</Th><Th align="right">All</Th><Th>Last raised</Th>
          <Th align="right">Realised</Th><Th>State</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <Tr key={d.name} className={d.silent ? 'bg-crit/[0.05]' : undefined}>
            <Td className="max-w-[180px] text-2xs text-ink">{d.name}</Td>
            {full && <Td className="max-w-[360px] text-2xs leading-snug text-ink-3">{d.standard?.covers ?? 'No standard dimension fits it'}</Td>}
            <Td align="right" className="tnum text-2xs text-ink-2">{d.inWindow}</Td>
            <Td align="right" className="tnum text-2xs text-ink-3">{d.recommendations.length}</Td>
            <Td className="tnum whitespace-nowrap text-2xs text-ink-2">
              {d.silentDays === null ? <span className="text-crit">never</span> : `${d.silentDays} d ago`}
            </Td>
            <Td align="right" className="tnum text-2xs text-ink-2">{usd(d.realisedUsd)}</Td>
            <Td><Chip tone={d.silent ? 'crit' : 'ok'}>{d.silent ? 'Silent' : 'Current'}</Chip></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function RecommendationsTable({ rows, full }: { rows: Recommendation[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Recommendation</Th><Th>Raised by</Th>{full && <Th>From</Th>}<Th>Raised</Th>
          <Th align="right">Projected</Th><Th align="right">Realised</Th><Th>State</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td className="max-w-[320px] text-2xs text-ink">
              {r.title}
              {full && r.exposure && r.exposure.consumers > 0 && (
                <span className="block text-[10px] text-ink-3">
                  {r.exposure.consumers} downstream reader{r.exposure.consumers === 1 ? '' : 's'} exposed
                  {r.exposure.largestAudience ? `, largest audience ${r.exposure.largestAudience.toLocaleString('en-GB')}` : ''} · {r.fix}
                </span>
              )}
              {full && !r.dimensionId && <span className="mt-0.5 block"><Chip tone="warn">no dimension</Chip></span>}
            </Td>
            <Td className="whitespace-nowrap text-2xs text-ink-2">
              {r.raisedBy}
              {r.unprompted && <span className="block text-[10px] text-ink-3">{r.standing ? 'standing' : 'unprompted'}</span>}
            </Td>
            {full && <Td className="text-2xs text-ink-3">{ORIGIN_LABEL[r.origin]}</Td>}
            <Td className="tnum whitespace-nowrap text-2xs text-ink-2">
              {day(r.raisedAt)}
              {r.ageDays !== null && <span className="block text-[10px] text-ink-3">{r.ageDays} d ago</span>}
            </Td>
            <Td align="right" className="tnum text-2xs text-ink-2">{r.projectedUsd === null ? '—' : usd(r.projectedUsd)}</Td>
            <Td align="right" className="tnum text-2xs text-ink-2">{r.realisedUsd === null ? '—' : usd(r.realisedUsd)}</Td>
            <Td>
              <Hint text={r.progress === 'expired' ? 'The decision window closed without an answer' : PROGRESS_LABEL[r.progress]}>
                <Chip tone={PROGRESS_TONE[r.progress]} className="whitespace-nowrap">{PROGRESS_LABEL[r.progress]}</Chip>
              </Hint>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function RecommendationsBody({ props, size }: CardProps) {
  const r = useLedger(props)
  const focus = String(props.focus ?? '')

  if (size !== 'page') {
    if (focus === 'recommendations') {
      const shown = limit(r.all, size, 6)
      return <><RecommendationsTable rows={shown} full={size === 'pane'} /><More shown={shown.length} total={r.all.length} /></>
    }
    if (!r.reference) {
      const shown = limit(r.all, size, 6)
      return <><RecommendationsTable rows={shown} full={size === 'pane'} /><More shown={shown.length} total={r.all.length} /></>
    }
    return <DimensionsTable rows={r.dimensions} windowDays={r.windowDays} full={size === 'pane'} />
  }

  return (
    <>
      <Card
        title="What the contract asks us to improve"
        subtitle={r.reference
          ? `${r.dimensions.length} dimensions · ${r.reference} · ${r.silentDimensions.length} silent for ${r.windowDays} days`
          : `${r.engagement.client} files no improvement dimensions, so cadence is not scored`}
        right={<TrendingUp size={13} className="text-ink-3" />}
      >
        {r.reference
          ? <DimensionsTable rows={r.dimensions} windowDays={r.windowDays} full />
          : (
            <Table>
              <thead><tr><Th>Not filed</Th></tr></thead>
              <tbody><Tr><Td className="text-2xs text-ink-3">No clause names the dimensions recommendations are owed against.</Td></Tr></tbody>
            </Table>
          )}
      </Card>

      <Card
        className="mt-4"
        title="Every recommendation"
        subtitle={`${r.all.length} across both registers and the estate watch · ${r.raisedInWindow} in the last ${r.windowDays} days · ${r.unpromptedInWindow} unprompted`}
        right={<Lightbulb size={13} className="text-ink-3" />}
      >
        <RecommendationsTable rows={r.all} full />
      </Card>

      <Card
        className="mt-4"
        title="What is owed, both ways"
        subtitle={`${r.silentDimensions.length} dimension${r.silentDimensions.length === 1 ? '' : 's'} ours to answer for · ${r.expiredUndecided.length} decision${r.expiredUndecided.length === 1 ? '' : 's'} never made`}
        right={<MessageSquareWarning size={13} className="text-ink-3" />}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Table>
            <thead><tr><Th>Ours: nothing proposed</Th><Th>Last raised</Th></tr></thead>
            <tbody>
              {r.silentDimensions.map((d) => (
                <Tr key={d.name}>
                  <Td className="max-w-[220px] text-2xs text-ink">{d.name}</Td>
                  <Td className="tnum text-2xs text-ink-3">{d.silentDays === null ? 'never' : `${d.silentDays} d ago`}</Td>
                </Tr>
              ))}
              {!r.silentDimensions.length && <Tr><Td colSpan={2} className="text-2xs text-ink-3">{r.reference ? 'Every dimension carries a recommendation in the window.' : 'Not scored: no dimensions filed.'}</Td></Tr>}
            </tbody>
          </Table>
          <Table>
            <thead><tr><Th>Theirs: expired without a decision</Th><Th>Raised</Th></tr></thead>
            <tbody>
              {r.expiredUndecided.map((x) => (
                <Tr key={x.id}>
                  <Td className="max-w-[260px] text-2xs text-ink">{x.title}</Td>
                  <Td className="tnum whitespace-nowrap text-2xs text-ink-3">{x.ageDays} d ago</Td>
                </Tr>
              ))}
              {!r.expiredUndecided.length && <Tr><Td colSpan={2} className="text-2xs text-ink-3">Every recommendation has been answered.</Td></Tr>}
            </tbody>
          </Table>
        </div>
        {r.unclassified.length > 0 && (
          <Table className="mt-3">
            <thead><tr><Th>Serving no dimension the contract names</Th><Th>Raised by</Th><Th>State</Th></tr></thead>
            <tbody>
              {r.unclassified.map((x) => (
                <Tr key={x.id}>
                  <Td className="max-w-[320px] text-2xs text-ink">{x.title}</Td>
                  <Td className="text-2xs text-ink-2">{x.raisedBy}</Td>
                  <Td><Chip tone={PROGRESS_TONE[x.progress]}>{PROGRESS_LABEL[x.progress]}</Chip></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

export const recommendationsView: ArtifactView = {
  Body: RecommendationsBody,
  Metrics: RecommendationMetrics,
  page: {
    title: 'Recommendations',
    subtitle: 'What was proposed without being asked, against the dimensions the contract names, and what the delivered ones returned',
    agents: ['agt_prospect', 'agt_herald'],
    what: 'reading both registers against the client’s own dimensions',
  },
}
