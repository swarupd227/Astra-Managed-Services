import React from 'react'
import { ClipboardList, Database, FileSignature, ListTree } from 'lucide-react'
import { BASIS_LABEL, type Basis } from '@/domain/acceleration'
import {
  REMEDY_LABEL, STATUS_LABEL, commitmentLedger,
  type CommitmentReading, type Ledger, type Status,
} from '@/domain/commitments'
import { ENGAGEMENTS, STAGE_BY_ID } from '@/domain/engagement'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { DERIVABLE_LABEL, recurring, type TicketHistory } from '@/domain/ticketHistory'
import { Bar, Card, Chip, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { useReadiness } from '../readiness'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Commitments.

   What the engagement is held to, the figure the platform reads against each
   promise today, and where that promise started from. A baseline is marked
   with the extract it was read from or the person who declared it; a row the
   platform cannot measure says so instead of showing a figure.

   Switching engagement switches every row: the commitments are the client's
   data and the measures behind them are the platform's. An engagement with
   nothing ingested shows its promises and no figures at all.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const STATUS_TONE: Record<Status, Tone> = { met: 'ok', on_track: 'info', behind: 'warn', missed: 'crit', not_measurable: 'neutral' }
const BASIS_TONE: Record<Basis, Tone> = { measured: 'ok', projected: 'info', declared: 'warn', not_measured: 'neutral' }

const n = (x: number) => x.toLocaleString('en-GB')
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const targetOf = (r: CommitmentReading) =>
  `${r.commitment.target.direction === 'at_most' ? '≤' : '≥'} ${r.commitment.target.value}${r.measure.unit === 'pct' ? '%' : ''}`

function useClientSide() {
  const roleId = useAstra((s) => s.roleId)
  return ROLE_BY_ID[roleId]?.org !== 'artizent'
}

/** The ledger, read through the same readiness reader the lifecycle page uses. */
function useLedger(engagementId: string): Ledger {
  const fleet = useReadiness()
  const remedies = useAstra((s) => s.commitmentLog)
  const packExports = useAstra((s) => s.packExports)
  const audience = useClientSide() ? 'client' : 'all'
  return React.useMemo(
    () => commitmentLedger({ engagementId, audience, fleet, remedies, packExports }),
    [engagementId, audience, fleet, remedies, packExports],
  )
}

function CommitmentMetrics({ props, size }: CardProps) {
  const [engagementId] = useEngagement(props)
  const l = useLedger(engagementId)
  const off = l.byStatus.behind + l.byStatus.missed
  return (
    <Band size={size} cols={7}>
      <Metric size="sm" label="Commitments" value={l.rows.length} hint={`${l.fromHistory} baselined on the client’s own records`} />
      <Metric size="sm" label="Met" value={l.byStatus.met} deltaTone={l.byStatus.met ? 'ok' : 'warn'} />
      <Metric size="sm" label="On track" value={l.byStatus.on_track} />
      <Metric size="sm" label="Behind" value={l.byStatus.behind} deltaTone={l.byStatus.behind ? 'warn' : 'ok'} hint={l.byStatus.missed ? `${l.byStatus.missed} past its date` : undefined} />
      <Metric size="sm" label="Unanswered" value={l.unanswered} deltaTone={l.unanswered ? 'crit' : 'ok'} hint={`${l.recoverySteps} steps named`} />
      <Metric size="sm" label="Not measurable" value={l.byStatus.not_measurable} hint="refused, not estimated" />
      <Metric size="sm" label="Charge at risk" value={`${l.chargeAtRiskPct}%`} deltaTone={off ? 'crit' : 'ok'} hint={off ? `across ${off} commitments` : 'none at risk'} />
    </Band>
  )
}

function Pace({ r }: { r: CommitmentReading }) {
  const span = Math.abs(r.commitment.target.value - r.commitment.baseline.value)
  // A commitment to hold a count at its baseline — none of this, ever — has no
  // distance to travel, so there is no pace to draw.
  if (r.reading.value === null || r.expected === null || !span) return <span className="text-2xs text-ink-3">—</span>
  const scale = (v: number) => Math.min(100, Math.max(0, (100 * Math.abs(v - r.commitment.baseline.value)) / span))
  return (
    <div className="w-[88px]">
      <Bar value={scale(r.reading.value)} tone={STATUS_TONE[r.status]} />
      <span className="tnum mt-1 block text-[10px] text-ink-3">{Math.round(scale(r.expected))}% expected by now</span>
    </div>
  )
}

function CommitmentsTable({ rows, full }: { rows: CommitmentReading[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Stage</Th><Th>What is promised</Th><Th>Where it started</Th><Th>Target</Th>
          <Th>Today</Th>{full && <Th>Pace</Th>}<Th>Due</Th>{full && <Th>If missed</Th>}<Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.commitment.id} className={r.status === 'not_measurable' ? 'opacity-70' : undefined}>
            <Td className="text-2xs text-ink-2">{STAGE_BY_ID[r.commitment.stage].name}</Td>
            <Td className="max-w-[300px] text-2xs text-ink">
              {r.commitment.name}
              {full && <span className="block text-[10px] leading-snug text-ink-3">{r.commitment.promise}</span>}
            </Td>
            <Td className="max-w-[200px] text-2xs text-ink-2">
              {r.commitment.baseline.display}
              {full && <span className="block text-[10px] leading-snug text-ink-3">{r.commitment.baseline.source}</span>}
            </Td>
            <Td className="tnum text-2xs text-ink-2">{targetOf(r)}</Td>
            <Td className="max-w-[190px] text-2xs text-ink">
              <span className="tnum">{r.reading.display}</span>
              {full && <span className="block text-[10px] leading-snug text-ink-3">{r.reading.note}</span>}
              {!full && r.reading.basis !== 'measured' && <Chip tone={BASIS_TONE[r.reading.basis]} className="ml-1">{BASIS_LABEL[r.reading.basis]}</Chip>}
            </Td>
            {full && <Td><Pace r={r} /></Td>}
            <Td className="tnum whitespace-nowrap text-2xs text-ink-2">
              {day(r.commitment.dueAt)}
              {full && <span className="block text-[10px] text-ink-3">{r.daysLeft >= 0 ? `${n(r.daysLeft)} days left` : `${n(-r.daysLeft)} days past`}</span>}
            </Td>
            {full && (
              <Td className="max-w-[150px] text-2xs text-ink-2">
                {r.commitment.consequence.note}
              </Td>
            )}
            <Td><Chip tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{STATUS_LABEL[r.status]}</Chip></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function OwedTable({ rows }: { rows: CommitmentReading[] }) {
  return (
    <Table>
      <thead>
        <tr><Th>Commitment</Th><Th>Status</Th><Th>What would move it</Th><Th>Owner</Th><Th>Recorded</Th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.commitment.id}>
            <Td className="max-w-[230px] text-2xs text-ink">
              {r.commitment.name}
              <span className="tnum block text-[10px] text-ink-3">{r.reading.display} against {targetOf(r)} · {day(r.commitment.dueAt)}</span>
            </Td>
            <Td>
              <Chip tone={STATUS_TONE[r.status]} className="whitespace-nowrap">{STATUS_LABEL[r.status]}</Chip>
              {r.unanswered && <Chip tone="crit" className="ml-1">Unanswered</Chip>}
            </Td>
            <Td className="max-w-[340px] text-2xs text-ink-2">
              {r.recovery.length
                ? <ul className="space-y-0.5">{r.recovery.slice(0, 4).map((s, i) => <li key={i} className="leading-snug">{s.what}</li>)}</ul>
                : <span className="text-ink-3">—</span>}
              {r.recovery.length > 4 && <span className="mt-0.5 block text-[10px] text-ink-3">+{r.recovery.length - 4} more</span>}
            </Td>
            <Td>
              <div className="flex max-w-[150px] flex-wrap gap-1">
                {[...new Set(r.recovery.map((s) => s.owner))].map((id) => (
                  <Chip key={id} tone={ROLE_BY_ID[id]?.org === 'artizent' ? 'neutral' : 'brand'}>{ROLE_BY_ID[id]?.title ?? id}</Chip>
                ))}
              </div>
            </Td>
            <Td className="max-w-[230px] text-2xs text-ink-2">
              {r.remedies.length
                ? r.remedies.map((m, i) => (
                  <span key={i} className="mb-0.5 block leading-snug">
                    <Chip tone={m.kind === 'waive' ? 'warn' : 'info'}>{REMEDY_LABEL[m.kind]}</Chip>
                    <span className="block text-[10px] text-ink-3">
                      {m.detail} · {m.by} · {m.reference}{m.dueAt ? ` · lands ${day(m.dueAt)}` : ''}
                    </span>
                  </span>
                ))
                : <span className="text-ink-3">Nothing recorded</span>}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function HistoryPanel({ h }: { h: TicketHistory }) {
  const clusters = recurring(h)
  return (
    <>
      <Band size="page" cols={7}>
        <Metric size="sm" label="Incidents" value={n(h.volumes.incidents)} hint={`${h.period.months} months`} />
        <Metric size="sm" label="Requests" value={n(h.volumes.requests)} hint={`+${h.growth.pct}% half on half`} />
        <Metric size="sm" label="In scope" value={`${n(h.scope.inScope)}`} hint={`${h.scope.inScopePct}% · ${h.scope.byLine.map((b) => `${b.id} ${n(b.incidents)}`).join(' · ')}`} />
        <Metric size="sm" label="Sub-categories" value={h.shape.subCategories} hint={`top 16 carry ${h.shape.top16Pct}%`} />
        <Metric size="sm" label="Repeating" value={`${h.shape.repeatPct}%`} hint={`${h.shape.clustersOverTen} clusters seen 10+ times`} />
        <Metric size="sm" label="Problem records" value={`${h.problems.records}`} deltaTone="warn" hint={`${h.problems.inScopeWithoutProblemPct}% of in-scope with none`} />
        <Metric size="sm" label="Off the client’s list" value={`${h.shape.offInventoryPct}%`} deltaTone="warn" hint={`${n(h.shape.offInventory)} incidents`} />
      </Band>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Table>
          <thead><tr><Th>Theme</Th><Th align="right">Incidents</Th><Th align="right">Share</Th><Th>Classes against it</Th></tr></thead>
          <tbody>
            {h.themes.map((t) => (
              <Tr key={t.id}>
                <Td className="max-w-[200px] text-2xs text-ink">{t.name}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{n(t.incidents)}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{t.pctOfInScope}%</Td>
                <Td>{t.classIds.length ? <Chip tone="info">{t.classIds.length}</Chip> : <Chip>none</Chip>}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        <Table>
          <thead><tr><Th>Repeating phrasing</Th><Th>Application</Th><Th align="right">Seen</Th><Th align="right">Months</Th><Th>Cause</Th></tr></thead>
          <tbody>
            {clusters.map((c) => (
              <Tr key={c.id}>
                <Td className="max-w-[220px] text-2xs text-ink">{c.example}</Td>
                <Td className="max-w-[140px] text-2xs text-ink-2">{c.subCategory}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{c.incidents}</Td>
                <Td align="right" className="tnum text-2xs text-ink-2">{c.months}</Td>
                <Td><Chip tone={c.classId ? 'ok' : 'warn'}>{c.classId ? 'costed' : 'none'}</Chip></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Table className="mt-3">
        <thead><tr><Th>What this extract will not support</Th><Th>Why</Th></tr></thead>
        <tbody>
          {h.cannot.map((c) => (
            <Tr key={c.what}>
              <Td className="text-2xs text-ink">{DERIVABLE_LABEL[c.what]}</Td>
              <Td className="max-w-[520px] text-2xs text-ink-3">{c.because}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

/*
 * Which engagement is in view, held outside the component tree. The metric
 * band and the table are rendered as siblings by the page, and a band
 * reading one client while the table reads another is exactly the drift
 * this registry exists to prevent.
 */
let selected = ENGAGEMENTS[0].id
const listeners = new Set<() => void>()
const engagementStore = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  get: () => selected,
  set: (id: string) => { selected = id; listeners.forEach((fn) => fn()) },
}

/** The engagement in view: the card's props win, otherwise the shared choice. */
function useEngagement(props: CardProps['props']): [string, (id: string) => void] {
  const shared = React.useSyncExternalStore(engagementStore.subscribe, engagementStore.get)
  const fromProps = String(props.engagement ?? '')
  const pinned = ENGAGEMENTS.find((e) => e.id === fromProps)?.id
  return [pinned ?? shared, engagementStore.set]
}

function CommitmentsBody({ props, size }: CardProps) {
  const [engagementId, setEngagement] = useEngagement(props)
  const l = useLedger(engagementId)
  const status = String(props.status ?? '')
  const rows = status ? l.rows.filter((r) => r.status === status) : l.rows
  const owed = l.rows.filter((r) => r.status === 'behind' || r.status === 'missed' || r.status === 'not_measurable')

  if (size !== 'page') {
    const shown = limit(rows, size, 6)
    return <><CommitmentsTable rows={shown} full={size === 'pane'} /><More shown={shown.length} total={rows.length} /></>
  }

  return (
    <>
      <Card
        title="Commitments"
        subtitle={`${l.engagement.client} · ${l.rows.length} promises · ${l.byStatus.met} met · ${l.chargeAtRiskPct}% of the charge at risk`}
        right={<FileSignature size={13} className="text-ink-3" />}
      >
        {ENGAGEMENTS.length > 1 && (
          <Tabs
            className="mb-3"
            tabs={ENGAGEMENTS.map((e) => ({ id: e.id, label: e.client }))}
            value={engagementId}
            onChange={setEngagement}
          />
        )}
        <CommitmentsTable rows={l.rows} full />
      </Card>

      {owed.length > 0 && (
        <Card
          className="mt-4"
          title="What is owed"
          subtitle={`${l.unanswered} unanswered · ${l.recoverySteps} steps named · ${l.chargeAtRiskPct}% of the charge at risk`}
          right={<ClipboardList size={13} className="text-ink-3" />}
        >
          <OwedTable rows={owed} />
        </Card>
      )}

      <Card
        className="mt-4"
        title="What the baselines were read from"
        subtitle={l.history && l.history.period.months ? `${l.history.source} · ${day(l.history.period.from)} to ${day(l.history.period.to)}` : 'No ticket extract ingested for this engagement'}
        right={l.history && l.history.period.months ? <Database size={13} className="text-ink-3" /> : <ListTree size={13} className="text-ink-3" />}
      >
        {l.history && l.history.period.months
          ? <HistoryPanel h={l.history} />
          : (
            <Table>
              <thead><tr><Th>Not ingested</Th><Th>Effect</Th></tr></thead>
              <tbody>
                {(l.history?.cannot ?? []).map((c) => (
                  <Tr key={c.what}>
                    <Td className="text-2xs text-ink">{DERIVABLE_LABEL[c.what]}</Td>
                    <Td className="text-2xs text-ink-3">{c.because}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
      </Card>
    </>
  )
}

export const commitmentsView: ArtifactView = {
  Body: CommitmentsBody,
  Metrics: CommitmentMetrics,
  page: {
    title: 'Commitments',
    subtitle: 'What the engagement is held to, what the platform reads against each promise today, and the records each baseline came from',
    agents: ['agt_herald', 'agt_bursar'],
    what: 'reading each commitment against the measure behind it',
  },
}
