import React from 'react'
import { Lightbulb, MessageSquareWarning, TrendingUp } from 'lucide-react'
import {
  ORIGIN_LABEL, PROGRESS_LABEL, readRecommendations,
  type DimensionReading, type Progress, type Recommendation, type RecommendationLedger,
} from '@/domain/recommendations'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
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

/* The band answers "what is being suggested and what needs me", in that order. */
function RecommendationMetrics({ props, size }: CardProps) {
  const r = useLedger(props)
  // The same "on the table" the page leads with: open, plus accepted and not yet done.
  const live = r.all.filter((x) => x.progress === 'open' || x.progress === 'accepted')
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Suggestions on the table" value={live.length} hint={`${live.filter((x) => x.standing).length} are standing estate defects`} />
      <Metric size="sm" label="Waiting on a decision" value={r.awaitingDecision.filter((x) => !x.standing).length} hint="raised, not yet answered" />
      <Metric
        size="sm" label="Nobody answered" value={r.expiredUndecided.length}
        deltaTone={r.expiredUndecided.length ? 'crit' : 'ok'} hint="the decision window closed"
      />
      <Metric size="sm" label="Value delivered" value={usd(r.realisedUsd)} hint={`${usd(r.projectedUsd)} was projected`} />
      <Metric
        size="sm" label="Against what we promised"
        value={r.realisedVsProjectedPct === null ? '—' : `${r.realisedVsProjectedPct.toFixed(0)}%`}
        deltaTone={r.realisedVsProjectedPct !== null && r.realisedVsProjectedPct >= 100 ? 'ok' : 'warn'}
      />
      <Metric
        size="sm" label="Areas with nothing suggested"
        value={r.reference ? r.silentDimensions.length : '—'}
        deltaTone={r.reference && r.silentDimensions.length ? 'warn' : 'ok'}
        hint={r.reference ? `of ${r.dimensions.length} the contract names` : 'none filed in the contract'}
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

/**
 * Who raised it, as the reader should see it. The client bought a service
 * that recommends; which agent inside it did the work is ours to manage, not
 * theirs to parse. The author stays on the record either way.
 */
function RaisedBy({ r, supplier }: { r: Recommendation; supplier: boolean }) {
  const inHouse = r.origin !== 'innovation' || r.raisedBy === 'Artizent' || r.raisedBy === 'An agent'
  const shown = supplier || !inHouse ? r.raisedBy : 'The service'
  return (
    <>
      {supplier || !inHouse
        ? shown
        : <Hint text={`${r.raisedBy} raised it`}><span>{shown}</span></Hint>}
      {r.unprompted && <span className="block text-[10px] text-ink-3">{r.standing ? 'standing' : 'unprompted'}</span>}
    </>
  )
}

function RecommendationsTable({ rows, full, verb = 'Recommendation', supplier }: { rows: Recommendation[]; full: boolean; verb?: string; supplier: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>{verb}</Th><Th>Raised by</Th>{full && <Th>From</Th>}<Th>Raised</Th>
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
            <Td className="whitespace-nowrap text-2xs text-ink-2"><RaisedBy r={r} supplier={supplier} /></Td>
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
  const roleId = useAstra((s) => s.roleId)
  const focus = String(props.focus ?? '')
  const supplier = ROLE_BY_ID[roleId]?.org === 'artizent'
  // What someone can still act on, and what is already settled.
  const live = r.all.filter((x) => x.progress === 'open' || x.progress === 'accepted')
  const closed = r.all.filter((x) => !live.includes(x))

  if (size !== 'page') {
    if (focus === 'recommendations') {
      const shown = limit(r.all, size, 6)
      return <><RecommendationsTable rows={shown} full={size === 'pane'} supplier={supplier} /><More shown={shown.length} total={r.all.length} /></>
    }
    if (!r.reference) {
      const shown = limit(r.all, size, 6)
      return <><RecommendationsTable rows={shown} full={size === 'pane'} supplier={supplier} /><More shown={shown.length} total={r.all.length} /></>
    }
    return <DimensionsTable rows={r.dimensions} windowDays={r.windowDays} full={size === 'pane'} />
  }

  return (
    <>
      <Card
        title="What we are recommending"
        subtitle={`${live.length} on the table · ${live.filter((x) => x.standing).length} of them defects standing in the estate right now`}
        right={<Lightbulb size={13} className="text-ink-3" />}
      >
        <RecommendationsTable rows={live} full verb="What we suggest doing" supplier={supplier} />
      </Card>

      <Card
        className="mt-4"
        title="What came of the earlier ones"
        subtitle={`${closed.length} decided, delivered or lapsed · ${usd(r.realisedUsd)} delivered against ${usd(r.projectedUsd)} projected`}
        right={<TrendingUp size={13} className="text-ink-3" />}
      >
        <RecommendationsTable rows={closed} full verb="What we suggested" supplier={supplier} />
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

      <Card
        className="mt-4"
        title="Cover against the contract"
        subtitle={r.reference
          ? `${r.dimensions.length} areas the contract names · ${r.reference}`
          : `${r.engagement.client} files no improvement areas, so this is not scored`}
        right={<TrendingUp size={13} className="text-ink-3" />}
      >
        {r.reference
          ? <DimensionsTable rows={r.dimensions} windowDays={r.windowDays} full />
          : (
            <Table>
              <thead><tr><Th>Not filed</Th></tr></thead>
              <tbody><Tr><Td className="text-2xs text-ink-3">No clause names the areas recommendations are owed against.</Td></Tr></tbody>
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
    subtitle: 'What we are suggesting the client does, what came of the earlier ones, and whether every area the contract names has had something said about it',
    agents: ['agt_prospect', 'agt_herald'],
    what: 'reading both registers against the client’s own dimensions',
  },
}
