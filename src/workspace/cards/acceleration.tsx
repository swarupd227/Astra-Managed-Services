import React from 'react'
import { Gauge, Layers, Workflow } from 'lucide-react'
import { AGENT_BY_ID } from '@/domain/estate'
import {
  BASIS_LABEL, BUILD_LABEL, SAVES_LABEL, accelerationSummary,
  type AcceleratorReading, type Basis, type BuildState, type Saves, type StageReading,
} from '@/domain/acceleration'
import { ROLE_BY_ID } from '@/domain/reference'
import { useAstra } from '@/domain/store'
import { ENGAGEMENT, ENGAGEMENTS, PACK_BY_ID, SERVICE_PACKS, STAGE_BY_ID, notIngested, type Engagement } from '@/domain/engagement'
import { Card, Chip, Metric, Table, Tabs, Td, Th, Tr } from '@/ui/primitives'
import { cn } from '@/lib/format'
import { Band, More, limit, type ArtifactView, type CardProps } from './frame'

/* ==========================================================================
   Engagement and acceleration.

   Which engagements the platform holds and what has been loaded for each,
   then the stages an engagement passes through, and against each stage what
   the platform makes faster: whose time it gives back, how the work is done
   without it, what it shows today, and whether that figure is measured here
   or someone's claim.

   The platform is client-facing. A client role sees the stages of its own
   engagement; the supplier's bid stage is ours to look at, and only a
   supplier role can bring it into view.
   ========================================================================== */

type Tone = 'neutral' | 'ok' | 'warn' | 'crit' | 'info' | 'brand' | 'agent'

const BUILD_TONE: Record<BuildState, Tone> = { live: 'ok', partial: 'warn', not_built: 'neutral' }
const SAVES_TONE: Record<Saves, Tone> = { client: 'brand', provider: 'neutral', both: 'info' }
const BASIS_TONE: Record<Basis, Tone> = { measured: 'ok', projected: 'info', declared: 'warn', not_measured: 'neutral' }
const INGEST_LABEL: Record<string, string> = { contract: 'Contract', inventory: 'Inventory', tickets: 'Tickets', estate: 'Estate', telemetry: 'Telemetry' }

const who = (id: string) => (id === 'astra' ? 'Astra' : AGENT_BY_ID[id]?.name ?? id)

/** True for anyone on the client's side, including a service consumer. */
function useClientSide() {
  const roleId = useAstra((s) => s.roleId)
  return ROLE_BY_ID[roleId]?.org !== 'artizent'
}

function useSummary(audience: 'client' | 'all') {
  return React.useMemo(() => accelerationSummary(audience), [audience])
}

function AccelerationMetrics({ size }: CardProps) {
  const s = useSummary(useClientSide() ? 'client' : 'all')
  const page = size === 'page'
  return (
    <Band size={size} cols={6}>
      <Metric size="sm" label="Engagements" value={ENGAGEMENTS.length} hint={page ? `${ENGAGEMENTS.filter((e) => e.ingested.estate).length} with an estate ingested` : undefined} />
      {page && <Metric size="sm" label="Service packs" value={SERVICE_PACKS.length} hint="reused across clients" />}
      <Metric size="sm" label="Accelerators live" value={`${s.live}/${s.accelerators.length}`} deltaTone={s.live ? 'ok' : 'warn'} hint={page ? `${s.forClient} give the client time back` : undefined} />
      <Metric size="sm" label="Measured here" value={s.measured} hint={page ? 'the rest declared or projected' : undefined} />
      <Metric size="sm" label="Partial" value={s.partial} deltaTone={s.partial ? 'warn' : 'ok'} />
      <Metric size="sm" label="Not built" value={s.notBuilt} deltaTone={s.notBuilt ? 'crit' : 'ok'} hint={page ? `${s.stagesUncovered} stage${s.stagesUncovered === 1 ? '' : 's'} with nothing built` : undefined} />
    </Band>
  )
}

function EngagementsTable({ rows }: { rows: Engagement[] }) {
  return (
    <Table>
      <thead>
        <tr><Th>Client</Th><Th>Service lines</Th><Th>Packs behind them</Th><Th>Regime</Th><Th>Stage</Th><Th>Loaded</Th></tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const missing = notIngested(e)
          return (
            <Tr key={e.id} className={e.id === ENGAGEMENT.id ? 'bg-brand/[0.05]' : undefined}>
              <Td className="max-w-[200px] text-2xs text-ink">
                {e.client}
                <span className="block text-[10px] text-ink-3">{e.industry} · {e.regions} · {e.currency}</span>
              </Td>
              <Td className="max-w-[220px] text-2xs text-ink-2">{e.serviceLines.map((l) => l.name).join(', ')}</Td>
              <Td>
                <div className="flex max-w-[220px] flex-wrap gap-1">
                  {[...new Set(e.serviceLines.map((l) => l.packId))].map((id) => <Chip key={id}>{PACK_BY_ID[id]?.name ?? id}</Chip>)}
                </div>
              </Td>
              <Td className="text-2xs text-ink-2">
                {e.regime.name}
                <span className="block text-[10px] text-ink-3">{e.regime.responseDays} d response · {e.regime.clientNoticeHrs} h notice</span>
              </Td>
              <Td><Chip tone={e.id === ENGAGEMENT.id ? 'brand' : 'neutral'}>{STAGE_BY_ID[e.stage].name}</Chip></Td>
              <Td>
                <div className="flex max-w-[240px] flex-wrap gap-1">
                  {(Object.keys(e.ingested) as (keyof Engagement['ingested'])[]).map((k) => (
                    <Chip key={k} tone={e.ingested[k] ? 'ok' : 'neutral'}>{INGEST_LABEL[k]}</Chip>
                  ))}
                </div>
                {missing.length > 0 && <span className="mt-0.5 block text-[10px] text-ink-3">{e.note}</span>}
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function StageStrip({ rows }: { rows: StageReading[] }) {
  return (
    <div className="overflow-x-auto">
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(150px, 1fr))` }}>
        {rows.map((s, i) => (
          <li
            key={s.stage.id}
            className={cn(
              'rounded border p-2.5',
              s.live ? 'border-ok/40 bg-ok/[0.06]' : s.partial ? 'border-warn/45 bg-warn/[0.06]' : 'border-dashed border-line bg-sunken',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-line-strong text-[9px] font-semibold text-ink-2">{i + 1}</span>
              <span className="text-xs font-medium text-ink">{s.stage.name}</span>
              {ENGAGEMENT.stage === s.stage.id && <Chip tone="brand" className="ml-auto">Now</Chip>}
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-ink-3">{s.stage.question}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Chip tone={s.live ? 'ok' : 'neutral'}>{s.live} live</Chip>
              {s.partial > 0 && <Chip tone="warn">{s.partial} partial</Chip>}
              {s.notBuilt > 0 && <Chip>{s.notBuilt} to build</Chip>}
            </div>
            {s.headline && (
              <p className="tnum mt-2 border-t border-line pt-1.5 text-2xs text-ink">
                {s.headline.reading.value}
                <span className="block text-[10px] text-ink-3">{s.headline.name}</span>
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function AcceleratorsTable({ rows, full }: { rows: AcceleratorReading[]; full: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Stage</Th><Th>What the platform does</Th>{full && <Th>Agents</Th>}<Th>Whose time</Th>
          <Th>Without it</Th><Th>With it</Th><Th>Basis</Th><Th>State</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <Tr key={a.id} className={a.state === 'not_built' ? 'opacity-70' : undefined}>
            <Td className="text-2xs text-ink-2">{STAGE_BY_ID[a.stage].name}</Td>
            <Td className="max-w-[320px] text-2xs text-ink">
              {a.name}
              {full && <span className="block text-[10px] leading-snug text-ink-3">{a.does}</span>}
            </Td>
            {full && (
              <Td>
                <div className="flex max-w-[160px] flex-wrap gap-1">
                  {a.agents.map((id) => <Chip key={id} tone="agent">{who(id)}</Chip>)}
                </div>
              </Td>
            )}
            <Td><Chip tone={SAVES_TONE[a.saves]}>{SAVES_LABEL[a.saves]}</Chip></Td>
            <Td className="max-w-[170px] text-2xs text-ink-2">
              {a.baseline.value}
              {full && <span className="block text-[10px] text-ink-3">{a.baseline.source}</span>}
            </Td>
            <Td className="max-w-[190px] text-2xs text-ink">
              {a.reading.value}
              {full && <span className="block text-[10px] text-ink-3">{a.reading.note}</span>}
            </Td>
            <Td><Chip tone={BASIS_TONE[a.reading.basis]} className="whitespace-nowrap">{BASIS_LABEL[a.reading.basis]}</Chip></Td>
            <Td><Chip tone={BUILD_TONE[a.state]}>{BUILD_LABEL[a.state]}</Chip></Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function AccelerationBody({ props, size }: CardProps) {
  const clientSide = useClientSide()
  const [audience, setAudience] = React.useState<'client' | 'all'>('client')
  const s = useSummary(clientSide ? 'client' : audience)
  const full = size !== 'card'
  const stage = String(props.stage ?? '')
  const rows = stage ? s.accelerators.filter((a) => a.stage === stage) : s.accelerators

  if (size !== 'page') {
    if (String(props.focus ?? '') === 'engagements') return <EngagementsTable rows={ENGAGEMENTS} />
    const shown = limit(rows, size, 8)
    return <><AcceleratorsTable rows={shown} full={full} /><More shown={shown.length} total={rows.length} /></>
  }

  return (
    <>
      <Card title="Engagements" subtitle={`${ENGAGEMENTS.length} loaded · ${SERVICE_PACKS.length} service packs`} right={<Layers size={13} className="text-ink-3" />}>
        <EngagementsTable rows={ENGAGEMENTS} />
      </Card>

      <Card className="mt-4" title="Stages" subtitle={`${ENGAGEMENT.client} is in ${STAGE_BY_ID[ENGAGEMENT.stage].name}`} right={<Workflow size={13} className="text-ink-3" />}>
        <StageStrip rows={s.stages} />
      </Card>

      <Card
        className="mt-4"
        title="Acceleration"
        subtitle={`${s.accelerators.length} accelerators · ${s.measured} measured here · ${s.forClient} give the client time back`}
        right={<Gauge size={13} className="text-ink-3" />}
      >
        {!clientSide && (
          <Tabs
            className="mb-3"
            tabs={[{ id: 'client', label: 'The client’s engagement' }, { id: 'all', label: 'Including our own stages' }]}
            value={audience}
            onChange={setAudience}
          />
        )}
        <AcceleratorsTable rows={s.accelerators} full />
      </Card>
    </>
  )
}

export const accelerationView: ArtifactView = {
  Body: AccelerationBody,
  Metrics: AccelerationMetrics,
  page: {
    title: 'Engagement and acceleration',
    subtitle: 'Engagements loaded, the stages of an engagement, and what the platform makes faster in each',
    agents: ['agt_herald', 'agt_prospect'],
    what: 'reading each stage against the records the platform holds',
  },
}
