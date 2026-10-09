import React from 'react'
import { BookMarked, ClipboardCheck, FileStack } from 'lucide-react'
import { AGENT_BY_ID } from '@/domain/estate'
import { ENGAGEMENTS } from '@/domain/engagement'
import {
  PROCEDURE_STATE_LABEL, readProcedures,
  type AreaReading, type ProcedureReading, type ProcedureRegister, type ProcedureState,
} from '@/domain/procedures'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { Card, Chip, Hint, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Procedures.

   The client's own procedure areas, whether each has a current procedure
   behind it, and for every procedure: who owns it, when it was last
   reviewed, what it authorises, what proves a run of it worked, and how many
   times the platform actually executed it.

   Nothing is scored until somebody adopts the client's list against a
   clause. An engagement whose areas have not been adopted shows what its
   contract files and no coverage figure at all.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const STATE_TONE: Record<ProcedureState, Tone> = { current: 'ok', draft: 'warn', retired: 'neutral' }

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const who = (id: string) => AGENT_BY_ID[id]?.name ?? id

/* Shared across the metric band and the tables, so the two cannot disagree. */
let selected = ENGAGEMENTS[0].id
const listeners = new Set<() => void>()
const store = {
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  get: () => selected,
  set: (id: string) => { selected = id; listeners.forEach((fn) => fn()) },
}

function useEngagement(props: CardProps['props']): [string, (id: string) => void] {
  const shared = React.useSyncExternalStore(store.subscribe, store.get)
  const pinned = ENGAGEMENTS.find((e) => e.id === String(props.engagement ?? ''))?.id
  return [pinned ?? shared, store.set]
}

function useRegister(engagementId: string): ProcedureRegister {
  const loads = useAstra((s) => s.areaLoads)
  const reviews = useAstra((s) => s.procedureReviews)
  const written = useAstra((s) => s.procedures)
  return React.useMemo(() => readProcedures({ engagementId, loads, reviews, procedures: written }), [engagementId, loads, reviews, written])
}

function ProcedureMetrics({ props, size }: CardProps) {
  const [engagementId] = useEngagement(props)
  const r = useRegister(engagementId)
  return (
    <Band size={size} cols={6}>
      <Metric
        size="sm" label="Areas adopted"
        value={r.load ? r.load.areas.length : '—'}
        deltaTone={r.load ? 'ok' : 'crit'}
        hint={r.load ? r.load.reference : `${r.engagement.procedureAreas?.areas.length ?? 0} filed, none adopted`}
      />
      <Metric size="sm" label="Covered" value={r.load ? `${r.covered}/${r.areas.length}` : '—'} deltaTone={r.load && r.gaps.length ? 'warn' : 'ok'} hint={r.load ? `${r.gaps.length} with nothing current` : 'not scored'} />
      <Metric size="sm" label="Procedures" value={r.procedures.length} hint={`${r.draftCount} in draft`} />
      <Metric size="sm" label="Review overdue" value={r.staleCount} deltaTone={r.staleCount ? 'crit' : 'ok'} />
      <Metric size="sm" label="Dormant" value={r.dormantCount} deltaTone={r.dormantCount ? 'warn' : 'ok'} hint="authorised, never executed" />
      {/* The soonest review is the most overdue one where any are, so the label follows the figure. */}
      <Metric
        size="sm"
        label={r.nextReview && r.nextReview.dueInDays < 0 ? 'Most overdue' : 'Next review'}
        value={r.nextReview ? `${Math.abs(r.nextReview.dueInDays)} d` : '—'}
        deltaTone={r.nextReview && r.nextReview.dueInDays < 0 ? 'crit' : undefined}
        hint={r.nextReview?.procedure.name}
      />
    </Band>
  )
}

function AreasTable({ rows, full }: { rows: AreaReading[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr><Th>The contract’s words</Th>{full && <Th>What the platform offers for it</Th>}<Th>Procedure</Th><Th>Reviewed</Th><Th>State</Th></tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <Tr key={a.area.id} className={a.covered ? undefined : 'bg-crit/[0.05]'}>
            <Td className="max-w-[200px] text-2xs text-ink">
              {a.area.name}
              {full && !a.area.standardId && <span className="block text-[10px] text-ink-3">no standard area fits it</span>}
            </Td>
            {full && (
              <Td className="max-w-[300px] text-2xs text-ink-3">
                {a.standard ? <Hint text={a.standard.expects}><span className="text-ink-2">{a.standard.name}</span></Hint> : '—'}
              </Td>
            )}
            <Td className="max-w-[260px] text-2xs text-ink-2">
              {a.procedures.length
                ? a.procedures.map((p) => (
                  <span key={p.procedure.id} className="block leading-snug">
                    {p.procedure.name} <span className="tnum text-ink-3">v{p.procedure.version}</span>
                  </span>
                ))
                : <span className="text-crit">None</span>}
            </Td>
            <Td className="tnum whitespace-nowrap text-2xs text-ink-2">
              {a.procedures.length ? day(a.procedures[0].procedure.lastReviewedAt) : '—'}
              {a.stale > 0 && <span className="block text-[10px] text-crit">{a.stale} overdue</span>}
            </Td>
            <Td>
              {a.covered
                ? <Chip tone={a.stale ? 'warn' : 'ok'}>{a.stale ? 'Overdue' : 'Current'}</Chip>
                : <Chip tone="crit">{a.procedures.length ? PROCEDURE_STATE_LABEL[a.procedures[0].procedure.state] : 'Gap'}</Chip>}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function ProceduresTable({ rows }: { rows: ProcedureReading[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Procedure</Th><Th>Owner</Th><Th>Written by</Th><Th>Executed by</Th><Th>Authorises</Th>
          <Th>Proved by</Th><Th>Reviewed</Th><Th align="right">Runs</Th><Th>State</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <Tr key={p.procedure.id}>
            <Td className="max-w-[240px] text-2xs text-ink">
              {p.procedure.name}
              <span className="tnum block text-[10px] text-ink-3">v{p.procedure.version} · {p.procedure.reference}</span>
            </Td>
            <Td className="text-2xs text-ink-2">{ROLE_BY_ID[p.procedure.owner]?.title ?? p.procedure.owner}</Td>
            <Td className="text-2xs text-ink-2">{who(p.procedure.author)}</Td>
            <Td>
              <div className="flex max-w-[140px] flex-wrap gap-1">
                {p.procedure.agents.map((a) => <Chip key={a} tone="agent">{who(a)}</Chip>)}
              </div>
            </Td>
            <Td>
              <div className="flex max-w-[120px] flex-wrap gap-1">
                {p.procedure.actionClasses.length
                  ? p.procedure.actionClasses.map((c) => <Chip key={c} tone={p.unknownClasses.includes(c) ? 'crit' : 'neutral'}>{c}</Chip>)
                  : <span className="text-2xs text-ink-3">decides only</span>}
              </div>
            </Td>
            <Td className="max-w-[140px] text-2xs text-ink-3">{p.procedure.verificationPack ?? '—'}</Td>
            <Td className="tnum whitespace-nowrap text-2xs text-ink-2">
              {day(p.procedure.lastReviewedAt)}
              <span className={`block text-[10px] ${p.stale ? 'text-crit' : 'text-ink-3'}`}>
                {p.stale ? `${Math.abs(p.dueInDays)} d overdue` : `due in ${p.dueInDays} d`}
              </span>
            </Td>
            <Td align="right" className="tnum text-2xs text-ink-2">{p.executions}</Td>
            <Td>
              <Chip tone={STATE_TONE[p.procedure.state]}>{PROCEDURE_STATE_LABEL[p.procedure.state]}</Chip>
              {p.dormant && <Chip tone="warn" className="ml-1">Dormant</Chip>}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function NotAdopted({ r }: { r: ProcedureRegister }) {
  const filed = r.engagement.procedureAreas
  return (
    <Table>
      <thead><tr><Th>Filed in the contract</Th><Th>Maps to</Th><Th>State</Th></tr></thead>
      <tbody>
        {(filed?.areas ?? []).map((a) => (
          <Tr key={a.id}>
            <Td className="text-2xs text-ink">{a.name}</Td>
            <Td className="text-2xs text-ink-3">{a.standardId ?? '—'}</Td>
            <Td><Chip tone="warn">Not adopted</Chip></Td>
          </Tr>
        ))}
        {!filed?.areas.length && (
          <Tr><Td colSpan={3} className="text-2xs text-ink-3">The contract files no procedure areas for this engagement.</Td></Tr>
        )}
      </tbody>
    </Table>
  )
}

function ProceduresBody({ props, size }: CardProps) {
  const [engagementId, setEngagement] = useEngagement(props)
  const r = useRegister(engagementId)

  if (size !== 'page') {
    if (!r.load) return <NotAdopted r={r} />
    const shown = limit(r.areas, size, 6)
    return <><AreasTable rows={shown} full={size === 'pane'} /><More shown={shown.length} total={r.areas.length} /></>
  }

  return (
    <>
      <Card
        title="The contract’s procedure areas"
        subtitle={r.load
          ? `${r.engagement.client} · ${r.load.areas.length} adopted from ${r.load.reference} by ${r.load.by} · ${r.covered} covered`
          : `${r.engagement.client} · not adopted, so coverage is not scored`}
        right={<FileStack size={13} className="text-ink-3" />}
      >
        {ENGAGEMENTS.length > 1 && (
          <Tabs
            className="mb-3"
            tabs={ENGAGEMENTS.map((e) => ({ id: e.id, label: e.client }))}
            value={engagementId}
            onChange={setEngagement}
          />
        )}
        {r.load ? <AreasTable rows={r.areas} full /> : <NotAdopted r={r} />}
      </Card>

      <Card
        className="mt-4"
        title="The procedures themselves"
        subtitle={`${r.procedures.length} held · ${r.staleCount} review overdue · ${r.dormantCount} dormant · ${r.draftCount} in draft`}
        right={<BookMarked size={13} className="text-ink-3" />}
      >
        <ProceduresTable rows={r.procedures} />
      </Card>

      <Card
        className="mt-4"
        title="What the register says is missing"
        subtitle={r.load
          ? `${r.gaps.length} area${r.gaps.length === 1 ? '' : 's'} with nothing current · ${r.notInContract.length} platform area${r.notInContract.length === 1 ? '' : 's'} the contract does not name`
          : 'Not scored until the client’s areas are adopted'}
        right={<ClipboardCheck size={13} className="text-ink-3" />}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Table>
            <thead><tr><Th>Area with nothing current</Th><Th>What a procedure here has to cover</Th></tr></thead>
            <tbody>
              {r.gaps.map((a) => (
                <Tr key={a.area.id}>
                  <Td className="max-w-[180px] text-2xs text-ink">{a.area.name}</Td>
                  <Td className="max-w-[340px] text-2xs leading-snug text-ink-3">{a.standard?.expects ?? 'No standard area fits it'}</Td>
                </Tr>
              ))}
              {!r.gaps.length && <Tr><Td colSpan={2} className="text-2xs text-ink-3">{r.load ? 'Every adopted area has a current procedure.' : 'Not scored until the areas are adopted.'}</Td></Tr>}
            </tbody>
          </Table>
          <Table>
            <thead><tr><Th>The platform offers, the contract does not name</Th><Th>Procedures held</Th></tr></thead>
            <tbody>
              {r.load && r.notInContract.map((s) => (
                <Tr key={s.id}>
                  <Td className="max-w-[220px] text-2xs text-ink-2">{s.name}</Td>
                  <Td className="text-2xs text-ink-3">{r.procedures.filter((p) => p.procedure.standardAreaId === s.id).length}</Td>
                </Tr>
              ))}
              {r.load && !r.notInContract.length && <Tr><Td colSpan={2} className="text-2xs text-ink-3">The contract names every area the platform offers.</Td></Tr>}
              {!r.load && <Tr><Td colSpan={2} className="text-2xs text-ink-3">Not scored until the areas are adopted.</Td></Tr>}
            </tbody>
          </Table>
        </div>
      </Card>
    </>
  )
}

export const proceduresView: ArtifactView = {
  Body: ProceduresBody,
  Metrics: ProcedureMetrics,
  page: {
    title: 'Procedures',
    subtitle: 'The procedure areas the contract requires, the procedures behind them, and when each was last reviewed',
    agents: ['agt_archivist', 'agt_herald'],
    what: 'reading the register against the client’s own list',
  },
}
